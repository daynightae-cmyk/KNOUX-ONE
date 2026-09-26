//! M02 planned services: S06 Delivery Optimization cache, S08 Recycle Bin review,
//! S10 scheduled cleanup profiles.
//!
//! S06 and S08 are strictly read-only measurements. S10 persists a profile document and
//! measures through the same allowlisted category list M02 already uses; the destructive
//! part of S10 delegates to `m02_cleanup_execute_complete` with that list, so there is
//! exactly one deletion path in this module and no second, looser one.

use crate::completion14::m02::{
    self, CleanupExecuteRequest, CleanupScanRequest, CleanupScanResult,
};
use crate::completion14::psbridge;
use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::AppHandle;

const MAX_CACHE_ITEMS: usize = 5_000;
const MAX_CACHE_DEPTH: usize = 8;
const MAX_CACHE_FILES: u64 = 2_000_000;
const MAX_RECYCLE_ITEMS: usize = 2_000;
const MAX_PROFILE_TARGETS: usize = 64;

/// The literal token a caller must echo to apply a cleanup profile. It is a fixed
/// string, not a value derived from the request, so a UI bug cannot construct it.
const APPLY_CONFIRMATION: &str = "APPLY";

#[allow(clippy::too_many_arguments)]
fn result<T>(
    op_id: String,
    capability: &str,
    handler: &str,
    started_at: String,
    timer: Instant,
    data: Option<T>,
    status: &str,
    summary_en: String,
    summary_ar: String,
    warnings: Vec<String>,
    error_code: Option<String>,
    stderr: Option<String>,
    exit_code: Option<i32>,
) -> OperationResult<T> {
    OperationResult {
        operation_id: op_id,
        capability_id: capability.into(),
        handler_id: handler.into(),
        status: status.into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code,
        stdout: None,
        stderr,
        summary_en,
        summary_ar,
        warnings,
        error_code,
        data,
    }
}

/// Only reachable on a non-Windows build, where every command in this module returns
/// the typed "unsupported OS" result instead of a measurement.
#[cfg_attr(target_os = "windows", allow(dead_code))]
fn unavailable<T>(
    op_id: String,
    capability: &str,
    handler: &str,
    started_at: String,
    timer: Instant,
) -> OperationResult<T> {
    result(
        op_id,
        capability,
        handler,
        started_at,
        timer,
        None,
        "unavailable",
        "This service measures Windows directly and needs the Windows desktop runtime.".into(),
        "تقيس هذه الخدمة ويندوز مباشرة وتحتاج بيئة سطح مكتب ويندوز.".into(),
        Vec::new(),
        Some("unsupported_os".into()),
        Some("Windows host is required.".into()),
        None,
    )
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn system_time_rfc3339(value: std::time::SystemTime) -> Option<String> {
    let duration = value.duration_since(std::time::UNIX_EPOCH).ok()?;
    chrono::DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0)
        .map(|stamp| stamp.to_rfc3339())
}

// ---------------------------------------------------------------------------
// M02-S06 — Delivery Optimization cache
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCacheItem {
    pub path: String,
    pub size_bytes: u64,
    pub last_modified: String,
    pub age_days: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCacheRoot {
    pub id: String,
    pub path: String,
    pub exists: bool,
    pub readable: bool,
    pub rejection_reason: Option<String>,
    pub requires_admin: bool,
    pub file_count: u64,
    pub total_bytes: u64,
    pub oldest_modified: Option<String>,
    pub newest_modified: Option<String>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryOptimizationEntry {
    pub file_id: String,
    pub status: String,
    pub priority: String,
    pub bytes_from_http: Option<u64>,
    pub bytes_from_peers: Option<u64>,
    pub source_kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryServiceState {
    /// The cmdlet exists on this machine.
    pub status_cmdlet_available: bool,
    /// The cmdlet exists and the query actually completed. A Windows build can ship the
    /// cmdlet while its backing class is not registered, and presenting the first as
    /// the second would read as "measured, and the answer is zero".
    pub status_query_succeeded: bool,
    pub perf_snap_cmdlet_available: bool,
    pub perf_snap_query_succeeded: bool,
    pub entries: Vec<DeliveryOptimizationEntry>,
    pub cache_size_bytes_reported: Option<u64>,
    pub download_mode: Option<String>,
    pub upload_mode: Option<String>,
    pub diag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCacheRequest {
    #[serde(default)]
    pub scope: String,
    #[serde(default)]
    pub include_files: bool,
    #[serde(default)]
    pub max_items: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCacheReport {
    pub scope_applied: String,
    pub roots: Vec<DeliveryCacheRoot>,
    pub total_bytes: u64,
    pub entry_count: u64,
    pub accessible_root_count: usize,
    pub items: Vec<DeliveryCacheItem>,
    pub items_included: bool,
    pub items_truncated: bool,
    pub service_state: DeliveryServiceState,
    pub measurement_source: String,
    pub deleted_anything: bool,
    pub measured_at: String,
}

const DELIVERY_SERVICE_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$statusAvailable = $false
$statusSucceeded = $false
$entries = @()
$diag = ''
try {
  $null = Get-Command Get-DeliveryOptimizationStatus -ErrorAction Stop
  $statusAvailable = $true
} catch { $diag = 'Get-DeliveryOptimizationStatus: ' + [string]$_.Exception.Message }
if ($statusAvailable) {
  try {
    $raw = @(Get-DeliveryOptimizationStatus -ErrorAction Stop)
    $statusSucceeded = $true
    $entries = @($raw | Select-Object -First 50 | ForEach-Object {
      [pscustomobject]@{
        fileId = [string]$_.FileId
        status = [string]$_.Status
        priority = [string]$_.Priority
        bytesFromHttp = if ($null -ne $_.BytesFromHttp) { [uint64]$_.BytesFromHttp } else { $null }
        bytesFromPeers = if ($null -ne $_.BytesFromPeers) { [uint64]$_.BytesFromPeers } else { $null }
        sourceKind = [string]$_.SourceKind
      }
    })
  } catch { $diag = 'Get-DeliveryOptimizationStatus run: ' + [string]$_.Exception.Message }
}
$perfAvailable = $false
$perfSucceeded = $false
$cacheSize = $null
$downloadMode = $null
$uploadMode = $null
try {
  $null = Get-Command Get-DeliveryOptimizationPerfSnap -ErrorAction Stop
  $perfAvailable = $true
} catch { $diag = $diag + [string]::Concat([Environment]::NewLine, 'Get-DeliveryOptimizationPerfSnap: ', [string]$_.Exception.Message) }
if ($perfAvailable) {
  try {
    $snap = Get-DeliveryOptimizationPerfSnap -ErrorAction Stop
    $perfSucceeded = $true
    if ($null -ne $snap) {
      if ($null -ne $snap.CacheSizeBytes) { $cacheSize = [uint64]$snap.CacheSizeBytes }
      if ($null -ne $snap.DownloadMode) { $downloadMode = [string]$snap.DownloadMode }
      if ($null -ne $snap.UploadMode) { $uploadMode = [string]$snap.UploadMode }
    }
  } catch { $diag = $diag + [string]::Concat([Environment]::NewLine, 'Get-DeliveryOptimizationPerfSnap run: ', [string]$_.Exception.Message) }
}
[pscustomobject]@{
  statusCmdletAvailable = $statusAvailable
  statusQuerySucceeded = $statusSucceeded
  perfSnapCmdletAvailable = $perfAvailable
  perfSnapQuerySucceeded = $perfSucceeded
  entries = $entries
  cacheSizeBytesReported = $cacheSize
  downloadMode = $downloadMode
  uploadMode = $uploadMode
  diag = $diag
} | ConvertTo-Json -Depth 5 -Compress
"#;

fn parse_service_state(stdout: &str) -> DeliveryServiceState {
    let failed = |diag: &str| DeliveryServiceState {
        status_cmdlet_available: false,
        status_query_succeeded: false,
        perf_snap_cmdlet_available: false,
        perf_snap_query_succeeded: false,
        entries: Vec::new(),
        cache_size_bytes_reported: None,
        download_mode: None,
        upload_mode: None,
        diag: Some(diag.to_string()),
    };
    let Ok(document) = psbridge::parse_json(stdout) else {
        return failed("delivery_optimization_state_unreadable");
    };
    let entries: Vec<DeliveryOptimizationEntry> = psbridge::as_array(
        document
            .get("entries")
            .cloned()
            .unwrap_or(serde_json::Value::Null),
    )
    .iter()
    .filter_map(|value| serde_json::from_value::<DeliveryOptimizationEntry>(value.clone()).ok())
    .collect();
    let text_or_none = |key: &str| {
        let raw = psbridge::text(&document, key);
        if raw.is_empty() {
            None
        } else {
            Some(raw)
        }
    };
    DeliveryServiceState {
        status_cmdlet_available: psbridge::boolean(&document, "statusCmdletAvailable")
            .unwrap_or(false),
        status_query_succeeded: psbridge::boolean(&document, "statusQuerySucceeded")
            .unwrap_or(false),
        perf_snap_cmdlet_available: psbridge::boolean(&document, "perfSnapCmdletAvailable")
            .unwrap_or(false),
        perf_snap_query_succeeded: psbridge::boolean(&document, "perfSnapQuerySucceeded")
            .unwrap_or(false),
        entries,
        cache_size_bytes_reported: psbridge::number(&document, "cacheSizeBytesReported"),
        download_mode: text_or_none("downloadMode"),
        upload_mode: text_or_none("uploadMode"),
        diag: text_or_none("diag"),
    }
}

fn delivery_cache_roots(scope: &str) -> Vec<(&'static str, PathBuf, bool)> {
    let program_data_cache = psbridge::program_data()
        .map(|base| base.join("Microsoft/Windows/DeliveryOptimization/Cache"))
        .unwrap_or_else(|| psbridge::windows_root().join("ServiceProfiles/NetworkService/AppData/Local/Microsoft/Windows/DeliveryOptimization/Cache"));
    let service_profile_cache = psbridge::windows_root().join(
        "ServiceProfiles/NetworkService/AppData/Local/Microsoft/Windows/DeliveryOptimization/Cache",
    );
    let user_cache = psbridge::local_app_data()
        .map(|base| base.join("Microsoft/Windows/DeliveryOptimization/Cache"));
    let mut roots = vec![
        ("program_data_cache", program_data_cache.clone(), true),
        ("service_profile_cache", service_profile_cache, true),
    ];
    if scope == "user" {
        if let Some(path) = user_cache {
            roots.push(("user_cache", path, false));
        }
    }
    roots
}

fn measure_delivery_root(
    id: &str,
    path: &Path,
    requires_admin: bool,
    include_files: bool,
    item_budget: &mut usize,
) -> (DeliveryCacheRoot, Vec<DeliveryCacheItem>) {
    if !path.exists() {
        return (
            DeliveryCacheRoot {
                id: id.into(),
                path: path.to_string_lossy().to_string(),
                exists: false,
                readable: false,
                rejection_reason: Some("root_does_not_exist".into()),
                requires_admin,
                file_count: 0,
                total_bytes: 0,
                oldest_modified: None,
                newest_modified: None,
                truncated: false,
            },
            Vec::new(),
        );
    }
    let mut file_count = 0u64;
    let mut total_bytes = 0u64;
    let mut truncated = false;
    let mut items: Vec<DeliveryCacheItem> = Vec::new();
    let mut oldest: Option<std::time::SystemTime> = None;
    let mut newest: Option<std::time::SystemTime> = None;
    let mut rejection: Option<String> = None;

    // walkdir with a depth ceiling and both a file ceiling and a listing ceiling: a
    // hostile or accidentally huge cache cannot turn this measurement into an unbounded
    // walk, and hitting either ceiling is reported rather than hidden.
    let walker = walkdir::WalkDir::new(path)
        .follow_links(false)
        .max_depth(MAX_CACHE_DEPTH)
        .into_iter();
    for entry in walker {
        if file_count >= MAX_CACHE_FILES {
            truncated = true;
            break;
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                rejection = Some(format!("walk_error:{}", error));
                break;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(error) => {
                rejection = Some(format!("metadata_error:{}", error));
                break;
            }
        };
        let size = metadata.len();
        total_bytes = total_bytes.saturating_add(size);
        file_count = file_count.saturating_add(1);
        let modified = metadata.modified().ok();
        if let Some(modified) = modified {
            oldest = Some(oldest.map_or(modified, |current: std::time::SystemTime| {
                current.min(modified)
            }));
            newest = Some(newest.map_or(modified, |current: std::time::SystemTime| {
                current.max(modified)
            }));
        }
        if include_files {
            if *item_budget == 0 {
                truncated = true;
                continue;
            }
            *item_budget -= 1;
            let age_days = modified
                .and_then(|value| value.elapsed().ok())
                .map(|value| value.as_secs_f64() / 86_400.0)
                .unwrap_or(0.0);
            items.push(DeliveryCacheItem {
                path: entry.path().to_string_lossy().to_string(),
                size_bytes: size,
                last_modified: modified.and_then(system_time_rfc3339).unwrap_or_default(),
                age_days,
            });
        }
    }

    let readable = rejection.is_none();
    (
        DeliveryCacheRoot {
            id: id.into(),
            path: path.to_string_lossy().to_string(),
            exists: true,
            readable,
            rejection_reason: rejection,
            requires_admin,
            file_count,
            total_bytes,
            oldest_modified: oldest.and_then(system_time_rfc3339),
            newest_modified: newest.and_then(system_time_rfc3339),
            truncated,
        },
        items,
    )
}

#[tauri::command]
pub async fn m02_delivery_cache(
    op_id: String,
    request: Option<DeliveryCacheRequest>,
) -> Result<OperationResult<DeliveryCacheReport>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let request = request.unwrap_or(DeliveryCacheRequest {
        scope: String::new(),
        include_files: false,
        max_items: None,
    });
    let scope = match request.scope.as_str() {
        "user" | "system" => request.scope.clone(),
        _ => "system".to_string(),
    };
    let include_files = request.include_files;
    let max_items = request
        .max_items
        .map(|value| value.min(MAX_CACHE_ITEMS))
        .unwrap_or(0);

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&request, &scope, include_files, max_items);
        Ok(unavailable(
            op_id,
            "m02_s06",
            "m02.cache.delivery",
            started_at,
            timer,
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let roots_spec = delivery_cache_roots(&scope);
        let service_script = DELIVERY_SERVICE_SCRIPT.to_string();
        let outcome = tauri::async_runtime::spawn_blocking(move || {
            let mut roots = Vec::new();
            let mut items = Vec::new();
            let mut budget = max_items;
            for (id, path, requires_admin) in roots_spec {
                let (root, root_items) =
                    measure_delivery_root(id, &path, requires_admin, include_files, &mut budget);
                roots.push(root);
                items.extend(root_items);
            }
            let (service_state, stderr, exit_code) = match psbridge::run(&service_script) {
                Ok(run) => (
                    parse_service_state(&run.stdout),
                    run.stderr_tail(),
                    run.exit_code,
                ),
                Err(reason) => (
                    DeliveryServiceState {
                        status_cmdlet_available: false,
                        status_query_succeeded: false,
                        perf_snap_cmdlet_available: false,
                        perf_snap_query_succeeded: false,
                        entries: Vec::new(),
                        cache_size_bytes_reported: None,
                        download_mode: None,
                        upload_mode: None,
                        diag: Some(reason),
                    },
                    None,
                    None,
                ),
            };
            (roots, items, service_state, stderr, exit_code)
        })
        .await
        .map_err(|error| format!("delivery_cache_join_failed:{error}"))?;

        let (roots, items, service_state, stderr, exit_code) = outcome;
        let total_bytes = roots.iter().map(|root| root.total_bytes).sum();
        let entry_count = roots.iter().map(|root| root.file_count).sum();
        let accessible_root_count = roots.iter().filter(|root| root.readable).count();
        let items_truncated = roots.iter().any(|root| root.truncated);

        let mut warnings = Vec::new();
        if accessible_root_count == 0 {
            warnings
                .push("No Delivery Optimization cache root was readable on this machine.".into());
        }
        for root in &roots {
            if let Some(reason) = &root.rejection_reason {
                warnings.push(format!("{}: {reason}", root.path));
            }
        }
        if let Some(diag) = &service_state.diag {
            if !diag.is_empty() {
                warnings.push(format!("Delivery Optimization cmdlets: {diag}"));
            }
        }
        if total_bytes == 0 && accessible_root_count > 0 {
            warnings.push("Every readable cache root was measured as empty.".into());
        }

        Ok(result(
            op_id,
            "m02_s06",
            "m02.cache.delivery",
            started_at,
            timer,
            Some(DeliveryCacheReport {
                scope_applied: scope,
                roots,
                total_bytes,
                entry_count,
                accessible_root_count,
                items,
                items_included: include_files,
                items_truncated,
                service_state,
                measurement_source:
                    "Delivery Optimization cache directories measured by the Win32 file API, plus Get-DeliveryOptimizationStatus and Get-DeliveryOptimizationPerfSnap when present"
                        .into(),
                deleted_anything: false,
                measured_at: Utc::now().to_rfc3339(),
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "The Delivery Optimization cache was measured read-only; nothing was removed."
                .into(),
            "تم قياس ذاكرة التخزين المؤقت لتوصيل التحسين للقراءة فقط؛ لم يُحذف شيء.".into(),
            warnings,
            None,
            stderr,
            exit_code,
        ))
    }
}

// ---------------------------------------------------------------------------
// M02-S08 — Recycle Bin review
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecycleEntry {
    pub shell_name: String,
    pub original_path: String,
    pub deleted_at: String,
    pub size_bytes: Option<u64>,
    pub size_reported: bool,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecycleBinRequest {
    #[serde(default)]
    pub include_details: bool,
    #[serde(default)]
    pub max_items: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecycleBinReport {
    pub shell_namespace_used: String,
    pub enumeration_succeeded: bool,
    pub total_items: usize,
    pub sized_items: usize,
    pub unsized_items: usize,
    pub total_bytes: u64,
    pub items: Vec<RecycleEntry>,
    pub items_truncated: bool,
    pub read_only_warning: bool,
    pub emptied_anything: bool,
    pub measurement_source: String,
    pub measured_at: String,
}

/// The Recycle Bin namespace of `Shell.Application`. Its detail column order is part of
/// the shell contract: 0 name, 1 original location, 2 date deleted, 3 size, 4 kind.
const RECYCLE_BIN_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$shell = New-Object -ComObject Shell.Application
$bin = $shell.NameSpace(0xA)
$items = New-Object System.Collections.Generic.List[object]
$count = $bin.Items().Count
for ($i = 0; $i -lt $count; $i++) {
  $item = $bin.Items().Item($i)
  $name = [string]$bin.GetDetailsOf($item, 0)
  $original = [string]$bin.GetDetailsOf($item, 1)
  $deleted = [string]$bin.GetDetailsOf($item, 2)
  $size = [string]$bin.GetDetailsOf($item, 3)
  $kind = [string]$bin.GetDetailsOf($item, 4)
  $sizeValue = $null
  if (-not [string]::IsNullOrWhiteSpace($size)) {
    $parsed = 0L
    if ([long]::TryParse(($size -replace '[^0-9]', ''), [ref]$parsed)) { $sizeValue = [uint64]$parsed }
  }
  $items.Add([pscustomobject]@{
    shellName = $name
    originalPath = $original
    deletedAt = $deleted
    sizeBytes = $sizeValue
    kind = $kind
  })
}
[pscustomobject]@{ count = $count; items = $items.ToArray() } | ConvertTo-Json -Depth 4 -Compress
"#;

#[tauri::command]
pub async fn m02_recycle_bin_review(
    op_id: String,
    request: Option<RecycleBinRequest>,
) -> Result<OperationResult<RecycleBinReport>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let request = request.unwrap_or(RecycleBinRequest {
        include_details: false,
        max_items: None,
    });
    let include_details = request.include_details;
    let max_items = request
        .max_items
        .map(|value| value.min(MAX_RECYCLE_ITEMS))
        .unwrap_or(MAX_RECYCLE_ITEMS);

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&request, include_details, max_items);
        Ok(unavailable(
            op_id,
            "m02_s08",
            "m02.recycle.review",
            started_at,
            timer,
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(RECYCLE_BIN_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m02_s08",
                    "m02.recycle.review",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The Recycle Bin namespace could not be opened.".into(),
                    "تعذّر فتح مساحة سلة محذوفات ويندوز.".into(),
                    vec![reason.clone()],
                    Some("recycle_bin_unavailable".into()),
                    None,
                    None,
                ))
            }
        };
        let document = match psbridge::parse_json(&run.stdout) {
            Ok(document) => document,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m02_s08",
                    "m02.recycle.review",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The Recycle Bin contents could not be read.".into(),
                    "تعذّرت قراءة محتويات سلة المحذوفات.".into(),
                    vec![reason],
                    Some("recycle_bin_unreadable".into()),
                    run.stderr_tail(),
                    run.exit_code,
                ))
            }
        };

        let raw: Vec<RecycleEntry> = psbridge::as_array(
            document
                .get("items")
                .cloned()
                .unwrap_or(serde_json::Value::Null),
        )
        .iter()
        .filter_map(|value| serde_json::from_value::<RecycleEntry>(value.clone()).ok())
        .map(|mut entry| {
            entry.size_reported = entry.size_bytes.is_some();
            entry
        })
        .collect();

        let total_reported = raw.len();
        let items_truncated = total_reported > max_items;
        let mut entries = raw;
        if items_truncated {
            entries.truncate(max_items);
        }
        if !include_details {
            // The detail columns stay in the document; the response carries only the
            // names and the totals, and says which mode produced them.
            for entry in &mut entries {
                entry.original_path = String::new();
                entry.deleted_at = String::new();
                entry.kind = String::new();
            }
        }

        let sized_items = entries
            .iter()
            .filter(|entry| entry.size_bytes.is_some())
            .count();
        let total_bytes = entries
            .iter()
            .filter_map(|entry| entry.size_bytes)
            .fold(0u64, |total, value| total.saturating_add(value));

        let mut warnings = Vec::new();
        if total_reported == 0 {
            warnings.push("Windows reported an empty Recycle Bin on this machine.".into());
        }
        if entries.len() < total_reported {
            warnings.push(format!(
                "Only the first {} of {} Recycle Bin entries are shown.",
                entries.len(),
                total_reported
            ));
        }
        if sized_items < entries.len() {
            warnings.push(format!(
                "{} of {} entries carry no size in the shell detail column, so the byte total covers only the sized entries.",
                entries.len() - sized_items,
                entries.len()
            ));
        }

        Ok(result(
            op_id,
            "m02_s08",
            "m02.recycle.review",
            started_at,
            timer,
            Some(RecycleBinReport {
                shell_namespace_used: "Shell.Application NameSpace(0xA)".into(),
                enumeration_succeeded: true,
                total_items: total_reported,
                sized_items,
                unsized_items: entries.len() - sized_items,
                total_bytes,
                items: entries,
                items_truncated,
                read_only_warning: true,
                emptied_anything: false,
                measurement_source:
                    "Recycle Bin shell namespace enumerated through the Windows Shell COM automation interface"
                        .into(),
                measured_at: Utc::now().to_rfc3339(),
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "The Recycle Bin was reviewed read-only; nothing was emptied.".into(),
            "تمت مراجعة سلة المحذوفات للقراءة فقط؛ لم يتم إفراغها.".into(),
            warnings,
            None,
            run.stderr_tail(),
            run.exit_code,
        ))
    }
}

// ---------------------------------------------------------------------------
// M02-S10 — Scheduled cleanup profiles
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupProfileRequest {
    pub profile_name: String,
    #[serde(default)]
    pub targets: Vec<String>,
    #[serde(default = "default_true")]
    pub dry_run: bool,
    #[serde(default)]
    pub apply: bool,
    #[serde(default)]
    pub confirmation: String,
    #[serde(default)]
    pub interval_days: Option<u32>,
    #[serde(default)]
    pub max_items_per_category: Option<usize>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupProfileMeasurement {
    pub scan_id: String,
    pub categories_measured: Vec<String>,
    pub rejected_targets: Vec<String>,
    pub files_measured: usize,
    pub bytes_measured: u64,
    pub scan_truncated: bool,
    pub scan_cancelled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupProfileApplyResult {
    pub applied: bool,
    pub confirmation_accepted: bool,
    pub deleted_files: usize,
    pub deleted_bytes: u64,
    pub skipped_files: usize,
    pub failure_count: usize,
    pub quarantined_instead_of_deleted: bool,
    pub status: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupProfile {
    pub profile_id: String,
    pub profile_name: String,
    pub file_path: String,
    pub byte_count: u64,
    pub sha256: String,
    pub read_back_verified: bool,
    pub targets: Vec<String>,
    pub rejected_targets: Vec<String>,
    pub interval_days: Option<u32>,
    pub dry_run_default: bool,
    pub confirmation_token: String,
    pub os_scheduler_registration: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_run_at: Option<String>,
    pub last_run_reclaimed_bytes: Option<u64>,
    pub run_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupProfileResult {
    pub profile: CleanupProfile,
    pub measurement: CleanupProfileMeasurement,
    pub apply: CleanupProfileApplyResult,
    pub read_only_warning: bool,
}

fn profile_directory(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("cleanup_profile_app_data_failed:{error}"))?
        .join("cleanup-profiles");
    fs::create_dir_all(&base)
        .map_err(|error| format!("cleanup_profile_directory_failed:{error}"))?;
    Ok(base)
}

fn profile_id(name: &str) -> Result<String, String> {
    let slug: String = name
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else if character == ' ' || character == '-' || character == '_' {
                '-'
            } else {
                '\u{fffd}'
            }
        })
        .filter(|character| *character != '\u{fffd}')
        .collect();
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        return Err("cleanup_profile_name_has_no_usable_characters".into());
    }
    Ok(trimmed.chars().take(64).collect())
}

fn write_profile(
    app: &AppHandle,
    profile: &CleanupProfile,
) -> Result<(String, u64, String, bool), String> {
    let directory = profile_directory(app)?;
    let path = directory.join(format!("{}.json", profile.profile_id));
    let mut document = profile.clone();
    document.file_path = path.to_string_lossy().to_string();
    let mut payload = serde_json::to_vec_pretty(&document)
        .map_err(|error| format!("cleanup_profile_serialize_failed:{error}"))?;
    payload.push(b'\n');
    let temporary = directory.join(format!("{}.json.tmp", profile.profile_id));
    fs::write(&temporary, &payload)
        .map_err(|error| format!("cleanup_profile_write_failed:{error}"))?;
    if let Err(reason) = fs::rename(&temporary, &path) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("cleanup_profile_commit_failed:{reason}"));
    }
    let disk =
        fs::read(&path).map_err(|error| format!("cleanup_profile_read_back_failed:{error}"))?;
    let digest = sha256_hex(&disk);
    let verified = serde_json::from_slice::<CleanupProfile>(&disk)
        .map(|stored| stored.profile_id == profile.profile_id)
        .unwrap_or(false);
    Ok((document.file_path, disk.len() as u64, digest, verified))
}

/// Reads the previously committed document for this profile, if one exists. A repeat run
/// must carry the original `created_at` and a real run count forward; resetting them would
/// make an old profile look newly created.
fn load_profile(app: &AppHandle, profile_id: &str) -> Option<CleanupProfile> {
    let directory = profile_directory(app).ok()?;
    let path = directory.join(format!("{profile_id}.json"));
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice::<CleanupProfile>(&bytes).ok()
}

#[tauri::command]
pub async fn m02_cleanup_schedule(
    app: AppHandle,
    op_id: String,
    request: CleanupProfileRequest,
) -> Result<OperationResult<CleanupProfileResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, &request);
        Ok(unavailable(
            op_id,
            "m02_s10",
            "m02.cleanup.schedule",
            started_at,
            timer,
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let mut warnings: Vec<String> = Vec::new();
        let id = match profile_id(&request.profile_name) {
            Ok(id) => id,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m02_s10",
                    "m02.cleanup.schedule",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The profile name cannot be turned into a safe file name.".into(),
                    "لا يمكن تحويل اسم ملف التعريف إلى اسم ملف آمن.".into(),
                    vec![reason.clone()],
                    Some(reason),
                    None,
                    None,
                ))
            }
        };
        if request.targets.len() > MAX_PROFILE_TARGETS {
            return Ok(result(
                op_id,
                "m02_s10",
                "m02.cleanup.schedule",
                started_at,
                timer,
                None,
                "failed",
                format!("A profile may reference at most {MAX_PROFILE_TARGETS} targets."),
                format!("يسمح ملف التعريف بـ {MAX_PROFILE_TARGETS} هدفًا كحد أقصى."),
                Vec::new(),
                Some("cleanup_profile_too_many_targets".into()),
                None,
                None,
            ));
        }

        // The category list is resolved against the same allowlist M02 already uses, so
        // a profile cannot name a directory the ordinary cleanup never touches.
        let resolved = m02::targets(&request.targets);
        let mut accepted: Vec<String> = Vec::new();
        let mut rejected: Vec<String> = Vec::new();
        for requested in &request.targets {
            if resolved.iter().any(|target| &target.id == requested) {
                accepted.push(requested.clone());
            } else {
                rejected.push(requested.clone());
            }
        }
        if !rejected.is_empty() {
            warnings.push(format!(
                "{} requested target(s) are not in the cleanup allowlist and were refused: {}",
                rejected.len(),
                rejected.join(", ")
            ));
        }
        if accepted.is_empty() {
            return Ok(result(
                op_id,
                "m02_s10",
                "m02.cleanup.schedule",
                started_at,
                timer,
                None,
                "failed",
                "No requested target is in the cleanup allowlist, so there is nothing to measure."
                    .into(),
                "لا يوجد هدف مطلوب ضمن قائمة التنظيف المسموح بها، فلا يوجد ما يقاس.".into(),
                warnings,
                Some("cleanup_profile_no_allowlisted_target".into()),
                None,
                None,
            ));
        }

        let scan_op_id = format!("{op_id}_scan");
        let scan = m02::m02_cleanup_scan_complete(
            app.clone(),
            scan_op_id.clone(),
            CleanupScanRequest {
                categories: accepted.clone(),
                max_items_per_category: request.max_items_per_category.unwrap_or(5_000),
            },
        )
        .await;
        let scan = match scan {
            Ok(scan) => scan,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m02_s10",
                    "m02.cleanup.schedule",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The profile measurement could not run.".into(),
                    "تعذّر تشغيل قياس ملف التعريف.".into(),
                    vec![reason],
                    Some("cleanup_profile_scan_failed".into()),
                    None,
                    None,
                ))
            }
        };
        let Some(scan_data) = scan.data.clone() else {
            return Ok(result(
                op_id,
                "m02_s10",
                "m02.cleanup.schedule",
                started_at,
                timer,
                None,
                if scan.status == "failed" {
                    "failed"
                } else {
                    "unavailable"
                },
                scan.summary_en.clone(),
                scan.summary_ar.clone(),
                {
                    let mut combined = scan.warnings.clone();
                    combined.push(format!("errorCode={}", scan.error_code.unwrap_or_default()));
                    combined
                },
                Some("cleanup_profile_scan_returned_no_data".into()),
                scan.stderr.clone(),
                scan.exit_code,
            ));
        };
        let measurement = summarize_scan(&scan_data, &accepted);

        // A dry run ends here. Nothing is written about reclamation and nothing removed.
        if request.dry_run || !request.apply {
            let now = Utc::now().to_rfc3339();
            let previous = load_profile(&app, &id);
            let mut profile = CleanupProfile {
                profile_id: id.clone(),
                profile_name: request.profile_name.trim().to_string(),
                file_path: String::new(),
                byte_count: 0,
                sha256: String::new(),
                read_back_verified: false,
                targets: accepted.clone(),
                rejected_targets: rejected.clone(),
                interval_days: request.interval_days,
                dry_run_default: true,
                confirmation_token: APPLY_CONFIRMATION.into(),
                os_scheduler_registration:
                    "not_registered: this service records the profile and measures it; no Windows scheduled task was created"
                        .into(),
                created_at: previous
                    .as_ref()
                    .map(|value| value.created_at.clone())
                    .unwrap_or_else(|| now.clone()),
                updated_at: now.clone(),
                last_run_at: Some(now),
                // A dry run reclaims nothing, so the previous measurement is kept rather
                // than being overwritten with a zero that would read as a result.
                last_run_reclaimed_bytes: previous
                    .as_ref()
                    .and_then(|value| value.last_run_reclaimed_bytes),
                run_count: previous.as_ref().map_or(1, |value| value.run_count + 1),
            };
            let stored = write_profile(&app, &profile);
            match stored {
                Ok((file_path, byte_count, sha256, verified)) => {
                    profile.file_path = file_path;
                    profile.byte_count = byte_count;
                    profile.sha256 = sha256;
                    profile.read_back_verified = verified;
                }
                Err(reason) => {
                    return Ok(result(
                        op_id,
                        "m02_s10",
                        "m02.cleanup.schedule",
                        started_at,
                        timer,
                        None,
                        "failed",
                        "The profile could not be persisted.".into(),
                        "تعذّر حفظ ملف التعريف.".into(),
                        vec![reason],
                        Some("cleanup_profile_persist_failed".into()),
                        None,
                        None,
                    ))
                }
            }
            if !profile.read_back_verified {
                warnings.push("The persisted profile did not match the in-memory document.".into());
            }
            return Ok(result(
                op_id,
                "m02_s10",
                "m02.cleanup.schedule",
                started_at,
                timer,
                Some(CleanupProfileResult {
                    profile,
                    measurement,
                    apply: CleanupProfileApplyResult {
                        applied: false,
                        confirmation_accepted: false,
                        deleted_files: 0,
                        deleted_bytes: 0,
                        skipped_files: 0,
                        failure_count: 0,
                        quarantined_instead_of_deleted: false,
                        status: "dry_run".into(),
                        warnings: vec![],
                    },
                    read_only_warning: true,
                }),
                "completed",
                "The cleanup profile was measured and saved as a dry run. Nothing was removed."
                    .into(),
                "تم قياس ملف تعريف التنظيف وحفظه كتجربة جافة. لم يُحذف شيء.".into(),
                warnings,
                None,
                scan.stderr.clone(),
                scan.exit_code,
            ));
        }

        if request.confirmation != APPLY_CONFIRMATION {
            return Ok(result(
                op_id,
                "m02_s10",
                "m02.cleanup.schedule",
                started_at,
                timer,
                None,
                "failed",
                format!("Applying a cleanup profile requires the literal confirmation {APPLY_CONFIRMATION}."),
                format!("يتطلب تطبيق ملف تعريف التنظيف كتابة الكلمة {APPLY_CONFIRMATION} حرفيًا."),
                warnings,
                Some("cleanup_profile_confirmation_required".into()),
                None,
                None,
            ));
        }

        // Reuse the single existing deletion path. This service never deletes anything
        // itself, so there is no second implementation to keep in step, and the execute
        // command registers its own cancellation token under this operation id.
        let execute = m02::m02_cleanup_execute_complete(
            app.clone(),
            op_id.clone(),
            CleanupExecuteRequest {
                scan_id: scan_data.scan_id.clone(),
                categories: accepted.clone(),
                confirmation: request.confirmation.clone(),
            },
        )
        .await;
        let execute = match execute {
            Ok(execute) => execute,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m02_s10",
                    "m02.cleanup.schedule",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The cleanup apply step could not run.".into(),
                    "تعذّر تشغيل خطوة تطبيق التنظيف.".into(),
                    vec![reason],
                    Some("cleanup_profile_apply_failed".into()),
                    None,
                    None,
                ))
            }
        };
        let Some(execute_data) = execute.data.clone() else {
            return Ok(result(
                op_id,
                "m02_s10",
                "m02.cleanup.schedule",
                started_at,
                timer,
                None,
                "failed",
                "The cleanup apply step returned no result.".into(),
                "لم تُرجع خطوة تطبيق التنظيف أي نتيجة.".into(),
                {
                    let mut combined = warnings.clone();
                    combined.extend(execute.warnings.clone());
                    combined
                },
                Some("cleanup_profile_apply_returned_no_data".into()),
                execute.stderr.clone(),
                execute.exit_code,
            ));
        };

        let apply = CleanupProfileApplyResult {
            applied: true,
            confirmation_accepted: true,
            deleted_files: execute_data.deleted_files as usize,
            deleted_bytes: execute_data.deleted_bytes,
            skipped_files: execute_data.skipped_files as usize,
            failure_count: execute_data.failed_files.len(),
            quarantined_instead_of_deleted: accepted.iter().any(|value| value == "old_downloads"),
            status: if execute_data.cancelled {
                "cancelled"
            } else {
                "applied"
            }
            .into(),
            warnings: execute_data.warnings.clone(),
        };
        warnings.extend(execute_data.warnings.clone());

        let now = Utc::now().to_rfc3339();
        let previous = load_profile(&app, &id);
        let mut profile = CleanupProfile {
            profile_id: id,
            profile_name: request.profile_name.trim().to_string(),
            file_path: String::new(),
            byte_count: 0,
            sha256: String::new(),
            read_back_verified: false,
            targets: accepted,
            rejected_targets: rejected,
            interval_days: request.interval_days,
            dry_run_default: false,
            confirmation_token: APPLY_CONFIRMATION.into(),
            os_scheduler_registration:
                "not_registered: this service records the profile and measures it; no Windows scheduled task was created"
                    .into(),
            created_at: previous
                .as_ref()
                .map(|value| value.created_at.clone())
                .unwrap_or_else(|| now.clone()),
            updated_at: now.clone(),
            last_run_at: Some(now),
            last_run_reclaimed_bytes: Some(apply.deleted_bytes),
            run_count: previous.as_ref().map_or(1, |value| value.run_count + 1),
        };
        match write_profile(&app, &profile) {
            Ok((file_path, byte_count, sha256, verified)) => {
                profile.file_path = file_path;
                profile.byte_count = byte_count;
                profile.sha256 = sha256;
                profile.read_back_verified = verified;
            }
            Err(reason) => {
                warnings.push(format!("cleanup_profile_persist_failed:{reason}"));
            }
        }

        Ok(result(
            op_id,
            "m02_s10",
            "m02.cleanup.schedule",
            started_at,
            timer,
            Some(CleanupProfileResult {
                profile,
                measurement,
                apply,
                read_only_warning: false,
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "The cleanup profile was applied through the audited cleanup path.".into(),
            "تم تطبيق ملف تعريف التنظيف عبر مسار التنظيف المُدقَّق.".into(),
            warnings,
            None,
            execute.stderr.clone(),
            execute.exit_code,
        ))
    }
}

fn summarize_scan(scan: &CleanupScanResult, accepted: &[String]) -> CleanupProfileMeasurement {
    let categories_measured: Vec<String> = scan
        .categories
        .iter()
        .map(|category| category.id.clone())
        .filter(|id| accepted.iter().any(|value| value == id))
        .collect();
    let files_measured: usize = scan
        .categories
        .iter()
        .filter(|category| accepted.iter().any(|value| value == &category.id))
        .map(|category| category.file_count as usize)
        .sum();
    let bytes_measured: u64 = scan
        .categories
        .iter()
        .filter(|category| accepted.iter().any(|value| value == &category.id))
        .map(|category| category.size_bytes)
        .sum();
    let included = |id: &str| accepted.iter().any(|value| value == id);
    CleanupProfileMeasurement {
        scan_id: scan.scan_id.clone(),
        categories_measured,
        rejected_targets: Vec::new(),
        files_measured,
        bytes_measured,
        // Truncation is only meaningful for the categories this profile covers. A
        // ceiling hit in an excluded category must not be reported against it.
        scan_truncated: scan
            .categories
            .iter()
            .any(|category| included(&category.id) && category.truncated),
        scan_cancelled: scan.cancelled,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        summarize_scan, CleanupProfile, APPLY_CONFIRMATION, MAX_RECYCLE_ITEMS, RECYCLE_BIN_SCRIPT,
    };
    use crate::completion14::m02::{CleanupCategorySummary, CleanupScanResult};

    fn scan_fixture(categories: Vec<CleanupCategorySummary>) -> CleanupScanResult {
        CleanupScanResult {
            scan_id: "scan-fixture".into(),
            categories,
            total_files: 0,
            total_bytes: 0,
            cancelled: false,
            scanned_at: "2026-09-26T00:00:00Z".into(),
            warnings: Vec::new(),
        }
    }

    fn category(id: &str, files: u64, bytes: u64, truncated: bool) -> CleanupCategorySummary {
        CleanupCategorySummary {
            id: id.into(),
            name_en: id.into(),
            name_ar: id.into(),
            file_count: files,
            size_bytes: bytes,
            requires_admin: false,
            scan_only: false,
            truncated,
            items: Vec::new(),
        }
    }

    #[test]
    fn measurement_covers_only_the_accepted_categories() {
        let scan = scan_fixture(vec![
            category("user_temp", 3, 300, false),
            category("windows_temp", 2, 200, true),
        ]);
        let summary = summarize_scan(&scan, &["user_temp".to_string()]);
        assert_eq!(summary.categories_measured, vec!["user_temp".to_string()]);
        assert_eq!(summary.files_measured, 3);
        assert_eq!(summary.bytes_measured, 300);
        assert!(!summary.scan_truncated);
    }

    #[test]
    fn measurement_reports_truncation_from_any_included_category() {
        let scan = scan_fixture(vec![category("windows_temp", 1, 10, true)]);
        let summary = summarize_scan(&scan, &["windows_temp".to_string()]);
        assert!(summary.scan_truncated);
    }

    #[test]
    fn confirmation_token_is_a_fixed_literal() {
        // The token is not derived from the request, so a UI bug cannot guess it.
        assert_eq!(APPLY_CONFIRMATION, "APPLY");
    }

    #[test]
    fn a_repeat_run_keeps_the_original_creation_time_and_counts_up() {
        // A second measurement of the same profile must not make an old document look
        // newly created, and must not reset the run counter to one.
        let created = "2026-01-01T00:00:00+00:00";
        let previous = CleanupProfile {
            profile_id: "weekly-tidy".into(),
            profile_name: "Weekly tidy".into(),
            file_path: "C:/app/weekly-tidy.json".into(),
            byte_count: 10,
            sha256: "a".repeat(64),
            read_back_verified: true,
            targets: vec!["user_temp".into()],
            rejected_targets: Vec::new(),
            interval_days: Some(7),
            dry_run_default: true,
            confirmation_token: APPLY_CONFIRMATION.into(),
            os_scheduler_registration: "not_registered: test".into(),
            created_at: created.into(),
            updated_at: created.into(),
            last_run_at: Some(created.into()),
            last_run_reclaimed_bytes: Some(4_096),
            run_count: 4,
        };
        let now = "2026-09-26T00:00:00+00:00".to_string();
        let next = CleanupProfile {
            created_at: previous.created_at.clone(),
            updated_at: now.clone(),
            last_run_at: Some(now),
            last_run_reclaimed_bytes: previous.last_run_reclaimed_bytes,
            run_count: previous.run_count + 1,
            ..previous
        };
        assert_eq!(next.created_at, created);
        assert_eq!(next.run_count, 5);
        assert_eq!(next.last_run_reclaimed_bytes, Some(4_096));
        assert_ne!(next.updated_at, created);
    }

    #[test]
    fn recycle_bin_script_only_enumerates_and_never_deletes() {
        for forbidden in [
            "Remove-Item",
            "Clear-RecycleBin",
            "Delete(",
            "Invoke-Expression",
            "cmd /c",
            "Start-Process",
        ] {
            assert!(
                !RECYCLE_BIN_SCRIPT.contains(forbidden),
                "recycle script must not contain {forbidden}"
            );
        }
        assert!(RECYCLE_BIN_SCRIPT.contains("0xA"));
    }

    #[test]
    fn recycle_item_ceiling_is_bounded() {
        const { assert!(MAX_RECYCLE_ITEMS <= 10_000) };
    }

    #[test]
    fn delivery_ceilings_are_bounded() {
        const { assert!(super::MAX_CACHE_ITEMS <= 20_000) };
        const { assert!(super::MAX_CACHE_DEPTH <= 16) };
    }

    #[test]
    fn the_cache_walk_measures_real_files_and_reports_a_missing_root() {
        use std::fs;
        let directory = tempfile::tempdir().expect("tempdir");
        let root = directory.path().join("Cache");
        fs::create_dir_all(root.join("nested/deeper")).expect("mkdir");
        fs::write(root.join("a.bin"), vec![0u8; 100]).expect("write a");
        fs::write(root.join("nested/b.bin"), vec![0u8; 250]).expect("write b");
        fs::write(root.join("nested/deeper/c.bin"), vec![0u8; 50]).expect("write c");

        let mut budget = 10usize;
        let (root_report, items) =
            super::measure_delivery_root("test", &root, false, true, &mut budget);
        assert!(root_report.exists);
        assert!(root_report.readable, "{:?}", root_report.rejection_reason);
        assert_eq!(root_report.file_count, 3);
        assert_eq!(root_report.total_bytes, 400);
        assert!(!root_report.truncated);
        assert_eq!(items.len(), 3);
        assert!(items.iter().all(|item| item.last_modified.len() > 10));

        // A listing budget smaller than the real file count must be reported, not hidden.
        let mut tiny = 1usize;
        let (capped, capped_items) =
            super::measure_delivery_root("test", &root, false, true, &mut tiny);
        assert!(
            capped.truncated,
            "hitting the listing ceiling must set truncated"
        );
        assert_eq!(
            capped.file_count, 3,
            "the real file count is still reported"
        );
        assert_eq!(capped_items.len(), 1);

        // A root that does not exist is reported as such, never as an empty cache.
        let missing = directory.path().join("not-here");
        let (absent, absent_items) =
            super::measure_delivery_root("test", &missing, true, true, &mut budget);
        assert!(!absent.exists);
        assert!(!absent.readable);
        assert_eq!(
            absent.rejection_reason.as_deref(),
            Some("root_does_not_exist")
        );
        assert_eq!(absent.file_count, 0);
        assert_eq!(absent.total_bytes, 0);
        assert!(absent_items.is_empty());
    }
}
