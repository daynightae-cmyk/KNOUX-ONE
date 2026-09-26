//! M10 planned services, batch 1: S01 Defender status, S05 Firewall status,
//! S06 UAC status, S07 SmartScreen status, S08 Secure Boot and TPM.
//!
//! All five are read-only status inspections. None of them starts a scan, changes a
//! policy, or writes a key, which is why they are the safe first slice of M10 to close.
//! S02/S03/S04 (Defender scans) and S09/S10 are deliberately left `planned`: a scan has a
//! real runtime cost and a real side effect, and shipping it before anything on this
//! machine has actually run a scan would be exactly the kind of unverified claim this
//! repository forbids.
//!
//! Every payload names the provider it read. When a provider is absent the field is
//! `available: false` with the reason Windows gave, never a zero that would read as
//! "measured, and the answer is nothing".

use crate::completion14::psbridge;
use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Instant;
use tauri::AppHandle;

const CAPABILITY_M10_S01: &str = "m10_s01";
const CAPABILITY_M10_S05: &str = "m10_s05";
const CAPABILITY_M10_S06: &str = "m10_s06";
const CAPABILITY_M10_S07: &str = "m10_s07";
const CAPABILITY_M10_S08: &str = "m10_s08";

/// One named measurement source and whether it answered. A service that read three
/// providers reports all three, so a partial reading is visible instead of implied.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceReport {
    pub name: String,
    pub available: bool,
    pub detail: String,
}

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

fn source(name: &str, available: bool, detail: impl Into<String>) -> SourceReport {
    SourceReport {
        name: name.into(),
        available,
        detail: detail.into(),
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

fn text_list(document: &Value, key: &str) -> Vec<String> {
    psbridge::as_array(
        document
            .get(key)
            .cloned()
            .unwrap_or(serde_json::Value::Null),
    )
    .iter()
    .map(|value| match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    })
    .collect()
}

// ---------------------------------------------------------------------------
// M10-S01 — Defender status
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefenderScanHistory {
    pub quick_scan_age_days: Option<u64>,
    pub quick_scan_end_time: String,
    pub full_scan_age_days: Option<u64>,
    pub full_scan_end_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefenderStatus {
    pub computer_state: String,
    pub antivirus_enabled: Option<bool>,
    pub antispyware_enabled: Option<bool>,
    pub real_time_protection_enabled: Option<bool>,
    pub behavior_monitor_enabled: Option<bool>,
    pub ioav_protection_enabled: Option<bool>,
    pub on_access_protection_enabled: Option<bool>,
    pub tamper_protection_source: String,
    pub is_tamper_protected: Option<bool>,
    pub am_running_mode: String,
    pub antivirus_signature_version: String,
    pub antivirus_signature_last_updated: String,
    pub engine_version: String,
    pub engine_signature_version: String,
    pub platform_version: String,
    pub exclusion_path_count: usize,
    pub exclusion_paths: Vec<String>,
    pub exclusion_extension_count: usize,
    pub exclusion_process_count: usize,
    pub history: DefenderScanHistory,
    pub sources: Vec<SourceReport>,
    pub changed_any_setting: bool,
    pub scan_started: bool,
    pub measured_at: String,
}

const DEFENDER_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$mpCmdletAvailable = $false
$mpError = ''
$mp = $null
try {
  $null = Get-Command Get-MpComputerStatus -ErrorAction Stop
  $mpCmdletAvailable = $true
  $mp = Get-MpComputerStatus -ErrorAction Stop
} catch { $mpError = [string]$_.Exception.Message }
$prefCmdletAvailable = $false
$prefError = ''
$exclusionPaths = @()
$exclusionExtensions = @()
$exclusionProcesses = @()
try {
  $null = Get-Command Get-MpPreference -ErrorAction Stop
  $prefCmdletAvailable = $true
  $pref = Get-MpPreference -ErrorAction Stop
  if ($null -ne $pref) {
    if ($null -ne $pref.ExclusionPath) { $exclusionPaths = @($pref.ExclusionPath | ForEach-Object { [string]$_ }) }
    if ($null -ne $pref.ExclusionExtension) { $exclusionExtensions = @($pref.ExclusionExtension | ForEach-Object { [string]$_ }) }
    if ($null -ne $pref.ExclusionProcess) { $exclusionProcesses = @($pref.ExclusionProcess | ForEach-Object { [string]$_ }) }
  }
} catch { $prefError = [string]$_.Exception.Message }
$platformVersion = ''
$sigKey = 'HKLM:\SOFTWARE\Microsoft\Windows Defender\SignatureUpdates'
try {
  $p = Get-ItemProperty -LiteralPath $sigKey -ErrorAction Stop
  if ($null -ne $p.AVSignatureApplied) { $platformVersion = [string]$p.AVSignatureApplied }
} catch { }
$serviceState = ''
try {
  $svc = Get-Service -Name WinDefend -ErrorAction Stop
  $serviceState = [string]$svc.Status
} catch { }
[pscustomobject]@{
  mpCmdletAvailable = $mpCmdletAvailable
  mpError = $mpError
  prefCmdletAvailable = $prefCmdletAvailable
  prefError = $prefError
  defenderServiceStatus = $serviceState
  platformVersion = $platformVersion
  exclusionPaths = $exclusionPaths
  exclusionExtensionCount = $exclusionExtensions.Count
  exclusionProcessCount = $exclusionProcesses.Count
  status = if ($null -ne $mp) {
    [pscustomobject]@{
      computerState = [string]$mp.AMComputerState
      antivirusEnabled = [bool]$mp.AntivirusEnabled
      antispywareEnabled = [bool]$mp.AntispywareEnabled
      realTimeProtectionEnabled = [bool]$mp.RealTimeProtectionEnabled
      behaviorMonitorEnabled = [bool]$mp.BehaviorMonitorEnabled
      ioavProtectionEnabled = [bool]$mp.IoavProtectionEnabled
      onAccessProtectionEnabled = [bool]$mp.OnAccessProtectionEnabled
      tamperProtectionSource = [string]$mp.TamperProtectionSource
      isTamperProtected = [bool]$mp.IsTamperProtected
      amRunningMode = [string]$mp.AMRunningMode
      antivirusSignatureVersion = [string]$mp.AntivirusSignatureVersion
      antivirusSignatureLastUpdated = if ($mp.AntivirusSignatureLastUpdated) { ([datetime]$mp.AntivirusSignatureLastUpdated).ToUniversalTime().ToString('o') } else { '' }
      engineVersion = [string]$mp.AMEngineVersion
      engineSignatureVersion = [string]$mp.AMEngineSignatureVersion
      quickScanAge = if ($null -ne $mp.QuickScanAge) { [uint64]$mp.QuickScanAge } else { $null }
      quickScanEndTime = if ($mp.QuickScanEndTime) { ([datetime]$mp.QuickScanEndTime).ToUniversalTime().ToString('o') } else { '' }
      fullScanAge = if ($null -ne $mp.FullScanAge) { [uint64]$mp.FullScanAge } else { $null }
      fullScanEndTime = if ($mp.FullScanEndTime) { ([datetime]$mp.FullScanEndTime).ToUniversalTime().ToString('o') } else { '' }
    }
  } else { $null }
} | ConvertTo-Json -Depth 5 -Compress
"#;

fn parse_defender_status(stdout: &str) -> Result<DefenderStatus, String> {
    let document = psbridge::parse_json(stdout)?;
    let mut sources = Vec::new();
    let cmdlet = psbridge::boolean(&document, "mpCmdletAvailable").unwrap_or(false);
    let error = field(&document, "mpError");
    sources.push(source(
        "Get-MpComputerStatus",
        cmdlet,
        if cmdlet {
            "The Defender status cmdlet answered on this machine.".to_string()
        } else if error.is_empty() {
            "The Defender status cmdlet is not present.".to_string()
        } else {
            error
        },
    ));
    let pref = psbridge::boolean(&document, "prefCmdletAvailable").unwrap_or(false);
    let pref_error = field(&document, "prefError");
    sources.push(source(
        "Get-MpPreference",
        pref,
        if pref {
            "The Defender preference cmdlet answered; exclusions were read.".to_string()
        } else if pref_error.is_empty() {
            "The Defender preference cmdlet is not present.".to_string()
        } else {
            pref_error
        },
    ));
    let service_status = field(&document, "defenderServiceStatus");
    sources.push(source(
        "Get-Service WinDefend",
        !service_status.is_empty(),
        if service_status.is_empty() {
            "The WinDefend service was not resolvable.".to_string()
        } else {
            format!("WinDefend service status: {service_status}")
        },
    ));
    let platform = field(&document, "platformVersion");
    sources.push(source(
        "SignatureUpdates registry key",
        !platform.is_empty(),
        if platform.is_empty() {
            "HKLM SignatureUpdates did not expose AVSignatureApplied.".to_string()
        } else {
            format!("AVSignatureApplied = {platform}")
        },
    ));

    let Some(status) = document.get("status").filter(|value| !value.is_null()) else {
        return Err("defender_status_unavailable".to_string());
    };
    Ok(DefenderStatus {
        computer_state: field(status, "computerState"),
        antivirus_enabled: flag(status, "antivirusEnabled"),
        antispyware_enabled: flag(status, "antispywareEnabled"),
        real_time_protection_enabled: flag(status, "realTimeProtectionEnabled"),
        behavior_monitor_enabled: flag(status, "behaviorMonitorEnabled"),
        ioav_protection_enabled: flag(status, "ioavProtectionEnabled"),
        on_access_protection_enabled: flag(status, "onAccessProtectionEnabled"),
        tamper_protection_source: field(status, "tamperProtectionSource"),
        is_tamper_protected: flag(status, "isTamperProtected"),
        am_running_mode: field(status, "amRunningMode"),
        antivirus_signature_version: field(status, "antivirusSignatureVersion"),
        antivirus_signature_last_updated: field(status, "antivirusSignatureLastUpdated"),
        engine_version: field(status, "engineVersion"),
        engine_signature_version: field(status, "engineSignatureVersion"),
        platform_version: platform,
        exclusion_path_count: text_list(&document, "exclusionPaths").len(),
        exclusion_paths: text_list(&document, "exclusionPaths"),
        exclusion_extension_count: number(&document, "exclusionExtensionCount").unwrap_or_default()
            as usize,
        exclusion_process_count: number(&document, "exclusionProcessCount").unwrap_or_default()
            as usize,
        history: DefenderScanHistory {
            quick_scan_age_days: number(status, "quickScanAge"),
            quick_scan_end_time: field(status, "quickScanEndTime"),
            full_scan_age_days: number(status, "fullScanAge"),
            full_scan_end_time: field(status, "fullScanEndTime"),
        },
        sources,
        changed_any_setting: false,
        scan_started: false,
        measured_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn m10_defender_status(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<DefenderStatus>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let _ = app;

    #[cfg(not(target_os = "windows"))]
    {
        Ok(result(
            op_id,
            CAPABILITY_M10_S01,
            "m10.defender.status",
            started_at,
            timer,
            None,
            "unavailable",
            "Microsoft Defender status is a Windows-only measurement.".into(),
            "حالة Microsoft Defender تُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(DEFENDER_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S01,
                    "m10.defender.status",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The Defender status query could not be started.".into(),
                    "تعذّر بدء استعلام حالة Defender.".into(),
                    vec![reason.clone()],
                    Some("defender_status_launch_failed".into()),
                    None,
                ))
            }
        };
        let status = match parse_defender_status(&run.stdout) {
            Ok(status) => status,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S01,
                    "m10.defender.status",
                    started_at,
                    timer,
                    None,
                    "unavailable",
                    "Microsoft Defender did not report a status on this machine.".into(),
                    "لم يُبلّغ Microsoft Defender عن حالة على هذا الجهاز.".into(),
                    vec![reason],
                    Some("defender_status_unavailable".into()),
                    run.stderr_tail(),
                ))
            }
        };
        let mut warnings: Vec<String> = status
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{} did not answer: {}", item.name, item.detail))
            .collect();
        if status.real_time_protection_enabled == Some(false) {
            warnings.push("Real-time protection is reported as off on this machine.".into());
        }
        if status.exclusion_path_count > 0 {
            warnings.push(format!(
                "Defender has {} configured path exclusion(s); they are listed in full because an exclusion is exactly what a silent measurement would hide.",
                status.exclusion_path_count
            ));
        }
        if status.history.quick_scan_age_days.is_none()
            && status.history.full_scan_age_days.is_none()
        {
            warnings.push("Windows reported no completed scan age for this machine.".into());
        }

        Ok(result(
            op_id,
            CAPABILITY_M10_S01,
            "m10.defender.status",
            started_at,
            timer,
            Some(status),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Microsoft Defender status, signature age and exclusions were read; nothing was changed and no scan was started."
                .into(),
            "تمت قراءة حالة Microsoft Defender وعمر التوقيع والاستثناءات؛ لم يتغير شيء ولم يبدأ أي فحص.".into(),
            warnings,
            None,
            run.stderr_tail(),
        ))
    }
}

// ---------------------------------------------------------------------------
// M10-S05 — Firewall status
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirewallProfileState {
    pub name: String,
    pub enabled: Option<bool>,
    pub default_inbound_action: String,
    pub default_outbound_action: String,
    pub allow_inbound_rules: Option<bool>,
    pub allow_local_firewall_rules: Option<bool>,
    pub log_file_name: String,
    pub log_allowed: Option<bool>,
    pub log_blocked: Option<bool>,
    pub log_max_size_kb: Option<u64>,
    pub notify_on_listen: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirewallRuleCount {
    pub direction: String,
    pub action: String,
    pub enabled: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirewallStatus {
    pub profiles: Vec<FirewallProfileState>,
    pub rule_counts: Vec<FirewallRuleCount>,
    pub rule_count_total: u64,
    pub profiles_disabled: usize,
    pub inbound_blocked_by_default_profiles: usize,
    pub sources: Vec<SourceReport>,
    pub changed_any_rule: bool,
    pub measured_at: String,
}

const FIREWALL_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$profileCmdletAvailable = $false
$profileError = ''
$profiles = @()
try {
  $null = Get-Command Get-NetFirewallProfile -ErrorAction Stop
  $profileCmdletAvailable = $true
  $profiles = @(Get-NetFirewallProfile -ErrorAction Stop | ForEach-Object {
    [pscustomobject]@{
      name = [string]$_.Name
      enabled = if ($null -ne $_.Enabled) { ([string]$_.Enabled) } else { '' }
      defaultInboundAction = [string]$_.DefaultInboundAction
      defaultOutboundAction = [string]$_.DefaultOutboundAction
      allowInboundRules = if ($null -ne $_.AllowInboundRules) { [bool]$_.AllowInboundRules } else { $null }
      allowLocalFirewallRules = if ($null -ne $_.AllowLocalFirewallRules) { [bool]$_.AllowLocalFirewallRules } else { $null }
      logFileName = [string]$_.LogFileName
      logAllowed = if ($null -ne $_.LogAllowed) { [bool]$_.LogAllowed } else { $null }
      logBlocked = if ($null -ne $_.LogBlocked) { [bool]$_.LogBlocked } else { $null }
      logMaxSizeKilobytes = if ($null -ne $_.LogMaxSizeKilobytes) { [uint64]$_.LogMaxSizeKilobytes } else { $null }
      notifyOnListen = if ($null -ne $_.NotifyOnListen) { [bool]$_.NotifyOnListen } else { $null }
    }
  })
} catch { $profileError = [string]$_.Exception.Message }
$ruleCmdletAvailable = $false
$ruleError = ''
$counts = @()
$total = 0
try {
  $null = Get-Command Get-NetFirewallRule -ErrorAction Stop
  $ruleCmdletAvailable = $true
  $total = @(Get-NetFirewallRule -PolicyStore ActiveStore -ErrorAction Stop).Count
  $counts = @(Get-NetFirewallRule -PolicyStore ActiveStore -ErrorAction Stop |
    Group-Object -Property Direction, Action, Enabled |
    ForEach-Object {
      $parts = $_.Name -split ', '
      [pscustomobject]@{
        direction = [string]$parts[0]
        action = if ($parts.Count -gt 1) { [string]$parts[1] } else { '' }
        enabled = if ($parts.Count -gt 2) { [string]$parts[2] } else { '' }
        count = [uint64]$_.Count
      }
    })
} catch { $ruleError = [string]$_.Exception.Message }
[pscustomobject]@{
  profileCmdletAvailable = $profileCmdletAvailable
  profileError = $profileError
  ruleCmdletAvailable = $ruleCmdletAvailable
  ruleError = $ruleError
  ruleCountTotal = [uint64]$total
  profiles = $profiles
  ruleCounts = $counts
} | ConvertTo-Json -Depth 5 -Compress
"#;

fn parse_firewall_status(stdout: &str) -> Result<FirewallStatus, String> {
    let document = psbridge::parse_json(stdout)?;
    let profile_available = psbridge::boolean(&document, "profileCmdletAvailable").unwrap_or(false);
    let profile_error = field(&document, "profileError");
    let rule_available = psbridge::boolean(&document, "ruleCmdletAvailable").unwrap_or(false);
    let rule_error = field(&document, "ruleError");
    let sources = vec![
        source(
            "Get-NetFirewallProfile",
            profile_available,
            if profile_available {
                "The firewall profile cmdlet answered.".to_string()
            } else if profile_error.is_empty() {
                "The firewall profile cmdlet is not present.".to_string()
            } else {
                profile_error
            },
        ),
        source(
            "Get-NetFirewallRule (ActiveStore)",
            rule_available,
            if rule_available {
                "The firewall rule cmdlet answered; rules were counted, not listed.".to_string()
            } else if rule_error.is_empty() {
                "The firewall rule cmdlet is not present.".to_string()
            } else {
                rule_error
            },
        ),
    ];
    let profiles: Vec<FirewallProfileState> = psbridge::as_array(
        document
            .get("profiles")
            .cloned()
            .unwrap_or(serde_json::Value::Null),
    )
    .iter()
    .filter_map(|value| serde_json::from_value::<FirewallProfileState>(value.clone()).ok())
    .collect();
    if profiles.is_empty() {
        return Err("firewall_profiles_unavailable".to_string());
    }
    let rule_counts: Vec<FirewallRuleCount> = psbridge::as_array(
        document
            .get("ruleCounts")
            .cloned()
            .unwrap_or(serde_json::Value::Null),
    )
    .iter()
    .filter_map(|value| serde_json::from_value::<FirewallRuleCount>(value.clone()).ok())
    .collect();
    Ok(FirewallStatus {
        profiles_disabled: profiles
            .iter()
            .filter(|profile| profile.enabled == Some(false))
            .count(),
        inbound_blocked_by_default_profiles: profiles
            .iter()
            .filter(|profile| profile.default_inbound_action.eq_ignore_ascii_case("Block"))
            .count(),
        profiles,
        rule_counts,
        rule_count_total: number(&document, "ruleCountTotal").unwrap_or_default(),
        sources,
        changed_any_rule: false,
        measured_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn m10_firewall_status(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<FirewallStatus>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let _ = app;

    #[cfg(not(target_os = "windows"))]
    {
        Ok(result(
            op_id,
            CAPABILITY_M10_S05,
            "m10.firewall.status",
            started_at,
            timer,
            None,
            "unavailable",
            "Windows Firewall status is a Windows-only measurement.".into(),
            "حالة جدار حماية ويندوز تُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(FIREWALL_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S05,
                    "m10.firewall.status",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The firewall status query could not be started.".into(),
                    "تعذّر بدء استعلام حالة جدار الحماية.".into(),
                    vec![reason],
                    Some("firewall_status_launch_failed".into()),
                    None,
                ))
            }
        };
        let status = match parse_firewall_status(&run.stdout) {
            Ok(status) => status,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S05,
                    "m10.firewall.status",
                    started_at,
                    timer,
                    None,
                    "unavailable",
                    "Windows Firewall did not report its profiles on this machine.".into(),
                    "لم يُبلّغ جدار حماية ويندوز عن ملفاته الشخصية على هذا الجهاز.".into(),
                    vec![reason],
                    Some("firewall_profiles_unavailable".into()),
                    run.stderr_tail(),
                ))
            }
        };
        let mut warnings: Vec<String> = status
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{} did not answer: {}", item.name, item.detail))
            .collect();
        if status.profiles_disabled > 0 {
            warnings.push(format!(
                "{} firewall profile(s) are disabled on this machine.",
                status.profiles_disabled
            ));
        }
        if status.rule_count_total == 0 {
            warnings
                .push("Windows reported no active firewall rules; the count is reported as measured, not assumed."
                    .into());
        }

        Ok(result(
            op_id,
            CAPABILITY_M10_S05,
            "m10.firewall.status",
            started_at,
            timer,
            Some(status),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Every firewall profile and the active rule counts were read; no rule was changed."
                .into(),
            "تمت قراءة كل ملفات تعريف جدار الحماية وعدّ القواعد النشطة؛ لم تتغير أي قاعدة.".into(),
            warnings,
            None,
            run.stderr_tail(),
        ))
    }
}

// ---------------------------------------------------------------------------
// M10-S06 — UAC status
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UacMachineValue {
    pub name: String,
    pub present: bool,
    pub value: String,
    pub meaning_en: String,
    pub meaning_ar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UacStatus {
    /// User Account Control is on when the machine policy enables it. This is the value
    /// that actually governs, and it cannot be turned off per user.
    pub user_account_control_enabled: Option<bool>,
    pub governing_scope: String,
    pub machine_values: Vec<UacMachineValue>,
    /// The per-user override, which can only make UAC *stricter*, never weaker.
    pub per_user_enable_lua: Option<bool>,
    pub per_user_override_present: bool,
    pub secure_desktop_default: Option<String>,
    pub admin_consent_behavior: Option<String>,
    pub sources: Vec<SourceReport>,
    pub changed_any_value: bool,
    pub elevation_performed: bool,
    pub measured_at: String,
}

const UAC_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$machinePath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$userPath = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$machinePresent = $false
$machineError = ''
$values = @{}
try {
  $p = Get-ItemProperty -LiteralPath $machinePath -ErrorAction Stop
  $machinePresent = $true
  foreach ($name in @('EnableLUA','ConsentPromptBehaviorAdmin','ConsentPromptBehaviorUser','PromptOnSecureDesktop','FilterAdministratorToken','EnableInstallerDetection')) {
    if ($null -ne $p.$name) { $values[$name] = [string]$p.$name }
  }
} catch { $machineError = [string]$_.Exception.Message }
$userPresent = $false
$userError = ''
$userEnableLua = $null
try {
  $u = Get-ItemProperty -LiteralPath $userPath -ErrorAction Stop
  $userPresent = $true
  if ($null -ne $u.EnableLUA) { $userEnableLua = [string]$u.EnableLUA }
} catch { $userError = [string]$_.Exception.Message }
[pscustomobject]@{
  machinePresent = $machinePresent
  machineError = $machineError
  userPresent = $userPresent
  userError = $userError
  userEnableLua = $userEnableLua
  values = $values
} | ConvertTo-Json -Depth 5 -Compress
"#;

/// The meaning of each policy value is stated rather than left for the reader to guess,
/// because a bare `ConsentPromptBehaviorAdmin = 5` is not an answer.
fn uac_meaning(name: &str, raw: &str) -> (&'static str, &'static str) {
    match (name, raw) {
        ("EnableLUA", "0") => (
            "User Account Control is switched off for this machine.",
            "التحكم في حسابات المستخدمين معطّل على هذا الجهاز.",
        ),
        ("EnableLUA", _) => (
            "User Account Control is switched on for this machine.",
            "التحكم في حسابات المستخدمين مفعّل على هذا الجهاز.",
        ),
        ("PromptOnSecureDesktop", "1") => (
            "Elevation prompts appear on the secure desktop.",
            "تظهر نوافذ_elevation على سطح المكتب الآمن.",
        ),
        ("PromptOnSecureDesktop", _) => (
            "Elevation prompts do not use the secure desktop.",
            "لا تستخدم نوافذ_elevation سطح المكتب الآمن.",
        ),
        ("ConsentPromptBehaviorAdmin", "0") => (
            "An administrator elevation is requested without prompting.",
            "لا تُعرض نافذة تأكيد عند طلب صلاحيات المسؤول.",
        ),
        ("ConsentPromptBehaviorAdmin", "5") => (
            "An administrator elevation prompts for consent.",
            "تطلب صلاحيات المسؤول موافقة صريحة.",
        ),
        ("ConsentPromptBehaviorAdmin", _) => (
            "An administrator elevation prompts for credentials.",
            "تطلب صلاحيات المسؤول بيانات اعتماد.",
        ),
        ("ConsentPromptBehaviorUser", "0") => (
            "A standard user elevation is requested without prompting.",
            "لا تُعرض نافذة تأكيد عند طلب صلاحيات المستخدم العادي.",
        ),
        ("ConsentPromptBehaviorUser", "5") => (
            "A standard user elevation prompts for consent.",
            "تطلب صلاحيات المستخدم العادي موافقة صريحة.",
        ),
        ("ConsentPromptBehaviorUser", _) => (
            "A standard user elevation prompts for credentials.",
            "تطلب صلاحيات المستخدم العادي بيانات اعتماد.",
        ),
        ("FilterAdministratorToken", "1") => (
            "The built-in administrator account runs with a filtered token.",
            "يعمل حساب المسؤول المدمج برمز مقيَّد.",
        ),
        ("EnableInstallerDetection", _) => {
            ("Installer detection is enabled.", "كشف المُثبِّتات مفعّل.")
        }
        _ => (
            "Policy value read from the machine policy key.",
            "قيمة سياسة مقروءة من مفتاح سياسة الجهاز.",
        ),
    }
}

fn parse_uac_status(stdout: &str) -> Result<UacStatus, String> {
    let document = psbridge::parse_json(stdout)?;
    let machine_present = psbridge::boolean(&document, "machinePresent").unwrap_or(false);
    let machine_error = field(&document, "machineError");
    if !machine_present {
        return Err(if machine_error.is_empty() {
            "uac_machine_policy_missing".to_string()
        } else {
            format!("uac_machine_policy_unreadable:{machine_error}")
        });
    }
    let mut machine_values = Vec::new();
    for name in [
        "EnableLUA",
        "ConsentPromptBehaviorAdmin",
        "ConsentPromptBehaviorUser",
        "PromptOnSecureDesktop",
        "FilterAdministratorToken",
        "EnableInstallerDetection",
    ] {
        let raw = psbridge::text(document.get("values").unwrap_or(&Value::Null), name);
        let (en, ar) = uac_meaning(name, &raw);
        machine_values.push(UacMachineValue {
            name: name.into(),
            present: !raw.is_empty(),
            value: raw,
            meaning_en: en.into(),
            meaning_ar: ar.into(),
        });
    }
    let enable = machine_values
        .iter()
        .find(|item| item.name == "EnableLUA")
        .filter(|item| item.present)
        .and_then(|item| match item.value.as_str() {
            "0" => Some(false),
            "1" => Some(true),
            _ => None,
        });
    let user_present = psbridge::boolean(&document, "userPresent").unwrap_or(false);
    let user_error = field(&document, "userError");
    let user_raw = field(&document, "userEnableLua");
    Ok(UacStatus {
        user_account_control_enabled: enable,
        governing_scope:
            "HKLM machine policy — a per-user value can only make UAC stricter, never weaker".into(),
        secure_desktop_default: machine_values
            .iter()
            .find(|item| item.name == "PromptOnSecureDesktop")
            .map(|item| item.value.clone()),
        admin_consent_behavior: machine_values
            .iter()
            .find(|item| item.name == "ConsentPromptBehaviorAdmin")
            .map(|item| item.value.clone()),
        per_user_enable_lua: match user_raw.as_str() {
            "0" => Some(false),
            "1" => Some(true),
            _ => None,
        },
        per_user_override_present: !user_raw.is_empty(),
        machine_values,
        sources: vec![
            source(
                "HKLM machine policy key",
                true,
                "The machine User Account Control policy key was read.".to_string(),
            ),
            source(
                "HKCU user policy key",
                user_present,
                if user_present {
                    if user_raw.is_empty() {
                        "The user policy key exists but sets no EnableLUA value.".to_string()
                    } else {
                        format!("The user policy key sets EnableLUA = {user_raw}.")
                    }
                } else if user_error.is_empty() {
                    "The user policy key does not exist on this account.".to_string()
                } else {
                    user_error
                },
            ),
        ],
        changed_any_value: false,
        elevation_performed: false,
        measured_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn m10_uac_status(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<UacStatus>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let _ = app;

    #[cfg(not(target_os = "windows"))]
    {
        Ok(result(
            op_id,
            CAPABILITY_M10_S06,
            "m10.uac.status",
            started_at,
            timer,
            None,
            "unavailable",
            "User Account Control policy is a Windows-only measurement.".into(),
            "سياسة التحكم في حسابات المستخدمين تُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(UAC_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S06,
                    "m10.uac.status",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The User Account Control policy could not be read.".into(),
                    "تعذّرت قراءة سياسة التحكم في حسابات المستخدمين.".into(),
                    vec![reason],
                    Some("uac_policy_read_failed".into()),
                    None,
                ))
            }
        };
        let status =
            match parse_uac_status(&run.stdout) {
                Ok(status) => status,
                Err(reason) => return Ok(result(
                    op_id,
                    CAPABILITY_M10_S06,
                    "m10.uac.status",
                    started_at,
                    timer,
                    None,
                    "unavailable",
                    "Windows did not expose a User Account Control machine policy on this machine."
                        .into(),
                    "لم يعرض ويندوز سياسةmachinery للتحكم في حسابات المستخدمين على هذا الجهاز."
                        .into(),
                    vec![reason],
                    Some("uac_policy_unavailable".into()),
                    run.stderr_tail(),
                )),
            };
        let mut warnings: Vec<String> = status
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{}: {}", item.name, item.detail))
            .collect();
        if status.user_account_control_enabled == Some(false) {
            warnings.push(
                "User Account Control is reported as switched off on this machine; that is a security-relevant reading, not an error."
                    .into(),
            );
        }
        if status.user_account_control_enabled.is_none() {
            warnings.push(
                "The machine policy key exists but sets no EnableLUA value, so the on/off verdict is reported as unmeasured rather than inferred from the Windows default."
                    .into(),
            );
        }
        if status.per_user_enable_lua == Some(false)
            && status.user_account_control_enabled == Some(true)
        {
            warnings.push(
                "This account carries a per-user EnableLUA value while the machine policy enables UAC; the machine policy governs."
                    .into(),
            );
        }

        Ok(result(
            op_id,
            CAPABILITY_M10_S06,
            "m10.uac.status",
            started_at,
            timer,
            Some(status),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "The User Account Control machine and user policy values were read. No value was written and no elevation was requested."
                .into(),
            "تمت قراءة قيم سياسة التحكم في حسابات المستخدمين للجهاز والمستخدم. لم تُكتب أي قيمة ولم يُطلب أي رفع صلاحيات.".into(),
            warnings,
            None,
            run.stderr_tail(),
        ))
    }
}

// ---------------------------------------------------------------------------
// M10-S07 — SmartScreen status
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartScreenSource {
    pub origin: String,
    pub value_name: String,
    pub present: bool,
    pub value: String,
    pub meaning_en: String,
    pub meaning_ar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartScreenStatus {
    /// The three policies are named separately because Windows reads them from different
    /// places on different builds, and a single "SmartScreen: on" would hide which one
    /// actually answered.
    pub sources: Vec<SmartScreenSource>,
    pub settings_read: usize,
    pub settings_missing: usize,
    pub effective_enforcement: String,
    pub changed_any_value: bool,
    pub measured_at: String,
}

const SMARTSCREEN_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$probes = @(
  @{ origin = 'HKCU Explorer'; path = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer'; name = 'SmartScreenEnabled' },
  @{ origin = 'HKLM System policy'; path = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System'; name = 'EnableSmartScreen' },
  @{ origin = 'HKLM Defender SmartScreen'; path = 'HKLM:\SOFTWARE\Microsoft\Windows Defender\SmartScreen'; name = 'EnableSmartScreenOnO365' },
  @{ origin = 'HKLM Defender SmartScreen'; path = 'HKLM:\SOFTWARE\Microsoft\Windows Defender\SmartScreen'; name = 'EnableWebPurchaseDownloadAutoBlocking' },
  @{ origin = 'HKCU Edge policy'; path = 'HKCU:\SOFTWARE\Policies\Microsoft\Edge'; name = 'SmartScreenEnabled' },
  @{ origin = 'HKLM Edge policy'; path = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'; name = 'SmartScreenEnabled' }
)
$found = New-Object System.Collections.Generic.List[object]
foreach ($probe in $probes) {
  $value = ''
  try {
    $p = Get-ItemProperty -LiteralPath $probe.path -ErrorAction Stop
    if ($null -ne $p.($probe.name)) { $value = [string]$p.($probe.name) }
  } catch { }
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    $found.Add([pscustomobject]@{ origin = [string]$probe.origin; valueName = [string]$probe.name; value = $value })
  }
}
[pscustomobject]@{ found = $found } | ConvertTo-Json -Depth 4 -Compress
"#;

fn parse_smartscreen_status(stdout: &str) -> Result<SmartScreenStatus, String> {
    let document = psbridge::parse_json(stdout)?;
    let raw: Vec<SmartScreenSource> = psbridge::as_array(
        document
            .get("found")
            .cloned()
            .unwrap_or(serde_json::Value::Null),
    )
    .iter()
    .map(|value| {
        let name = field(value, "valueName");
        let raw_value = field(value, "value");
        let (en, ar) = match (name.as_str(), raw_value.as_str()) {
            ("SmartScreenEnabled", "0") | ("EnableSmartScreen", "0") => (
                "SmartScreen download reputation checking is switched off at this location.",
                "فحص سمعة التنزيلات في SmartScreen معطّل في هذا الموضع.",
            ),
            ("SmartScreenEnabled", _) | ("EnableSmartScreen", _) => (
                "SmartScreen download reputation checking is switched on at this location.",
                "فحص سمعة التنزيلات في SmartScreen مفعّل في هذا الموضع.",
            ),
            ("EnableSmartScreenOnO365", _) => (
                "The Office 365 SmartScreen integration is set at this location.",
                "تكامل SmartScreen مع Office 365 مضبوط في هذا الموضع.",
            ),
            ("EnableWebPurchaseDownloadAutoBlocking", _) => (
                "Automatic blocking of web-purchased downloads is set at this location.",
                "الحظر التلقائي لتنزيلات الشراء من الويب مضبوط في هذا الموضع.",
            ),
            _ => (
                "The value was read and reported verbatim.",
                "قُرئت القيمة وأُبلِّغ عنها حرفيًا.",
            ),
        };
        SmartScreenSource {
            origin: field(value, "origin"),
            value_name: name,
            present: true,
            value: raw_value,
            meaning_en: en.into(),
            meaning_ar: ar.into(),
        }
    })
    .collect();
    let settings_read = raw.len();
    // Six locations are probed on every supported build; anything absent is a real
    // finding about this machine, so it is counted rather than hidden behind a default.
    let settings_missing = 6usize.saturating_sub(settings_read);
    let enforcement = if settings_read == 0 {
        "unknown: no SmartScreen policy value was readable at any probed location, so this service cannot say whether SmartScreen is on"
            .to_string()
    } else if raw.iter().any(|item| {
        matches!(item.value.as_str(), "0")
            && item.value_name != "EnableSmartScreenOnO365"
            && item.value_name != "EnableWebPurchaseDownloadAutoBlocking"
    }) {
        "disabled_at_least_one_location".to_string()
    } else {
        "enabled_at_every_readable_location".to_string()
    };
    Ok(SmartScreenStatus {
        sources: raw,
        settings_read,
        settings_missing,
        effective_enforcement: enforcement,
        changed_any_value: false,
        measured_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn m10_smartscreen_status(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<SmartScreenStatus>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let _ = app;

    #[cfg(not(target_os = "windows"))]
    {
        Ok(result(
            op_id,
            CAPABILITY_M10_S07,
            "m10.smartscreen.status",
            started_at,
            timer,
            None,
            "unavailable",
            "SmartScreen policy is a Windows-only measurement.".into(),
            "سياسة SmartScreen تُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(SMARTSCREEN_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S07,
                    "m10.smartscreen.status",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The SmartScreen policy could not be read.".into(),
                    "تعذّرت قراءة سياسة SmartScreen.".into(),
                    vec![reason],
                    Some("smartscreen_policy_read_failed".into()),
                    None,
                ))
            }
        };
        let status = match parse_smartscreen_status(&run.stdout) {
            Ok(status) => status,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S07,
                    "m10.smartscreen.status",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The SmartScreen policy probe produced no readable document.".into(),
                    "لم يُنتج فحص سياسة SmartScreen مستندًا قابلًا للقراءة.".into(),
                    vec![reason],
                    Some("smartscreen_policy_unreadable".into()),
                    run.stderr_tail(),
                ))
            }
        };
        let mut warnings: Vec<String> = Vec::new();
        if status.settings_read == 0 {
            warnings.push(
                "No SmartScreen policy value was readable at any probed location; the service reports this as unknown rather than assuming a default."
                    .into(),
            );
        } else if status.settings_missing > 0 {
            warnings.push(format!(
                "{} of 6 probed SmartScreen locations hold no value on this machine; each readable one is reported with its origin."
                , status.settings_missing
            ));
        }
        if status.effective_enforcement == "disabled_at_least_one_location" {
            warnings.push("SmartScreen is switched off at at least one policy location.".into());
        }

        Ok(result(
            op_id,
            CAPABILITY_M10_S07,
            "m10.smartscreen.status",
            started_at,
            timer,
            Some(status),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "SmartScreen policy values were read from every location Windows exposes them; no value was written."
                .into(),
            "تمت قراءة قيم سياسة SmartScreen من كل موضع يعرضها ويندوز؛ لم تُكتب أي قيمة.".into(),
            warnings,
            None,
            run.stderr_tail(),
        ))
    }
}

// ---------------------------------------------------------------------------
// M10-S08 — Secure Boot and TPM
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TpmDetail {
    pub name: String,
    pub present: Option<bool>,
    pub ready: Option<bool>,
    pub enabled: Option<bool>,
    pub activated: Option<bool>,
    pub owned: Option<bool>,
    pub spec_version: String,
    pub manufacturer: String,
    pub manufacturer_version: String,
    pub managed_physical_presence_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureBootTpmStatus {
    /// `Confirm-SecureBootUEFI` throws on a BIOS/legacy boot, which is a real reading
    /// and not a failure, so the outcome is a value rather than an error.
    pub secure_boot_state: String,
    pub secure_boot_confirmed: Option<bool>,
    pub secure_boot_detail: String,
    pub bios_mode: String,
    pub tpm: Vec<TpmDetail>,
    pub sources: Vec<SourceReport>,
    pub changed_any_setting: bool,
    pub measured_at: String,
}

const SECUREBOOT_TPM_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$secureBootState = 'unknown'
$secureBootConfirmed = $null
$secureBootDetail = ''
try {
  $null = Get-Command Confirm-SecureBootUEFI -ErrorAction Stop
  try {
    $secureBootConfirmed = [bool](Confirm-SecureBootUEFI -ErrorAction Stop)
    $secureBootState = if ($secureBootConfirmed) { 'on' } else { 'off' }
    $secureBootDetail = 'Confirm-SecureBootUEFI returned without error.'
  } catch {
    $secureBootState = 'off'
    $secureBootDetail = 'Confirm-SecureBootUEFI reported: ' + [string]$_.Exception.Message
  }
} catch {
  $secureBootState = 'unavailable'
  $secureBootDetail = 'The secure boot cmdlet is not present: ' + [string]$_.Exception.Message
}
$firmware = ''
try {
  $fw = Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State' -ErrorAction Stop
  if ($null -ne $fw.UEFISecureBootEnabled) { $firmware = [string]$fw.UEFISecureBootEnabled }
} catch { }
$tpmCmdletAvailable = $false
$tpmError = ''
$tpm = $null
try {
  $null = Get-Command Get-Tpm -ErrorAction Stop
  $tpmCmdletAvailable = $true
  $tpm = Get-Tpm -ErrorAction Stop
} catch { $tpmError = [string]$_.Exception.Message }
$win32TpmAvailable = $false
$win32TpmError = ''
$spec = ''
$manufacturer = ''
$manufacturerVersion = ''
$managedVersion = ''
try {
  $w = Get-CimInstance -Namespace 'root\CIMV2\Security\MicrosoftTpm' -ClassName Win32_Tpm -ErrorAction Stop
  $win32TpmAvailable = $true
  if ($null -ne $w) {
    $spec = [string]$w.SpecVersion
    $manufacturer = [string]$w.ManufacturerIdTxt
    $manufacturerVersion = [string]$w.ManufacturerVersion
    $managedVersion = [string]$w.ManagedPhysicalPresenceVersion
  }
} catch { $win32TpmError = [string]$_.Exception.Message }
[pscustomobject]@{
  secureBootState = $secureBootState
  secureBootConfirmed = $secureBootConfirmed
  secureBootDetail = $secureBootDetail
  uefiSecureBootEnabled = $firmware
  tpmCmdletAvailable = $tpmCmdletAvailable
  tpmError = $tpmError
  tpm = if ($null -ne $tpm) {
    [pscustomobject]@{
      tpmPresent = [bool]$tpm.TpmPresent
      tpmReady = [bool]$tpm.TpmReady
      tpmEnabled = if ($null -ne $tpm.TpmEnabled) { [bool]$tpm.TpmEnabled } else { $null }
      tpmActivated = if ($null -ne $tpm.TpmActivated) { [bool]$tpm.TpmActivated } else { $null }
      tpmOwned = if ($null -ne $tpm.TpmOwned) { [bool]$tpm.TpmOwned } else { $null }
    }
  } else { $null }
  win32TpmAvailable = $win32TpmAvailable
  win32TpmError = $win32TpmError
  specVersion = $spec
  manufacturer = $manufacturer
  manufacturerVersion = $manufacturerVersion
  managedPhysicalPresenceVersion = $managedVersion
} | ConvertTo-Json -Depth 5 -Compress
"#;

fn parse_secureboot_tpm_status(stdout: &str) -> Result<SecureBootTpmStatus, String> {
    let document = psbridge::parse_json(stdout)?;
    let state = field(&document, "secureBootState");
    if state == "unknown" {
        return Err("secure_boot_state_unknown".to_string());
    }
    let firmware = field(&document, "uefiSecureBootEnabled");
    let detail = field(&document, "secureBootDetail");
    let tpm_available = psbridge::boolean(&document, "tpmCmdletAvailable").unwrap_or(false);
    let tpm_error = field(&document, "tpmError");
    let win32_available = psbridge::boolean(&document, "win32TpmAvailable").unwrap_or(false);
    let win32_error = field(&document, "win32TpmError");

    let mut tpm = Vec::new();
    if let Some(status) = document.get("tpm").filter(|value| !value.is_null()) {
        tpm.push(TpmDetail {
            name: "Get-Tpm".into(),
            present: flag(status, "tpmPresent"),
            ready: flag(status, "tpmReady"),
            enabled: flag(status, "tpmEnabled"),
            activated: flag(status, "tpmActivated"),
            owned: flag(status, "tpmOwned"),
            spec_version: String::new(),
            manufacturer: String::new(),
            manufacturer_version: String::new(),
            managed_physical_presence_version: String::new(),
        });
    }
    if win32_available {
        tpm.push(TpmDetail {
            name: "Win32_Tpm".into(),
            present: None,
            ready: None,
            enabled: None,
            activated: None,
            owned: None,
            spec_version: field(&document, "specVersion"),
            manufacturer: field(&document, "manufacturer"),
            manufacturer_version: field(&document, "manufacturerVersion"),
            managed_physical_presence_version: field(&document, "managedPhysicalPresenceVersion"),
        });
    }

    let sources = vec![
        source(
            "Confirm-SecureBootUEFI",
            state != "unavailable",
            detail.clone(),
        ),
        source(
            "SecureBoot\\State registry key",
            !firmware.is_empty(),
            if firmware.is_empty() {
                "The firmware secure boot flag is not exposed on this boot.".to_string()
            } else {
                format!("UEFISecureBootEnabled = {firmware}")
            },
        ),
        source(
            "Get-Tpm",
            tpm_available,
            if tpm_available {
                "The TPM cmdlet answered.".to_string()
            } else if tpm_error.is_empty() {
                "The TPM cmdlet is not present.".to_string()
            } else {
                tpm_error
            },
        ),
        source(
            "Win32_Tpm (root\\CIMV2\\Security\\MicrosoftTpm)",
            win32_available,
            if win32_available {
                "The TPM CIM class answered.".to_string()
            } else if win32_error.is_empty() {
                "The TPM CIM class is not registered on this machine.".to_string()
            } else {
                win32_error
            },
        ),
    ];

    let bios_mode = if state == "on" {
        "UEFI with secure boot".to_string()
    } else if state == "off" {
        "UEFI with secure boot reported as off, or a legacy BIOS boot".to_string()
    } else {
        "unknown".to_string()
    };

    Ok(SecureBootTpmStatus {
        secure_boot_state: state,
        secure_boot_confirmed: psbridge::boolean(&document, "secureBootConfirmed"),
        secure_boot_detail: detail,
        bios_mode,
        tpm,
        sources,
        changed_any_setting: false,
        measured_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn m10_secureboot_tpm_status(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<SecureBootTpmStatus>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let _ = app;

    #[cfg(not(target_os = "windows"))]
    {
        Ok(result(
            op_id,
            CAPABILITY_M10_S08,
            "m10.secureboot.tpm",
            started_at,
            timer,
            None,
            "unavailable",
            "Secure Boot and TPM state is a Windows-only measurement.".into(),
            "حالة Secure Boot وTPM تُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let run = match psbridge::run(SECUREBOOT_TPM_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S08,
                    "m10.secureboot.tpm",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The Secure Boot and TPM query could not be started.".into(),
                    "تعذّر بدء استعلام Secure Boot وTPM.".into(),
                    vec![reason],
                    Some("secureboot_query_launch_failed".into()),
                    None,
                ))
            }
        };
        let status = match parse_secureboot_tpm_status(&run.stdout) {
            Ok(status) => status,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAPABILITY_M10_S08,
                    "m10.secureboot.tpm",
                    started_at,
                    timer,
                    None,
                    "unavailable",
                    "Windows did not report a Secure Boot state on this machine.".into(),
                    "لم يُبلّغ ويندوز عن حالة Secure Boot على هذا الجهاز.".into(),
                    vec![reason],
                    Some("secure_boot_state_unavailable".into()),
                    run.stderr_tail(),
                ))
            }
        };
        let mut warnings: Vec<String> = status
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{} did not answer: {}", item.name, item.detail))
            .collect();
        if status.secure_boot_state == "off" {
            warnings.push(
                "Secure Boot is reported as off. The response does not claim why, because the firmware flag and the cmdlet can disagree and both readings are reported."
                    .into(),
            );
        }
        if status.tpm.is_empty() {
            warnings.push(
                "No TPM provider answered on this machine; TPM state is reported as unmeasured rather than absent."
                    .into(),
            );
        }

        Ok(result(
            op_id,
            CAPABILITY_M10_S08,
            "m10.secureboot.tpm",
            started_at,
            timer,
            Some(status),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Secure Boot state and every available TPM provider were read; nothing was changed."
                .into(),
            "تمت قراءة حالة Secure Boot وكل مزوّد TPM متاح؛ لم يتغير شيء.".into(),
            warnings,
            None,
            run.stderr_tail(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::{
        parse_defender_status, parse_firewall_status, parse_secureboot_tpm_status,
        parse_smartscreen_status, parse_uac_status, uac_meaning,
    };
    use serde_json::json;

    #[test]
    fn a_defender_payload_without_a_status_object_is_refused() {
        assert_eq!(
            parse_defender_status(&json!({ "mpCmdletAvailable": true }).to_string())
                .expect_err("must fail"),
            "defender_status_unavailable"
        );
    }

    #[test]
    fn a_defender_payload_reports_each_source_separately() {
        let payload = json!({
            "mpCmdletAvailable": true,
            "mpError": "",
            "prefCmdletAvailable": false,
            "prefError": "access denied",
            "defenderServiceStatus": "Running",
            "platformVersion": "1.1.23090.11-0",
            "exclusionPaths": ["C:\\Temp", "D:\\Scratch"],
            "exclusionExtensionCount": 3,
            "exclusionProcessCount": 1,
            "status": {
                "computerState": "1",
                "antivirusEnabled": true,
                "realTimeProtectionEnabled": false,
                "antivirusSignatureVersion": "1.429.1304.0",
                "antivirusSignatureLastUpdated": "2026-09-25T02:00:00+00:00",
                "quickScanAge": 4,
                "quickScanEndTime": "2026-09-25T02:05:00+00:00",
                "fullScanAge": null,
                "fullScanEndTime": ""
            }
        });
        let status = parse_defender_status(&payload.to_string()).expect("parses");
        assert!(status
            .sources
            .iter()
            .any(|s| s.name == "Get-MpComputerStatus" && s.available));
        assert!(status.sources.iter().any(|s| s.name == "Get-MpPreference"
            && !s.available
            && s.detail.contains("access denied")));
        assert_eq!(status.exclusion_path_count, 2);
        assert_eq!(status.exclusion_extension_count, 3);
        assert_eq!(status.history.quick_scan_age_days, Some(4));
        // A null age must stay null. Zero would read as "scanned today".
        assert_eq!(status.history.full_scan_age_days, None);
        assert_eq!(status.real_time_protection_enabled, Some(false));
        assert!(!status.changed_any_setting);
        assert!(!status.scan_started);
    }

    #[test]
    fn a_firewall_payload_without_profiles_is_refused() {
        assert_eq!(
            parse_firewall_status(
                &json!({ "profileCmdletAvailable": true, "profiles": [] }).to_string()
            )
            .expect_err("must fail"),
            "firewall_profiles_unavailable"
        );
    }

    #[test]
    fn firewall_status_counts_disabled_and_blocking_profiles() {
        let payload = json!({
            "profileCmdletAvailable": true,
            "profileError": "",
            "ruleCmdletAvailable": true,
            "ruleError": "",
            "ruleCountTotal": 412,
            "profiles": [
                { "name": "Domain", "enabled": true, "defaultInboundAction": "Block", "defaultOutboundAction": "Allow", "logFileName": "" },
                { "name": "Private", "enabled": true, "defaultInboundAction": "Block", "defaultOutboundAction": "Allow", "logFileName": "" },
                { "name": "Public", "enabled": false, "defaultInboundAction": "Allow", "defaultOutboundAction": "Allow", "logFileName": "" }
            ],
            "ruleCounts": [
                { "direction": "Inbound", "action": "Allow", "enabled": "True", "count": 120 }
            ]
        });
        let status = parse_firewall_status(&payload.to_string()).expect("parses");
        assert_eq!(status.profiles_disabled, 1);
        assert_eq!(status.inbound_blocked_by_default_profiles, 2);
        assert_eq!(status.rule_count_total, 412);
        assert!(!status.changed_any_rule);
    }

    #[test]
    fn a_machine_policy_without_enable_lua_is_unmeasured_rather_than_guessed() {
        // The whole key being absent is a hard failure: there is nothing to report.
        assert!(parse_uac_status(&json!({ "machinePresent": false }).to_string()).is_err());
        // The key existing without EnableLUA is not a failure — the other policy values
        // are still real — but the on/off verdict must stay unmeasured rather than
        // inheriting the Windows default.
        let payload = json!({
            "machinePresent": true,
            "machineError": "",
            "userPresent": false,
            "userError": "",
            "userEnableLua": "",
            "values": { "ConsentPromptBehaviorAdmin": "5" }
        });
        let status = parse_uac_status(&payload.to_string()).expect("parses");
        assert_eq!(status.user_account_control_enabled, None);
        assert_eq!(status.admin_consent_behavior.as_deref(), Some("5"));
        let token = status
            .machine_values
            .iter()
            .find(|item| item.name == "EnableLUA")
            .expect("listed");
        assert!(!token.present);
    }

    #[test]
    fn uac_status_reports_the_governing_value_and_names_its_meaning() {
        let payload = json!({
            "machinePresent": true,
            "machineError": "",
            "userPresent": true,
            "userError": "",
            "userEnableLua": "1",
            "values": {
                "EnableLUA": "1",
                "ConsentPromptBehaviorAdmin": "5",
                "ConsentPromptBehaviorUser": "5",
                "PromptOnSecureDesktop": "1"
            }
        });
        let status = parse_uac_status(&payload.to_string()).expect("parses");
        assert_eq!(status.user_account_control_enabled, Some(true));
        assert_eq!(status.per_user_enable_lua, Some(true));
        assert!(status.per_user_override_present);
        assert_eq!(status.admin_consent_behavior.as_deref(), Some("5"));
        assert!(status.governing_scope.contains("HKLM"));
        // A value that is absent must be marked absent, not rendered as 0.
        let token = status
            .machine_values
            .iter()
            .find(|item| item.name == "FilterAdministratorToken")
            .expect("listed");
        assert!(!token.present);
        assert!(token.value.is_empty());
        assert!(!status.changed_any_value);
        assert!(!status.elevation_performed);
    }

    #[test]
    fn uac_meanings_distinguish_prompt_forms() {
        assert!(uac_meaning("ConsentPromptBehaviorAdmin", "0")
            .0
            .contains("without prompting"));
        assert!(uac_meaning("ConsentPromptBehaviorAdmin", "5")
            .0
            .contains("consent"));
        assert!(uac_meaning("ConsentPromptBehaviorAdmin", "4")
            .0
            .contains("credentials"));
        assert!(uac_meaning("EnableLUA", "0").0.contains("switched off"));
    }

    #[test]
    fn smartscreen_reports_unknown_rather_than_defaulting_to_on() {
        let status = parse_smartscreen_status(&json!({ "found": [] }).to_string()).expect("parses");
        assert_eq!(status.settings_read, 0);
        assert_eq!(status.settings_missing, 6);
        assert!(
            status.effective_enforcement.starts_with("unknown"),
            "an empty probe must not be reported as enabled: {}",
            status.effective_enforcement
        );
    }

    #[test]
    fn smartscreen_detects_an_explicit_disable() {
        let payload = json!({
            "found": [
                { "origin": "HKCU Explorer", "valueName": "SmartScreenEnabled", "value": "0" }
            ]
        });
        let status = parse_smartscreen_status(&payload.to_string()).expect("parses");
        assert_eq!(status.settings_read, 1);
        assert_eq!(
            status.effective_enforcement,
            "disabled_at_least_one_location"
        );
        assert!(status.sources[0].meaning_en.contains("switched off"));
        assert!(!status.sources[0].meaning_ar.is_empty());
    }

    #[test]
    fn secure_boot_off_is_a_reading_and_never_an_error() {
        let payload = json!({
            "secureBootState": "off",
            "secureBootConfirmed": false,
            "secureBootDetail": "Confirm-SecureBootUEFI reported: Access denied",
            "uefiSecureBootEnabled": "",
            "tpmCmdletAvailable": true,
            "tpmError": "",
            "tpm": { "tpmPresent": true, "tpmReady": true, "tpmEnabled": true, "tpmActivated": true, "tpmOwned": true },
            "win32TpmAvailable": true,
            "win32TpmError": "",
            "specVersion": "2.0",
            "manufacturer": "STM",
            "manufacturerVersion": "13",
            "managedPhysicalPresenceVersion": "1.2"
        });
        let status = parse_secureboot_tpm_status(&payload.to_string()).expect("parses");
        assert_eq!(status.secure_boot_state, "off");
        assert_eq!(status.secure_boot_confirmed, Some(false));
        assert_eq!(status.tpm.len(), 2);
        assert_eq!(status.tpm[0].name, "Get-Tpm");
        assert_eq!(status.tpm[1].manufacturer, "STM");
        assert!(!status.changed_any_setting);
    }

    #[test]
    fn an_absent_tpm_is_unmeasured_rather_than_absent() {
        let payload = json!({
            "secureBootState": "on",
            "secureBootConfirmed": true,
            "secureBootDetail": "ok",
            "uefiSecureBootEnabled": "1",
            "tpmCmdletAvailable": false,
            "tpmError": "Get-Tpm is not recognised",
            "tpm": null,
            "win32TpmAvailable": false,
            "win32TpmError": "Invalid namespace"
        });
        let status = parse_secureboot_tpm_status(&payload.to_string()).expect("parses");
        assert!(status.tpm.is_empty());
        assert!(status
            .sources
            .iter()
            .any(|s| s.name == "Get-Tpm" && !s.available));
        assert!(status
            .sources
            .iter()
            .any(|s| s.name.contains("Win32_Tpm") && !s.available));
    }
}
