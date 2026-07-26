use crate::startup_services::{
    contracts::{
        BootHistoryItem, BootHistoryResult, ScheduledTaskInventory, ScheduledTaskItem,
        WindowsServiceInventory, WindowsServiceItem,
    },
    discovery, powershell,
};
use chrono::Utc;
use serde::Deserialize;
use std::collections::HashMap;

const SCHEDULED_TASKS_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$results = @()
Get-ScheduledTask | ForEach-Object {
  $task = $_
  $info = $null
  try { $info = Get-ScheduledTaskInfo -TaskName $task.TaskName -TaskPath $task.TaskPath } catch {}
  $results += [pscustomobject]@{
    TaskPath = [string]$task.TaskPath
    TaskName = [string]$task.TaskName
    State = [string]$task.State
    Enabled = [bool]($task.Settings.Enabled)
    Author = if ($null -eq $task.Author) { $null } else { [string]$task.Author }
    Description = if ($null -eq $task.Description) { $null } else { [string]$task.Description }
    LastRunTime = if ($null -eq $info -or $info.LastRunTime -eq [datetime]::MinValue) { $null } else { $info.LastRunTime.ToUniversalTime().ToString('o') }
    NextRunTime = if ($null -eq $info -or $info.NextRunTime -eq [datetime]::MinValue) { $null } else { $info.NextRunTime.ToUniversalTime().ToString('o') }
    LastTaskResult = if ($null -eq $info) { $null } else { [int64]$info.LastTaskResult }
  }
}
@($results) | ConvertTo-Json -Depth 6 -Compress
"#;

const WINDOWS_SERVICES_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$results = Get-CimInstance -ClassName Win32_Service | ForEach-Object {
  [pscustomobject]@{
    Name = [string]$_.Name
    DisplayName = [string]$_.DisplayName
    State = [string]$_.State
    StartMode = [string]$_.StartMode
    PathName = if ($null -eq $_.PathName) { $null } else { [string]$_.PathName }
    StartName = if ($null -eq $_.StartName) { $null } else { [string]$_.StartName }
    ProcessId = if ($null -eq $_.ProcessId) { $null } else { [uint32]$_.ProcessId }
  }
}
@($results) | ConvertTo-Json -Depth 5 -Compress
"#;

const BOOT_HISTORY_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$limit = 30
if (-not [string]::IsNullOrWhiteSpace($env:KNOUX_BOOT_LIMIT)) {
  $parsed = 0
  if ([int]::TryParse($env:KNOUX_BOOT_LIMIT, [ref]$parsed)) { $limit = [Math]::Max(1, [Math]::Min(200, $parsed)) }
}
$results = @()
$events = Get-WinEvent -FilterHashtable @{ LogName='Microsoft-Windows-Diagnostics-Performance/Operational'; Id=100 } -MaxEvents $limit
foreach ($event in $events) {
  [xml]$xml = $event.ToXml()
  $values = @{}
  foreach ($data in $xml.Event.EventData.Data) {
    $values[[string]$data.Name] = [string]$data.'#text'
  }
  $results += [pscustomobject]@{
    RecordedAt = $event.TimeCreated.ToUniversalTime().ToString('o')
    BootDurationMs = if ($values.ContainsKey('BootTime')) { [uint64]$values['BootTime'] } else { $null }
    MainPathBootTimeMs = if ($values.ContainsKey('MainPathBootTime')) { [uint64]$values['MainPathBootTime'] } else { $null }
    BootPostBootTimeMs = if ($values.ContainsKey('BootPostBootTime')) { [uint64]$values['BootPostBootTime'] } else { $null }
    EventId = [uint32]$event.Id
    Level = [string]$event.LevelDisplayName
  }
}
@($results) | ConvertTo-Json -Depth 5 -Compress
"#;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct RawTask {
    task_path: String,
    task_name: String,
    state: String,
    enabled: bool,
    author: Option<String>,
    description: Option<String>,
    last_run_time: Option<String>,
    next_run_time: Option<String>,
    last_task_result: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct RawService {
    name: String,
    display_name: String,
    state: String,
    start_mode: String,
    path_name: Option<String>,
    start_name: Option<String>,
    process_id: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct RawBootEvent {
    recorded_at: String,
    boot_duration_ms: Option<u64>,
    main_path_boot_time_ms: Option<u64>,
    boot_post_boot_time_ms: Option<u64>,
    event_id: u32,
    level: String,
}

pub fn scheduled_tasks() -> Result<ScheduledTaskInventory, String> {
    let raw: Vec<RawTask> = powershell::run_json(SCHEDULED_TASKS_SCRIPT, HashMap::new())?;
    let mut tasks = raw
        .into_iter()
        .map(|task| {
            let protected = task.task_path.to_ascii_lowercase().starts_with("\\microsoft\\");
            ScheduledTaskItem {
                task_path: task.task_path,
                task_name: task.task_name,
                state: task.state,
                enabled: task.enabled,
                author: task.author,
                description: task.description,
                last_run_time: task.last_run_time,
                next_run_time: task.next_run_time,
                last_task_result: task.last_task_result,
                protected,
            }
        })
        .collect::<Vec<_>>();
    tasks.sort_by(|left, right| {
        left.task_path
            .cmp(&right.task_path)
            .then_with(|| left.task_name.cmp(&right.task_name))
    });
    Ok(ScheduledTaskInventory {
        tasks,
        measured_at: Utc::now().to_rfc3339(),
        read_only: true,
        warnings: vec!["scheduled_task_changes_not_enabled_in_this_phase".into()],
    })
}

pub fn windows_services() -> Result<WindowsServiceInventory, String> {
    let raw: Vec<RawService> = powershell::run_json(WINDOWS_SERVICES_SCRIPT, HashMap::new())?;
    let mut services = raw
        .into_iter()
        .map(|service| {
            let (protected, reason_en, reason_ar) = discovery::is_protected_service(
                &service.name,
                service.start_name.as_deref(),
                service.path_name.as_deref(),
            );
            WindowsServiceItem {
                name: service.name,
                display_name: service.display_name,
                state: service.state,
                start_mode: service.start_mode,
                path_name: service.path_name,
                start_name: service.start_name,
                process_id: service.process_id,
                protected,
                protection_reason_en: reason_en,
                protection_reason_ar: reason_ar,
            }
        })
        .collect::<Vec<_>>();
    services.sort_by(|left, right| left.display_name.to_ascii_lowercase().cmp(&right.display_name.to_ascii_lowercase()));
    Ok(WindowsServiceInventory {
        services,
        measured_at: Utc::now().to_rfc3339(),
        read_only: true,
        warnings: vec!["service_changes_not_enabled_in_this_phase".into()],
    })
}

pub fn boot_history(limit: usize) -> Result<BootHistoryResult, String> {
    let mut environment = HashMap::new();
    environment.insert("KNOUX_BOOT_LIMIT".into(), limit.clamp(1, 200).to_string());
    let raw: Vec<RawBootEvent> = powershell::run_json(BOOT_HISTORY_SCRIPT, environment)?;
    let entries = raw
        .into_iter()
        .map(|event| BootHistoryItem {
            recorded_at: event.recorded_at,
            boot_duration_ms: event.boot_duration_ms,
            main_path_boot_time_ms: event.main_path_boot_time_ms,
            boot_post_boot_time_ms: event.boot_post_boot_time_ms,
            event_id: event.event_id,
            level: event.level,
        })
        .collect();
    Ok(BootHistoryResult {
        entries,
        source: "Microsoft-Windows-Diagnostics-Performance/Operational event 100".into(),
        measured_at: Utc::now().to_rfc3339(),
        warnings: Vec::new(),
    })
}
