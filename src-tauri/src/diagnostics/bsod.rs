use crate::diagnostics::{
    contracts::{BsodTriageRequest, BsodTriageResult, BugcheckEvidence, MinidumpEvidence},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawBugcheck { time_created: Option<String>, code: Option<String>, parameters: Option<Vec<String>>, dump_path: Option<String>, message: Option<String> }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawDump { path: String, file_name: String, size_bytes: u64, modified_at: String, readable: bool }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEnvelope { bugchecks: Vec<RawBugcheck>, minidumps: Vec<RawDump>, debugger_path: Option<String>, warnings: Vec<String> }

pub fn triage(request: &BsodTriageRequest) -> Result<BsodTriageResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 365);
    let include = if request.include_minidump_inventory { "$true" } else { "$false" };
    let script = format!(r#"
$start=(Get-Date).AddHours(-{hours}); $warnings=@(); $bugchecks=@(); $dumps=@()
try {{
  $events=Get-WinEvent -FilterHashtable @{{LogName='System';StartTime=$start;Id=1001}} -ErrorAction Stop | Where-Object {{$_.ProviderName -match 'BugCheck|WER-SystemErrorReporting'}}
  foreach($event in $events){{
    $message=if($event.Message){{[string]$event.Message}}else{{''}}; $code=$null; $dump=$null; $parameters=@()
    if($message -match '(?i)bugcheck was:\s*(0x[0-9a-f]+)'){{$code=$matches[1]}}
    if($message -match '(?i)([A-Z]:\\[^\r\n]+\.dmp)'){{$dump=$matches[1]}}
    foreach($match in [regex]::Matches($message,'0x[0-9a-fA-F]+')){{$parameters += $match.Value}}
    $bugchecks += [pscustomobject]@{{timeCreated=$event.TimeCreated.ToUniversalTime().ToString('o');code=$code;parameters=@($parameters | Select-Object -First 5);dumpPath=$dump;message=$message}}
  }}
}} catch {{$warnings += "BugCheck event query: $($_.Exception.Message)"}}
if({include}){{
  try {{ if(Test-Path "$env:WINDIR\Minidump"){{ Get-ChildItem "$env:WINDIR\Minidump\*.dmp" -File -ErrorAction Stop | Sort-Object LastWriteTime -Descending | Select-Object -First 100 | ForEach-Object {{ $readable=$false; try{{$stream=[IO.File]::Open($_.FullName,'Open','Read','ReadWrite');$stream.Dispose();$readable=$true}}catch{{}}; $dumps += [pscustomobject]@{{path=$_.FullName;fileName=$_.Name;sizeBytes=[uint64]$_.Length;modifiedAt=$_.LastWriteTimeUtc.ToString('o');readable=$readable}} }} }} }} catch {{$warnings += "Minidump inventory: $($_.Exception.Message)"}}
}}
$debugger=(Get-Command windbg.exe,kd.exe,cdb.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
[pscustomobject]@{{bugchecks=@($bugchecks);minidumps=@($dumps);debuggerPath=$debugger;warnings=@($warnings)}} | ConvertTo-Json -Depth 7 -Compress
"#);
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    Ok(BsodTriageResult {
        bugchecks: raw.bugchecks.into_iter().map(|item| BugcheckEvidence { time_created: item.time_created.unwrap_or_default(), code: item.code.filter(|v| !v.is_empty()), parameters: item.parameters.unwrap_or_default(), dump_path: item.dump_path.filter(|v| !v.is_empty()), message: item.message.unwrap_or_default() }).collect(),
        minidumps: raw.minidumps.into_iter().map(|item| MinidumpEvidence { path: item.path, file_name: item.file_name, size_bytes: item.size_bytes, modified_at: item.modified_at, readable: item.readable }).collect(),
        debugger_available: raw.debugger_path.is_some(),
        debugger_path: raw.debugger_path,
        analysis_level: "BugCheck event correlation and minidump inventory. Binary stack analysis requires WinDbg or CDB.".into(),
        warnings: raw.warnings,
    })
}
