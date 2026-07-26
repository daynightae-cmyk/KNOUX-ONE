use crate::diagnostics::{
    contracts::{ServiceDiagnosticsRequest, ServiceDiagnosticsResult, ServiceFailure},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawFailure { service_name: Option<String>, display_name: Option<String>, start_mode: Option<String>, state: Option<String>, process_id: Option<u32>, event_id: Option<u32>, time_created: Option<String>, message: Option<String> }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEnvelope { failures: Vec<RawFailure>, automatic_not_running: Vec<RawFailure>, warnings: Vec<String> }

fn map(item: RawFailure) -> ServiceFailure { ServiceFailure { service_name: item.service_name.filter(|v| !v.is_empty()), display_name: item.display_name.filter(|v| !v.is_empty()), start_mode: item.start_mode.filter(|v| !v.is_empty()), state: item.state.filter(|v| !v.is_empty()), process_id: item.process_id, event_id: item.event_id, time_created: item.time_created.filter(|v| !v.is_empty()), message: item.message.unwrap_or_default() } }

pub fn diagnose(request: &ServiceDiagnosticsRequest) -> Result<ServiceDiagnosticsResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 90);
    let script = format!(r#"
$start=(Get-Date).AddHours(-{hours});$failures=@();$automatic=@();$warnings=@()
try {{
  Get-WinEvent -FilterHashtable @{{LogName='System';ProviderName='Service Control Manager';StartTime=$start;Id=7000,7001,7009,7011,7022,7023,7024,7031,7034}} -ErrorAction Stop | ForEach-Object {{
    $message=if($_.Message){{[string]$_.Message}}else{{''}};$service=$null
    if($message -match '(?im)service\s+([^\r\n]+?)\s+(failed|terminated|hung|did not)'){{$service=$matches[1].Trim()}}
    $failures += [pscustomobject]@{{serviceName=$service;displayName=$null;startMode=$null;state=$null;processId=$null;eventId=[uint32]$_.Id;timeCreated=$_.TimeCreated.ToUniversalTime().ToString('o');message=$message}}
  }}
}} catch {{$warnings += "Service events: $($_.Exception.Message)"}}
try {{
  Get-CimInstance Win32_Service -ErrorAction Stop | Where-Object {{$_.StartMode -eq 'Auto' -and $_.State -ne 'Running' -and -not $_.DelayedAutoStart}} | ForEach-Object {{
    $automatic += [pscustomobject]@{{serviceName=[string]$_.Name;displayName=[string]$_.DisplayName;startMode=[string]$_.StartMode;state=[string]$_.State;processId=[uint32]$_.ProcessId;eventId=$null;timeCreated=$null;message='Automatic service is not running at audit time.'}}
  }}
}} catch {{$warnings += "Service inventory: $($_.Exception.Message)"}}
[pscustomobject]@{{failures=@($failures);automaticNotRunning=@($automatic);warnings=@($warnings)}} | ConvertTo-Json -Depth 6 -Compress
"#);
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    Ok(ServiceDiagnosticsResult { failures: raw.failures.into_iter().map(map).collect(), automatic_not_running: raw.automatic_not_running.into_iter().map(map).collect(), warnings: raw.warnings })
}
