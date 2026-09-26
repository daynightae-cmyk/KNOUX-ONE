//! M01 planned services: S03 Winget repair guidance, S04 essential software catalog,
//! S07 installed application inventory export, S08 post-format profiles.
//!
//! Every number in this file is measured on the running machine. The bundled catalog
//! (`resources/essential-software.json`) is a stated recommendation policy, never a
//! measurement, and each response says so and reports the hash of the exact bytes that
//! were used. Nothing here mutates system state: S03 emits literal guidance text, S07
//! writes a report into a user-chosen directory, and S08 writes a profile document.
//!
//! M01-S03 deliberately does not repair anything. The service name is "repair
//! guidance", and reporting guidance as if it were a repair would be the exact
//! dishonesty this repository forbids.

use crate::completion14::psbridge;
use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Component, PathBuf};
use std::time::Instant;
use tauri::AppHandle;

const CATALOG_RESOURCE_PATH: &str = "resources/essential-software.json";
const CATALOG_EMBEDDED: &str = include_str!("../../../resources/essential-software.json");
const MAX_INVENTORY_ITEMS: usize = 20_000;
const MAX_TARGET_PATHS: usize = 32;
const MAX_PROFILE_STEPS: usize = 24;

// ---------------------------------------------------------------------------
// Shared result envelope
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared installed-application inventory (used by S04 and S07)
// ---------------------------------------------------------------------------

/// A real value read from a Windows uninstall registry key. `uninstall_string` is data
/// recorded for the user to read; this service never executes it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub display_name: String,
    pub registry_key: String,
    pub hive: String,
    pub publisher: String,
    pub version: Option<String>,
    pub install_location: Option<String>,
    pub install_date: Option<String>,
    pub estimated_size_bytes: Option<u64>,
    pub uninstall_string: Option<String>,
    pub is_windows_installer: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryHiveReport {
    pub hive: String,
    pub registry_path: String,
    pub present: bool,
    pub keys_read: usize,
    pub entries_kept: usize,
    pub entries_skipped_system_component: usize,
    pub entries_skipped_update: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Inventory {
    pub apps: Vec<InstalledApp>,
    pub hives: Vec<InventoryHiveReport>,
    pub total_keys_read: usize,
    pub duplicate_display_names_collapsed: usize,
    pub inventory_truncated: bool,
    pub measured_at: String,
    pub measurement_source: String,
}

const INVENTORY_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$hiveSpecs = @(
  @{ hive = 'HKLM64'; path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall' },
  @{ hive = 'HKLM32'; path = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' },
  @{ hive = 'HKCU';   path = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall' }
)
$items = New-Object System.Collections.Generic.List[object]
$hiveReport = New-Object System.Collections.Generic.List[object]
foreach ($spec in $hiveSpecs) {
  $present = $false
  $keys = @()
  try {
    if (Test-Path -LiteralPath $spec.path) {
      $present = $true
      $keys = @(Get-ChildItem -LiteralPath $spec.path -ErrorAction SilentlyContinue)
    }
  } catch { $present = $false; $keys = @() }
  $kept = 0
  $skippedSystem = 0
  $skippedUpdate = 0
  foreach ($key in $keys) {
    $props = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
    if ($null -eq $props) { continue }
    $display = [string]$props.DisplayName
    if ([string]::IsNullOrWhiteSpace($display)) { continue }
    if ([int]$props.SystemComponent -eq 1) { $skippedSystem = $skippedSystem + 1; continue }
    # Windows Update and hotfix entries are not applications. The rule is reported with
    # the count it removed so the exclusion is auditable rather than silent.
    if ([string]$key.PSChildName -match '^(?i)KB\d{6}$' -or $display -match '^(?i)(Security Update|Update for|Hotfix for|Windows .* Update)') {
      $skippedUpdate = $skippedUpdate + 1
      continue
    }
    $estimated = $null
    if ($null -ne $props.EstimatedSize) {
      $kb = [int64]$props.EstimatedSize
      if ($kb -gt 0) { $estimated = [uint64]$kb * 1024 }
    }
    $version = $null
    if (-not [string]::IsNullOrWhiteSpace([string]$props.DisplayVersion)) { $version = [string]$props.DisplayVersion }
    $location = $null
    if (-not [string]::IsNullOrWhiteSpace([string]$props.InstallLocation)) { $location = [string]$props.InstallLocation }
    $installDate = $null
    if (-not [string]::IsNullOrWhiteSpace([string]$props.InstallDate)) { $installDate = [string]$props.InstallDate }
    $uninstall = $null
    if (-not [string]::IsNullOrWhiteSpace([string]$props.UninstallString)) { $uninstall = [string]$props.UninstallString }
    $isMsi = $null
    if ($null -ne $props.WindowsInstaller) { $isMsi = [bool]([int]$props.WindowsInstaller -eq 1) }
    $items.Add([pscustomobject]@{
      displayName = $display
      registryKey = [string]$key.PSChildName
      hive = [string]$spec.hive
      publisher = [string]$props.Publisher
      version = $version
      installLocation = $location
      installDate = $installDate
      estimatedSizeBytes = $estimated
      uninstallString = $uninstall
      isWindowsInstaller = $isMsi
    })
    $kept = $kept + 1
  }
  $hiveReport.Add([pscustomobject]@{
    hive = [string]$spec.hive
    registryPath = [string]$spec.path
    present = $present
    keysRead = $keys.Count
    entriesKept = $kept
    entriesSkippedSystemComponent = $skippedSystem
    entriesSkippedUpdate = $skippedUpdate
  })
}
[pscustomobject]@{ hives = $hiveReport.ToArray(); items = $items.ToArray() } | ConvertTo-Json -Depth 5 -Compress
"#;

fn parse_inventory(stdout: &str) -> Result<Inventory, String> {
    let document = psbridge::parse_json(stdout)?;
    let apps: Vec<InstalledApp> = psbridge::as_array(
        document
            .get("items")
            .cloned()
            .ok_or_else(|| "inventory_payload_missing_items".to_string())?,
    )
    .iter()
    .filter_map(|value| serde_json::from_value::<InstalledApp>(value.clone()).ok())
    .collect();
    let hives: Vec<InventoryHiveReport> = psbridge::as_array(
        document
            .get("hives")
            .cloned()
            .ok_or_else(|| "inventory_payload_missing_hives".to_string())?,
    )
    .iter()
    .filter_map(|value| serde_json::from_value::<InventoryHiveReport>(value.clone()).ok())
    .collect();
    if hives.is_empty() {
        return Err("inventory_reported_no_registry_hive".to_string());
    }
    let mut apps = apps;
    let inventory_truncated = apps.len() > MAX_INVENTORY_ITEMS;
    if inventory_truncated {
        apps.truncate(MAX_INVENTORY_ITEMS);
    }
    // The same application is frequently registered in both the 64-bit and 32-bit hive.
    // One representative is kept and the collapse count is reported. The key set makes
    // this linear: a machine with twenty thousand entries must not take twenty thousand
    // squared comparisons.
    apps.sort_by(|left, right| {
        left.display_name
            .to_lowercase()
            .cmp(&right.display_name.to_lowercase())
            .then(left.hive.cmp(&right.hive))
            .then(left.registry_key.cmp(&right.registry_key))
    });
    let mut unique: Vec<InstalledApp> = Vec::with_capacity(apps.len());
    let mut seen: HashSet<(String, String)> = HashSet::with_capacity(apps.len());
    let mut duplicate_display_names_collapsed = 0usize;
    for app in apps {
        let key = (
            app.display_name.to_lowercase(),
            app.version.clone().unwrap_or_default(),
        );
        if !seen.insert(key) {
            duplicate_display_names_collapsed += 1;
            continue;
        }
        unique.push(app);
    }
    let total_keys_read = hives.iter().map(|hive| hive.keys_read).sum();
    Ok(Inventory {
        apps: unique,
        hives,
        total_keys_read,
        duplicate_display_names_collapsed,
        inventory_truncated,
        measured_at: Utc::now().to_rfc3339(),
        measurement_source:
            "Windows uninstall registry (HKLM 64-bit, HKLM WOW6432Node, HKCU) read through the registry provider"
                .into(),
    })
}

fn read_inventory() -> Result<(Inventory, Option<String>, Option<i32>), String> {
    let run = psbridge::run(INVENTORY_SCRIPT)?;
    if !run.stdout.trim().is_empty() {
        if let Ok(inventory) = parse_inventory(&run.stdout) {
            return Ok((inventory, run.stderr_tail(), run.exit_code));
        }
    }
    if run.exit_code.unwrap_or(1) != 0 {
        return Err(format!(
            "inventory_registry_read_failed:{}",
            run.stderr_tail().unwrap_or_else(|| "no output".into())
        ));
    }
    Err("inventory_payload_unreadable".into())
}

// ---------------------------------------------------------------------------
// M01-S03 — Winget repair guidance
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetDiagnosticLog {
    pub name: String,
    pub size_bytes: u64,
    pub last_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetDiagnosis {
    pub winget_path: String,
    pub winget_version: String,
    pub source_list_succeeded: bool,
    pub source_list_text: String,
    pub source_list_error: Option<String>,
    pub source_markers_matched: Vec<String>,
    pub diag_root: String,
    pub diag_root_exists: bool,
    pub diag_logs: Vec<WingetDiagnosticLog>,
    pub windows_build: String,
    pub os_caption: String,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairStep {
    pub id: String,
    pub order: u32,
    pub mutating: bool,
    pub requires_admin: bool,
    pub title_en: String,
    pub title_ar: String,
    pub detail_en: String,
    pub detail_ar: String,
    /// The measured fact on the machine that caused this step to be offered. A step
    /// with no evidence is never emitted.
    pub evidence: String,
    /// A literal command line for the user to run themselves. The application never
    /// executes it, and a placeholder is named rather than filled with user text.
    pub command_template: Option<String>,
    pub requires_user_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetRepairRequest {
    #[serde(default)]
    pub scope: String,
    #[serde(default)]
    pub repair_target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetRepairGuidance {
    pub scope_applied: String,
    pub repair_target_applied: String,
    pub diagnosis: WingetDiagnosis,
    pub steps: Vec<RepairStep>,
    pub steps_omitted_for_scope: u32,
    pub steps_omitted_for_target: u32,
    pub mutating_actions_performed: u32,
    pub executed_any_command: bool,
    pub note_en: String,
    pub note_ar: String,
}

const WINGET_DIAG_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$wingetPath = ''
$wingetVersion = ''
try {
  $command = Get-Command winget.exe -ErrorAction Stop
  $wingetPath = [string]$command.Source
} catch { $wingetPath = '' }
if (-not [string]::IsNullOrWhiteSpace($wingetPath)) {
  try { $wingetVersion = ((& winget.exe --version 2>&1) | Out-String).Trim() } catch { $wingetVersion = '' }
}
$sourceText = ''
$sourceOk = $false
$sourceError = ''
try {
  $sourceText = ((& winget.exe source list 2>&1) | Out-String)
  $sourceOk = $true
} catch { $sourceText = ''; $sourceError = [string]$_.Exception.Message }
$diagRoot = ''
if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
  $diagRoot = Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe\LocalState\DiagOutputDir'
}
$diagExists = $false
$logs = @()
if (-not [string]::IsNullOrWhiteSpace($diagRoot) -and (Test-Path -LiteralPath $diagRoot)) {
  $diagExists = $true
  $logs = @(Get-ChildItem -LiteralPath $diagRoot -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 10 |
    ForEach-Object {
      [pscustomobject]@{
        name = [string]$_.Name
        sizeBytes = [uint64]$_.Length
        lastModified = if ($_.LastWriteTimeUtc) { $_.LastWriteTimeUtc.ToString('o') } else { '' }
      }
    })
}
$build = ''
$caption = ''
try { $build = [string](Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop).CurrentBuild } catch { $build = '' }
try { $caption = [string](Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).Caption } catch { $caption = '' }
[pscustomobject]@{
  wingetPath = $wingetPath
  wingetVersion = $wingetVersion
  sourceListSucceeded = $sourceOk
  sourceListText = $sourceText
  sourceListError = $sourceError
  diagRoot = $diagRoot
  diagRootExists = $diagExists
  diagLogs = @($logs)
  windowsBuild = $build
  osCaption = $caption
  measuredAt = [datetime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 5 -Compress
"#;

/// Markers that, when literally present in the `winget source list` output, mean the
/// source needs attention. The matched marker is reported so the reason is auditable.
const SOURCE_MARKERS: &[(&str, &str, &str, &str, &str)] = &[
    (
        "0x8a15002b",
        "The msstore source needs updating because winget itself is out of date.",
        "مصدر المتجر يحتاج تحديثًا لأن إصدار winget نفسه قديم.",
        "Update App Installer so the msstore source is refreshed.",
        "حدّث مُثبّت التطبيقات ليُحدَّث مصدر المتجر.",
    ),
    (
        "0x8a150044",
        "A package source is missing its agreement.",
        "أحد مصادر الحزم يفتقد اتفاقية الاستخدام.",
        "Accept the package source agreement.",
        "اقبل اتفاقية مصدر الحزم.",
    ),
    (
        "Unable to retrieve",
        "A source could not be reached from this machine.",
        "تعذّر الوصول إلى أحد المصادر من هذا الجهاز.",
        "Check network reachability for the winget sources.",
        "تحقق من إمكانية الوصول إلى مصادر winget عبر الشبكة.",
    ),
];

fn parse_winget_diagnosis(stdout: &str) -> Result<WingetDiagnosis, String> {
    let document = psbridge::parse_json(stdout)?;
    let diag_logs: Vec<WingetDiagnosticLog> = psbridge::as_array(
        document
            .get("diagLogs")
            .cloned()
            .unwrap_or(serde_json::Value::Null),
    )
    .iter()
    .filter_map(|value| serde_json::from_value::<WingetDiagnosticLog>(value.clone()).ok())
    .collect();
    let source_list_text = psbridge::text(&document, "sourceListText");
    let source_list_text = source_list_text.chars().take(8192).collect::<String>();
    let mut source_markers_matched = Vec::new();
    for (marker, _, _, _, _) in SOURCE_MARKERS {
        if source_list_text.contains(marker)
            && !source_markers_matched.contains(&marker.to_string())
        {
            source_markers_matched.push((*marker).to_string());
        }
    }
    let source_list_error = {
        let raw = psbridge::text(&document, "sourceListError");
        if raw.is_empty() {
            None
        } else {
            Some(raw)
        }
    };
    Ok(WingetDiagnosis {
        winget_path: psbridge::text(&document, "wingetPath"),
        winget_version: psbridge::text(&document, "wingetVersion"),
        source_list_succeeded: psbridge::boolean(&document, "sourceListSucceeded").unwrap_or(false),
        source_list_text,
        source_list_error,
        source_markers_matched,
        diag_root: psbridge::text(&document, "diagRoot"),
        diag_root_exists: psbridge::boolean(&document, "diagRootExists").unwrap_or(false),
        diag_logs,
        windows_build: psbridge::text(&document, "windowsBuild"),
        os_caption: psbridge::text(&document, "osCaption"),
        measured_at: psbridge::text(&document, "measuredAt"),
    })
}

fn build_guidance(
    diagnosis: &WingetDiagnosis,
    scope: &str,
    target: &str,
) -> (Vec<RepairStep>, u32, u32) {
    let mut all: Vec<RepairStep> = Vec::new();
    let mut push = |step: RepairStep| {
        all.push(RepairStep {
            order: all.len() as u32 + 1,
            ..step
        })
    };

    if diagnosis.winget_path.is_empty() {
        push(RepairStep {
            id: "install-app-installer".into(),
            order: 0,
            mutating: true,
            requires_admin: false,
            title_en: "Winget was not found on this machine".into(),
            title_ar: "لم يُعثر على Winget على هذا الجهاز".into(),
            detail_en: "Get-Command winget.exe returned nothing, so no package operation can run. Open the official Microsoft Store entry for \"App Installer\" and repair or reinstall it.".into(),
            detail_ar: "لم يُرجع Get-Command أي نتيجة لـ winget.exe، فلا يمكن تشغيل أي عملية حزم. افتح صفحة \"App Installer\" الرسمية في متجر مايكروسوفت لإصلاحه أو إعادة تثبيته.".into(),
            evidence: "Get-Command winget.exe produced no path.".into(),
            command_template: None,
            requires_user_value: None,
        });
    } else {
        push(RepairStep {
            id: "verify-version".into(),
            order: 0,
            mutating: false,
            requires_admin: false,
            title_en: "Confirm the reported version".into(),
            title_ar: "تأكيد الإصدار المُبلَّغ عنه".into(),
            detail_en: "This is a read-only check. Run it yourself to confirm the same version this service measured.".into(),
            detail_ar: "هذا فحص للقراءة فقط. نفّذه بنفسك للتأكد من نفس الإصدار الذي قاسته هذه الخدمة.".into(),
            evidence: format!(
                "Measured winget path {} and reported version \"{}\".",
                diagnosis.winget_path, diagnosis.winget_version
            ),
            command_template: Some("winget --version".into()),
            requires_user_value: None,
        });
    }

    for (marker, detail_en, detail_ar, title_en, title_ar) in SOURCE_MARKERS {
        if !diagnosis
            .source_markers_matched
            .iter()
            .any(|found| found == marker)
        {
            continue;
        }
        push(RepairStep {
            id: format!("source-marker-{marker}"),
            order: 0,
            mutating: true,
            requires_admin: false,
            title_en: (*title_en).into(),
            title_ar: (*title_ar).into(),
            detail_en: (*detail_en).into(),
            detail_ar: (*detail_ar).into(),
            evidence: format!("The literal marker \"{marker}\" appears in the measured `winget source list` output."),
            command_template: Some(
                "winget source update --name winget".into(),
            ),
            requires_user_value: None,
        });
    }

    if !diagnosis.source_list_succeeded {
        push(RepairStep {
            id: "source-list-failed".into(),
            order: 0,
            mutating: false,
            requires_admin: false,
            title_en: "The source list could not be read".into(),
            title_ar: "تعذّرت قراءة قائمة المصادر".into(),
            detail_en: "The measured command reported an error. The error text is included in the evidence, so no step is offered on a guess.".into(),
            detail_ar: "أبلغ الأمر المُقاس عن خطأ. نص الخطأ مضمّن في الدليل، فلا تُقترح أي خطوة بالتخمين.".into(),
            evidence: format!(
                "winget source list failed: {}",
                diagnosis
                    .source_list_error
                    .clone()
                    .unwrap_or_else(|| "no error text captured".into())
            ),
            command_template: Some("winget source list".into()),
            requires_user_value: None,
        });
    }

    if diagnosis.diag_root_exists {
        let newest = diagnosis.diag_logs.first();
        push(RepairStep {
            id: "inspect-diagnostic-log".into(),
            order: 0,
            mutating: false,
            requires_admin: true,
            title_en: "Read the newest winget diagnostic log".into(),
            title_ar: "قراءة أحدث سجل تشخيص لـ winget".into(),
            detail_en: "winget writes a log per operation under the measured directory below. This step only points at the file; nothing is opened or uploaded.".into(),
            detail_ar: "يكتب winget سجلاً لكل عملية في المجلد المقاس أدناه. تشير هذه الخطوة إلى الملف فقط؛ لا يُفتح شيء ولا يُرفع شيء.".into(),
            evidence: match newest {
                Some(log) => format!(
                    "{} diagnostic logs exist; newest is {} ({} bytes, modified {}).",
                    diagnosis.diag_logs.len(),
                    log.name,
                    log.size_bytes,
                    log.last_modified
                ),
                None => format!(
                    "The diagnostic directory {} exists but contained no readable file.",
                    diagnosis.diag_root
                ),
            },
            command_template: None,
            requires_user_value: None,
        });
    }

    push(RepairStep {
        id: "install-package".into(),
        order: 0,
        mutating: true,
        requires_admin: false,
        title_en: "Install or reinstall a single package".into(),
        title_ar: "تثبيت أو إعادة تثبيت حزمة واحدة".into(),
        detail_en: "Replace the placeholder with a package identifier you chose. KNOUX ONE never runs this line for you; the install queue is a separate service with its own allowlist.".into(),
        detail_ar: "استبدل العنصر بمعرّف حزمة تختاره. لا ينفّذ KNOUX ONE هذا السطر نيابةً عنك؛ طابور التثبيت خدمة منفصلة بقائمة سماح خاصة بها.".into(),
        evidence: "Requested repair target is package scope.".into(),
        command_template: Some(
            "winget install --id <PACKAGE_ID> --exact --source winget --accept-package-agreements --accept-source-agreements".into(),
        ),
        requires_user_value: Some("PACKAGE_ID".into()),
    });

    let total_offered = all.len() as u32;
    let mut omitted_scope = 0u32;
    let mut kept: Vec<RepairStep> = Vec::new();
    for step in all {
        if step.requires_admin && scope != "system" {
            omitted_scope += 1;
            continue;
        }
        let relevant = match target {
            "source" => step.id.starts_with("source-"),
            "cache" => step.id == "inspect-diagnostic-log" || step.id == "verify-version",
            _ => true,
        };
        if !relevant {
            continue;
        }
        kept.push(step);
    }
    let omitted_target = total_offered - omitted_scope - kept.len() as u32;
    kept.sort_by_key(|step| step.order);
    for (index, step) in kept.iter_mut().enumerate() {
        step.order = index as u32 + 1;
    }
    (kept, omitted_scope, omitted_target)
}

#[tauri::command]
pub async fn m01_winget_repair_guide(
    op_id: String,
    request: Option<WingetRepairRequest>,
) -> Result<OperationResult<WingetRepairGuidance>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let request = request.unwrap_or(WingetRepairRequest {
        scope: String::new(),
        repair_target: String::new(),
    });
    let scope = match request.scope.as_str() {
        "local" => "local",
        "system" => "system",
        _ => "local",
    };
    let target = match request.repair_target.as_str() {
        "source" | "cache" | "package" => request.repair_target.clone(),
        _ => "package".to_string(),
    };

    #[cfg(not(target_os = "windows"))]
    {
        let _ = &request;
        let _ = (&scope, &target);
        Ok(unavailable(
            op_id,
            "m01_s03",
            "m01.winget.repair",
            started_at,
            timer,
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let outcome = tauri::async_runtime::spawn_blocking(move || {
            let run = psbridge::run(WINGET_DIAG_SCRIPT)?;
            let diagnosis = parse_winget_diagnosis(&run.stdout)?;
            Ok::<_, String>((
                diagnosis,
                run.stderr_tail(),
                run.exit_code,
                run.stdout_truncated,
            ))
        })
        .await
        .map_err(|error| format!("winget_diagnosis_join_failed:{error}"))?;

        let (diagnosis, stderr, exit_code, stdout_truncated) = match outcome {
            Ok(value) => value,
            Err(reason) => {
                // The launcher reported why before any measurement existed, so there is
                // no exit code or stderr to quote yet.
                return Ok(result(
                    op_id,
                    "m01_s03",
                    "m01.winget.repair",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The winget diagnosis could not be measured.".into(),
                    "تعذّر قياس حالة winget.".into(),
                    vec![reason.clone()],
                    Some("winget_diagnosis_failed".into()),
                    None,
                    None,
                ));
            }
        };

        let mut warnings = Vec::new();
        if diagnosis.winget_path.is_empty() {
            warnings.push("winget.exe was not found on this machine.".into());
        } else if diagnosis.winget_version.is_empty() {
            warnings.push("winget.exe was found but reported no version.".into());
        }
        if !diagnosis.source_list_succeeded {
            warnings.push("`winget source list` did not complete on this machine.".into());
        }
        if stdout_truncated {
            // A clipped capture could hide a source row, so it must not be presented as
            // a complete reading of the source list.
            warnings.push(
                "The captured output exceeded the bridge ceiling and was clipped; the source list below may be incomplete."
                    .into(),
            );
        }

        let (steps, omitted_scope, omitted_target) = build_guidance(&diagnosis, scope, &target);
        let mutating_steps_offered = steps.iter().filter(|step| step.mutating).count() as u32;
        let note_en = format!(
            "Guidance only. This service executed no command and performed 0 mutating actions; it offers {mutating_steps_offered} mutating step(s) out of {} for you to run yourself.",
            steps.len()
        );
        let note_ar = format!(
            "إرشاد فقط. لم تشغّل هذه الخدمة أي أمر ولم تُنفّذ أي إجراء مُعدِّل (0 إجراء)؛ وتعرض {mutating_steps_offered} خطوة مُعدِّلة من أصل {} لتشغيلها بنفسك.",
            steps.len()
        );

        Ok(result(
            op_id,
            "m01_s03",
            "m01.winget.repair",
            started_at,
            timer,
            Some(WingetRepairGuidance {
                scope_applied: scope.into(),
                repair_target_applied: target,
                diagnosis,
                steps,
                steps_omitted_for_scope: omitted_scope,
                steps_omitted_for_target: omitted_target,
                mutating_actions_performed: 0,
                executed_any_command: false,
                note_en,
                note_ar,
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Winget state was measured and conditional repair guidance was produced.".into(),
            "تم قياس حالة winget وإنتاج إرشادات إصلاح مشروطة.".into(),
            warnings,
            None,
            stderr,
            exit_code,
        ))
    }
}

// ---------------------------------------------------------------------------
// M01-S04 — Essential software catalog
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogProvenance {
    pub bundled_resource_path: String,
    pub byte_count: u64,
    pub sha256: String,
    pub catalog_id: String,
    pub catalog_revision: String,
    pub declared_item_count: usize,
    pub policy_override_path: Option<String>,
    pub policy_override_sha256: Option<String>,
    pub description_en: String,
    pub description_ar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogItem {
    pub id: String,
    pub category: String,
    pub name_en: String,
    pub name_ar: String,
    pub publisher: String,
    pub package_id: String,
    pub package_id_provenance: String,
    pub package_id_verified_on_this_machine: bool,
    pub package_check_detail: Option<String>,
    pub why_en: String,
    pub why_ar: String,
    pub state: String,
    pub matched_by: Option<String>,
    pub installed_display_name: Option<String>,
    pub installed_version: Option<String>,
    pub installed_publisher: Option<String>,
    pub installed_location: Option<String>,
    pub installed_size_bytes: Option<u64>,
    pub installed_hive: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EssentialCatalogRequest {
    #[serde(default)]
    pub scope: String,
    #[serde(default)]
    pub filter: String,
    #[serde(default)]
    pub verify_package_ids: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EssentialCatalogReport {
    pub scope_applied: String,
    pub filter_applied: String,
    pub items: Vec<CatalogItem>,
    pub catalog_items_in_scope: usize,
    pub items_installed: usize,
    pub items_absent: usize,
    pub items_suppressed_by_scope: usize,
    pub package_ids_checked: usize,
    pub package_ids_verified: usize,
    pub package_check_was_requested: bool,
    pub catalog: CatalogProvenance,
    pub installed_state: Inventory,
    pub unmatched_installed_entries: usize,
    pub measured_at: String,
}

#[derive(Debug, Clone, Deserialize)]
struct RawCatalog {
    schema_version: u32,
    catalog_id: String,
    catalog_revision: String,
    description_en: String,
    description_ar: String,
    items: Vec<RawCatalogItem>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct RawMatchRule {
    #[serde(default, rename = "displayNameContains")]
    display_name_contains: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RawCatalogItem {
    id: String,
    category: String,
    name_en: String,
    name_ar: String,
    publisher: String,
    package_id: String,
    why_en: String,
    why_ar: String,
    #[serde(default, rename = "match")]
    match_rule: RawMatchRule,
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

/// The catalog can be replaced on disk by the operator. When the file is present its
/// bytes are hashed and reported, so a modified policy can never be mistaken for the
/// bundled one.
fn load_catalog() -> Result<(RawCatalog, CatalogProvenance), String> {
    let (bytes, override_path, override_sha) = match psbridge::roaming_app_data() {
        Some(base) => {
            let path = base.join("KNOUX ONE").join("essential-software.json");
            match fs::read(&path) {
                Ok(bytes) => {
                    let digest = sha256_hex(&bytes);
                    (
                        bytes,
                        Some(path.to_string_lossy().to_string()),
                        Some(digest),
                    )
                }
                Err(_) => (CATALOG_EMBEDDED.as_bytes().to_vec(), None, None),
            }
        }
        None => (CATALOG_EMBEDDED.as_bytes().to_vec(), None, None),
    };
    let catalog: RawCatalog = serde_json::from_slice(&bytes)
        .map_err(|error| format!("essential_catalog_unreadable:{error}"))?;
    if catalog.schema_version != 1 {
        return Err(format!(
            "essential_catalog_unsupported_schema:{}",
            catalog.schema_version
        ));
    }
    if catalog.items.is_empty() {
        return Err("essential_catalog_declared_no_items".to_string());
    }
    let provenance = CatalogProvenance {
        bundled_resource_path: CATALOG_RESOURCE_PATH.into(),
        byte_count: bytes.len() as u64,
        sha256: sha256_hex(&bytes),
        catalog_id: catalog.catalog_id.clone(),
        catalog_revision: catalog.catalog_revision.clone(),
        declared_item_count: catalog.items.len(),
        policy_override_path: override_path,
        policy_override_sha256: override_sha,
        description_en: catalog.description_en.clone(),
        description_ar: catalog.description_ar.clone(),
    };
    Ok((catalog, provenance))
}

fn match_installed(item: &RawCatalogItem, app: &InstalledApp) -> Option<String> {
    let display = app.display_name.to_lowercase();
    for needle in &item.match_rule.display_name_contains {
        let needle = needle.to_lowercase();
        if !needle.is_empty() && display.contains(&needle) {
            return Some(format!("displayName contains \"{needle}\""));
        }
    }
    None
}

const PACKAGE_CHECK_SCRIPT_PREFIX: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ids = @(""#;

const PACKAGE_CHECK_SCRIPT_SUFFIX: &str = r#")
$out = New-Object System.Collections.Generic.List[object]
foreach ($id in $ids) {
  $detail = ''
  $ok = $false
  try {
    $detail = ((& winget.exe show --id $id --exact --disable-interactivity 2>&1) | Out-String).Trim()
    $ok = ($LASTEXITCODE -eq 0)
  } catch { $detail = [string]$_.Exception.Message; $ok = $false }
  $first = ''
  if (-not [string]::IsNullOrWhiteSpace($detail)) {
    $first = (($detail -split "`r?`n") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
  }
  $out.Add([pscustomobject]@{ id = [string]$id; verified = $ok; detail = [string]$first })
}
@($out) | ConvertTo-Json -Depth 3 -Compress
"#;

/// Package identifiers are only marked verified when the operator explicitly asked for
/// the check, the check actually ran, and Windows reported success. The check is capped
/// because each identifier costs a network round trip.
const MAX_PACKAGE_CHECKS: usize = 12;

fn run_package_checks(ids: &[String]) -> (BTreeMap<String, (bool, String)>, Option<String>) {
    if ids.is_empty() {
        return (BTreeMap::new(), None);
    }
    let quoted: Vec<String> = ids
        .iter()
        .take(MAX_PACKAGE_CHECKS)
        .map(|id| format!("'{}'", id.replace('\'', "''")))
        .collect();
    let script = format!(
        "{PACKAGE_CHECK_SCRIPT_PREFIX}{}{PACKAGE_CHECK_SCRIPT_SUFFIX}",
        quoted.join(",")
    );
    match psbridge::run(&script) {
        Ok(run) => {
            let mut map = BTreeMap::new();
            for value in psbridge::as_array(
                psbridge::parse_json(&run.stdout).unwrap_or(serde_json::Value::Null),
            ) {
                let id = psbridge::text(&value, "id");
                if id.is_empty() {
                    continue;
                }
                let verified = psbridge::boolean(&value, "verified").unwrap_or(false);
                let detail = psbridge::text(&value, "detail");
                map.insert(id, (verified, detail));
            }
            (map, run.stderr_tail())
        }
        Err(reason) => (BTreeMap::new(), Some(reason)),
    }
}

#[tauri::command]
pub async fn m01_essential_catalog(
    op_id: String,
    request: Option<EssentialCatalogRequest>,
) -> Result<OperationResult<EssentialCatalogReport>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let request = request.unwrap_or(EssentialCatalogRequest {
        scope: String::new(),
        filter: String::new(),
        verify_package_ids: false,
    });
    let scope = match request.scope.as_str() {
        "available" => "available",
        _ => "installed",
    };
    let filter = match request.filter.as_str() {
        "security" | "development" | "essential" | "all" => request.filter.clone(),
        _ => "essential".to_string(),
    };

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&request, &scope, &filter);
        Ok(unavailable(
            op_id,
            "m01_s04",
            "m01.catalog.essential",
            started_at,
            timer,
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let (catalog, provenance) = match load_catalog() {
            Ok(value) => value,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m01_s04",
                    "m01.catalog.essential",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The bundled recommendation catalog could not be read.".into(),
                    "تعذّرت قراءة سياسة التوصية المرفقة.".into(),
                    vec![reason.clone()],
                    Some("essential_catalog_unreadable".into()),
                    None,
                    None,
                ))
            }
        };
        let (inventory, stderr, exit_code) = match read_inventory() {
            Ok(value) => value,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m01_s04",
                    "m01.catalog.essential",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The installed application registry could not be read.".into(),
                    "تعذّرت قراءة سجل التطبيقات المثبتة.".into(),
                    vec![reason.clone()],
                    Some("installed_state_unavailable".into()),
                    None,
                    None,
                ))
            }
        };

        // Resolve every catalog item against the real inventory before filtering, so
        // the "installed" scope cannot hide an item by first shrinking the list.
        let mut resolved: Vec<(RawCatalogItem, Option<InstalledApp>, Option<String>)> = Vec::new();
        let mut matched_installed: Vec<bool> = vec![false; inventory.apps.len()];
        for item in &catalog.items {
            let mut hit: Option<(usize, String)> = None;
            for (index, app) in inventory.apps.iter().enumerate() {
                if let Some(reason) = match_installed(item, app) {
                    hit = Some((index, reason));
                    break;
                }
            }
            match hit {
                Some((index, reason)) => {
                    matched_installed[index] = true;
                    resolved.push((
                        item.clone(),
                        Some(inventory.apps[index].clone()),
                        Some(reason),
                    ));
                }
                None => resolved.push((item.clone(), None, None)),
            }
        }
        let unmatched_installed_entries = matched_installed.iter().filter(|hit| !**hit).count();

        let in_filter: Vec<(RawCatalogItem, Option<InstalledApp>, Option<String>)> = resolved
            .into_iter()
            .filter(|(item, _, _)| filter == "all" || item.category == filter)
            .collect();
        let catalog_items_in_scope = in_filter.len();

        let want_package_check = request.verify_package_ids;
        let pending_ids: Vec<String> = if want_package_check {
            in_filter
                .iter()
                .filter(|(_, app, _)| app.is_none())
                .map(|(item, _, _)| item.package_id.clone())
                .filter(|id| !id.is_empty())
                .collect()
        } else {
            Vec::new()
        };
        let (package_checks, package_check_stderr) = if want_package_check {
            run_package_checks(&pending_ids)
        } else {
            (BTreeMap::new(), None)
        };
        let package_ids_checked = package_checks.len();
        let package_ids_verified = package_checks.values().filter(|(ok, _)| *ok).count();

        let mut items: Vec<CatalogItem> = Vec::new();
        let mut suppressed = 0usize;
        for (item, app, matched_by) in in_filter {
            let installed = app.is_some();
            if scope == "installed" && !installed {
                suppressed += 1;
                continue;
            }
            let check = package_checks.get(&item.package_id);
            items.push(CatalogItem {
                id: item.id.clone(),
                category: item.category.clone(),
                name_en: item.name_en.clone(),
                name_ar: item.name_ar.clone(),
                publisher: item.publisher.clone(),
                package_id: item.package_id.clone(),
                package_id_provenance: if provenance.policy_override_path.is_some() {
                    "policy_override_file".into()
                } else {
                    "bundled_policy".into()
                },
                package_id_verified_on_this_machine: check.map(|(ok, _)| *ok).unwrap_or(false),
                package_check_detail: check.map(|(_, detail)| detail.clone()),
                why_en: item.why_en.clone(),
                why_ar: item.why_ar.clone(),
                state: if installed { "installed" } else { "absent" }.into(),
                matched_by,
                installed_display_name: app.as_ref().map(|value| value.display_name.clone()),
                installed_version: app.as_ref().and_then(|value| value.version.clone()),
                installed_publisher: app
                    .as_ref()
                    .map(|value| value.publisher.clone())
                    .filter(|value| !value.is_empty()),
                installed_location: app
                    .as_ref()
                    .and_then(|value| value.install_location.clone()),
                installed_size_bytes: app.as_ref().and_then(|value| value.estimated_size_bytes),
                installed_hive: app.as_ref().map(|value| value.hive.clone()),
            });
        }
        let items_installed = items
            .iter()
            .filter(|item| item.state == "installed")
            .count();
        let items_absent = items.len() - items_installed;

        let mut warnings = Vec::new();
        if items.is_empty() {
            warnings.push(
                "No catalog item matched this filter and scope on the measured registry.".into(),
            );
        }
        if request.verify_package_ids && package_checks.is_empty() && !pending_ids.is_empty() {
            warnings.push(
                "Package verification was requested but produced no result; no identifier is reported as verified."
                    .into(),
            );
        }
        if provenance.policy_override_path.is_some() {
            warnings.push(
                "A local policy override replaced the bundled catalog; its hash is reported in the provenance."
                    .into(),
            );
        }
        if let Some(reason) = &package_check_stderr {
            warnings.push(format!("Package check diagnostics: {reason}"));
        }

        let merged_stderr = match (stderr, package_check_stderr) {
            (Some(left), Some(right)) => Some(format!("{left}\n{right}")),
            (Some(only), None) | (None, Some(only)) => Some(only),
            (None, None) => None,
        };

        Ok(result(
            op_id,
            "m01_s04",
            "m01.catalog.essential",
            started_at,
            timer,
            Some(EssentialCatalogReport {
                scope_applied: scope.into(),
                filter_applied: filter,
                items,
                catalog_items_in_scope,
                items_installed,
                items_absent,
                items_suppressed_by_scope: suppressed,
                package_ids_checked,
                package_ids_verified,
                package_check_was_requested: request.verify_package_ids,
                catalog: provenance,
                installed_state: inventory,
                unmatched_installed_entries,
                measured_at: Utc::now().to_rfc3339(),
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "The recommendation catalog was resolved against the measured Windows uninstall registry."
                .into(),
            "تم مطابقة سياسة التوصيات مع سجل إلغاء التثبيت المقاس فعليًا في ويندوز.".into(),
            warnings,
            None,
            merged_stderr,
            exit_code,
        ))
    }
}

// ---------------------------------------------------------------------------
// M01-S07 — Installed application inventory export
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryExportRequest {
    #[serde(default = "default_true")]
    pub include_version: bool,
    #[serde(default = "default_true")]
    pub include_install_path: bool,
    #[serde(default)]
    pub format: String,
    #[serde(default)]
    pub destination_directory: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryExport {
    pub format: String,
    pub file_path: String,
    pub file_name: String,
    pub byte_count: u64,
    pub sha256: String,
    pub read_back_verified: bool,
    pub app_count: usize,
    pub skipped_system_component: usize,
    pub skipped_updates: usize,
    pub duplicate_display_names_collapsed: usize,
    pub export_directory_defaulted: bool,
    pub inventory_truncated: bool,
    pub hives: Vec<InventoryHiveReport>,
    pub includes_version: bool,
    pub includes_install_path: bool,
    pub exported_at: String,
}

fn sanitize_file_stem(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                // A dot is kept only as a separator between segments; a leading dot
                // would produce a hidden file and `..` would produce a traversal.
                if character == '.' {
                    '.'
                } else {
                    '_'
                }
            }
        })
        .collect();
    // Leading and trailing dots, underscores and dashes are all removed, so a name made
    // only of separators cannot become a file called `___` or a hidden `.config`.
    let trimmed = cleaned.trim_matches(['.', '_', '-']);
    if trimmed.is_empty() {
        return "knoux-installed-apps".to_string();
    }
    trimmed.chars().take(80).collect()
}

fn csv_escape(value: &str) -> String {
    if value.contains(['"', ',', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn html_escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            other => out.push(other),
        }
    }
    out
}

fn export_directory(explicit: Option<&str>) -> Result<(PathBuf, bool), String> {
    if let Some(value) = explicit.map(str::trim).filter(|value| !value.is_empty()) {
        let path = PathBuf::from(value);
        if !path.is_absolute() {
            return Err("inventory_export_directory_must_be_absolute".into());
        }
        fs::create_dir_all(&path)
            .map_err(|error| format!("inventory_export_directory_failed:{error}"))?;
        return Ok((path, false));
    }
    let base = std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .ok_or_else(|| "user_profile_unavailable".to_string())?;
    let path = base.join("Documents").join("KNOUX ONE Exports");
    fs::create_dir_all(&path)
        .map_err(|error| format!("inventory_export_directory_failed:{error}"))?;
    Ok((path, true))
}

#[tauri::command]
pub async fn m01_installed_app_inventory_export(
    op_id: String,
    request: Option<InventoryExportRequest>,
) -> Result<OperationResult<InventoryExport>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let request = request.unwrap_or(InventoryExportRequest {
        include_version: true,
        include_install_path: true,
        format: String::new(),
        destination_directory: None,
        file_name: None,
    });
    let format = match request.format.as_str() {
        "csv" => "csv",
        "html" => "html",
        _ => "json",
    };

    #[cfg(not(target_os = "windows"))]
    {
        let _ = &request;
        Ok(unavailable(
            op_id,
            "m01_s07",
            "m01.apps.inventory.export",
            started_at,
            timer,
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let (inventory, stderr, exit_code) = match read_inventory() {
            Ok(value) => value,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m01_s07",
                    "m01.apps.inventory.export",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The installed application registry could not be read.".into(),
                    "تعذّرت قراءة سجل التطبيقات المثبتة.".into(),
                    vec![reason.clone()],
                    Some("installed_state_unavailable".into()),
                    None,
                    None,
                ))
            }
        };
        if inventory.apps.is_empty() {
            return Ok(result(
                op_id,
                "m01_s07",
                "m01.apps.inventory.export",
                started_at,
                timer,
                None,
                "failed",
                "Windows reported no installed application entries, so there is nothing to export."
                    .into(),
                "لم يُبلّغ ويندوز عن أي تطبيقات مثبتة، فلا يوجد ما يُصدَّر.".into(),
                Vec::new(),
                Some("installed_inventory_empty".into()),
                stderr,
                exit_code,
            ));
        }

        let (directory, defaulted) =
            match export_directory(request.destination_directory.as_deref()) {
                Ok(value) => value,
                Err(reason) => {
                    return Ok(result(
                        op_id,
                        "m01_s07",
                        "m01.apps.inventory.export",
                        started_at,
                        timer,
                        None,
                        "failed",
                        "The export directory could not be prepared.".into(),
                        "تعذّر تجهيز مجلد التصدير.".into(),
                        vec![reason.clone()],
                        Some("inventory_export_directory_invalid".into()),
                        None,
                        None,
                    ))
                }
            };
        let stamp = Utc::now().format("%Y%m%d-%H%M%S");
        let stem = sanitize_file_stem(request.file_name.as_deref().unwrap_or(""));
        let file_name = format!("{stem}-{stamp}.{format}");
        let file_path = directory.join(&file_name);

        let body = match format {
            "csv" => {
                let mut lines = vec![
                    "Display Name,Publisher,Version,Install Location,Install Date,Estimated Size Bytes,Registry Key,Hive,Windows Installer,Uninstall String"
                        .to_string(),
                ];
                for app in &inventory.apps {
                    let version = if request.include_version {
                        app.version.clone().unwrap_or_default()
                    } else {
                        String::new()
                    };
                    let location = if request.include_install_path {
                        app.install_location.clone().unwrap_or_default()
                    } else {
                        String::new()
                    };
                    let row = [
                        csv_escape(&app.display_name),
                        csv_escape(&app.publisher),
                        csv_escape(&version),
                        csv_escape(&location),
                        csv_escape(&app.install_date.clone().unwrap_or_default()),
                        app.estimated_size_bytes
                            .map(|value| value.to_string())
                            .unwrap_or_default(),
                        csv_escape(&app.registry_key),
                        csv_escape(&app.hive),
                        app.is_windows_installer
                            .map(|value| value.to_string())
                            .unwrap_or_default(),
                        csv_escape(app.uninstall_string.as_deref().unwrap_or("")),
                    ];
                    lines.push(row.join(","));
                }
                // A byte-order mark is written so Excel opens UTF-8 paths without
                // mangling non-Latin names.
                format!("\u{feff}{}\r\n", lines.join("\r\n"))
            }
            "html" => {
                let mut rows = String::new();
                for app in &inventory.apps {
                    rows.push_str(&format!(
                        "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
                        html_escape(&app.display_name),
                        html_escape(&app.publisher),
                        html_escape(if request.include_version {
                            app.version.as_deref().unwrap_or("")
                        } else {
                            ""
                        }),
                        html_escape(if request.include_install_path {
                            app.install_location.as_deref().unwrap_or("")
                        } else {
                            ""
                        }),
                        app.estimated_size_bytes
                            .map(|value| value.to_string())
                            .unwrap_or_default(),
                        html_escape(&app.hive),
                    ));
                }
                format!(
                    "<!DOCTYPE html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><title>KNOUX ONE installed application inventory</title>\
<style>body{{font-family:system-ui,sans-serif;margin:24px}}table{{border-collapse:collapse;width:100%}}\
th,td{{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;vertical-align:top}}\
th{{background:#f2f2f2;position:sticky;top:0}}caption{{text-align:left;font-weight:600;padding-bottom:8px}}</style></head>\
<body><table><caption>Measured from the Windows uninstall registry at {measured}. \
{count} applications; {skipped_system} system components and {skipped_update} update entries were excluded by rule; \
{collapsed} duplicate name+version pairs were collapsed.</caption>\
<thead><tr><th>Application</th><th>Publisher</th><th>Version</th><th>Install location</th><th>Size (bytes)</th><th>Registry hive</th></tr></thead>\
<tbody>{rows}</tbody></table></body></html>\n",
                    measured = Utc::now().to_rfc3339(),
                    count = inventory.apps.len(),
                    skipped_system = inventory
                        .hives
                        .iter()
                        .map(|hive| hive.entries_skipped_system_component)
                        .sum::<usize>(),
                    skipped_update = inventory
                        .hives
                        .iter()
                        .map(|hive| hive.entries_skipped_update)
                        .sum::<usize>(),
                    collapsed = inventory.duplicate_display_names_collapsed,
                )
            }
            _ => {
                let mut document = serde_json::json!({
                    "schemaVersion": 1,
                    "generator": format!("KNOUX ONE {}", env!("CARGO_PKG_VERSION")),
                    "measuredAt": Utc::now().to_rfc3339(),
                    "includesVersion": request.include_version,
                    "includesInstallPath": request.include_install_path,
                    "measurementSource": inventory.measurement_source,
                    "hives": inventory.hives,
                    "appCount": inventory.apps.len(),
                    "skippedSystemComponent": inventory.hives.iter().map(|hive| hive.entries_skipped_system_component).sum::<usize>(),
                    "skippedUpdates": inventory.hives.iter().map(|hive| hive.entries_skipped_update).sum::<usize>(),
                    "duplicateDisplayNamesCollapsed": inventory.duplicate_display_names_collapsed,
                    "inventoryTruncated": inventory.inventory_truncated,
                    "applications": inventory.apps,
                });
                // Stable key order keeps the hash reproducible for the same registry.
                if let Some(object) = document.as_object_mut() {
                    object.sort_keys();
                }
                let mut text = serde_json::to_string_pretty(&document)
                    .map_err(|error| format!("inventory_export_serialize_failed:{error}"))?;
                text.push('\n');
                text
            }
        };

        let bytes = body.into_bytes();
        if let Err(reason) = fs::write(&file_path, &bytes) {
            return Ok(result(
                op_id,
                "m01_s07",
                "m01.apps.inventory.export",
                started_at,
                timer,
                None,
                "failed",
                "The export file could not be written.".into(),
                "تعذّرت كتابة ملف التصدير.".into(),
                vec![format!("inventory_export_write_failed:{reason}")],
                Some("inventory_export_write_failed".into()),
                None,
                None,
            ));
        }
        // Read the file back and compare the digest: a report is only "exported" when
        // the bytes on disk are the bytes that were hashed.
        let read_back = fs::read(&file_path);
        let (byte_count, sha256, read_back_verified) = match read_back {
            Ok(disk) => {
                let digest = sha256_hex(&disk);
                (
                    disk.len() as u64,
                    digest.clone(),
                    digest == sha256_hex(&bytes),
                )
            }
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m01_s07",
                    "m01.apps.inventory.export",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The export file could not be read back for verification.".into(),
                    "تعذّرت قراءة ملف التصدير للتحقق.".into(),
                    vec![format!("inventory_export_verify_failed:{reason}")],
                    Some("inventory_export_verify_failed".into()),
                    None,
                    None,
                ))
            }
        };

        let mut warnings = Vec::new();
        if inventory.inventory_truncated {
            warnings.push(format!(
                "The registry reported more than {MAX_INVENTORY_ITEMS} entries; the export holds the first {MAX_INVENTORY_ITEMS} in registry order."
            ));
        }
        if !read_back_verified {
            warnings.push("The written file did not match the hashed content.".into());
        }

        Ok(result(
            op_id,
            "m01_s07",
            "m01.apps.inventory.export",
            started_at,
            timer,
            Some(InventoryExport {
                format: format.into(),
                file_path: file_path.to_string_lossy().to_string(),
                file_name,
                byte_count,
                sha256,
                read_back_verified,
                app_count: inventory.apps.len(),
                skipped_system_component: inventory
                    .hives
                    .iter()
                    .map(|hive| hive.entries_skipped_system_component)
                    .sum(),
                skipped_updates: inventory
                    .hives
                    .iter()
                    .map(|hive| hive.entries_skipped_update)
                    .sum(),
                duplicate_display_names_collapsed: inventory.duplicate_display_names_collapsed,
                export_directory_defaulted: defaulted,
                inventory_truncated: inventory.inventory_truncated,
                hives: inventory.hives,
                includes_version: request.include_version,
                includes_install_path: request.include_install_path,
                exported_at: Utc::now().to_rfc3339(),
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "The installed application inventory was exported and the written file was verified."
                .into(),
            "تم تصدير جرد التطبيقات المثبتة والتحقق من الملف المكتوب.".into(),
            warnings,
            None,
            stderr,
            exit_code,
        ))
    }
}

// ---------------------------------------------------------------------------
// M01-S08 — Post-format profiles
// ---------------------------------------------------------------------------

/// A profile step may only name an allowlisted native handler, may only name the exact
/// Tauri command that handler is registered to, and may only carry the parameter keys
/// that command accepts. This is what keeps a profile from becoming an arbitrary
/// command line. The pairs are asserted against `nativeCommandRegistry.ts` by
/// `plannedServicesIntegrity.test.ts`, so the two lists cannot drift apart.
const ALLOWED_PROFILE_STEPS: &[(&str, &str, &[&str])] = &[
    ("m01.system.discover", "m01_system_discover_complete", &[]),
    ("m01.winget.verify", "m01_winget_verify", &[]),
    (
        "m01.winget.install",
        "m01_winget_install_queued",
        &["packageId"],
    ),
    (
        "m01.apps.inventory.export",
        "m01_installed_app_inventory_export",
        &["format"],
    ),
    (
        "m01.catalog.essential",
        "m01_essential_catalog",
        &["scope", "filter"],
    ),
    (
        "m02.cleanup.scan",
        "m02_cleanup_scan_complete",
        &["categories"],
    ),
    ("m02.cache.delivery", "m02_delivery_cache", &["scope"]),
    (
        "m02.recycle.review",
        "m02_recycle_bin_review",
        &["includeDetails"],
    ),
    ("m04.space.check", "m04_space_check_complete", &[]),
    ("m04.storage.scan", "m04_storage_scan_complete", &[]),
    ("m07.update.manage", "m07_windows_update_manage", &[]),
    ("m08.dns.flush", "m08_flush_dns", &[]),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileStepInput {
    pub step_id: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub parameters: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileStep {
    pub order: u32,
    pub step_id: String,
    pub native_command: String,
    pub enabled: bool,
    pub parameters: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileTarget {
    pub path: String,
    pub accepted: bool,
    pub exists: bool,
    pub is_directory: bool,
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostFormatProfileRequest {
    pub profile_name: String,
    #[serde(default)]
    pub target_paths: Vec<String>,
    #[serde(default)]
    pub steps: Vec<ProfileStepInput>,
    #[serde(default)]
    pub run_after_format_scan: Option<bool>,
    #[serde(default)]
    pub interval_days: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostFormatProfile {
    pub profile_id: String,
    pub profile_name: String,
    pub file_path: String,
    pub file_name: String,
    pub byte_count: u64,
    pub sha256: String,
    pub read_back_verified: bool,
    pub targets: Vec<ProfileTarget>,
    pub accepted_target_count: usize,
    pub rejected_targets: Vec<String>,
    pub steps: Vec<ProfileStep>,
    pub rejected_steps: Vec<String>,
    pub run_after_format_scan: bool,
    pub interval_days: Option<u32>,
    pub os_scheduler_registration: String,
    pub changed_system_state: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostFormatProfileList {
    pub profiles: Vec<StoredProfileSummary>,
    pub directory: String,
    pub directory_exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredProfileSummary {
    pub profile_id: String,
    pub profile_name: String,
    pub file_path: String,
    pub byte_count: u64,
    pub sha256: String,
    pub read_back_verified: bool,
    pub step_count: usize,
    pub accepted_target_count: usize,
    pub run_after_format_scan: bool,
    pub interval_days: Option<u32>,
    pub modified_at: String,
    pub parse_error: Option<String>,
}

fn profile_directory(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("profile_app_data_failed:{error}"))?
        .join("post-format-profiles");
    fs::create_dir_all(&base).map_err(|error| format!("profile_directory_failed:{error}"))?;
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
        return Err("profile_name_has_no_usable_characters".into());
    }
    Ok(trimmed.chars().take(64).collect())
}

fn validate_target(value: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("profile_target_is_empty".into());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("profile_target_must_be_absolute".into());
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("profile_target_must_not_contain_parent_segments".into());
    }
    Ok(path)
}

#[tauri::command]
pub async fn m01_post_format_profile_create(
    app: AppHandle,
    op_id: String,
    request: PostFormatProfileRequest,
) -> Result<OperationResult<PostFormatProfile>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, &request);
        Ok(unavailable(
            op_id,
            "m01_s08",
            "m01.profiles.postformat.create",
            started_at,
            timer,
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let mut warnings: Vec<String> = Vec::new();
        if request.steps.len() > MAX_PROFILE_STEPS {
            return Ok(result(
                op_id,
                "m01_s08",
                "m01.profiles.postformat.create",
                started_at,
                timer,
                None,
                "failed",
                format!("A profile may contain at most {MAX_PROFILE_STEPS} steps."),
                format!("يسمح ملف التعريف بـ {MAX_PROFILE_STEPS} خطوة كحد أقصى."),
                Vec::new(),
                Some("profile_too_many_steps".into()),
                None,
                None,
            ));
        }
        if request.target_paths.len() > MAX_TARGET_PATHS {
            return Ok(result(
                op_id,
                "m01_s08",
                "m01.profiles.postformat.create",
                started_at,
                timer,
                None,
                "failed",
                format!("A profile may reference at most {MAX_TARGET_PATHS} target paths."),
                format!("يسمح ملف التعريف بـ {MAX_TARGET_PATHS} مسارًا كحد أقصى."),
                Vec::new(),
                Some("profile_too_many_targets".into()),
                None,
                None,
            ));
        }

        let id = match profile_id(&request.profile_name) {
            Ok(id) => id,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m01_s08",
                    "m01.profiles.postformat.create",
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

        let mut targets: Vec<ProfileTarget> = Vec::new();
        for raw in &request.target_paths {
            match validate_target(raw) {
                Ok(path) => {
                    let exists = path.exists();
                    let is_directory = path.is_dir();
                    let mut rejection = None;
                    if !exists {
                        rejection = Some("path_does_not_exist".into());
                    } else if !is_directory {
                        rejection = Some("path_is_not_a_directory".into());
                    }
                    targets.push(ProfileTarget {
                        path: path.to_string_lossy().to_string(),
                        accepted: rejection.is_none(),
                        exists,
                        is_directory,
                        rejection_reason: rejection,
                    });
                }
                Err(reason) => targets.push(ProfileTarget {
                    path: raw.clone(),
                    accepted: false,
                    exists: false,
                    is_directory: false,
                    rejection_reason: Some(reason),
                }),
            }
        }
        let rejected_targets: Vec<String> = targets
            .iter()
            .filter(|target| !target.accepted)
            .map(|target| {
                format!(
                    "{} ({})",
                    target.path,
                    target
                        .rejection_reason
                        .clone()
                        .unwrap_or_else(|| "rejected".into())
                )
            })
            .collect();
        let accepted_target_count = targets.iter().filter(|target| target.accepted).count();
        if !rejected_targets.is_empty() {
            warnings.push(format!(
                "{} target path(s) were recorded but marked unusable: {}",
                rejected_targets.len(),
                rejected_targets.join("; ")
            ));
        }

        let mut steps: Vec<ProfileStep> = Vec::new();
        let mut rejected_steps: Vec<String> = Vec::new();
        for (index, step) in request.steps.iter().enumerate() {
            let Some((_, native_command, allowed_keys)) = ALLOWED_PROFILE_STEPS
                .iter()
                .find(|(handler, _, _)| *handler == step.step_id)
            else {
                rejected_steps.push(format!("{}: handler not allowlisted", step.step_id));
                continue;
            };
            let mut parameters = BTreeMap::new();
            let mut rejected = false;
            for (key, value) in &step.parameters {
                if !allowed_keys.contains(&key.as_str()) {
                    rejected_steps.push(format!(
                        "{}: parameter \"{key}\" not allowlisted",
                        step.step_id
                    ));
                    rejected = true;
                    continue;
                }
                if value.chars().count() > 200 {
                    rejected_steps
                        .push(format!("{}: parameter \"{key}\" is too long", step.step_id));
                    rejected = true;
                    continue;
                }
                parameters.insert(key.clone(), value.clone());
            }
            if rejected {
                continue;
            }
            steps.push(ProfileStep {
                order: index as u32 + 1,
                step_id: step.step_id.clone(),
                native_command: (*native_command).to_string(),
                enabled: step.enabled,
                parameters,
            });
        }
        if !rejected_steps.is_empty() {
            warnings.push(format!(
                "{} step(s) were refused because they named something outside the allowlist: {}",
                rejected_steps.len(),
                rejected_steps.join("; ")
            ));
        }
        if steps.is_empty() {
            warnings.push(
                "No allowlisted step survived validation, so the profile records no action.".into(),
            );
        }

        let now = Utc::now().to_rfc3339();
        let mut profile = PostFormatProfile {
            profile_id: id.clone(),
            profile_name: request.profile_name.trim().to_string(),
            file_path: String::new(),
            file_name: format!("{id}.json"),
            byte_count: 0,
            sha256: String::new(),
            read_back_verified: false,
            targets,
            accepted_target_count,
            rejected_targets,
            steps,
            rejected_steps,
            run_after_format_scan: request.run_after_format_scan.unwrap_or(true),
            interval_days: request.interval_days,
            os_scheduler_registration:
                "not_registered: this service records the profile only; no Windows scheduled task or RunOnce entry was created"
                    .into(),
            changed_system_state: false,
            created_at: now.clone(),
            updated_at: now,
        };

        let directory = match profile_directory(&app) {
            Ok(directory) => directory,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m01_s08",
                    "m01.profiles.postformat.create",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The profile directory could not be prepared.".into(),
                    "تعذّر تجهيز مجلد ملفات التعريف.".into(),
                    vec![reason.clone()],
                    Some("profile_directory_failed".into()),
                    None,
                    None,
                ))
            }
        };
        let path = directory.join(format!("{id}.json"));
        // The path is written into the document itself so the stored file is
        // self-describing rather than only resolvable by whoever listed it.
        profile.file_path = path.to_string_lossy().to_string();
        let mut payload = serde_json::to_vec_pretty(&profile)
            .map_err(|error| format!("profile_serialize_failed:{error}"))?;
        payload.push(b'\n');
        let temporary = directory.join(format!("{id}.json.tmp"));
        if let Err(reason) = fs::write(&temporary, &payload) {
            let _ = fs::remove_file(&temporary);
            return Ok(result(
                op_id,
                "m01_s08",
                "m01.profiles.postformat.create",
                started_at,
                timer,
                None,
                "failed",
                "The profile document could not be written.".into(),
                "تعذّرت كتابة مستند ملف التعريف.".into(),
                vec![format!("profile_write_failed:{reason}")],
                Some("profile_write_failed".into()),
                None,
                None,
            ));
        }
        if let Err(reason) = fs::rename(&temporary, &path) {
            let _ = fs::remove_file(&temporary);
            return Ok(result(
                op_id,
                "m01_s08",
                "m01.profiles.postformat.create",
                started_at,
                timer,
                None,
                "failed",
                "The profile document could not be committed.".into(),
                "تعذّر تثبيت مستند ملف التعريف.".into(),
                vec![format!("profile_commit_failed:{reason}")],
                Some("profile_commit_failed".into()),
                None,
                None,
            ));
        }
        // The profile is only "created" once the committed bytes are read back, parsed
        // again, and found to hold the same identity.
        let disk = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m01_s08",
                    "m01.profiles.postformat.create",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The committed profile could not be read back.".into(),
                    "تعذّرت قراءة ملف التعريف بعد التثبيت.".into(),
                    vec![format!("profile_read_back_failed:{reason}")],
                    Some("profile_read_back_failed".into()),
                    None,
                    None,
                ))
            }
        };
        let digest = sha256_hex(&disk);
        let reparsed: Result<PostFormatProfile, _> = serde_json::from_slice(&disk);
        let read_back_verified = match &reparsed {
            Ok(stored) => {
                stored.profile_id == id
                    && stored.profile_name == request.profile_name.trim()
                    && stored.steps.len() == profile.steps.len()
            }
            Err(_) => false,
        };
        if !read_back_verified {
            warnings.push("The committed profile did not match the in-memory document.".into());
        }

        let mut created = profile;
        created.file_path = path.to_string_lossy().to_string();
        created.byte_count = disk.len() as u64;
        created.sha256 = digest;
        created.read_back_verified = read_back_verified;

        Ok(result(
            op_id,
            "m01_s08",
            "m01.profiles.postformat.create",
            started_at,
            timer,
            Some(created),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "A post-format profile was written, read back and hashed. No system state was changed."
                .into(),
            "تمكتابة ملف تعريف ما بعد التهيئة وقراءته وتجزئة محتواه. لم تتغير حالة النظام.".into(),
            warnings,
            None,
            None,
            None,
        ))
    }
}

/// Resolve a handler to the exact command it is registered to. Used by the allowlist
/// test so the table cannot name a command that does not exist.
#[cfg(test)]
fn native_command_for(handler: &str) -> Option<&'static str> {
    ALLOWED_PROFILE_STEPS
        .iter()
        .find(|(id, _, _)| *id == handler)
        .map(|(_, command, _)| *command)
}

#[tauri::command]
pub fn m01_post_format_profiles(
    app: AppHandle,
    op_id: Option<String>,
) -> Result<OperationResult<PostFormatProfileList>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let op_id = op_id.unwrap_or_else(|| "op_profile_list".to_string());
    let directory = match profile_directory(&app) {
        Ok(directory) => directory,
        Err(reason) => {
            return Ok(result(
                op_id,
                "m01_s08",
                "m01.profiles.postformat.list",
                started_at,
                timer,
                None,
                "failed",
                "The profile directory could not be read.".into(),
                "تعذّرت قراءة مجلد ملفات التعريف.".into(),
                vec![reason.clone()],
                Some("profile_directory_failed".into()),
                None,
                None,
            ))
        }
    };
    let mut profiles: Vec<StoredProfileSummary> = Vec::new();
    let mut warnings = Vec::new();
    let entries = match fs::read_dir(&directory) {
        Ok(entries) => entries,
        Err(reason) => {
            return Ok(result(
                op_id,
                "m01_s08",
                "m01.profiles.postformat.list",
                started_at,
                timer,
                None,
                "failed",
                "The profile directory could not be listed.".into(),
                "تعذّر سرد مجلد ملفات التعريف.".into(),
                vec![format!("profile_list_failed:{reason}")],
                Some("profile_list_failed".into()),
                None,
                None,
            ))
        }
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(reason) => {
                warnings.push(format!("{}: {reason}", path.display()));
                continue;
            }
        };
        let digest = sha256_hex(&bytes);
        let modified_at = entry
            .metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|value| {
                chrono::DateTime::<Utc>::from_timestamp(value.as_secs() as i64, 0)
                    .map(|stamp| stamp.to_rfc3339())
                    .unwrap_or_default()
            })
            .unwrap_or_default();
        match serde_json::from_slice::<PostFormatProfile>(&bytes) {
            Ok(stored) => profiles.push(StoredProfileSummary {
                profile_id: stored.profile_id,
                profile_name: stored.profile_name,
                file_path: path.to_string_lossy().to_string(),
                byte_count: bytes.len() as u64,
                sha256: digest.clone(),
                read_back_verified: true,
                step_count: stored.steps.len(),
                accepted_target_count: stored.accepted_target_count,
                run_after_format_scan: stored.run_after_format_scan,
                interval_days: stored.interval_days,
                modified_at,
                parse_error: None,
            }),
            Err(reason) => {
                warnings.push(format!("{}: {reason}", path.display()));
                profiles.push(StoredProfileSummary {
                    profile_id: path
                        .file_stem()
                        .map(|value| value.to_string_lossy().to_string())
                        .unwrap_or_default(),
                    profile_name: String::new(),
                    file_path: path.to_string_lossy().to_string(),
                    byte_count: bytes.len() as u64,
                    sha256: digest,
                    read_back_verified: false,
                    step_count: 0,
                    accepted_target_count: 0,
                    run_after_format_scan: false,
                    interval_days: None,
                    modified_at,
                    parse_error: Some(reason.to_string()),
                });
            }
        }
    }
    profiles.sort_by(|left, right| left.profile_id.cmp(&right.profile_id));

    Ok(result(
        op_id,
        "m01_s08",
        "m01.profiles.postformat.list",
        started_at,
        timer,
        Some(PostFormatProfileList {
            profiles,
            directory: directory.to_string_lossy().to_string(),
            directory_exists: directory.is_dir(),
        }),
        if warnings.is_empty() {
            "completed"
        } else {
            "completed_with_warnings"
        },
        "Stored post-format profiles were read from disk.".into(),
        "تمت قراءة ملفات تعريف ما بعد التهيئة المخزّنة من القرص.".into(),
        warnings,
        None,
        None,
        None,
    ))
}

#[cfg(test)]
mod tests {
    use super::{
        csv_escape, html_escape, native_command_for, parse_inventory, parse_winget_diagnosis,
        profile_id, sanitize_file_stem, validate_target, ALLOWED_PROFILE_STEPS, INVENTORY_SCRIPT,
        MAX_INVENTORY_ITEMS,
    };
    use serde_json::json;

    #[test]
    fn bundled_catalog_is_valid_and_non_empty() {
        let catalog: serde_json::Value =
            serde_json::from_str(super::CATALOG_EMBEDDED).expect("bundled catalog parses");
        assert_eq!(catalog["schemaVersion"], json!(1));
        let items = catalog["items"].as_array().expect("items array");
        assert!(items.len() >= 20, "catalog must carry a real policy list");
        for item in items {
            for key in ["id", "category", "nameEn", "nameAr", "packageId", "match"] {
                assert!(
                    item.get(key).is_some(),
                    "catalog item is missing {key}: {item}"
                );
            }
            assert!(
                ["essential", "security", "development"]
                    .contains(&item["category"].as_str().unwrap()),
                "unexpected category in {item}"
            );
        }
    }

    #[test]
    fn inventory_script_never_builds_a_command_from_data() {
        // The inventory script only reads registry values. It must contain no dynamic
        // invocation, so a display name can never become executable text.
        for forbidden in [
            "Invoke-Expression",
            "iex ",
            "Invoke-Command",
            "cmd /c",
            "Start-Process",
        ] {
            assert!(
                !INVENTORY_SCRIPT.contains(forbidden),
                "inventory script must not contain {forbidden}"
            );
        }
    }

    #[test]
    fn parse_inventory_keeps_one_representative_per_name_and_version() {
        let payload = json!({
            "hives": [
                { "hive": "HKLM64", "registryPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                  "present": true, "keysRead": 2, "entriesKept": 2,
                  "entriesSkippedSystemComponent": 1, "entriesSkippedUpdate": 1 }
            ],
            "items": [
                { "displayName": "Git", "registryKey": "Git_is1", "hive": "HKLM64", "publisher": "Git",
                  "version": "2.44.0", "installLocation": "C:\\Program Files\\Git", "installDate": null,
                  "estimatedSizeBytes": 1234, "uninstallString": null, "isWindowsInstaller": false },
                { "displayName": "git", "registryKey": "Git_is1", "hive": "HKLM32", "publisher": "Git",
                  "version": "2.44.0", "installLocation": null, "installDate": null,
                  "estimatedSizeBytes": null, "uninstallString": null, "isWindowsInstaller": false }
            ]
        });
        let inventory = parse_inventory(&payload.to_string()).expect("inventory parses");
        assert_eq!(inventory.apps.len(), 1);
        assert_eq!(inventory.duplicate_display_names_collapsed, 1);
        assert_eq!(inventory.hives[0].entries_skipped_system_component, 1);
        assert_eq!(inventory.hives[0].entries_skipped_update, 1);
        assert_eq!(inventory.total_keys_read, 2);
    }

    #[test]
    fn parse_inventory_refuses_a_payload_without_hives() {
        let payload = json!({ "hives": [], "items": [] }).to_string();
        assert_eq!(
            parse_inventory(&payload).expect_err("must fail"),
            "inventory_reported_no_registry_hive"
        );
    }

    #[test]
    fn parse_inventory_reports_truncation_instead_of_hiding_it() {
        let items: Vec<serde_json::Value> = (0..MAX_INVENTORY_ITEMS + 5)
            .map(|index| {
                json!({
                    "displayName": format!("App {index}"),
                    "registryKey": format!("key{index}"),
                    "hive": "HKLM64",
                    "publisher": "",
                    "version": null,
                    "installLocation": null,
                    "installDate": null,
                    "estimatedSizeBytes": null,
                    "uninstallString": null,
                    "isWindowsInstaller": null
                })
            })
            .collect();
        let payload = json!({
            "hives": [{ "hive": "HKLM64", "registryPath": "p", "present": true, "keysRead": 1,
                        "entriesKept": 1, "entriesSkippedSystemComponent": 0, "entriesSkippedUpdate": 0 }],
            "items": items
        });
        let inventory = parse_inventory(&payload.to_string()).expect("inventory parses");
        assert!(inventory.inventory_truncated);
        assert_eq!(inventory.apps.len(), MAX_INVENTORY_ITEMS);
    }

    #[test]
    fn a_full_inventory_parses_in_bounded_time() {
        // The dedupe step used to compare every entry against every kept entry, which
        // made a twenty-thousand-entry registry take minutes. This asserts the collapse
        // path stays linear enough to be usable, without asserting a wall-clock time.
        let items: Vec<serde_json::Value> = (0..MAX_INVENTORY_ITEMS)
            .map(|index| {
                json!({
                    // Every entry appears twice, so the dedupe really has work to do.
                    "displayName": format!("App {}", index % 4_000),
                    "registryKey": format!("key{index}"),
                    "hive": if index % 2 == 0 { "HKLM64" } else { "HKLM32" },
                    "publisher": "",
                    "version": "1.0.0",
                    "installLocation": null,
                    "installDate": null,
                    "estimatedSizeBytes": null,
                    "uninstallString": null,
                    "isWindowsInstaller": null
                })
            })
            .collect();
        let payload = json!({
            "hives": [{ "hive": "HKLM64", "registryPath": "p", "present": true, "keysRead": 1,
                        "entriesKept": 1, "entriesSkippedSystemComponent": 0, "entriesSkippedUpdate": 0 }],
            "items": items
        });
        let started = std::time::Instant::now();
        let inventory = parse_inventory(&payload.to_string()).expect("inventory parses");
        let elapsed = started.elapsed();
        assert_eq!(inventory.apps.len(), 4_000);
        assert_eq!(
            inventory.duplicate_display_names_collapsed,
            MAX_INVENTORY_ITEMS - 4_000
        );
        assert!(
            elapsed.as_secs() < 20,
            "a full inventory took {elapsed:?}; the dedupe path is not linear"
        );
    }

    #[test]
    fn winget_diagnosis_records_the_literals_it_matched() {
        let payload = json!({
            "wingetPath": "C:\\Program Files\\WindowsApps\\winget.exe",
            "wingetVersion": "v1.9.23400",
            "sourceListSucceeded": true,
            "sourceListText": "Name: msstore\nState: Updated Required (0x8a15002b)",
            "sourceListError": "",
            "diagRoot": "C:\\Users\\x\\AppData\\Local\\Packages",
            "diagRootExists": true,
            "diagLogs": [{ "name": "log.diagnostic.txt", "sizeBytes": 2048, "lastModified": "2026-09-26T00:00:00Z" }],
            "windowsBuild": "26200",
            "osCaption": "Microsoft Windows 11 Pro",
            "measuredAt": "2026-09-26T00:00:00Z"
        });
        let diagnosis = parse_winget_diagnosis(&payload.to_string()).expect("diagnosis parses");
        assert_eq!(diagnosis.winget_version, "v1.9.23400");
        assert!(diagnosis
            .source_markers_matched
            .contains(&"0x8a15002b".to_string()));
        assert_eq!(diagnosis.diag_logs.len(), 1);
    }

    #[test]
    fn guidance_is_driven_by_measurement_and_never_executes() {
        use super::build_guidance;
        let diagnosis = super::WingetDiagnosis {
            winget_path: String::new(),
            winget_version: String::new(),
            source_list_succeeded: false,
            source_list_text: String::new(),
            source_list_error: Some("boom".into()),
            source_markers_matched: vec![],
            diag_root: "C:\\diag".into(),
            diag_root_exists: true,
            diag_logs: vec![],
            windows_build: "26200".into(),
            os_caption: "Windows 11".into(),
            measured_at: "2026-09-26T00:00:00Z".into(),
        };
        let (steps, omitted_scope, _) = build_guidance(&diagnosis, "local", "package");
        assert!(steps.iter().any(|step| step.id == "install-app-installer"));
        // The diagnostic-log step needs elevation, so a local-scope request drops it.
        assert!(!steps.iter().any(|step| step.id == "inspect-diagnostic-log"));
        assert_eq!(omitted_scope, 1);
        for step in &steps {
            assert!(
                !step.evidence.trim().is_empty(),
                "step {} was offered without evidence",
                step.id
            );
        }
        let (source_steps, _, _) = build_guidance(&diagnosis, "system", "source");
        assert!(
            source_steps
                .iter()
                .all(|step| step.id.starts_with("source-")),
            "source scope must not leak unrelated steps"
        );
    }

    #[test]
    fn profile_names_become_safe_file_names() {
        assert_eq!(profile_id("After Format").expect("id"), "after-format");
        assert_eq!(profile_id("  Trailing  ").expect("id"), "trailing");
        assert!(profile_id("///").is_err());
        assert!(profile_id("").is_err());
    }

    #[test]
    fn target_paths_must_be_absolute_and_without_parent_segments() {
        assert!(validate_target("relative/path").is_err());
        assert!(validate_target(r"C:\Users\x\..\Windows").is_err());
        assert!(validate_target("   ").is_err());
        assert!(validate_target(r"C:\Users\x\Documents").is_ok());
    }

    #[test]
    fn file_stem_sanitising_removes_traversal_characters() {
        for hostile in ["..\\..\\evil", "../../evil", "....", "  ", "-_-", ".config"] {
            let stem = sanitize_file_stem(hostile);
            assert!(!stem.contains('\\'), "separator survived in {stem}");
            assert!(!stem.contains('/'), "separator survived in {stem}");
            assert!(!stem.contains(".."), "traversal survived in {stem}");
            assert!(!stem.starts_with('.'), "hidden file name produced: {stem}");
            assert!(!stem.is_empty(), "empty file stem from {hostile}");
        }
        assert_eq!(sanitize_file_stem(""), "knoux-installed-apps");
        assert_eq!(sanitize_file_stem("   "), "knoux-installed-apps");
        assert_eq!(sanitize_file_stem("my report 2026"), "my_report_2026");
        assert_eq!(sanitize_file_stem("knoux.apps"), "knoux.apps");
    }

    #[test]
    fn only_allowlisted_profile_steps_resolve_to_a_real_command() {
        assert_eq!(
            native_command_for("m01.system.discover"),
            Some("m01_system_discover_complete")
        );
        assert_eq!(native_command_for("rm -rf /"), None);
        // Every allowlisted step must name a command, never leave it blank, and never
        // repeat a handler.
        let mut handlers: Vec<&str> = ALLOWED_PROFILE_STEPS
            .iter()
            .map(|(handler, _, _)| *handler)
            .collect();
        handlers.sort_unstable();
        let count = handlers.len();
        handlers.dedup();
        assert_eq!(handlers.len(), count, "duplicate handler in the allowlist");
        for (handler, command, _) in ALLOWED_PROFILE_STEPS {
            assert!(!command.is_empty(), "handler {handler} has no command name");
        }
    }

    #[test]
    fn export_escaping_is_lossless_for_csv_and_html() {
        assert_eq!(csv_escape("plain"), "plain");
        assert_eq!(csv_escape("a,b"), "\"a,b\"");
        assert_eq!(csv_escape("say \"hi\""), "\"say \"\"hi\"\"\"");
        assert_eq!(
            html_escape("<script>&\"'"),
            "&lt;script&gt;&amp;&quot;&#39;"
        );
    }
}
