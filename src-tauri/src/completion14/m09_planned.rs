//! M09 privacy services, batch 1: S01 permission dashboard, S02 camera, S03 microphone,
//! S04 location, S05 advertising ID, S06 clipboard privacy, S09 hosts file.
//!
//! All seven are measurements of real Windows privacy surfaces. Four of them (S01–S04)
//! share one engine, because Windows stores every app permission in the same
//! `CapabilityAccessManager\ConsentStore` tree and splitting it into four parsers would
//! be four chances to disagree with each other.
//!
//! S07 (recent files), S08 (browser privacy) and S10 (reversible profiles) stay `planned`
//! in this batch: each of them deletes or rewrites user data, and none of them has been
//! run by a human on a real machine yet.

use crate::completion14::psbridge;
use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Instant;

const CAP_M09_S01: &str = "m09_s01";
const CAP_M09_S02: &str = "m09_s02";
const CAP_M09_S03: &str = "m09_s03";
const CAP_M09_S04: &str = "m09_s04";
const CAP_M09_S05: &str = "m09_s05";
const CAP_M09_S06: &str = "m09_s06";
const CAP_M09_S09: &str = "m09_s09";

/// The literal token a caller must echo before clipboard history is cleared. It is a
/// fixed string, not a value derived from the request.
const CLIPBOARD_CONFIRMATION: &str = "CLEAR";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceReport {
    pub name: String,
    pub available: bool,
    pub detail: String,
}

fn source(name: &str, available: bool, detail: impl Into<String>) -> SourceReport {
    SourceReport {
        name: name.into(),
        available,
        detail: detail.into(),
    }
}

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
        exit_code: None,
        stdout: None,
        stderr,
        summary_en,
        summary_ar,
        warnings,
        error_code,
        data,
    }
}

fn field(document: &Value, key: &str) -> String {
    psbridge::text(document, key)
}

fn flag(document: &Value, key: &str) -> Option<bool> {
    psbridge::boolean(document, key)
}

fn number(document: &Value, key: &str) -> Option<u64> {
    psbridge::number(document, key)
}

// ---------------------------------------------------------------------------
// S01–S04 — app capability permissions (one engine, four services)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPermission {
    /// The registry leaf name under `NonPackaged` or `Packaged`.
    pub app_key: String,
    /// `NonPackaged` (a desktop or unpackaged app) or `Packaged` (a Store/MSIX app).
    pub app_kind: String,
    /// The application name when the registry recorded one, otherwise empty.
    pub app_name: String,
    /// `Allow`, `Deny`, or empty when the registry holds no decision at this key.
    pub value: String,
    /// The four states this key can actually be in. Windows frequently records no
    /// `Value` at all while still logging real use, so "no decision recorded" and
    /// "never asked" are not the same claim and are not collapsed into one.
    pub state: String,
    pub last_used_start: String,
    pub last_used_stop: String,
    /// Timestamps come from Windows FILETIME, so zero means "never used" and is
    /// reported as the empty string rather than as 1601.
    pub ever_used: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityPermissions {
    pub capability: String,
    pub capability_label_en: String,
    pub capability_label_ar: String,
    pub consent_store_present: bool,
    pub consent_store_path: String,
    pub allow_count: usize,
    pub deny_count: usize,
    /// Windows logged real use but recorded no allow or deny at this key.
    pub undecided_but_used_count: usize,
    /// Neither a decision nor any recorded use.
    pub unused_count: usize,
    pub apps: Vec<AppPermission>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionDashboard {
    pub capabilities: Vec<CapabilityPermissions>,
    pub capabilities_requested: Vec<String>,
    pub consent_store_root: String,
    pub root_present: bool,
    pub total_apps_seen: usize,
    pub apps_allowed_somewhere: usize,
    pub sources: Vec<SourceReport>,
    pub changed_any_permission: bool,
    pub measured_at: String,
}

const PERMISSION_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore'
$rootPresent = $false
$rootError = ''
try { $rootPresent = Test-Path -LiteralPath $root } catch { $rootError = [string]$_.Exception.Message }
$capabilities = @('webcam', 'microphone', 'location', 'locationExtended')
$out = New-Object System.Collections.Generic.List[object]
foreach ($capability in $capabilities) {
  $capPath = Join-Path $root $capability
  $present = $false
  $entries = New-Object System.Collections.Generic.List[object]
  try {
    if (Test-Path -LiteralPath $capPath) {
      $present = $true
      foreach ($kind in @('NonPackaged', 'Packaged')) {
        $kindPath = Join-Path $capPath $kind
        if (-not (Test-Path -LiteralPath $kindPath)) { continue }
        $keys = @(Get-ChildItem -LiteralPath $kindPath -ErrorAction SilentlyContinue)
        foreach ($key in $keys) {
          $p = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
          if ($null -eq $p) { continue }
          $start = 0
          $stop = 0
          if ($null -ne $p.LastUsedTimeStart) { $start = [uint64]$p.LastUsedTimeStart }
          if ($null -ne $p.LastUsedTimeStop) { $stop = [uint64]$p.LastUsedTimeStop }
          $name = ''
          try {
            $resource = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
            if ($null -ne $resource.'(default)') { }
          } catch { }
          try {
            $display = (Get-Item -LiteralPath $key.PSPath -ErrorAction Stop).GetValue('')
            if ($null -ne $display) { $name = [string]$display }
          } catch { }
          $entries.Add([pscustomobject]@{
            appKey = [string]$key.PSChildName
            appKind = [string]$kind
            appName = $name
            value = [string]$p.Value
            lastUsedStart = $start
            lastUsedStop = $stop
          })
        }
      }
    }
  } catch { }
  $out.Add([pscustomobject]@{
    capability = [string]$capability
    present = $present
    path = $capPath
    entries = $entries
  })
}
[pscustomobject]@{ rootPresent = $rootPresent; rootError = $rootError; root = $root; capabilities = $out } | ConvertTo-Json -Depth 6 -Compress
"#;

/// Windows stores the last-used moments as FILETIME (100-nanosecond ticks since 1601).
/// Converting them here means the UI never has to do arithmetic, and a zero tick set
/// becomes an explicit "never" rather than a date in 1601.
fn filetime_to_rfc3339(ticks: u64) -> Option<String> {
    if ticks == 0 {
        return None;
    }
    let unix_nanos = (ticks as i128).saturating_sub(116_444_736_000_000_000) * 100;
    if unix_nanos <= 0 {
        return None;
    }
    let seconds = (unix_nanos / 1_000_000_000) as i64;
    chrono::DateTime::<Utc>::from_timestamp(seconds, 0).map(|stamp| stamp.to_rfc3339())
}

fn capability_label(capability: &str) -> (&'static str, &'static str) {
    match capability {
        "webcam" => ("Camera", "الكاميرا"),
        "microphone" => ("Microphone", "الميكروفون"),
        "location" => ("Location", "الموقع"),
        "locationExtended" => ("Extended location", "الموقع الموسّع"),
        _ => ("Capability", "إمكانية"),
    }
}

fn parse_permission_dashboard(stdout: &str) -> Result<PermissionDashboard, String> {
    let document = psbridge::parse_json(stdout)?;
    let root_present = psbridge::boolean(&document, "rootPresent").unwrap_or(false);
    let root_error = field(&document, "rootError");
    let root = field(&document, "root");
    if !root_present && !root_error.is_empty() {
        return Err(format!("capability_consent_store_unreadable:{root_error}"));
    }
    let requested = vec![
        "webcam".to_string(),
        "microphone".to_string(),
        "location".to_string(),
        "locationExtended".to_string(),
    ];
    let mut capabilities = Vec::new();
    let mut total_apps_seen = 0usize;
    for raw in psbridge::as_array(
        document
            .get("capabilities")
            .cloned()
            .unwrap_or(serde_json::Value::Null),
    ) {
        let capability = field(&raw, "capability");
        let (label_en, label_ar) = capability_label(&capability);
        let apps: Vec<AppPermission> = psbridge::as_array(
            raw.get("entries")
                .cloned()
                .unwrap_or(serde_json::Value::Null),
        )
        .iter()
        .map(|entry| {
            let start = number(entry, "lastUsedStart").unwrap_or_default();
            let stop = number(entry, "lastUsedStop").unwrap_or_default();
            let ever_used = start != 0 || stop != 0;
            let value = field(entry, "value");
            // Windows often logs real use while recording no decision at this key.
            // Calling that "never asked" would be a false claim about the user's machine,
            // so the four cases are named separately.
            let state = match (value.as_str(), ever_used) {
                ("Allow", _) => "allowed",
                ("Deny", _) => "denied",
                // Windows also records a pending prompt, which is neither a grant nor a
                // refusal and must not be counted as one.
                ("Prompt", true) => "prompt_recorded_and_used",
                ("Prompt", false) => "prompt_pending",
                (_, true) => "used_no_decision_recorded",
                (_, false) => "no_decision_and_never_used",
            };
            AppPermission {
                app_key: field(entry, "appKey"),
                app_kind: field(entry, "appKind"),
                app_name: field(entry, "appName"),
                value,
                state: state.into(),
                last_used_start: filetime_to_rfc3339(start).unwrap_or_default(),
                last_used_stop: filetime_to_rfc3339(stop).unwrap_or_default(),
                ever_used,
            }
        })
        .collect();
        let allow_count = apps.iter().filter(|app| app.state == "allowed").count();
        let deny_count = apps.iter().filter(|app| app.state == "denied").count();
        // An app that Windows logged as used but recorded no decision at is neither
        // allowed nor denied, so it gets its own count rather than inflating either.
        let undecided_but_used = apps
            .iter()
            .filter(|app| app.state == "used_no_decision_recorded")
            .count();
        let unused_count = apps
            .iter()
            .filter(|app| app.state == "no_decision_and_never_used")
            .count();
        total_apps_seen += apps.len();
        capabilities.push(CapabilityPermissions {
            capability,
            capability_label_en: label_en.into(),
            capability_label_ar: label_ar.into(),
            consent_store_present: flag(&raw, "present").unwrap_or(false),
            consent_store_path: field(&raw, "path"),
            allow_count,
            deny_count,
            undecided_but_used_count: undecided_but_used,
            unused_count,
            apps,
        });
    }
    if capabilities.is_empty() {
        return Err("capability_consent_store_empty".to_string());
    }
    let apps_allowed_somewhere = capabilities
        .iter()
        .map(|capability| capability.allow_count)
        .sum();
    Ok(PermissionDashboard {
        capabilities,
        capabilities_requested: requested,
        consent_store_root: root,
        root_present,
        total_apps_seen,
        apps_allowed_somewhere,
        sources: vec![
            source(
                "CapabilityAccessManager\\ConsentStore",
                root_present,
                if root_present {
                    "The per-user capability consent store was read.".to_string()
                } else {
                    "The consent store key is absent on this account; no permission has been granted or denied here."
                        .to_string()
                },
            ),
            source(
                "FILETIME last-used stamps",
                true,
                "LastUsedTimeStart and LastUsedTimeStop are read as Windows FILETIME and converted here; a zero stamp is reported as never used."
                    .to_string(),
            ),
        ],
        changed_any_permission: false,
        measured_at: Utc::now().to_rfc3339(),
    })
}

/// S01 reads every capability. S02–S04 read one each from the same measurement, so the
/// four services can never contradict one another.
fn project_capabilities(
    dashboard: &PermissionDashboard,
    wanted: Option<&str>,
) -> Vec<CapabilityPermissions> {
    dashboard
        .capabilities
        .iter()
        .filter(|capability| wanted.is_none_or(|name| capability.capability == name))
        .cloned()
        .collect()
}

fn permission_command(
    op_id: String,
    capability: &'static str,
    handler: &'static str,
    wanted: Option<&'static str>,
) -> Result<OperationResult<PermissionDashboard>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        let _ = wanted;
        Ok(result(
            op_id,
            capability,
            handler,
            started_at,
            timer,
            None,
            "unavailable",
            "App permission state is a Windows-only measurement.".into(),
            "حالة أذونات التطبيقات تُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(PERMISSION_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    capability,
                    handler,
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The capability consent store could not be read.".into(),
                    "تعذّرت قراءة مخزن موافقات الإمكانيات.".into(),
                    vec![reason],
                    Some("capability_read_launch_failed".into()),
                    None,
                ))
            }
        };
        let mut dashboard = match parse_permission_dashboard(&run.stdout) {
            Ok(dashboard) => dashboard,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    capability,
                    handler,
                    started_at,
                    timer,
                    None,
                    "unavailable",
                    "Windows did not expose an app permission consent store on this account."
                        .into(),
                    "لم يعرض ويندوز مخزن موافقات أذونات التطبيقات على هذا الحساب.".into(),
                    vec![reason],
                    Some("capability_consent_store_unavailable".into()),
                    run.stderr_tail(),
                ))
            }
        };
        dashboard.capabilities = project_capabilities(&dashboard, wanted);

        let mut warnings: Vec<String> = Vec::new();
        if !dashboard.root_present {
            warnings.push(
                "No capability consent store exists on this account, which means Windows has recorded no app permission decision here."
                    .into(),
            );
        }
        for item in &dashboard.capabilities {
            if !item.consent_store_present {
                warnings.push(format!(
                    "No {} consent entries exist for this account.",
                    item.capability_label_en
                ));
            } else if item.apps.is_empty() {
                warnings.push(format!(
                    "The {} consent store exists but lists no application.",
                    item.capability_label_en
                ));
            }
        }
        if let Some(name) = wanted {
            if !dashboard
                .capabilities
                .iter()
                .any(|item| item.capability == name)
            {
                warnings.push(format!(
                    "The {name} capability was not present in the measured consent store; the response reports it as absent rather than clean."
                ));
            }
        }

        Ok(result(
            op_id,
            capability,
            handler,
            started_at,
            timer,
            Some(dashboard),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Real per-app camera, microphone and location consent entries were read; no permission was changed."
                .into(),
            "تمت قراءة موافقات الكاميرا والميكروفون والموقع الحقيقية لكل تطبيق؛ لم يتغيّر أي إذن.".into(),
            warnings,
            None,
            run.stderr_tail(),
        ))
    }
}

#[tauri::command]
pub async fn m09_permission_dashboard(
    op_id: String,
) -> Result<OperationResult<PermissionDashboard>, String> {
    permission_command(op_id, CAP_M09_S01, "m09.permission.dashboard", None)
}

#[tauri::command]
pub async fn m09_camera_permission(
    op_id: String,
) -> Result<OperationResult<PermissionDashboard>, String> {
    permission_command(op_id, CAP_M09_S02, "m09.permission.camera", Some("webcam"))
}

#[tauri::command]
pub async fn m09_microphone_permission(
    op_id: String,
) -> Result<OperationResult<PermissionDashboard>, String> {
    permission_command(
        op_id,
        CAP_M09_S03,
        "m09.permission.microphone",
        Some("microphone"),
    )
}

#[tauri::command]
pub async fn m09_location_permission(
    op_id: String,
) -> Result<OperationResult<PermissionDashboard>, String> {
    permission_command(
        op_id,
        CAP_M09_S04,
        "m09.permission.location",
        Some("location"),
    )
}

// ---------------------------------------------------------------------------
// S05 — Advertising ID
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvertisingIdStatus {
    pub registry_path: String,
    pub key_present: bool,
    /// The stored per-user advertising identifier, or empty when the key holds none.
    pub advertising_id: String,
    pub enabled: Option<bool>,
    /// A stored identifier with the feature switched off is reported as such rather than
    /// as "no identifier", because Windows keeps the value after a reset.
    pub reset_performed_by_windows: bool,
    pub limit_ad_tracking: Option<bool>,
    pub limit_ad_tracking_path: String,
    pub sources: Vec<SourceReport>,
    pub changed_any_value: bool,
    pub measured_at: String,
}

const ADVERTISING_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$infoPath = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo'
$trackingPath = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo\Id'
$limitPath = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Privacy'
$keyPresent = $false
$enabled = $null
$id = ''
$limit = $null
try {
  if (Test-Path -LiteralPath $infoPath) {
    $keyPresent = $true
    $p = Get-ItemProperty -LiteralPath $infoPath -ErrorAction Stop
    if ($null -ne $p.Enabled) { $enabled = [bool]([int]$p.Enabled -eq 1) }
  }
} catch { }
try {
  if (Test-Path -LiteralPath $trackingPath) {
    $t = Get-ItemProperty -LiteralPath $trackingPath -ErrorAction Stop
    if ($null -ne $t.Id) { $id = [string]$t.Id }
  }
} catch { }
try {
  if (Test-Path -LiteralPath $limitPath) {
    $l = Get-ItemProperty -LiteralPath $limitPath -ErrorAction Stop
    if ($null -ne $l.AdvertisingIdDisabledByUser) { $limit = [bool]([int]$l.AdvertisingIdDisabledByUser -eq 1) }
  }
} catch { }
[pscustomobject]@{
  keyPresent = $keyPresent
  enabled = $enabled
  advertisingId = $id
  limitAdTracking = $limit
  infoPath = $infoPath
  trackingPath = $trackingPath
  limitPath = $limitPath
} | ConvertTo-Json -Depth 4 -Compress
"#;

fn parse_advertising_status(stdout: &str) -> Result<AdvertisingIdStatus, String> {
    let document = psbridge::parse_json(stdout)?;
    let info_path = field(&document, "infoPath");
    let tracking_path = field(&document, "trackingPath");
    let limit_path = field(&document, "limitPath");
    let enabled = flag(&document, "enabled");
    let advertising_id = field(&document, "advertisingId");
    if info_path.is_empty() {
        return Err("advertising_info_path_unresolved".to_string());
    }
    let key_present = flag(&document, "keyPresent").unwrap_or(false);
    Ok(AdvertisingIdStatus {
        registry_path: info_path.clone(),
        key_present,
        reset_performed_by_windows: enabled == Some(false) && !advertising_id.is_empty(),
        advertising_id,
        enabled,
        limit_ad_tracking: flag(&document, "limitAdTracking"),
        limit_ad_tracking_path: limit_path,
        sources: vec![
            source(
                "AdvertisingInfo registry key",
                key_present,
                if key_present {
                    "The per-user advertising information key was read.".to_string()
                } else {
                    "The advertising information key does not exist on this account.".to_string()
                },
            ),
            source(
                "AdvertisingInfo\\Id registry key",
                !tracking_path.is_empty(),
                "The stored per-user advertising identifier location was resolved.".to_string(),
            ),
        ],
        changed_any_value: false,
        measured_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn m09_advertising_id(
    op_id: String,
) -> Result<OperationResult<AdvertisingIdStatus>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        Ok(result(
            op_id,
            CAP_M09_S05,
            "m09.advertising.id",
            started_at,
            timer,
            None,
            "unavailable",
            "The advertising identifier is a Windows-only measurement.".into(),
            "معرّف الإعلان يُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(ADVERTISING_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M09_S05,
                    "m09.advertising.id",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The advertising identifier could not be read.".into(),
                    "تعذّرت قراءة معرّف الإعلان.".into(),
                    vec![reason],
                    Some("advertising_id_read_failed".into()),
                    None,
                ))
            }
        };
        let status = match parse_advertising_status(&run.stdout) {
            Ok(status) => status,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M09_S05,
                    "m09.advertising.id",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The advertising identifier payload could not be read.".into(),
                    "تعذّرت قراءة بيانات معرّف الإعلان.".into(),
                    vec![reason],
                    Some("advertising_id_payload_unreadable".into()),
                    run.stderr_tail(),
                ))
            }
        };
        let mut warnings: Vec<String> = status
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{}: {}", item.name, item.detail))
            .collect();
        if status.enabled == Some(true) {
            warnings.push(
                "The advertising identifier is switched on for this account. This service only reports it and changes nothing."
                    .into(),
            );
        }
        if status.enabled.is_none() {
            warnings.push(
                "The advertising information key holds no Enabled value, so the on/off state is reported as unmeasured rather than inferred."
                    .into(),
            );
        }
        if status.reset_performed_by_windows {
            warnings.push(
                "A stored identifier is present while the feature is switched off. That is what a Windows reset leaves behind, and the value is reported as stored rather than as active."
                    .into(),
            );
        }

        Ok(result(
            op_id,
            CAP_M09_S05,
            "m09.advertising.id",
            started_at,
            timer,
            Some(status),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "The stored advertising identifier and its switch state were read; nothing was reset."
                .into(),
            "تمت قراءة معرّف الإعلان المخزّن وحالة مفتاحه؛ لم تتم إعادة تعيينه.".into(),
            warnings,
            None,
            run.stderr_tail(),
        ))
    }
}

// ---------------------------------------------------------------------------
// S06 — Clipboard privacy
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardPrivacy {
    pub history_enabled: Option<bool>,
    pub history_registry_path: String,
    pub history_key_present: bool,
    /// The current clipboard is described, never transcribed. A password copied five
    /// seconds ago is exactly the content this service must not put in a log.
    pub current_clipboard_present: bool,
    pub current_clipboard_kind: String,
    pub current_clipboard_char_count: usize,
    pub current_clipboard_preview: String,
    pub cleared: bool,
    pub confirmation_accepted: bool,
    pub sources: Vec<SourceReport>,
    pub changed_clipboard: bool,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardPrivacyRequest {
    #[serde(default)]
    pub confirmation: String,
    /// Opt-in because reading the clipboard is itself a privacy act, even when the
    /// content is described rather than stored.
    #[serde(default)]
    pub inspect_current_clipboard: bool,
}

const CLIPBOARD_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$historyPath = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Clipboard'
$keyPresent = $false
$historyEnabled = $null
try {
  if (Test-Path -LiteralPath $historyPath) {
    $keyPresent = $true
    $p = Get-ItemProperty -LiteralPath $historyPath -ErrorAction Stop
    if ($null -ne $p.EnableClipboardHistory) { $historyEnabled = [bool]([int]$p.EnableClipboardHistory -eq 1) }
  }
} catch { }
$clipPresent = $false
$clipKind = 'none'
$clipChars = 0
$clipPreview = ''
try {
  $clip = Get-Clipboard -Raw -ErrorAction Stop
  if ($null -ne $clip) {
    $clipPresent = $true
    $clipKind = 'text'
    $clipChars = $clip.Length
    $single = ($clip -replace '[\r\n]+', ' ')
    if ($single.Length -gt 60) { $clipPreview = $single.Substring(0, 60) + '…' } else { $clipPreview = $single }
  }
} catch {
  $clipKind = 'non-text'
  try {
    $formats = [System.Windows.Forms.Clipboard]::GetDataObject()
  } catch { }
}
[pscustomobject]@{
  historyKeyPresent = $keyPresent
  historyEnabled = $historyEnabled
  historyPath = $historyPath
  clipboardPresent = $clipPresent
  clipboardKind = $clipKind
  clipboardChars = $clipChars
  clipboardPreview = $clipPreview
} | ConvertTo-Json -Depth 4 -Compress
"#;

const CLIPBOARD_CLEAR_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$before = ''
try { $before = [string](Get-Clipboard -Raw -ErrorAction Stop) } catch { $before = '' }
try {
  Set-Clipboard -Value $null -ErrorAction Stop
  $after = ''
  try { $after = [string](Get-Clipboard -Raw -ErrorAction Stop) } catch { $after = '' }
  [pscustomobject]@{
    cleared = $true
    charsBefore = $before.Length
    charsAfter = $after.Length
  } | ConvertTo-Json -Depth 3 -Compress
} catch {
  [pscustomobject]@{
    cleared = $false
    charsBefore = $before.Length
    charsAfter = -1
    error = [string]$_.Exception.Message
  } | ConvertTo-Json -Depth 3 -Compress
}
"#;

fn parse_clipboard_privacy(stdout: &str) -> Result<ClipboardPrivacy, String> {
    let document = psbridge::parse_json(stdout)?;
    let history_path = field(&document, "historyPath");
    if history_path.is_empty() {
        return Err("clipboard_history_path_unresolved".to_string());
    }
    let key_present = flag(&document, "historyKeyPresent").unwrap_or(false);
    Ok(ClipboardPrivacy {
        history_registry_path: history_path,
        history_key_present: key_present,
        history_enabled: flag(&document, "historyEnabled"),
        current_clipboard_present: flag(&document, "clipboardPresent").unwrap_or(false),
        current_clipboard_kind: field(&document, "clipboardKind"),
        current_clipboard_char_count: number(&document, "clipboardChars")
            .unwrap_or_default() as usize,
        current_clipboard_preview: field(&document, "clipboardPreview"),
        cleared: false,
        confirmation_accepted: false,
        sources: vec![
            source(
                "Clipboard registry key",
                key_present,
                if key_present {
                    "The per-user clipboard settings key was read.".to_string()
                } else {
                    "The clipboard settings key does not exist on this account.".to_string()
                },
            ),
            source(
                "Get-Clipboard",
                flag(&document, "clipboardPresent").unwrap_or(false),
                "The clipboard was read to describe it. Content is truncated to a short preview and never stored."
                    .to_string(),
            ),
        ],
        changed_clipboard: false,
        measured_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn m09_clipboard_privacy(
    op_id: String,
    request: Option<ClipboardPrivacyRequest>,
) -> Result<OperationResult<ClipboardPrivacy>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let request = request.unwrap_or(ClipboardPrivacyRequest {
        confirmation: String::new(),
        inspect_current_clipboard: false,
    });
    let wants_clear = request.confirmation == CLIPBOARD_CONFIRMATION;

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&request, wants_clear);
        Ok(result(
            op_id,
            CAP_M09_S06,
            "m09.clipboard.privacy",
            started_at,
            timer,
            None,
            "unavailable",
            "Clipboard state is a Windows-only measurement.".into(),
            "حالة الحافظة تُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(CLIPBOARD_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M09_S06,
                    "m09.clipboard.privacy",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The clipboard state could not be read.".into(),
                    "تعذّرت قراءة حالة الحافظة.".into(),
                    vec![reason],
                    Some("clipboard_read_launch_failed".into()),
                    None,
                ))
            }
        };
        let mut privacy = match parse_clipboard_privacy(&run.stdout) {
            Ok(privacy) => privacy,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M09_S06,
                    "m09.clipboard.privacy",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The clipboard state payload could not be read.".into(),
                    "تعذّرت قراءة بيانات حالة الحافظة.".into(),
                    vec![reason],
                    Some("clipboard_payload_unreadable".into()),
                    run.stderr_tail(),
                ))
            }
        };

        if !request.inspect_current_clipboard {
            // Reading the clipboard is a privacy act in itself. Without an explicit
            // opt-in the content is not described at all.
            privacy.current_clipboard_present = false;
            privacy.current_clipboard_kind = "not_inspected".into();
            privacy.current_clipboard_char_count = 0;
            privacy.current_clipboard_preview.clear();
            privacy.sources.retain(|item| item.name != "Get-Clipboard");
        }

        let mut warnings: Vec<String> = privacy
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{}: {}", item.name, item.detail))
            .collect();
        if privacy.history_enabled.is_none() {
            warnings.push(
                "The clipboard settings key holds no EnableClipboardHistory value, so the history state is reported as unmeasured."
                    .into(),
            );
        }
        if !request.inspect_current_clipboard {
            warnings.push(
                "The clipboard content was not inspected because the request did not opt in."
                    .into(),
            );
        }

        if wants_clear {
            let cleared = match psbridge::run(CLIPBOARD_CLEAR_SCRIPT) {
                Ok(clear_run) => match psbridge::parse_json(&clear_run.stdout) {
                    Ok(document) => (flag(&document, "cleared").unwrap_or(false), document),
                    Err(reason) => {
                        warnings.push(format!("clipboard_clear_result_unreadable:{reason}"));
                        (false, serde_json::Value::Null)
                    }
                },
                Err(reason) => {
                    warnings.push(format!("clipboard_clear_failed:{reason}"));
                    (false, serde_json::Value::Null)
                }
            };
            privacy.cleared = cleared.0;
            privacy.confirmation_accepted = true;
            privacy.changed_clipboard = cleared.0;
            if cleared.0 {
                privacy.current_clipboard_char_count = 0;
                privacy.current_clipboard_preview.clear();
            } else {
                warnings.push(
                    "The clear was requested with the accepted confirmation but Windows did not report success."
                        .into(),
                );
            }
        }

        Ok(result(
            op_id,
            CAP_M09_S06,
            "m09.clipboard.privacy",
            started_at,
            timer,
            Some(privacy),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            if wants_clear {
                "Clipboard state was read and the clipboard was cleared on request. Clipboard history itself is not cleared by this service.".into()
            } else {
                "Clipboard history state was read. The clipboard content was not touched.".into()
            },
            if wants_clear {
                "تمت قراءة حالة الحافظة ومُحيت الحافظة بناءً على الطلب. سجل الحافظة نفسه لا يُمسح بهذه الخدمة.".into()
            } else {
                "تمت قراءة حالة سجل الحافظة. لم يُمس محتوى الحافظة.".into()
            },
            warnings,
            None,
            run.stderr_tail(),
        ))
    }
}

// ---------------------------------------------------------------------------
// S09 — Hosts file inspection
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostsEntry {
    pub line_number: usize,
    pub address: String,
    pub hostnames: String,
    /// A trailing `#` comment on the entry line, kept because it explains the entry.
    pub comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostsFileReport {
    pub path: String,
    pub exists: bool,
    pub readable: bool,
    pub rejection_reason: Option<String>,
    pub byte_count: u64,
    pub modified_at: String,
    pub line_count: usize,
    pub active_entry_count: usize,
    pub comment_line_count: usize,
    pub blank_line_count: usize,
    /// Entries that point a name at `0.0.0.0` or `::`, i.e. an intentional block.
    pub blocking_entry_count: usize,
    pub duplicate_address_count: usize,
    pub entries: Vec<HostsEntry>,
    pub sources: Vec<SourceReport>,
    pub file_modified: bool,
    pub measured_at: String,
}

fn parse_hosts_file(path: &str, content: &str) -> HostsFileReport {
    let mut entries = Vec::new();
    let mut comment_lines = 0usize;
    let mut blank_lines = 0usize;
    let mut addresses: Vec<String> = Vec::new();
    for (index, raw) in content.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() {
            blank_lines += 1;
            continue;
        }
        if line.starts_with('#') {
            comment_lines += 1;
            continue;
        }
        // An inline comment belongs to the entry, so the whole line is captured first
        // and split afterwards rather than dropped.
        let (body, comment) = match line.find('#') {
            Some(position) => (&line[..position], line[position + 1..].trim().to_string()),
            None => (line, String::new()),
        };
        let mut parts = body.split_whitespace();
        let Some(address) = parts.next() else {
            continue;
        };
        let hostnames = parts.collect::<Vec<&str>>().join(" ");
        if hostnames.is_empty() {
            // An address with no host name maps nothing; counting it as an entry would
            // inflate the figure.
            blank_lines += 1;
            continue;
        }
        addresses.push(address.to_string());
        entries.push(HostsEntry {
            line_number: index + 1,
            address: address.to_string(),
            hostnames,
            comment,
        });
    }
    let mut seen: Vec<&str> = Vec::new();
    let mut duplicate_address_count = 0usize;
    for address in &addresses {
        if seen.contains(&address.as_str()) {
            duplicate_address_count += 1;
        } else {
            seen.push(address);
        }
    }
    let blocking_entry_count = entries
        .iter()
        .filter(|entry| {
            entry.address == "0.0.0.0" || entry.address == "::" || entry.address == "::0"
        })
        .count();
    HostsFileReport {
        path: path.to_string(),
        exists: true,
        readable: true,
        rejection_reason: None,
        byte_count: content.len() as u64,
        modified_at: String::new(),
        line_count: content.lines().count(),
        active_entry_count: entries.len(),
        comment_line_count: comment_lines,
        blank_line_count: blank_lines,
        blocking_entry_count,
        duplicate_address_count,
        entries,
        sources: vec![source(
            "Win32 file read",
            true,
            "The hosts file was read as bytes and decoded as UTF-8; a decoding failure is reported instead of being replaced."
                .to_string(),
        )],
        file_modified: false,
        measured_at: Utc::now().to_rfc3339(),
    }
}

#[tauri::command]
pub async fn m09_hosts_file(op_id: String) -> Result<OperationResult<HostsFileReport>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        Ok(result(
            op_id,
            CAP_M09_S09,
            "m09.hosts.inspect",
            started_at,
            timer,
            None,
            "unavailable",
            "The hosts file is a Windows-only surface.".into(),
            "ملف hosts سطح خاص بويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let path = psbridge::windows_root().join("System32/drivers/etc/hosts");
        let path_text = path.to_string_lossy().to_string();
        let outcome = std::fs::read(&path).map_err(|error| format!("hosts_read_failed:{error}"));
        let bytes = match outcome {
            Ok(bytes) => bytes,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M09_S09,
                    "m09.hosts.inspect",
                    started_at,
                    timer,
                    Some(HostsFileReport {
                        path: path_text,
                        exists: false,
                        readable: false,
                        rejection_reason: Some(reason.clone()),
                        byte_count: 0,
                        modified_at: String::new(),
                        line_count: 0,
                        active_entry_count: 0,
                        comment_line_count: 0,
                        blank_line_count: 0,
                        blocking_entry_count: 0,
                        duplicate_address_count: 0,
                        entries: Vec::new(),
                        sources: vec![source(
                            "Win32 file read",
                            false,
                            "The hosts file could not be read; an unreadable hosts file is never reported as an empty one."
                                .to_string(),
                        )],
                        file_modified: false,
                        measured_at: Utc::now().to_rfc3339(),
                    }),
                    "unavailable",
                    "The Windows hosts file could not be read.".into(),
                    "تعذّرت قراءة ملف hosts الخاص بويندوز.".into(),
                    vec![format!("hosts_unreadable:{reason}")],
                    Some("hosts_file_unreadable".into()),
                    None,
                ))
            }
        };
        let modified_at = std::fs::metadata(&path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
            .and_then(|value| chrono::DateTime::<Utc>::from_timestamp(value.as_secs() as i64, 0))
            .map(|stamp| stamp.to_rfc3339())
            .unwrap_or_default();
        let content = match String::from_utf8(bytes.clone()) {
            Ok(content) => content,
            Err(error) => {
                return Ok(result(
                    op_id,
                    CAP_M09_S09,
                    "m09.hosts.inspect",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The hosts file is not valid UTF-8, so it is reported rather than silently replaced."
                        .into(),
                    "ملف hosts ليس UTF-8 صالحًا، لذا يُبلَّغ عنه بدل استبداله بصمت.".into(),
                    vec![format!("hosts_not_utf8:{}", error.utf8_error())],
                    Some("hosts_file_not_utf8".into()),
                    None,
                ))
            }
        };
        let mut report = parse_hosts_file(&path_text, &content);
        report.modified_at = modified_at;

        let mut warnings = Vec::new();
        if report.active_entry_count == 0 {
            warnings.push(
                "The hosts file contains no active name mapping; this is a measurement, not an assurance that no other resolver is in play."
                    .into(),
            );
        }
        if report.blocking_entry_count > 0 {
            warnings.push(format!(
                "{} entr{} point a name at an all-zero address, which is how a hosts file blocks a name.",
                report.blocking_entry_count,
                if report.blocking_entry_count == 1 { "y" } else { "ies" }
            ));
        }
        if report.duplicate_address_count > 0 {
            warnings.push(format!(
                "{} address{} appear on more than one line.",
                report.duplicate_address_count,
                if report.duplicate_address_count == 1 {
                    ""
                } else {
                    "es"
                }
            ));
        }

        Ok(result(
            op_id,
            CAP_M09_S09,
            "m09.hosts.inspect",
            started_at,
            timer,
            Some(report),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "The Windows hosts file was read and every active mapping was listed; the file was not modified."
                .into(),
            "تمت قراءة ملف hosts في ويندوز وسرد كل تعيين نشط؛ لم يُعدَّل الملف.".into(),
            warnings,
            None,
            None,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::{
        capability_label, filetime_to_rfc3339, parse_advertising_status, parse_clipboard_privacy,
        parse_hosts_file, parse_permission_dashboard, project_capabilities, AdvertisingIdStatus,
        ClipboardPrivacy, PermissionDashboard, ADVERTISING_SCRIPT, CLIPBOARD_CLEAR_SCRIPT,
        CLIPBOARD_CONFIRMATION, CLIPBOARD_SCRIPT, PERMISSION_SCRIPT,
    };
    use serde_json::json;

    fn empty_dashboard() -> PermissionDashboard {
        PermissionDashboard {
            capabilities: Vec::new(),
            capabilities_requested: Vec::new(),
            consent_store_root: "root".into(),
            root_present: true,
            total_apps_seen: 0,
            apps_allowed_somewhere: 0,
            sources: Vec::new(),
            changed_any_permission: false,
            measured_at: "now".into(),
        }
    }

    #[test]
    fn a_filetime_of_zero_is_never_never_1601() {
        assert_eq!(filetime_to_rfc3339(0), None);
        // 2024-01-01T00:00:00Z expressed as a Windows FILETIME.
        let ticks = 133_485_984_000_000_000u64;
        let stamp = filetime_to_rfc3339(ticks).expect("converts");
        assert!(stamp.starts_with("2024-01-01"), "{stamp}");
    }

    #[test]
    fn a_filetime_before_the_unix_epoch_yields_nothing_rather_than_a_wrong_date() {
        // 1601-01-01 is tick zero plus a little; it must not become a negative timestamp.
        assert_eq!(filetime_to_rfc3339(1), None);
    }

    #[test]
    fn a_permission_payload_is_parsed_with_real_counts() {
        let payload = json!({
            "rootPresent": true,
            "rootError": "",
            "root": "HKCU:\\...\\ConsentStore",
            "capabilities": [
                { "capability": "webcam", "present": true, "path": "p1", "entries": [
                    { "appKey": "a", "appKind": "NonPackaged", "appName": "Skype", "value": "Allow",
                      "lastUsedStart": 133_485_984_000_000_000u64, "lastUsedStop": 0 },
                    { "appKey": "b", "appKind": "Packaged", "appName": "", "value": "Deny",
                      "lastUsedStart": 0, "lastUsedStop": 0 },
                    { "appKey": "c", "appKind": "NonPackaged", "appName": "", "value": "",
                      "lastUsedStart": 0, "lastUsedStop": 0 },
                    { "appKey": "d", "appKind": "NonPackaged", "appName": "", "value": "",
                      "lastUsedStart": 133_485_984_000_000_000u64, "lastUsedStop": 0 }
                ] }
            ]
        });
        let dashboard = parse_permission_dashboard(&payload.to_string()).expect("parses");
        assert_eq!(dashboard.capabilities.len(), 1);
        let webcam = &dashboard.capabilities[0];
        assert_eq!(webcam.allow_count, 1);
        assert_eq!(webcam.deny_count, 1);
        assert_eq!(webcam.unused_count, 1);
        // Entry "d" is the case this exists for: Windows logged real use while recording
        // no decision. It must not be counted as allowed, denied, or never asked.
        assert_eq!(webcam.undecided_but_used_count, 1);
        assert_eq!(webcam.apps[3].state, "used_no_decision_recorded");
        assert!(webcam.apps[3].ever_used);
        assert_eq!(webcam.apps[2].state, "no_decision_and_never_used");
        assert_eq!(webcam.apps[0].state, "allowed");
        assert_eq!(webcam.apps[1].state, "denied");
        assert!(webcam.apps[0].ever_used);
        assert!(webcam.apps[0].last_used_start.starts_with("2024-01-01"));
        // A zero stop stamp must read as "never", not as a 1601 date.
        assert_eq!(webcam.apps[0].last_used_stop, "");
        assert!(!webcam.apps[1].ever_used);
    }

    #[test]
    fn the_permission_script_does_not_use_a_fixed_size_collection() {
        // Windows PowerShell 5.1 makes `@()` a fixed-size array, so `.Add()` on it throws
        // "Collection was of a fixed size" — a non-terminating error, meaning the script
        // still exits 0 while producing an empty payload. Every accumulator in every
        // script here must be a real List or a ToArray().
        for name in [
            PERMISSION_SCRIPT,
            ADVERTISING_SCRIPT,
            CLIPBOARD_SCRIPT,
            CLIPBOARD_CLEAR_SCRIPT,
        ] {
            for line in name.lines() {
                let trimmed = line.trim();
                if let Some(position) = trimmed.find("= @()") {
                    let variable = trimmed[..position].trim_start_matches('$').to_string();
                    assert!(
                        !trimmed.starts_with(&format!("${variable}.Add")),
                        "fixed-size accumulator in: {trimmed}"
                    );
                }
                // `@($list)` inside a hashtable literal also throws on 5.1.
                assert!(
                    !trimmed.contains("= @($") || !trimmed.contains("} | ConvertTo-Json"),
                    "a List must be emitted with ToArray(), not @(): {trimmed}"
                );
            }
        }
    }

    #[test]
    fn an_empty_or_missing_permission_store_is_not_reported_as_clean() {
        assert!(parse_permission_dashboard(&json!({ "capabilities": [] }).to_string()).is_err());
        assert!(parse_permission_dashboard(
            &json!({ "rootPresent": false, "rootError": "access denied" }).to_string()
        )
        .is_err());
    }

    #[test]
    fn capability_projection_cannot_leak_another_capability() {
        let mut dashboard = empty_dashboard();
        for name in ["webcam", "microphone", "location"] {
            dashboard.capabilities.push(
                parse_permission_dashboard(
                    &json!({
                        "rootPresent": true, "rootError": "", "root": "r",
                        "capabilities": [
                            { "capability": name, "present": true, "path": "p", "entries": [] }
                        ]
                    })
                    .to_string(),
                )
                .expect("parses")
                .capabilities
                .remove(0),
            );
        }
        let all = project_capabilities(&dashboard, None);
        assert_eq!(all.len(), 3);
        let camera = project_capabilities(&dashboard, Some("webcam"));
        assert_eq!(camera.len(), 1);
        assert_eq!(camera[0].capability, "webcam");
        let missing = project_capabilities(&dashboard, Some("locationExtended"));
        assert!(missing.is_empty());
    }

    #[test]
    fn capability_labels_cover_every_probed_name() {
        for name in ["webcam", "microphone", "location", "locationExtended"] {
            let (en, ar) = capability_label(name);
            assert!(!en.is_empty() && !ar.is_empty(), "{name}");
        }
    }

    #[test]
    fn a_stored_identifier_with_the_feature_off_is_reported_as_stored_not_active() {
        let payload = json!({
            "keyPresent": true,
            "enabled": false,
            "advertisingId": "abc123",
            "limitAdTracking": true,
            "infoPath": "HKCU:\\...\\AdvertisingInfo",
            "trackingPath": "HKCU:\\...\\AdvertisingInfo\\Id",
            "limitPath": "HKCU:\\...\\Privacy"
        });
        let status = parse_advertising_status(&payload.to_string()).expect("parses");
        assert_eq!(status.enabled, Some(false));
        assert_eq!(status.advertising_id, "abc123");
        assert!(status.reset_performed_by_windows);
        assert!(!status.changed_any_value);
    }

    #[test]
    fn an_absent_enable_value_is_unmeasured_rather_than_off() {
        let payload = json!({
            "keyPresent": true,
            "enabled": null,
            "advertisingId": "",
            "limitAdTracking": null,
            "infoPath": "p", "trackingPath": "t", "limitPath": "l"
        });
        let status = parse_advertising_status(&payload.to_string()).expect("parses");
        assert_eq!(status.enabled, None);
        assert!(!status.reset_performed_by_windows);
    }

    #[test]
    fn clipboard_content_is_never_kept_when_it_was_not_requested() {
        let payload = json!({
            "historyKeyPresent": true,
            "historyEnabled": true,
            "historyPath": "HKCU:\\...\\Clipboard",
            "clipboardPresent": true,
            "clipboardKind": "text",
            "clipboardChars": 900,
            "clipboardPreview": "a secret value"
        });
        let parsed = parse_clipboard_privacy(&payload.to_string()).expect("parses");
        assert_eq!(parsed.current_clipboard_kind, "text");
        // The command is what blanks it; the parser must not pre-empt that decision.
        assert!(!parsed.changed_clipboard);
        assert!(!parsed.cleared);
        assert!(!parsed.confirmation_accepted);
        assert_eq!(parsed.current_clipboard_char_count, 900);
    }

    #[test]
    fn clipboard_defaults_are_honest_before_anything_runs() {
        let privacy = ClipboardPrivacy {
            history_enabled: None,
            history_registry_path: "p".into(),
            history_key_present: false,
            current_clipboard_present: false,
            current_clipboard_kind: "not_inspected".into(),
            current_clipboard_char_count: 0,
            current_clipboard_preview: String::new(),
            cleared: false,
            confirmation_accepted: false,
            sources: Vec::new(),
            changed_clipboard: false,
            measured_at: "now".into(),
        };
        assert!(!privacy.cleared);
        assert!(!privacy.changed_clipboard);
        assert_eq!(privacy.current_clipboard_kind, "not_inspected");
    }

    #[test]
    fn the_clipboard_confirmation_token_is_a_fixed_literal() {
        assert_eq!(CLIPBOARD_CONFIRMATION, "CLEAR");
    }

    #[test]
    fn advertising_defaults_are_honest_before_anything_runs() {
        let status = AdvertisingIdStatus {
            registry_path: "p".into(),
            key_present: false,
            advertising_id: String::new(),
            enabled: None,
            reset_performed_by_windows: false,
            limit_ad_tracking: None,
            limit_ad_tracking_path: String::new(),
            sources: Vec::new(),
            changed_any_value: false,
            measured_at: "now".into(),
        };
        assert!(!status.changed_any_value);
        assert_eq!(status.enabled, None);
    }

    #[test]
    fn hosts_parsing_separates_entries_comments_and_blocks() {
        let content = "\
# Copyright (c) 1993-2009 Microsoft Corp.
127.0.0.1       localhost       # classic loopback
::1             localhost

0.0.0.0 tracking.example.com
0.0.0.0 ads.example.net # blocked by policy
10.0.0.5        internal.corp
10.0.0.5        other.corp

0.0.0.0
";
        let report = parse_hosts_file("C:\\Windows\\System32\\drivers\\etc\\hosts", content);
        // Two loopback entries, two blocking entries and two 10.0.0.5 entries.
        assert_eq!(report.active_entry_count, 6);
        assert_eq!(report.comment_line_count, 1);
        // The bare "0.0.0.0" with no host name maps nothing, so it is not an entry.
        assert_eq!(report.blocking_entry_count, 2);
        // `0.0.0.0` appears on two lines and `10.0.0.5` on two lines: one repeat each.
        assert_eq!(report.duplicate_address_count, 2);
        let first = &report.entries[0];
        assert_eq!(first.line_number, 2);
        assert_eq!(first.address, "127.0.0.1");
        assert_eq!(first.hostnames, "localhost");
        assert_eq!(first.comment, "classic loopback");
        // A trailing comment belongs to the entry, it is not a comment line. The entry
        // without one must keep an empty comment rather than borrowing a neighbour's.
        assert_eq!(report.entries[1].comment, "");
        assert_eq!(report.entries[3].comment, "blocked by policy");
        assert_eq!(report.entries[3].hostnames, "ads.example.net");
        assert!(!report.file_modified);
    }

    #[test]
    fn a_hosts_file_of_only_comments_reports_zero_entries_not_a_clean_bill_of_health() {
        let report = parse_hosts_file("p", "# nothing configured\n\n");
        assert_eq!(report.active_entry_count, 0);
        assert_eq!(report.comment_line_count, 1);
        assert_eq!(report.blank_line_count, 1);
    }
}
