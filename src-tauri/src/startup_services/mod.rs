use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupItem {
    pub id: String,
    pub name: String,
    pub command: String,
    pub executable_path: Option<String>,
    pub source_kind: String,
    pub source_path: String,
    pub scope: String,
    pub publisher: String,
    pub signature_status: String,
    pub protected: bool,
    pub mutable: bool,
    pub enabled: bool,
    pub impact_score: u8,
    pub impact_label: String,
    pub impact_basis: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskItem {
    pub id: String,
    pub task_name: String,
    pub task_path: String,
    pub state: String,
    pub enabled: bool,
    pub author: String,
    pub action: String,
    pub trigger: String,
    pub protected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsServiceItem {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub state: String,
    pub start_mode: String,
    pub path_name: String,
    pub publisher: String,
    pub signature_status: String,
    pub protected: bool,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootMetric {
    pub measured_at: String,
    pub boot_duration_ms: Option<u64>,
    pub main_path_boot_ms: Option<u64>,
    pub boot_post_boot_ms: Option<u64>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImpactSummary {
    pub items: Vec<StartupItem>,
    pub boot_history: Vec<BootMetric>,
    pub average_boot_ms: Option<u64>,
    pub high_attention_count: usize,
    pub scoring_notice_en: String,
    pub scoring_notice_ar: String,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationItem {
    pub item_id: String,
    pub item_name: String,
    pub severity: String,
    pub recommendation_en: String,
    pub recommendation_ar: String,
    pub reasons: Vec<String>,
    pub automatic_change_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationReport {
    pub recommendations: Vec<RecommendationItem>,
    pub protected_count: usize,
    pub mutable_count: usize,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeRecord {
    pub id: String,
    pub item_id: String,
    pub item_name: String,
    pub kind: String,
    pub source_kind: String,
    pub source_path: String,
    pub value_name: Option<String>,
    pub original_command: String,
    pub backup_path: Option<String>,
    pub delayed_task_name: Option<String>,
    pub created_at: String,
    pub restored_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupProfile {
    pub id: String,
    pub name: String,
    pub enabled_item_ids: Vec<String>,
    pub created_at: String,
    pub applied_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationResult {
    pub item: Option<StartupItem>,
    pub change: Option<ChangeRecord>,
    pub active_changes: Vec<ChangeRecord>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileResult {
    pub profiles: Vec<StartupProfile>,
    pub active_changes: Vec<ChangeRecord>,
    pub applied_profile_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum StartupChangeRequest {
    #[serde(rename = "disable")]
    Disable {
        item_id: String,
        confirmation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum DelayRequest {
    #[serde(rename = "list")]
    List,
    #[serde(rename = "create")]
    Create {
        item_id: String,
        delay_seconds: u32,
        confirmation: String,
    },
    #[serde(rename = "remove")]
    Remove {
        change_id: String,
        confirmation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum ProfileRequest {
    #[serde(rename = "list")]
    List,
    #[serde(rename = "create")]
    Create {
        name: String,
        enabled_item_ids: Vec<String>,
    },
    #[serde(rename = "apply")]
    Apply {
        profile_id: String,
        confirmation: String,
    },
    #[serde(rename = "delete")]
    Delete {
        profile_id: String,
        confirmation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum RestoreRequest {
    #[serde(rename = "list")]
    List,
    #[serde(rename = "restore")]
    Restore {
        change_id: String,
        confirmation: String,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawStartupItem {
    name: String,
    command: String,
    executable_path: Option<String>,
    source_kind: String,
    source_path: String,
    scope: String,
    publisher: Option<String>,
    signature_status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawTaskItem {
    task_name: String,
    task_path: String,
    state: String,
    enabled: bool,
    author: Option<String>,
    action: Option<String>,
    trigger: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawServiceItem {
    name: String,
    display_name: String,
    state: String,
    start_mode: String,
    path_name: Option<String>,
    publisher: Option<String>,
    signature_status: Option<String>,
}

fn success<T>(
    operation_id: String,
    capability_id: &str,
    handler_id: &str,
    started_at: String,
    timer: Instant,
    data: T,
    summary_en: String,
    summary_ar: String,
    warnings: Vec<String>,
) -> OperationResult<T> {
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: if warnings.is_empty() {
            "completed".into()
        } else {
            "completed_with_warnings".into()
        },
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(0),
        stdout: None,
        stderr: None,
        summary_en,
        summary_ar,
        warnings,
        error_code: None,
        data: Some(data),
    }
}

fn failure<T>(
    operation_id: String,
    capability_id: &str,
    handler_id: &str,
    started_at: String,
    timer: Instant,
    code: &str,
    message: String,
) -> OperationResult<T> {
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: "failed".into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(1),
        stdout: None,
        stderr: Some(message.clone()),
        summary_en: message.clone(),
        summary_ar: format!("فشلت عملية بدء التشغيل والخدمات: {message}"),
        warnings: Vec::new(),
        error_code: Some(code.into()),
        data: None,
    }
}

fn stable_id(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update([0]);
    }
    hex::encode(hasher.finalize())[..24].to_string()
}

fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn run_powershell(script: &str) -> Result<String, String> {
    let output = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output()
        .map_err(|error| format!("powershell_launch_failed:{error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(stdout)
    } else if stderr.is_empty() {
        Err(format!("powershell_failed:{}", output.status))
    } else {
        Err(stderr)
    }
}

fn run_powershell_json<T: DeserializeOwned>(script: &str) -> Result<T, String> {
    let stdout = run_powershell(script)?;
    serde_json::from_str(&stdout)
        .map_err(|error| format!("powershell_json_invalid:{error}:{stdout}"))
}

fn app_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app_data_unavailable:{error}"))?
        .join("startup-services");
    fs::create_dir_all(&root).map_err(|error| format!("app_data_create_failed:{error}"))?;
    Ok(root)
}

fn load_json<T: DeserializeOwned + Default>(path: &Path) -> Result<T, String> {
    if !path.exists() {
        return Ok(T::default());
    }
    let bytes =
        fs::read(path).map_err(|error| format!("read_failed:{}:{error}", path.display()))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("json_invalid:{}:{error}", path.display()))
}

fn save_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("directory_create_failed:{error}"))?;
    }
    let bytes =
        serde_json::to_vec_pretty(value).map_err(|error| format!("json_encode_failed:{error}"))?;
    fs::write(path, bytes).map_err(|error| format!("write_failed:{}:{error}", path.display()))
}

fn changes_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("changes.json"))
}

fn profiles_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("profiles.json"))
}

fn active_changes(app: &AppHandle) -> Result<Vec<ChangeRecord>, String> {
    let changes: Vec<ChangeRecord> = load_json(&changes_path(app)?)?;
    Ok(changes
        .into_iter()
        .filter(|item| item.restored_at.is_none())
        .collect())
}

fn save_change(app: &AppHandle, change: ChangeRecord) -> Result<(), String> {
    let path = changes_path(app)?;
    let mut changes: Vec<ChangeRecord> = load_json(&path)?;
    changes.push(change);
    save_json(&path, &changes)
}

fn update_change(app: &AppHandle, updated: &ChangeRecord) -> Result<(), String> {
    let path = changes_path(app)?;
    let mut changes: Vec<ChangeRecord> = load_json(&path)?;
    let Some(existing) = changes.iter_mut().find(|item| item.id == updated.id) else {
        return Err("change_not_found".into());
    };
    *existing = updated.clone();
    save_json(&path, &changes)
}

fn is_microsoft(publisher: &str, path: &str, name: &str) -> bool {
    let publisher = publisher.to_ascii_lowercase();
    let path = path.to_ascii_lowercase();
    let name = name.to_ascii_lowercase();
    publisher.contains("microsoft")
        || path.contains("\\windows\\system32\\")
        || path.contains("\\windows\\syswow64\\")
        || name.contains("windows security")
        || name.contains("defender")
}

fn impact(item: &RawStartupItem) -> (u8, String, Vec<String>) {
    let mut score = 15u8;
    let mut reasons = Vec::new();
    let command = item.command.to_ascii_lowercase();
    let signature = item.signature_status.as_deref().unwrap_or_default();
    if signature != "Valid" {
        score = score.saturating_add(25);
        reasons.push("Executable signature is not reported as valid.".into());
    }
    if item.scope == "machine" {
        score = score.saturating_add(10);
        reasons.push("Entry runs for the machine scope.".into());
    }
    if command.contains("updater") || command.contains("update") {
        score = score.saturating_add(15);
        reasons.push("Command appears to be an updater.".into());
    }
    if command.contains("--background") || command.contains("/background") {
        score = score.saturating_add(10);
        reasons.push("Command explicitly requests background execution.".into());
    }
    if item.source_kind == "startup_folder" {
        score = score.saturating_add(5);
        reasons.push("Entry is launched from a Startup folder.".into());
    }
    let label = if score >= 60 {
        "high_attention"
    } else if score >= 35 {
        "review"
    } else {
        "low_attention"
    };
    (score.min(100), label.into(), reasons)
}

fn registry_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$locations=@(
 @{Scope='user';Kind='registry_run';Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'},
 @{Scope='user';Kind='registry_run_once';Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce'},
 @{Scope='machine';Kind='registry_run';Path='HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'},
 @{Scope='machine';Kind='registry_run_once';Path='HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce'},
 @{Scope='machine';Kind='registry_run';Path='HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'}
)
$result=@()
foreach($location in $locations){
 if(-not (Test-Path -LiteralPath $location.Path)){continue}
 $properties=Get-ItemProperty -LiteralPath $location.Path
 foreach($property in $properties.PSObject.Properties){
  if($property.Name -like 'PS*'){continue}
  $command=[Environment]::ExpandEnvironmentVariables([string]$property.Value)
  $candidate=$null
  if($command -match '^\s*"([^"]+\.exe)"'){ $candidate=$matches[1] }
  elseif($command -match '^\s*([^\s]+\.exe)'){ $candidate=$matches[1] }
  $publisher=''
  $signature='NotChecked'
  if($candidate -and (Test-Path -LiteralPath $candidate)){
   $sig=Get-AuthenticodeSignature -LiteralPath $candidate
   $signature=[string]$sig.Status
   if($sig.SignerCertificate){$publisher=[string]$sig.SignerCertificate.Subject}
  }
  $result += [pscustomobject]@{
   name=[string]$property.Name; command=$command; executablePath=$candidate;
   sourceKind=$location.Kind; sourcePath=$location.Path; scope=$location.Scope;
   publisher=$publisher; signatureStatus=$signature
  }
 }
}
@($result) | ConvertTo-Json -Depth 5 -Compress
"#
}

fn startup_folder_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$shell=New-Object -ComObject WScript.Shell
$folders=@(
 @{Scope='user';Path=[Environment]::GetFolderPath('Startup')},
 @{Scope='machine';Path=[Environment]::GetFolderPath('CommonStartup')}
)
$result=@()
foreach($folder in $folders){
 if(-not $folder.Path -or -not (Test-Path -LiteralPath $folder.Path)){continue}
 Get-ChildItem -LiteralPath $folder.Path -File -Force | ForEach-Object {
  $command=$_.FullName
  $candidate=$_.FullName
  if($_.Extension -ieq '.lnk'){
   try{$shortcut=$shell.CreateShortcut($_.FullName);$candidate=$shortcut.TargetPath;$command=('"'+$shortcut.TargetPath+'" '+$shortcut.Arguments).Trim()}catch{}
  }
  $publisher='';$signature='NotChecked'
  if($candidate -and (Test-Path -LiteralPath $candidate)){
   $sig=Get-AuthenticodeSignature -LiteralPath $candidate
   $signature=[string]$sig.Status
   if($sig.SignerCertificate){$publisher=[string]$sig.SignerCertificate.Subject}
  }
  $result += [pscustomobject]@{
   name=$_.Name; command=$command; executablePath=$candidate; sourceKind='startup_folder';
   sourcePath=$_.FullName; scope=$folder.Scope; publisher=$publisher; signatureStatus=$signature
  }
 }
}
@($result) | ConvertTo-Json -Depth 5 -Compress
"#
}

fn tasks_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$result=@()
Get-ScheduledTask | ForEach-Object {
 $task=$_
 $startup=@($task.Triggers | Where-Object {$_.CimClass.CimClassName -in @('MSFT_TaskLogonTrigger','MSFT_TaskBootTrigger')})
 if($startup.Count -eq 0){return}
 $actions=@($task.Actions | ForEach-Object {(($_.Execute+' '+$_.Arguments).Trim())}) -join '; '
 $triggers=@($startup | ForEach-Object {$_.CimClass.CimClassName}) -join ', '
 $result += [pscustomobject]@{
  taskName=[string]$task.TaskName; taskPath=[string]$task.TaskPath; state=[string]$task.State;
  enabled=[bool]$task.Settings.Enabled; author=[string]$task.Author; action=$actions; trigger=$triggers
 }
}
@($result) | ConvertTo-Json -Depth 5 -Compress
"#
}

fn services_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$result=@()
Get-CimInstance Win32_Service | ForEach-Object {
 $path=[string]$_.PathName
 $candidate=$null
 if($path -match '^\s*"([^"]+\.exe)"'){ $candidate=$matches[1] }
 elseif($path -match '^\s*([^\s]+\.exe)'){ $candidate=$matches[1] }
 $publisher='';$signature='NotChecked'
 if($candidate -and (Test-Path -LiteralPath $candidate)){
  $sig=Get-AuthenticodeSignature -LiteralPath $candidate
  $signature=[string]$sig.Status
  if($sig.SignerCertificate){$publisher=[string]$sig.SignerCertificate.Subject}
 }
 $result += [pscustomobject]@{
  name=[string]$_.Name; displayName=[string]$_.DisplayName; state=[string]$_.State;
  startMode=[string]$_.StartMode; pathName=$path; publisher=$publisher; signatureStatus=$signature
 }
}
@($result) | ConvertTo-Json -Depth 5 -Compress
"#
}

fn boot_history_script(limit: usize) -> String {
    format!(
        r#"
$ErrorActionPreference='Stop'
$result=@()
Get-WinEvent -FilterHashtable @{{LogName='Microsoft-Windows-Diagnostics-Performance/Operational';Id=100}} -MaxEvents {} | ForEach-Object {{
 $xml=[xml]$_.ToXml();$map=@{{}}
 foreach($node in $xml.Event.EventData.Data){{$map[[string]$node.Name]=[string]$node.'#text'}}
 $result += [pscustomobject]@{{
  measuredAt=$_.TimeCreated.ToUniversalTime().ToString('o');
  bootDurationMs=if($map.BootTime){{[long]$map.BootTime}}else{{$null}};
  mainPathBootMs=if($map.MainPathBootTime){{[long]$map.MainPathBootTime}}else{{$null}};
  bootPostBootMs=if($map.BootPostBootTime){{[long]$map.BootPostBootTime}}else{{$null}};
  source='Microsoft-Windows-Diagnostics-Performance/Operational Event 100'
 }}
}}
@($result) | ConvertTo-Json -Depth 5 -Compress
"#,
        limit.clamp(1, 100)
    )
}

fn read_registry_items() -> Result<Vec<StartupItem>, String> {
    let raw: Vec<RawStartupItem> = run_powershell_json(registry_script())?;
    Ok(raw.into_iter().map(to_startup_item).collect())
}

fn read_folder_items() -> Result<Vec<StartupItem>, String> {
    let raw: Vec<RawStartupItem> = run_powershell_json(startup_folder_script())?;
    Ok(raw.into_iter().map(to_startup_item).collect())
}

fn to_startup_item(raw: RawStartupItem) -> StartupItem {
    let (impact_score, impact_label, impact_basis) = impact(&raw);
    let publisher = raw.publisher.unwrap_or_default();
    let signature_status = raw.signature_status.unwrap_or_else(|| "NotChecked".into());
    let protected = is_microsoft(
        &publisher,
        raw.executable_path.as_deref().unwrap_or(&raw.command),
        &raw.name,
    );
    let mutable = raw.scope == "user" && !protected;
    StartupItem {
        id: stable_id(&[&raw.source_kind, &raw.source_path, &raw.name, &raw.command]),
        name: raw.name,
        command: raw.command,
        executable_path: raw.executable_path,
        source_kind: raw.source_kind,
        source_path: raw.source_path,
        scope: raw.scope,
        publisher,
        signature_status,
        protected,
        mutable,
        enabled: true,
        impact_score,
        impact_label,
        impact_basis,
    }
}

fn read_tasks() -> Result<Vec<ScheduledTaskItem>, String> {
    let raw: Vec<RawTaskItem> = run_powershell_json(tasks_script())?;
    Ok(raw
        .into_iter()
        .map(|item| {
            let author = item.author.unwrap_or_default();
            let protected = item
                .task_path
                .to_ascii_lowercase()
                .starts_with("\\microsoft\\")
                || author.to_ascii_lowercase().contains("microsoft");
            ScheduledTaskItem {
                id: stable_id(&[&item.task_path, &item.task_name]),
                task_name: item.task_name,
                task_path: item.task_path,
                state: item.state,
                enabled: item.enabled,
                author,
                action: item.action.unwrap_or_default(),
                trigger: item.trigger.unwrap_or_default(),
                protected,
            }
        })
        .collect())
}

fn read_services() -> Result<Vec<WindowsServiceItem>, String> {
    let critical: HashSet<&str> = [
        "RpcSs",
        "WinDefend",
        "EventLog",
        "PlugPlay",
        "Power",
        "SamSs",
        "LanmanWorkstation",
        "Dhcp",
        "Dnscache",
        "W32Time",
        "BITS",
        "TrustedInstaller",
        "CryptSvc",
    ]
    .into_iter()
    .collect();
    let raw: Vec<RawServiceItem> = run_powershell_json(services_script())?;
    Ok(raw
        .into_iter()
        .map(|item| {
            let publisher = item.publisher.unwrap_or_default();
            let path_name = item.path_name.unwrap_or_default();
            let protected = critical.contains(item.name.as_str())
                || is_microsoft(&publisher, &path_name, &item.display_name);
            WindowsServiceItem {
                id: stable_id(&["service", &item.name]),
                name: item.name,
                display_name: item.display_name,
                state: item.state,
                start_mode: item.start_mode,
                path_name,
                publisher,
                signature_status: item.signature_status.unwrap_or_else(|| "NotChecked".into()),
                protected,
                recommendation: if protected {
                    "Protected Windows or Microsoft service; inspection only.".into()
                } else {
                    "Third-party service. Review vendor documentation before changing it.".into()
                },
            }
        })
        .collect())
}

fn read_boot_history(limit: usize) -> Result<Vec<BootMetric>, String> {
    run_powershell_json(&boot_history_script(limit))
}

fn all_startup_items() -> Result<Vec<StartupItem>, String> {
    let mut items = read_registry_items()?;
    items.extend(read_folder_items()?);
    items.sort_by(|left, right| {
        right
            .impact_score
            .cmp(&left.impact_score)
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(items)
}

fn find_item(item_id: &str) -> Result<StartupItem, String> {
    all_startup_items()?
        .into_iter()
        .find(|item| item.id == item_id)
        .ok_or_else(|| "startup_item_not_found".into())
}

fn disable_item(
    app: &AppHandle,
    item: &StartupItem,
    delayed_task_name: Option<String>,
) -> Result<ChangeRecord, String> {
    if !item.mutable || item.protected || item.scope != "user" {
        return Err("startup_item_is_protected_or_requires_administrator".into());
    }
    let change_id = Uuid::new_v4().to_string();
    let mut backup_path = None;
    if item.source_kind.starts_with("registry_") {
        let script = format!(
            "$ErrorActionPreference='Stop'; Remove-ItemProperty -LiteralPath {} -Name {} -ErrorAction Stop",
            ps_quote(&item.source_path),
            ps_quote(&item.name)
        );
        run_powershell(&script)?;
    } else if item.source_kind == "startup_folder" {
        let source = PathBuf::from(&item.source_path);
        let startup = PathBuf::from(std::env::var("APPDATA").map_err(|_| "appdata_missing")?)
            .join("Microsoft\\Windows\\Start Menu\\Programs\\Startup");
        let source_parent = source.parent().ok_or("startup_source_parent_missing")?;
        if !source_parent
            .to_string_lossy()
            .eq_ignore_ascii_case(startup.to_string_lossy().as_ref())
        {
            return Err("startup_folder_outside_user_scope".into());
        }
        let backup_dir = app_root(app)?.join("disabled-startup");
        fs::create_dir_all(&backup_dir).map_err(|error| format!("backup_create_failed:{error}"))?;
        let target = backup_dir.join(format!(
            "{}_{}",
            change_id,
            source
                .file_name()
                .ok_or("startup_filename_missing")?
                .to_string_lossy()
        ));
        fs::rename(&source, &target).map_err(|error| format!("startup_move_failed:{error}"))?;
        backup_path = Some(target.to_string_lossy().to_string());
    } else {
        return Err("unsupported_startup_source".into());
    }
    let change = ChangeRecord {
        id: change_id,
        item_id: item.id.clone(),
        item_name: item.name.clone(),
        kind: if delayed_task_name.is_some() {
            "delayed".into()
        } else {
            "disabled".into()
        },
        source_kind: item.source_kind.clone(),
        source_path: item.source_path.clone(),
        value_name: item
            .source_kind
            .starts_with("registry_")
            .then(|| item.name.clone()),
        original_command: item.command.clone(),
        backup_path,
        delayed_task_name,
        created_at: Utc::now().to_rfc3339(),
        restored_at: None,
    };
    if let Err(error) = save_change(app, change.clone()) {
        let _ = restore_change_internal(app, &change, false);
        return Err(error);
    }
    Ok(change)
}

fn restore_change_internal(
    app: &AppHandle,
    change: &ChangeRecord,
    mark_restored: bool,
) -> Result<ChangeRecord, String> {
    if change.restored_at.is_some() {
        return Ok(change.clone());
    }
    if change.source_kind.starts_with("registry_") {
        let value_name = change
            .value_name
            .as_deref()
            .ok_or("registry_value_name_missing")?;
        let script = format!(
            "$ErrorActionPreference='Stop'; if(-not(Test-Path -LiteralPath {})){{New-Item -Path {} -Force | Out-Null}}; New-ItemProperty -LiteralPath {} -Name {} -Value {} -PropertyType String -Force | Out-Null",
            ps_quote(&change.source_path), ps_quote(&change.source_path), ps_quote(&change.source_path),
            ps_quote(value_name), ps_quote(&change.original_command)
        );
        run_powershell(&script)?;
    } else if change.source_kind == "startup_folder" {
        let backup = PathBuf::from(change.backup_path.as_deref().ok_or("backup_path_missing")?);
        let target = PathBuf::from(&change.source_path);
        if target.exists() {
            return Err("restore_target_already_exists".into());
        }
        fs::rename(&backup, &target).map_err(|error| format!("startup_restore_failed:{error}"))?;
    } else {
        return Err("unsupported_restore_source".into());
    }
    if let Some(task_name) = &change.delayed_task_name {
        let _ = Command::new("schtasks.exe")
            .args(["/Delete", "/TN", task_name, "/F"])
            .output();
    }
    let mut restored = change.clone();
    restored.restored_at = Some(Utc::now().to_rfc3339());
    if mark_restored {
        update_change(app, &restored)?;
    }
    Ok(restored)
}

fn profile_store(app: &AppHandle) -> Result<Vec<StartupProfile>, String> {
    load_json(&profiles_path(app)?)
}

fn save_profiles(app: &AppHandle, profiles: &[StartupProfile]) -> Result<(), String> {
    save_json(&profiles_path(app)?, &profiles)
}

#[tauri::command]
pub fn m05_registry_entries(op_id: String) -> Result<OperationResult<Vec<StartupItem>>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match read_registry_items() {
        Ok(items) => Ok(success(
            op_id,
            "m05_s01",
            "m05.registry.inspect",
            started_at,
            timer,
            items,
            "Registry startup entries were read from Windows.".into(),
            "تمت قراءة مدخلات بدء التشغيل من سجل ويندوز.".into(),
            Vec::new(),
        )),
        Err(error) => Ok(failure(
            op_id,
            "m05_s01",
            "m05.registry.inspect",
            started_at,
            timer,
            "registry_read_failed",
            error,
        )),
    }
}

#[tauri::command]
pub fn m05_startup_folders(op_id: String) -> Result<OperationResult<Vec<StartupItem>>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match read_folder_items() {
        Ok(items) => Ok(success(
            op_id,
            "m05_s02",
            "m05.folders.inspect",
            started_at,
            timer,
            items,
            "Windows Startup folders were inspected.".into(),
            "تم فحص مجلدات بدء التشغيل في ويندوز.".into(),
            Vec::new(),
        )),
        Err(error) => Ok(failure(
            op_id,
            "m05_s02",
            "m05.folders.inspect",
            started_at,
            timer,
            "startup_folder_read_failed",
            error,
        )),
    }
}

#[tauri::command]
pub fn m05_scheduled_tasks(
    op_id: String,
) -> Result<OperationResult<Vec<ScheduledTaskItem>>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match read_tasks() {
        Ok(items) => Ok(success(
            op_id,
            "m05_s03",
            "m05.tasks.inspect",
            started_at,
            timer,
            items,
            "Boot and logon scheduled tasks were inspected.".into(),
            "تم فحص المهام المجدولة عند الإقلاع وتسجيل الدخول.".into(),
            Vec::new(),
        )),
        Err(error) => Ok(failure(
            op_id,
            "m05_s03",
            "m05.tasks.inspect",
            started_at,
            timer,
            "scheduled_task_read_failed",
            error,
        )),
    }
}

#[tauri::command]
pub fn m05_windows_services(
    op_id: String,
) -> Result<OperationResult<Vec<WindowsServiceItem>>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match read_services() {
        Ok(items) => Ok(success(
            op_id,
            "m05_s04",
            "m05.services.inspect",
            started_at,
            timer,
            items,
            "Windows services and executable signatures were inspected read-only.".into(),
            "تم فحص خدمات ويندوز وتوقيعات ملفاتها للقراءة فقط.".into(),
            Vec::new(),
        )),
        Err(error) => Ok(failure(
            op_id,
            "m05_s04",
            "m05.services.inspect",
            started_at,
            timer,
            "services_read_failed",
            error,
        )),
    }
}

#[tauri::command]
pub fn m05_impact_assess(op_id: String) -> Result<OperationResult<ImpactSummary>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let items = match all_startup_items() {
        Ok(items) => items,
        Err(error) => {
            return Ok(failure(
                op_id,
                "m05_s05",
                "m05.impact.assess",
                started_at,
                timer,
                "impact_inventory_failed",
                error,
            ))
        }
    };
    let boot_history = read_boot_history(20).unwrap_or_default();
    let values: Vec<u64> = boot_history
        .iter()
        .filter_map(|item| item.boot_duration_ms)
        .collect();
    let average_boot_ms =
        (!values.is_empty()).then(|| values.iter().sum::<u64>() / values.len() as u64);
    let high_attention_count = items.iter().filter(|item| item.impact_score >= 60).count();
    Ok(success(op_id, "m05_s05", "m05.impact.assess", started_at, timer,
        ImpactSummary {
            items, boot_history, average_boot_ms, high_attention_count,
            scoring_notice_en: "The item score is a transparent review heuristic based on signature, scope and command characteristics; it is not a measured per-app boot delay.".into(),
            scoring_notice_ar: "درجة العنصر مؤشر مراجعة شفاف يعتمد على التوقيع والنطاق وخصائص الأمر، وليست قياسًا لزمن تأخير كل برنامج.".into(),
            measured_at: Utc::now().to_rfc3339(),
        },
        "Startup attention scores and measured boot history were calculated.".into(),
        "تم حساب مؤشرات مراجعة بدء التشغيل وسجل الإقلاع المقاس.".into(), Vec::new()))
}

#[tauri::command]
pub fn m05_recommendations(op_id: String) -> Result<OperationResult<RecommendationReport>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let items = match all_startup_items() {
        Ok(items) => items,
        Err(error) => {
            return Ok(failure(
                op_id,
                "m05_s06",
                "m05.recommendations.generate",
                started_at,
                timer,
                "recommendation_inventory_failed",
                error,
            ))
        }
    };
    let protected_count = items.iter().filter(|item| item.protected).count();
    let mutable_count = items.iter().filter(|item| item.mutable).count();
    let recommendations = items
        .iter()
        .filter(|item| item.mutable && item.impact_score >= 35)
        .map(|item| RecommendationItem {
            item_id: item.id.clone(),
            item_name: item.name.clone(),
            severity: if item.impact_score >= 60 { "high".into() } else { "review".into() },
            recommendation_en: "Review this non-Microsoft user startup entry. Disable it only when you recognize the application and do not need it immediately after sign-in.".into(),
            recommendation_ar: "راجع عنصر بدء التشغيل الخاص بالمستخدم وغير التابع لمايكروسوفت، وعطله فقط إذا كنت تعرف البرنامج ولا تحتاجه فور تسجيل الدخول.".into(),
            reasons: item.impact_basis.clone(),
            automatic_change_allowed: false,
        })
        .collect();
    Ok(success(
        op_id,
        "m05_s06",
        "m05.recommendations.generate",
        started_at,
        timer,
        RecommendationReport {
            recommendations,
            protected_count,
            mutable_count,
            measured_at: Utc::now().to_rfc3339(),
        },
        "Safe review recommendations were generated without changing Windows.".into(),
        "تم إنشاء توصيات مراجعة آمنة دون تغيير ويندوز.".into(),
        Vec::new(),
    ))
}

#[tauri::command]
pub fn m05_startup_change(
    app: AppHandle,
    op_id: String,
    request: StartupChangeRequest,
) -> Result<OperationResult<MutationResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let outcome = match request {
        StartupChangeRequest::Disable {
            item_id,
            confirmation,
        } => {
            let item = match find_item(&item_id) {
                Ok(item) => item,
                Err(error) => {
                    return Ok(failure(
                        op_id,
                        "m05_s09",
                        "m05.startup.change",
                        started_at,
                        timer,
                        "item_not_found",
                        error,
                    ))
                }
            };
            if confirmation != format!("DISABLE {}", item.name) {
                return Ok(failure(
                    op_id,
                    "m05_s09",
                    "m05.startup.change",
                    started_at,
                    timer,
                    "confirmation_mismatch",
                    format!("Type DISABLE {} to continue.", item.name),
                ));
            }
            match disable_item(&app, &item, None) {
                Ok(change) => MutationResult {
                    item: Some(item),
                    change: Some(change),
                    active_changes: active_changes(&app).unwrap_or_default(),
                    message: "Startup entry disabled with a restoration record.".into(),
                },
                Err(error) => {
                    return Ok(failure(
                        op_id,
                        "m05_s09",
                        "m05.startup.change",
                        started_at,
                        timer,
                        "disable_failed",
                        error,
                    ))
                }
            }
        }
    };
    Ok(success(
        op_id,
        "m05_s09",
        "m05.startup.change",
        started_at,
        timer,
        outcome,
        "The startup change was applied and recorded for restoration.".into(),
        "تم تطبيق تغيير بدء التشغيل وحفظ سجل للاستعادة.".into(),
        Vec::new(),
    ))
}

#[tauri::command]
pub fn m05_delay_manage(
    app: AppHandle,
    op_id: String,
    request: DelayRequest,
) -> Result<OperationResult<MutationResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = match request {
        DelayRequest::List => MutationResult {
            item: None,
            change: None,
            active_changes: active_changes(&app)
                .unwrap_or_default()
                .into_iter()
                .filter(|item| item.kind == "delayed")
                .collect(),
            message: "Delayed startup records loaded.".into(),
        },
        DelayRequest::Create {
            item_id,
            delay_seconds,
            confirmation,
        } => {
            if !matches!(delay_seconds, 30 | 60 | 90) {
                return Ok(failure(
                    op_id,
                    "m05_s07",
                    "m05.delay.manage",
                    started_at,
                    timer,
                    "invalid_delay",
                    "Delay must be 30, 60, or 90 seconds.".into(),
                ));
            }
            let item = match find_item(&item_id) {
                Ok(item) => item,
                Err(error) => {
                    return Ok(failure(
                        op_id,
                        "m05_s07",
                        "m05.delay.manage",
                        started_at,
                        timer,
                        "item_not_found",
                        error,
                    ))
                }
            };
            if confirmation != format!("DELAY {}", item.name) {
                return Ok(failure(
                    op_id,
                    "m05_s07",
                    "m05.delay.manage",
                    started_at,
                    timer,
                    "confirmation_mismatch",
                    format!("Type DELAY {} to continue.", item.name),
                ));
            }
            if !item.mutable || item.protected {
                return Ok(failure(
                    op_id,
                    "m05_s07",
                    "m05.delay.manage",
                    started_at,
                    timer,
                    "item_protected",
                    "Only recognized non-Microsoft user startup items can be delayed.".into(),
                ));
            }
            let task_name = format!("\\KNOUX ONE\\Delayed\\{}", item.id);
            let delay = format!("0000:{delay_seconds:02}");
            let output = Command::new("schtasks.exe")
                .args([
                    "/Create",
                    "/SC",
                    "ONLOGON",
                    "/DELAY",
                    &delay,
                    "/TN",
                    &task_name,
                    "/TR",
                    &item.command,
                    "/F",
                ])
                .output()
                .map_err(|error| format!("schtasks_launch_failed:{error}"))?;
            if !output.status.success() {
                let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
                return Ok(failure(
                    op_id,
                    "m05_s07",
                    "m05.delay.manage",
                    started_at,
                    timer,
                    "task_create_failed",
                    message,
                ));
            }
            match disable_item(&app, &item, Some(task_name.clone())) {
                Ok(change) => MutationResult {
                    item: Some(item),
                    change: Some(change),
                    active_changes: active_changes(&app).unwrap_or_default(),
                    message: format!("Program will start {delay_seconds} seconds after sign-in."),
                },
                Err(error) => {
                    let _ = Command::new("schtasks.exe")
                        .args(["/Delete", "/TN", &task_name, "/F"])
                        .output();
                    return Ok(failure(
                        op_id,
                        "m05_s07",
                        "m05.delay.manage",
                        started_at,
                        timer,
                        "original_disable_failed",
                        error,
                    ));
                }
            }
        }
        DelayRequest::Remove {
            change_id,
            confirmation,
        } => {
            if confirmation != "RESTORE" {
                return Ok(failure(
                    op_id,
                    "m05_s07",
                    "m05.delay.manage",
                    started_at,
                    timer,
                    "confirmation_mismatch",
                    "Type RESTORE to remove delayed startup and restore the original entry.".into(),
                ));
            }
            let change = active_changes(&app)
                .unwrap_or_default()
                .into_iter()
                .find(|item| item.id == change_id && item.kind == "delayed");
            let Some(change) = change else {
                return Ok(failure(
                    op_id,
                    "m05_s07",
                    "m05.delay.manage",
                    started_at,
                    timer,
                    "change_not_found",
                    "Delayed startup record was not found.".into(),
                ));
            };
            match restore_change_internal(&app, &change, true) {
                Ok(restored) => MutationResult {
                    item: None,
                    change: Some(restored),
                    active_changes: active_changes(&app).unwrap_or_default(),
                    message: "Original startup entry restored and delayed task removed.".into(),
                },
                Err(error) => {
                    return Ok(failure(
                        op_id,
                        "m05_s07",
                        "m05.delay.manage",
                        started_at,
                        timer,
                        "restore_failed",
                        error,
                    ))
                }
            }
        }
    };
    Ok(success(
        op_id,
        "m05_s07",
        "m05.delay.manage",
        started_at,
        timer,
        result,
        "Delayed startup settings were processed safely.".into(),
        "تمت معالجة إعدادات التشغيل المؤجل بأمان.".into(),
        Vec::new(),
    ))
}

#[tauri::command]
pub fn m05_profiles_manage(
    app: AppHandle,
    op_id: String,
    request: ProfileRequest,
) -> Result<OperationResult<ProfileResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let mut profiles = match profile_store(&app) {
        Ok(items) => items,
        Err(error) => {
            return Ok(failure(
                op_id,
                "m05_s08",
                "m05.profiles.manage",
                started_at,
                timer,
                "profile_store_failed",
                error,
            ))
        }
    };
    let mut applied_profile_id = None;
    let message = match request {
        ProfileRequest::List => "Startup profiles loaded.".into(),
        ProfileRequest::Create {
            name,
            enabled_item_ids,
        } => {
            let name = name.trim();
            if name.len() < 2 || name.len() > 64 {
                return Ok(failure(
                    op_id,
                    "m05_s08",
                    "m05.profiles.manage",
                    started_at,
                    timer,
                    "invalid_profile_name",
                    "Profile name must contain 2 to 64 characters.".into(),
                ));
            }
            let known: HashSet<String> = all_startup_items()
                .unwrap_or_default()
                .into_iter()
                .map(|item| item.id)
                .collect();
            let filtered: Vec<String> = enabled_item_ids
                .into_iter()
                .filter(|id| known.contains(id))
                .collect();
            profiles.push(StartupProfile {
                id: Uuid::new_v4().to_string(),
                name: name.into(),
                enabled_item_ids: filtered,
                created_at: Utc::now().to_rfc3339(),
                applied_at: None,
            });
            save_profiles(&app, &profiles)?;
            "Startup profile created from verified current items.".into()
        }
        ProfileRequest::Delete {
            profile_id,
            confirmation,
        } => {
            if confirmation != "DELETE PROFILE" {
                return Ok(failure(
                    op_id,
                    "m05_s08",
                    "m05.profiles.manage",
                    started_at,
                    timer,
                    "confirmation_mismatch",
                    "Type DELETE PROFILE to continue.".into(),
                ));
            }
            let before = profiles.len();
            profiles.retain(|item| item.id != profile_id);
            if profiles.len() == before {
                return Ok(failure(
                    op_id,
                    "m05_s08",
                    "m05.profiles.manage",
                    started_at,
                    timer,
                    "profile_not_found",
                    "Startup profile was not found.".into(),
                ));
            }
            save_profiles(&app, &profiles)?;
            "Startup profile deleted.".into()
        }
        ProfileRequest::Apply {
            profile_id,
            confirmation,
        } => {
            if confirmation != "APPLY PROFILE" {
                return Ok(failure(
                    op_id,
                    "m05_s08",
                    "m05.profiles.manage",
                    started_at,
                    timer,
                    "confirmation_mismatch",
                    "Type APPLY PROFILE to continue.".into(),
                ));
            }
            let Some(profile_index) = profiles.iter().position(|item| item.id == profile_id) else {
                return Ok(failure(
                    op_id,
                    "m05_s08",
                    "m05.profiles.manage",
                    started_at,
                    timer,
                    "profile_not_found",
                    "Startup profile was not found.".into(),
                ));
            };
            let enabled: HashSet<String> = profiles[profile_index]
                .enabled_item_ids
                .iter()
                .cloned()
                .collect();
            for item in all_startup_items()
                .unwrap_or_default()
                .into_iter()
                .filter(|item| item.mutable && !enabled.contains(&item.id))
            {
                if active_changes(&app)
                    .unwrap_or_default()
                    .iter()
                    .any(|change| change.item_id == item.id)
                {
                    continue;
                }
                disable_item(&app, &item, None)?;
            }
            for change in active_changes(&app)
                .unwrap_or_default()
                .into_iter()
                .filter(|change| enabled.contains(&change.item_id))
            {
                restore_change_internal(&app, &change, true)?;
            }
            profiles[profile_index].applied_at = Some(Utc::now().to_rfc3339());
            save_profiles(&app, &profiles)?;
            applied_profile_id = Some(profile_id);
            "Startup profile applied to mutable user entries. Protected and machine entries were untouched.".into()
        }
    };
    Ok(success(
        op_id,
        "m05_s08",
        "m05.profiles.manage",
        started_at,
        timer,
        ProfileResult {
            profiles,
            active_changes: active_changes(&app).unwrap_or_default(),
            applied_profile_id,
            message,
        },
        "Startup profiles were processed.".into(),
        "تمت معالجة بروفايلات بدء التشغيل.".into(),
        Vec::new(),
    ))
}

#[tauri::command]
pub fn m05_restore_manage(
    app: AppHandle,
    op_id: String,
    request: RestoreRequest,
) -> Result<OperationResult<MutationResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = match request {
        RestoreRequest::List => MutationResult {
            item: None,
            change: None,
            active_changes: active_changes(&app).unwrap_or_default(),
            message: "Restorable startup changes loaded.".into(),
        },
        RestoreRequest::Restore {
            change_id,
            confirmation,
        } => {
            if confirmation != "RESTORE" {
                return Ok(failure(
                    op_id,
                    "m05_s09",
                    "m05.restore.manage",
                    started_at,
                    timer,
                    "confirmation_mismatch",
                    "Type RESTORE to continue.".into(),
                ));
            }
            let change = active_changes(&app)
                .unwrap_or_default()
                .into_iter()
                .find(|item| item.id == change_id);
            let Some(change) = change else {
                return Ok(failure(
                    op_id,
                    "m05_s09",
                    "m05.restore.manage",
                    started_at,
                    timer,
                    "change_not_found",
                    "Restoration record was not found.".into(),
                ));
            };
            match restore_change_internal(&app, &change, true) {
                Ok(restored) => MutationResult {
                    item: None,
                    change: Some(restored),
                    active_changes: active_changes(&app).unwrap_or_default(),
                    message: "Startup item restored to its previous state.".into(),
                },
                Err(error) => {
                    return Ok(failure(
                        op_id,
                        "m05_s09",
                        "m05.restore.manage",
                        started_at,
                        timer,
                        "restore_failed",
                        error,
                    ))
                }
            }
        }
    };
    Ok(success(
        op_id,
        "m05_s09",
        "m05.restore.manage",
        started_at,
        timer,
        result,
        "Restoration records were processed.".into(),
        "تمت معالجة سجلات الاستعادة.".into(),
        Vec::new(),
    ))
}

#[tauri::command]
pub fn m05_boot_history(
    op_id: String,
    limit: Option<usize>,
) -> Result<OperationResult<Vec<BootMetric>>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match read_boot_history(limit.unwrap_or(30)) {
        Ok(items) => Ok(success(
            op_id,
            "m05_s10",
            "m05.boot.history",
            started_at,
            timer,
            items,
            "Measured Windows boot-performance history was loaded from Event 100.".into(),
            "تم تحميل سجل أداء إقلاع ويندوز المقاس من الحدث 100.".into(),
            Vec::new(),
        )),
        Err(error) => Ok(failure(
            op_id,
            "m05_s10",
            "m05.boot.history",
            started_at,
            timer,
            "boot_history_failed",
            error,
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_ids_are_deterministic() {
        assert_eq!(stable_id(&["a", "b"]), stable_id(&["a", "b"]));
        assert_ne!(stable_id(&["a", "b"]), stable_id(&["a", "c"]));
    }

    #[test]
    fn microsoft_system_entries_are_protected() {
        assert!(is_microsoft(
            "CN=Microsoft Corporation",
            "C:\\Program Files\\App.exe",
            "App"
        ));
        assert!(is_microsoft(
            "",
            "C:\\Windows\\System32\\SecurityHealthSystray.exe",
            "Security"
        ));
        assert!(!is_microsoft(
            "CN=Vendor",
            "C:\\Program Files\\Vendor\\App.exe",
            "Vendor App"
        ));
    }

    #[test]
    fn powershell_literal_quoting_escapes_single_quotes() {
        assert_eq!(ps_quote("O'Brien"), "'O''Brien'");
    }
}
