use crate::diagnostics::{
    contracts::{ApplicationCrash, CrashCorrelationRequest, CrashCorrelationResult},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawCrash { application: Option<String>, faulting_module: Option<String>, exception_code: Option<String>, event_id: Option<u32>, provider: Option<String>, time_created: Option<String>, message: Option<String> }
#[derive(Debug, Deserialize)]
struct RawEnvelope { crashes: Vec<RawCrash>, warnings: Vec<String> }

pub fn correlate(request: &CrashCorrelationRequest) -> Result<CrashCorrelationResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 90);
    let limit = request.limit.clamp(1, 2_000);
    let script = format!(r#"
$start=(Get-Date).AddHours(-{hours})
$warnings=@(); $crashes=@()
try {{
  $items = Get-WinEvent -FilterHashtable @{{LogName='Application'; StartTime=$start; Id=1000,1001,1002,1026}} -ErrorAction Stop | Select-Object -First {limit}
  foreach($event in $items) {{
    $message = if($event.Message){{[string]$event.Message}}else{{''}}
    $app = $null; $module = $null; $exception = $null
    if($message -match '(?im)Faulting application name:\s*([^,\r\n]+)'){{$app=$matches[1].Trim()}}
    elseif($message -match '(?im)Application:\s*([^\r\n]+)'){{$app=$matches[1].Trim()}}
    elseif($message -match '(?im)Faulting package full name:\s*([^\r\n]+)'){{$app=$matches[1].Trim()}}
    if($message -match '(?im)Faulting module name:\s*([^,\r\n]+)'){{$module=$matches[1].Trim()}}
    if($message -match '(?im)Exception code:\s*([^\r\n]+)'){{$exception=$matches[1].Trim()}}
    if(-not $app){{$app=[string]$event.ProviderName}}
    $crashes += [pscustomobject]@{{application=$app;faultingModule=$module;exceptionCode=$exception;eventId=[uint32]$event.Id;provider=[string]$event.ProviderName;timeCreated=$event.TimeCreated.ToUniversalTime().ToString('o');message=$message}}
  }}
}} catch {{$warnings += $_.Exception.Message}}
[pscustomobject]@{{crashes=@($crashes);warnings=@($warnings)}} | ConvertTo-Json -Depth 6 -Compress
"#);
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    let mut counts = HashMap::<String, u32>::new();
    for item in &raw.crashes { *counts.entry(item.application.clone().unwrap_or_else(|| "Unknown".into())).or_default() += 1; }
    let crashes = raw.crashes.into_iter().map(|item| {
        let application = item.application.unwrap_or_else(|| "Unknown".into());
        ApplicationCrash { occurrence_count: *counts.get(&application).unwrap_or(&1), application, faulting_module: item.faulting_module.filter(|v| !v.is_empty()), exception_code: item.exception_code.filter(|v| !v.is_empty()), event_id: item.event_id.unwrap_or_default(), provider: item.provider.unwrap_or_else(|| "Unknown".into()), time_created: item.time_created.unwrap_or_default(), message: item.message.unwrap_or_default() }
    }).collect::<Vec<_>>();
    let mut recurring_applications = counts.into_iter().filter(|(_, count)| *count > 1).map(|(name, count)| format!("{name} ({count})")).collect::<Vec<_>>();
    recurring_applications.sort();
    Ok(CrashCorrelationResult { total_events: crashes.len(), crashes, recurring_applications, warnings: raw.warnings })
}
