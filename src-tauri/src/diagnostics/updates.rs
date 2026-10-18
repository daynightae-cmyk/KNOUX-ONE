use crate::diagnostics::{
    contracts::{InstalledUpdate, UpdateDiagnosticsRequest, UpdateDiagnosticsResult, UpdateEvidence},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEvent { time_created: Option<String>, event_id: Option<u32>, level: Option<String>, kb: Option<String>, error_code: Option<String>, message: Option<String> }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawUpdate { hotfix_id: Option<String>, description: Option<String>, installed_on: Option<String> }
#[derive(Debug, Deserialize)]
struct RawEnvelope { events: Vec<RawEvent>, installed_updates: Vec<RawUpdate>, warnings: Vec<String> }

pub fn analyze(request: &UpdateDiagnosticsRequest) -> Result<UpdateDiagnosticsResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 365);
    let limit = request.limit.clamp(1, 2_000);
    let script = format!(r#"
$start=(Get-Date).AddHours(-{hours});$events=@();$updates=@();$warnings=@()
try {{
  Get-WinEvent -FilterHashtable @{{LogName='System';ProviderName='Microsoft-Windows-WindowsUpdateClient';StartTime=$start;Id=19,20,25,31,34,35}} -ErrorAction Stop | Select-Object -First {limit} | ForEach-Object {{
    $message=if($_.Message){{[string]$_.Message}}else{{''}};$kb=$null;$code=$null
    if($message -match '(?i)KB\d+'){{$kb=$matches[0]}}
    if($message -match '(?i)0x[0-9a-f]{{8}}'){{$code=$matches[0]}}
    $events += [pscustomobject]@{{timeCreated=$_.TimeCreated.ToUniversalTime().ToString('o');eventId=[uint32]$_.Id;level=[string]$_.LevelDisplayName;kb=$kb;errorCode=$code;message=$message}}
  }}
}} catch {{$warnings += "Windows Update events: $($_.Exception.Message)"}}
try {{ Get-HotFix -ErrorAction Stop | Sort-Object InstalledOn -Descending | Select-Object -First 100 | ForEach-Object {{$updates += [pscustomobject]@{{hotfixId=[string]$_.HotFixID;description=[string]$_.Description;installedOn=if($_.InstalledOn){{$_.InstalledOn.ToString('yyyy-MM-dd')}}else{{$null}}}} }} }} catch {{$warnings += "Installed updates: $($_.Exception.Message)"}}
[pscustomobject]@{{events=@($events);installedUpdates=@($updates);warnings=@($warnings)}} | ConvertTo-Json -Depth 6 -Compress
"#);
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    let events = raw.events.into_iter().map(|item| UpdateEvidence { time_created: item.time_created.unwrap_or_default(), event_id: item.event_id.unwrap_or_default(), level: item.level.unwrap_or_else(|| "Unknown".into()), kb: item.kb.filter(|v| !v.is_empty()), error_code: item.error_code.filter(|v| !v.is_empty()), message: item.message.unwrap_or_default() }).collect::<Vec<_>>();
    let failure_count = events.iter().filter(|item| matches!(item.event_id, 20 | 25 | 31 | 34 | 35)).count();
    Ok(UpdateDiagnosticsResult { events, installed_updates: raw.installed_updates.into_iter().map(|item| InstalledUpdate { hotfix_id: item.hotfix_id.unwrap_or_default(), description: item.description.unwrap_or_default(), installed_on: item.installed_on.filter(|v| !v.is_empty()) }).collect(), failure_count, warnings: raw.warnings })
}
