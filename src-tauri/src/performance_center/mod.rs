use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    fs::File,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuCoreSample {
    pub name: String,
    pub utilization_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuSnapshot {
    pub model: String,
    pub logical_processors: u32,
    pub current_mhz: u64,
    pub max_mhz: u64,
    pub total_percent: f64,
    pub cores: Vec<CpuCoreSample>,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySnapshot {
    pub total_physical_bytes: u64,
    pub available_physical_bytes: u64,
    pub used_physical_bytes: u64,
    pub committed_bytes: u64,
    pub commit_limit_bytes: u64,
    pub cache_bytes: u64,
    pub load_percent: f64,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSample {
    pub name: String,
    pub read_bytes_per_sec: u64,
    pub write_bytes_per_sec: u64,
    pub transfers_per_sec: u64,
    pub active_time_percent: f64,
    pub queue_length: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskActivitySnapshot {
    pub disks: Vec<DiskSample>,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkAdapterSample {
    pub name: String,
    pub bytes_received_per_sec: u64,
    pub bytes_sent_per_sec: u64,
    pub bytes_total_per_sec: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessConnectionSample {
    pub pid: u32,
    pub process_name: String,
    pub connection_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkActivitySnapshot {
    pub adapters: Vec<NetworkAdapterSample>,
    pub process_connections: Vec<ProcessConnectionSample>,
    pub bandwidth_notice_en: String,
    pub bandwidth_notice_ar: String,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessItem {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub executable_path: Option<String>,
    pub command_line: Option<String>,
    pub working_set_bytes: u64,
    pub private_memory_bytes: u64,
    pub cpu_seconds: f64,
    pub thread_count: u32,
    pub handle_count: u32,
    pub priority: String,
    pub path_verified: bool,
    pub protected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessExplorerSnapshot {
    pub processes: Vec<ProcessItem>,
    pub total_processes: usize,
    pub truncated: bool,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeavyProcessItem {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f64,
    pub working_set_bytes: u64,
    pub private_memory_bytes: u64,
    pub thread_count: u32,
    pub protected: bool,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeavyProcessReport {
    pub processes: Vec<HeavyProcessItem>,
    pub cpu_attention_percent: f64,
    pub memory_attention_bytes: u64,
    pub sample_interval_ms: u64,
    pub leak_notice_en: String,
    pub leak_notice_ar: String,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityChange {
    pub id: String,
    pub pid: u32,
    pub process_name: String,
    pub previous_priority: String,
    pub new_priority: String,
    pub created_at: String,
    pub restored_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityResult {
    pub active_changes: Vec<PriorityChange>,
    pub process: Option<ProcessItem>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum PriorityRequest {
    #[serde(rename = "list")]
    List,
    #[serde(rename = "set")]
    Set {
        pid: u32,
        priority: String,
        confirmation: String,
    },
    #[serde(rename = "restore")]
    Restore {
        change_id: String,
        confirmation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerPlan {
    pub guid: String,
    pub name: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerPlanSnapshot {
    pub active_guid: String,
    pub plans: Vec<PowerPlan>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerPlanChange {
    pub id: String,
    pub previous_guid: String,
    pub selected_guid: String,
    pub created_at: String,
    pub restored_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerPlanResult {
    pub snapshot: PowerPlanSnapshot,
    pub active_changes: Vec<PowerPlanChange>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum PowerPlanRequest {
    #[serde(rename = "list")]
    List,
    #[serde(rename = "set")]
    Set { guid: String, confirmation: String },
    #[serde(rename = "restore")]
    Restore {
        change_id: String,
        confirmation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceProfile {
    pub id: String,
    pub name: String,
    pub power_scheme_guid: String,
    pub cpu_attention_percent: f64,
    pub memory_attention_percent: f64,
    pub created_at: String,
    pub applied_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileResult {
    pub profiles: Vec<PerformanceProfile>,
    pub active_profile_id: Option<String>,
    pub power: PowerPlanSnapshot,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum ProfileRequest {
    #[serde(rename = "list")]
    List,
    #[serde(rename = "create")]
    Create {
        name: String,
        power_scheme_guid: String,
        cpu_attention_percent: f64,
        memory_attention_percent: f64,
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
#[serde(rename_all = "camelCase")]
pub struct BenchmarkReport {
    pub cpu_hash_iterations: u64,
    pub cpu_hashes_per_sec: f64,
    pub disk_test_bytes: u64,
    pub disk_write_mbps: f64,
    pub disk_read_mbps: f64,
    pub temporary_file_removed: bool,
    pub report_path: String,
    pub measured_at: String,
    pub notice_en: String,
    pub notice_ar: String,
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
        summary_ar: format!("فشلت عملية مركز الأداء: {message}"),
        warnings: Vec::new(),
        error_code: Some(code.into()),
        data: None,
    }
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
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app_data_unavailable:{error}"))?
        .join("performance-center");
    fs::create_dir_all(&path).map_err(|error| format!("app_data_create_failed:{error}"))?;
    Ok(path)
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

fn is_protected_process(name: &str, path: Option<&str>, pid: u32) -> bool {
    if pid <= 4 {
        return true;
    }
    let name = name.to_ascii_lowercase();
    let protected_names = [
        "system",
        "registry",
        "smss",
        "csrss",
        "wininit",
        "winlogon",
        "services",
        "lsass",
        "svchost",
        "dwm",
        "fontdrvhost",
        "memory compression",
    ];
    if protected_names.iter().any(|item| name == *item) {
        return true;
    }
    path.map(|value| {
        let value = value.to_ascii_lowercase();
        value.contains("\\windows\\system32\\") || value.contains("\\windows\\syswow64\\")
    })
    .unwrap_or(false)
}

fn cpu_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$processors=@(Get-CimInstance Win32_Processor)
$perf=@(Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor)
$total=$perf | Where-Object { $_.Name -eq '_Total' } | Select-Object -First 1
$cores=@($perf | Where-Object { $_.Name -ne '_Total' } | Sort-Object {[int]$_.Name} | ForEach-Object {
  [pscustomobject]@{name=[string]$_.Name;utilizationPercent=[double]$_.PercentProcessorTime}
})
[pscustomobject]@{
  model=(($processors | ForEach-Object {$_.Name.Trim()}) -join ' / ')
  logicalProcessors=[uint32](($processors | Measure-Object NumberOfLogicalProcessors -Sum).Sum)
  currentMhz=[uint64](($processors | Measure-Object CurrentClockSpeed -Average).Average)
  maxMhz=[uint64](($processors | Measure-Object MaxClockSpeed -Average).Average)
  totalPercent=if($null -eq $total){0}else{[double]$total.PercentProcessorTime}
  cores=$cores
  measuredAt=(Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 6 -Compress
"#
}

fn memory_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$os=Get-CimInstance Win32_OperatingSystem
$perf=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$total=[uint64]$os.TotalVisibleMemorySize*1024
$available=[uint64]$os.FreePhysicalMemory*1024
$used=$total-$available
[pscustomobject]@{
  totalPhysicalBytes=$total
  availablePhysicalBytes=$available
  usedPhysicalBytes=$used
  committedBytes=[uint64]$perf.CommittedBytes
  commitLimitBytes=[uint64]$perf.CommitLimit
  cacheBytes=[uint64]$perf.CacheBytes
  loadPercent=if($total -eq 0){0}else{[math]::Round(($used*100.0)/$total,2)}
  measuredAt=(Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Compress
"#
}

fn disk_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$items=@(Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object {$_.Name -ne '_Total'} | ForEach-Object {
  [pscustomobject]@{
    name=[string]$_.Name
    readBytesPerSec=[uint64]$_.DiskReadBytesPersec
    writeBytesPerSec=[uint64]$_.DiskWriteBytesPersec
    transfersPerSec=[uint64]$_.DiskTransfersPersec
    activeTimePercent=[double]$_.PercentDiskTime
    queueLength=[uint64]$_.CurrentDiskQueueLength
  }
})
[pscustomobject]@{disks=$items;measuredAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json -Depth 5 -Compress
"#
}

fn network_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$adapters=@(Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface | ForEach-Object {
  [pscustomobject]@{
    name=[string]$_.Name
    bytesReceivedPerSec=[uint64]$_.BytesReceivedPersec
    bytesSentPerSec=[uint64]$_.BytesSentPersec
    bytesTotalPerSec=[uint64]$_.BytesTotalPersec
  }
})
$connections=@()
try {
  $groups=Get-NetTCPConnection -State Established -ErrorAction Stop | Group-Object OwningProcess
  $connections=@($groups | ForEach-Object {
    $pidValue=[uint32]$_.Name
    $processName='Unknown'
    try {$processName=(Get-Process -Id $pidValue -ErrorAction Stop).ProcessName}catch{}
    [pscustomobject]@{pid=$pidValue;processName=$processName;connectionCount=[uint32]$_.Count}
  } | Sort-Object connectionCount -Descending | Select-Object -First 50)
}catch{}
[pscustomobject]@{
  adapters=$adapters
  processConnections=$connections
  bandwidthNoticeEn='Adapter throughput is measured by Windows. Per-process rows show established connection counts, not fabricated per-process bandwidth.'
  bandwidthNoticeAr='يتم قياس سرعة المحولات من ويندوز، بينما تعرض صفوف البرامج عدد الاتصالات الفعلية ولا تختلق سرعة لكل برنامج.'
  measuredAt=(Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 6 -Compress
"#
}

fn process_script(limit: usize) -> String {
    format!(
        r#"
$ErrorActionPreference='Stop'
$cim=@{{}}
Get-CimInstance Win32_Process | ForEach-Object {{$cim[[uint32]$_.ProcessId]=$_}}
$all=@(Get-Process | Sort-Object WorkingSet64 -Descending)
$items=@($all | Select-Object -First {limit} | ForEach-Object {{
  $p=$_
  $meta=$cim[[uint32]$p.Id]
  $path=$null
  try {{$path=$p.Path}}catch{{}}
  $priority='Unknown'
  try {{$priority=[string]$p.PriorityClass}}catch{{}}
  $name=[string]$p.ProcessName
  $isProtected=($p.Id -le 4) -or @('System','Registry','smss','csrss','wininit','winlogon','services','lsass','svchost','dwm','fontdrvhost','Memory Compression') -contains $name
  if($path -and ($path -like '*\Windows\System32\*' -or $path -like '*\Windows\SysWOW64\*')) {{$isProtected=$true}}
  [pscustomobject]@{{
    pid=[uint32]$p.Id
    parentPid=if($null -eq $meta){{$null}}else{{[uint32]$meta.ParentProcessId}}
    name=$name
    executablePath=$path
    commandLine=if($null -eq $meta){{$null}}else{{$meta.CommandLine}}
    workingSetBytes=[uint64]$p.WorkingSet64
    privateMemoryBytes=[uint64]$p.PrivateMemorySize64
    cpuSeconds=if($null -eq $p.CPU){{0}}else{{[double]$p.CPU}}
    threadCount=[uint32]$p.Threads.Count
    handleCount=[uint32]$p.HandleCount
    priority=$priority
    pathVerified=[bool]($path -and (Test-Path -LiteralPath $path))
    protected=[bool]$isProtected
  }}
}})
[pscustomobject]@{{processes=$items;totalProcesses=[uint64]$all.Count;truncated=[bool]($all.Count -gt {limit});measuredAt=(Get-Date).ToUniversalTime().ToString('o')}} | ConvertTo-Json -Depth 6 -Compress
"#,
    )
}

fn heavy_script() -> &'static str {
    r#"
$ErrorActionPreference='Stop'
$logical=[double](Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
if($logical -lt 1){$logical=1}
$first=@{}
Get-Process | ForEach-Object {if($null -ne $_.CPU){$first[[uint32]$_.Id]=[double]$_.CPU}}
$interval=800
Start-Sleep -Milliseconds $interval
$items=@(Get-Process | ForEach-Object {
  $p=$_
  $before=$first[[uint32]$p.Id]
  if($null -eq $before -or $null -eq $p.CPU){return}
  $cpu=[math]::Max(0,(($p.CPU-$before)/($interval/1000.0)/$logical)*100.0)
  $name=[string]$p.ProcessName
  $path=$null
  try {$path=$p.Path}catch{}
  $isProtected=($p.Id -le 4) -or @('System','Registry','smss','csrss','wininit','winlogon','services','lsass','svchost','dwm','fontdrvhost','Memory Compression') -contains $name
  if($path -and ($path -like '*\Windows\System32\*' -or $path -like '*\Windows\SysWOW64\*')) {$isProtected=$true}
  $reasons=@()
  if($cpu -ge 25){$reasons+='High measured CPU during sample'}
  if($p.WorkingSet64 -ge 1073741824){$reasons+='Working set is at least 1 GB'}
  [pscustomobject]@{
    pid=[uint32]$p.Id
    name=$name
    cpuPercent=[math]::Round($cpu,2)
    workingSetBytes=[uint64]$p.WorkingSet64
    privateMemoryBytes=[uint64]$p.PrivateMemorySize64
    threadCount=[uint32]$p.Threads.Count
    protected=[bool]$isProtected
    reasons=@($reasons)
  }
} | Sort-Object @{Expression='cpuPercent';Descending=$true},@{Expression='workingSetBytes';Descending=$true} | Select-Object -First 30)
[pscustomobject]@{
  processes=$items
  cpuAttentionPercent=25.0
  memoryAttentionBytes=[uint64]1073741824
  sampleIntervalMs=[uint64]$interval
  leakNoticeEn='This is a measured short sample. A memory leak is not claimed without repeated historical growth evidence.'
  leakNoticeAr='هذه عينة قصيرة مقاسة، ولا يتم الادعاء بوجود تسريب ذاكرة دون سجل نمو متكرر.'
  measuredAt=(Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 6 -Compress
"#
}

fn read_process(pid: u32) -> Result<ProcessItem, String> {
    let script = format!(
        r#"
$ErrorActionPreference='Stop'
$p=Get-Process -Id {pid} -ErrorAction Stop
$meta=Get-CimInstance Win32_Process -Filter "ProcessId={pid}" | Select-Object -First 1
$path=$null
try {{$path=$p.Path}}catch{{}}
$priority='Unknown'
try {{$priority=[string]$p.PriorityClass}}catch{{}}
$name=[string]$p.ProcessName
$isProtected=($p.Id -le 4) -or @('System','Registry','smss','csrss','wininit','winlogon','services','lsass','svchost','dwm','fontdrvhost','Memory Compression') -contains $name
if($path -and ($path -like '*\Windows\System32\*' -or $path -like '*\Windows\SysWOW64\*')) {{$isProtected=$true}}
[pscustomobject]@{{
 pid=[uint32]$p.Id
 parentPid=if($null -eq $meta){{$null}}else{{[uint32]$meta.ParentProcessId}}
 name=$name
 executablePath=$path
 commandLine=if($null -eq $meta){{$null}}else{{$meta.CommandLine}}
 workingSetBytes=[uint64]$p.WorkingSet64
 privateMemoryBytes=[uint64]$p.PrivateMemorySize64
 cpuSeconds=if($null -eq $p.CPU){{0}}else{{[double]$p.CPU}}
 threadCount=[uint32]$p.Threads.Count
 handleCount=[uint32]$p.HandleCount
 priority=$priority
 pathVerified=[bool]($path -and (Test-Path -LiteralPath $path))
 protected=[bool]$isProtected
}} | ConvertTo-Json -Compress
"#,
    );
    run_powershell_json(&script)
}

fn normalize_priority(value: &str) -> Option<&'static str> {
    match value.to_ascii_lowercase().as_str() {
        "idle" => Some("Idle"),
        "belownormal" | "below_normal" => Some("BelowNormal"),
        "normal" => Some("Normal"),
        "abovenormal" | "above_normal" => Some("AboveNormal"),
        "high" => Some("High"),
        _ => None,
    }
}

fn priority_changes_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("priority-changes.json"))
}

fn active_priority_changes(app: &AppHandle) -> Result<Vec<PriorityChange>, String> {
    let changes: Vec<PriorityChange> = load_json(&priority_changes_path(app)?)?;
    Ok(changes
        .into_iter()
        .filter(|item| item.restored_at.is_none())
        .collect())
}

fn save_priority_change(app: &AppHandle, change: PriorityChange) -> Result<(), String> {
    let path = priority_changes_path(app)?;
    let mut changes: Vec<PriorityChange> = load_json(&path)?;
    changes.push(change);
    save_json(&path, &changes)
}

fn update_priority_change(app: &AppHandle, updated: &PriorityChange) -> Result<(), String> {
    let path = priority_changes_path(app)?;
    let mut changes: Vec<PriorityChange> = load_json(&path)?;
    let item = changes
        .iter_mut()
        .find(|item| item.id == updated.id)
        .ok_or_else(|| "priority_change_not_found".to_string())?;
    *item = updated.clone();
    save_json(&path, &changes)
}

fn set_process_priority(pid: u32, priority: &str) -> Result<(), String> {
    let script = format!(
        "$ErrorActionPreference='Stop';$p=Get-Process -Id {pid} -ErrorAction Stop;$p.PriorityClass='{priority}'"
    );
    run_powershell(&script).map(|_| ())
}

fn power_snapshot() -> Result<PowerPlanSnapshot, String> {
    run_powershell_json(
        r#"
$ErrorActionPreference='Stop'
$activeText=(powercfg /GETACTIVESCHEME) -join "`n"
$active=[regex]::Match($activeText,'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}').Value.ToLower()
$plans=@(powercfg /L | ForEach-Object {
  $match=[regex]::Match($_,'([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+\((.+?)\)')
  if($match.Success){
    $guid=$match.Groups[1].Value.ToLower()
    [pscustomobject]@{guid=$guid;name=$match.Groups[2].Value;active=[bool]($guid -eq $active)}
  }
})
[pscustomobject]@{activeGuid=$active;plans=$plans} | ConvertTo-Json -Depth 5 -Compress
"#,
    )
}

fn valid_guid(value: &str) -> bool {
    value.len() == 36
        && value.chars().enumerate().all(|(index, ch)| match index {
            8 | 13 | 18 | 23 => ch == '-',
            _ => ch.is_ascii_hexdigit(),
        })
}

fn activate_power_plan(guid: &str) -> Result<(), String> {
    if !valid_guid(guid) {
        return Err("invalid_power_scheme_guid".into());
    }
    let output = Command::new("powercfg.exe")
        .args(["/S", guid])
        .output()
        .map_err(|error| format!("powercfg_launch_failed:{error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn power_changes_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("power-changes.json"))
}

fn active_power_changes(app: &AppHandle) -> Result<Vec<PowerPlanChange>, String> {
    let changes: Vec<PowerPlanChange> = load_json(&power_changes_path(app)?)?;
    Ok(changes
        .into_iter()
        .filter(|item| item.restored_at.is_none())
        .collect())
}

fn save_power_change(app: &AppHandle, change: PowerPlanChange) -> Result<(), String> {
    let path = power_changes_path(app)?;
    let mut changes: Vec<PowerPlanChange> = load_json(&path)?;
    changes.push(change);
    save_json(&path, &changes)
}

fn update_power_change(app: &AppHandle, updated: &PowerPlanChange) -> Result<(), String> {
    let path = power_changes_path(app)?;
    let mut changes: Vec<PowerPlanChange> = load_json(&path)?;
    let item = changes
        .iter_mut()
        .find(|item| item.id == updated.id)
        .ok_or_else(|| "power_change_not_found".to_string())?;
    *item = updated.clone();
    save_json(&path, &changes)
}

fn profiles_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("profiles.json"))
}

fn active_profile_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("active-profile.json"))
}

fn read_active_profile(app: &AppHandle) -> Result<Option<String>, String> {
    load_json(&active_profile_path(app)?)
}

fn write_active_profile(app: &AppHandle, id: Option<String>) -> Result<(), String> {
    save_json(&active_profile_path(app)?, &id)
}

fn benchmark(app: &AppHandle) -> Result<BenchmarkReport, String> {
    let measured_at = Utc::now().to_rfc3339();
    let cpu_block = vec![0x5Au8; 4096];
    let mut previous = [0u8; 32];
    let iterations = 20_000u64;
    let cpu_start = Instant::now();
    for index in 0..iterations {
        let mut hasher = Sha256::new();
        hasher.update(&cpu_block);
        hasher.update(previous);
        hasher.update(index.to_le_bytes());
        previous.copy_from_slice(&hasher.finalize());
    }
    let cpu_seconds = cpu_start.elapsed().as_secs_f64().max(0.000_001);
    let cpu_hashes_per_sec = iterations as f64 / cpu_seconds;

    let root = app_root(app)?;
    let benchmark_dir = root.join("benchmarks");
    fs::create_dir_all(&benchmark_dir)
        .map_err(|error| format!("benchmark_directory_failed:{error}"))?;
    let temporary_path = benchmark_dir.join(format!("temporary-{}.bin", Uuid::new_v4()));
    let disk_test_bytes = 8 * 1024 * 1024u64;
    let payload = vec![0xA5u8; disk_test_bytes as usize];

    let write_start = Instant::now();
    let mut file = File::create(&temporary_path)
        .map_err(|error| format!("benchmark_create_failed:{error}"))?;
    file.write_all(&payload)
        .map_err(|error| format!("benchmark_write_failed:{error}"))?;
    file.sync_all()
        .map_err(|error| format!("benchmark_sync_failed:{error}"))?;
    drop(file);
    let write_seconds = write_start.elapsed().as_secs_f64().max(0.000_001);

    let read_start = Instant::now();
    let mut read_file =
        File::open(&temporary_path).map_err(|error| format!("benchmark_open_failed:{error}"))?;
    let mut read_payload = Vec::with_capacity(disk_test_bytes as usize);
    read_file
        .read_to_end(&mut read_payload)
        .map_err(|error| format!("benchmark_read_failed:{error}"))?;
    let read_seconds = read_start.elapsed().as_secs_f64().max(0.000_001);
    if read_payload.len() != payload.len() {
        return Err("benchmark_read_size_mismatch".into());
    }

    let temporary_file_removed = fs::remove_file(&temporary_path).is_ok();
    let report_path = benchmark_dir.join(format!(
        "benchmark-{}.json",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    let mut report = BenchmarkReport {
        cpu_hash_iterations: iterations,
        cpu_hashes_per_sec,
        disk_test_bytes,
        disk_write_mbps: (disk_test_bytes as f64 / 1_048_576.0) / write_seconds,
        disk_read_mbps: (disk_test_bytes as f64 / 1_048_576.0) / read_seconds,
        temporary_file_removed,
        report_path: report_path.to_string_lossy().into_owned(),
        measured_at,
        notice_en: "This is a short local comparison sample, not a universal hardware score or vendor claim.".into(),
        notice_ar: "هذه عينة مقارنة محلية قصيرة وليست درجة عالمية للعتاد أو ادعاءً من الشركة المصنعة.".into(),
    };
    save_json(&report_path, &report)?;
    report.report_path = report_path.to_string_lossy().into_owned();
    Ok(report)
}

fn read_command<T: DeserializeOwned>(
    capability_id: &str,
    handler_id: &str,
    script: &str,
    summary_en: &str,
    summary_ar: &str,
) -> OperationResult<T> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match run_powershell_json(script) {
        Ok(data) => success(
            operation_id,
            capability_id,
            handler_id,
            started_at,
            timer,
            data,
            summary_en.into(),
            summary_ar.into(),
            Vec::new(),
        ),
        Err(error) => failure(
            operation_id,
            capability_id,
            handler_id,
            started_at,
            timer,
            "windows_measurement_failed",
            error,
        ),
    }
}

#[tauri::command]
pub fn m06_cpu_monitor() -> OperationResult<CpuSnapshot> {
    read_command(
        "m06_s01",
        "m06.cpu.monitor",
        cpu_script(),
        "Measured CPU utilization, clock and per-core activity from Windows performance data.",
        "تم قياس استخدام المعالج والسرعة ونشاط الأنوية من بيانات أداء ويندوز.",
    )
}

#[tauri::command]
pub fn m06_memory_monitor() -> OperationResult<MemorySnapshot> {
    read_command(
        "m06_s02",
        "m06.memory.monitor",
        memory_script(),
        "Measured physical, committed and cached memory from Windows.",
        "تم قياس الذاكرة الفعلية والمحجوزة والمخبأة من ويندوز.",
    )
}

#[tauri::command]
pub fn m06_disk_activity() -> OperationResult<DiskActivitySnapshot> {
    read_command(
        "m06_s03",
        "m06.disk.activity",
        disk_script(),
        "Measured physical-disk read, write, active-time and queue activity.",
        "تم قياس القراءة والكتابة ووقت النشاط وطابور الأقراص الفعلية.",
    )
}

#[tauri::command]
pub fn m06_network_activity() -> OperationResult<NetworkActivitySnapshot> {
    read_command(
        "m06_s04",
        "m06.network.activity",
        network_script(),
        "Measured network-adapter throughput and active process connection counts.",
        "تم قياس سرعة محولات الشبكة وعدد الاتصالات النشطة للبرامج.",
    )
}

#[tauri::command]
pub fn m06_process_explorer(limit: Option<usize>) -> OperationResult<ProcessExplorerSnapshot> {
    let limit = limit.unwrap_or(200).clamp(20, 500);
    read_command(
        "m06_s05",
        "m06.process.explorer",
        &process_script(limit),
        "Read the live Windows process inventory with parent, path and resource evidence.",
        "تمت قراءة العمليات النشطة مع العملية الأصلية والمسار وأدلة استهلاك الموارد.",
    )
}

#[tauri::command]
pub fn m06_heavy_processes() -> OperationResult<HeavyProcessReport> {
    read_command(
        "m06_s06",
        "m06.process.heavy",
        heavy_script(),
        "Measured a bounded CPU and memory sample for the highest-consuming processes.",
        "تم قياس عينة محدودة للمعالج والذاكرة لأكثر البرامج استهلاكًا.",
    )
}

#[tauri::command]
pub fn m06_priority_manage(
    app: AppHandle,
    request: PriorityRequest,
) -> OperationResult<PriorityResult> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let outcome = (|| -> Result<PriorityResult, String> {
        match request {
            PriorityRequest::List => Ok(PriorityResult {
                active_changes: active_priority_changes(&app)?,
                process: None,
                message: "Priority change history loaded.".into(),
            }),
            PriorityRequest::Set {
                pid,
                priority,
                confirmation,
            } => {
                if confirmation != format!("PRIORITY {pid}") {
                    return Err("typed_confirmation_mismatch".into());
                }
                let target = normalize_priority(&priority)
                    .ok_or_else(|| "unsupported_priority_or_realtime_blocked".to_string())?;
                let process = read_process(pid)?;
                if process.protected
                    || is_protected_process(
                        &process.name,
                        process.executable_path.as_deref(),
                        process.pid,
                    )
                {
                    return Err("protected_process_priority_change_blocked".into());
                }
                let previous = process.priority.clone();
                set_process_priority(pid, target)?;
                let change = PriorityChange {
                    id: Uuid::new_v4().to_string(),
                    pid,
                    process_name: process.name.clone(),
                    previous_priority: previous,
                    new_priority: target.into(),
                    created_at: Utc::now().to_rfc3339(),
                    restored_at: None,
                };
                save_priority_change(&app, change)?;
                Ok(PriorityResult {
                    active_changes: active_priority_changes(&app)?,
                    process: Some(read_process(pid)?),
                    message: "Process priority changed and journaled for restoration.".into(),
                })
            }
            PriorityRequest::Restore {
                change_id,
                confirmation,
            } => {
                if confirmation != "RESTORE PRIORITY" {
                    return Err("typed_confirmation_mismatch".into());
                }
                let path = priority_changes_path(&app)?;
                let changes: Vec<PriorityChange> = load_json(&path)?;
                let mut change = changes
                    .into_iter()
                    .find(|item| item.id == change_id && item.restored_at.is_none())
                    .ok_or_else(|| "priority_change_not_found".to_string())?;
                let process = read_process(change.pid)?;
                if process.name != change.process_name {
                    return Err("pid_reused_by_different_process".into());
                }
                set_process_priority(change.pid, &change.previous_priority)?;
                change.restored_at = Some(Utc::now().to_rfc3339());
                update_priority_change(&app, &change)?;
                Ok(PriorityResult {
                    active_changes: active_priority_changes(&app)?,
                    process: Some(read_process(change.pid)?),
                    message: "Previous process priority restored.".into(),
                })
            }
        }
    })();
    match outcome {
        Ok(data) => success(
            operation_id,
            "m06_s07",
            "m06.priority.manage",
            started_at,
            timer,
            data,
            "Process priority operation completed with safety checks.".into(),
            "اكتملت عملية أولوية البرنامج مع تطبيق فحوص الأمان.".into(),
            Vec::new(),
        ),
        Err(error) => failure(
            operation_id,
            "m06_s07",
            "m06.priority.manage",
            started_at,
            timer,
            "priority_operation_failed",
            error,
        ),
    }
}

#[tauri::command]
pub fn m06_power_plans_manage(
    app: AppHandle,
    request: PowerPlanRequest,
) -> OperationResult<PowerPlanResult> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let outcome = (|| -> Result<PowerPlanResult, String> {
        match request {
            PowerPlanRequest::List => Ok(PowerPlanResult {
                snapshot: power_snapshot()?,
                active_changes: active_power_changes(&app)?,
                message: "Power plans loaded.".into(),
            }),
            PowerPlanRequest::Set { guid, confirmation } => {
                if confirmation != "CHANGE POWER PLAN" {
                    return Err("typed_confirmation_mismatch".into());
                }
                let before = power_snapshot()?;
                if !before.plans.iter().any(|item| item.guid == guid) {
                    return Err("power_scheme_not_installed".into());
                }
                activate_power_plan(&guid)?;
                save_power_change(
                    &app,
                    PowerPlanChange {
                        id: Uuid::new_v4().to_string(),
                        previous_guid: before.active_guid,
                        selected_guid: guid,
                        created_at: Utc::now().to_rfc3339(),
                        restored_at: None,
                    },
                )?;
                Ok(PowerPlanResult {
                    snapshot: power_snapshot()?,
                    active_changes: active_power_changes(&app)?,
                    message: "Power plan changed and the previous plan was journaled.".into(),
                })
            }
            PowerPlanRequest::Restore {
                change_id,
                confirmation,
            } => {
                if confirmation != "RESTORE POWER PLAN" {
                    return Err("typed_confirmation_mismatch".into());
                }
                let changes: Vec<PowerPlanChange> = load_json(&power_changes_path(&app)?)?;
                let mut change = changes
                    .into_iter()
                    .find(|item| item.id == change_id && item.restored_at.is_none())
                    .ok_or_else(|| "power_change_not_found".to_string())?;
                activate_power_plan(&change.previous_guid)?;
                change.restored_at = Some(Utc::now().to_rfc3339());
                update_power_change(&app, &change)?;
                Ok(PowerPlanResult {
                    snapshot: power_snapshot()?,
                    active_changes: active_power_changes(&app)?,
                    message: "Previous power plan restored.".into(),
                })
            }
        }
    })();
    match outcome {
        Ok(data) => success(
            operation_id,
            "m06_s08",
            "m06.power.manage",
            started_at,
            timer,
            data,
            "Power-plan operation completed and journaled.".into(),
            "اكتملت عملية خطة الطاقة وتم تسجيلها للاستعادة.".into(),
            Vec::new(),
        ),
        Err(error) => failure(
            operation_id,
            "m06_s08",
            "m06.power.manage",
            started_at,
            timer,
            "power_plan_operation_failed",
            error,
        ),
    }
}

#[tauri::command]
pub fn m06_profiles_manage(
    app: AppHandle,
    request: ProfileRequest,
) -> OperationResult<ProfileResult> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let outcome = (|| -> Result<ProfileResult, String> {
        let path = profiles_path(&app)?;
        let mut profiles: Vec<PerformanceProfile> = load_json(&path)?;
        let mut active = read_active_profile(&app)?;
        let message = match request {
            ProfileRequest::List => "Performance profiles loaded.".to_string(),
            ProfileRequest::Create {
                name,
                power_scheme_guid,
                cpu_attention_percent,
                memory_attention_percent,
            } => {
                let name = name.trim();
                if !(2..=60).contains(&name.chars().count()) {
                    return Err("profile_name_length_invalid".into());
                }
                let power = power_snapshot()?;
                if !power
                    .plans
                    .iter()
                    .any(|item| item.guid == power_scheme_guid)
                {
                    return Err("power_scheme_not_installed".into());
                }
                if !(5.0..=100.0).contains(&cpu_attention_percent)
                    || !(10.0..=100.0).contains(&memory_attention_percent)
                {
                    return Err("profile_threshold_out_of_range".into());
                }
                profiles.push(PerformanceProfile {
                    id: Uuid::new_v4().to_string(),
                    name: name.into(),
                    power_scheme_guid,
                    cpu_attention_percent,
                    memory_attention_percent,
                    created_at: Utc::now().to_rfc3339(),
                    applied_at: None,
                });
                save_json(&path, &profiles)?;
                "Performance profile created.".into()
            }
            ProfileRequest::Apply {
                profile_id,
                confirmation,
            } => {
                if confirmation != "APPLY PROFILE" {
                    return Err("typed_confirmation_mismatch".into());
                }
                let profile = profiles
                    .iter_mut()
                    .find(|item| item.id == profile_id)
                    .ok_or_else(|| "profile_not_found".to_string())?;
                activate_power_plan(&profile.power_scheme_guid)?;
                profile.applied_at = Some(Utc::now().to_rfc3339());
                active = Some(profile.id.clone());
                save_json(&path, &profiles)?;
                write_active_profile(&app, active.clone())?;
                "Performance profile applied.".into()
            }
            ProfileRequest::Delete {
                profile_id,
                confirmation,
            } => {
                if confirmation != "DELETE PROFILE" {
                    return Err("typed_confirmation_mismatch".into());
                }
                profiles.retain(|item| item.id != profile_id);
                if active.as_deref() == Some(profile_id.as_str()) {
                    active = None;
                    write_active_profile(&app, None)?;
                }
                save_json(&path, &profiles)?;
                "Performance profile deleted.".into()
            }
        };
        Ok(ProfileResult {
            profiles,
            active_profile_id: active,
            power: power_snapshot()?,
            message,
        })
    })();
    match outcome {
        Ok(data) => success(
            operation_id,
            "m06_s09",
            "m06.profiles.manage",
            started_at,
            timer,
            data,
            "Performance profile operation completed.".into(),
            "اكتملت عملية بروفايل الأداء.".into(),
            Vec::new(),
        ),
        Err(error) => failure(
            operation_id,
            "m06_s09",
            "m06.profiles.manage",
            started_at,
            timer,
            "performance_profile_operation_failed",
            error,
        ),
    }
}

#[tauri::command]
pub fn m06_benchmark_report(app: AppHandle) -> OperationResult<BenchmarkReport> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match benchmark(&app) {
        Ok(data) => success(
            operation_id,
            "m06_s10",
            "m06.benchmark.report",
            started_at,
            timer,
            data,
            "Completed a bounded CPU hash and temporary-disk throughput sample.".into(),
            "اكتملت عينة محدودة لبصمات المعالج وسرعة ملف مؤقت على القرص.".into(),
            Vec::new(),
        ),
        Err(error) => failure(
            operation_id,
            "m06_s10",
            "m06.benchmark.report",
            started_at,
            timer,
            "benchmark_failed",
            error,
        ),
    }
}
