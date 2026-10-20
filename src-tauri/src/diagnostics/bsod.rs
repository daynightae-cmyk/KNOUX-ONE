use crate::diagnostics::{
    contracts::{BsodTriageRequest, BsodTriageResult, BugcheckEvidence, MinidumpEvidence},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawBugcheck {
    time_created: Option<String>,
    code: Option<String>,
    parameters: Option<Vec<String>>,
    dump_path: Option<String>,
    message: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawDump {
    path: String,
    file_name: String,
    size_bytes: u64,
    modified_at: String,
    readable: bool,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEnvelope {
    bugchecks: Vec<RawBugcheck>,
    minidumps: Vec<RawDump>,
    #[serde(
        default,
        deserialize_with = "crate::diagnostics::json::optional_string"
    )]
    debugger_path: Option<String>,
    warnings: Vec<String>,
}

/// Discovers a Windows debugger for the triage result.
///
/// Windows PowerShell 5.1 serialises `Select-Object -First 1 -ExpandProperty
/// Source` over an empty pipeline as `{}` instead of `null`, and a map cannot
/// be read as a path, so the whole triage failed with
/// `invalid type: map, expected a string`. Collecting the sources into an
/// array first keeps the value a string or `$null` in every interpreter.
const DEBUGGER_DISCOVERY: &str = r#"
$debugger=$null
$debuggerSources=@(Get-Command windbg.exe,kd.exe,cdb.exe -ErrorAction SilentlyContinue | ForEach-Object { [string]$_.Source } | Where-Object { $_ -ne '' })
if($debuggerSources.Count -gt 0){$debugger=[string]$debuggerSources[0]}
"#;

pub fn triage(request: &BsodTriageRequest) -> Result<BsodTriageResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 365);
    let include = if request.include_minidump_inventory {
        "$true"
    } else {
        "$false"
    };
    let script = format!(
        r#"
$start=(Get-Date).AddHours(-{hours}); $warnings=@(); $bugchecks=@(); $dumps=@()
try {{
  $events=Get-WinEvent -FilterHashtable @{{LogName='System';StartTime=$start;Id=1001}} -ErrorAction SilentlyContinue | Where-Object {{$_.ProviderName -match 'BugCheck|WER-SystemErrorReporting'}}
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
{debugger_discovery}
[pscustomobject]@{{bugchecks=@($bugchecks);minidumps=@($dumps);debuggerPath=$debugger;warnings=@($warnings)}} | ConvertTo-Json -Depth 7 -Compress
"#,
        debugger_discovery = DEBUGGER_DISCOVERY
    );
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

#[cfg(test)]
mod tests {
    use super::{RawEnvelope, DEBUGGER_DISCOVERY};

    #[test]
    fn reads_an_empty_object_for_the_debugger_path() {
        let raw: RawEnvelope = serde_json::from_str(
            r#"{"bugchecks":[],"minidumps":[],"debuggerPath":{},"warnings":[]}"#,
        )
        .expect("an empty object must not fail the triage");

        assert!(raw.debugger_path.is_none());
    }

    #[test]
    fn keeps_a_reported_debugger_path() {
        let raw: RawEnvelope = serde_json::from_str(
            r#"{"bugchecks":[],"minidumps":[],"debuggerPath":"C:\\tools\\windbg.exe","warnings":[]}"#,
        )
        .expect("a reported path must parse");

        assert_eq!(raw.debugger_path.as_deref(), Some("C:\\tools\\windbg.exe"));
    }

    #[test]
    fn the_discovery_script_does_not_use_the_empty_object_pattern() {
        assert!(
            !DEBUGGER_DISCOVERY.contains("ExpandProperty"),
            "Select-Object -First 1 -ExpandProperty writes an empty object when nothing is found"
        );
    }

    /// The discovery script runs on the Windows runner, so the shape it writes
    /// is checked against the real interpreter rather than a recorded copy.
    #[cfg(target_os = "windows")]
    #[test]
    fn the_discovery_script_never_writes_an_object_for_the_debugger_path() {
        let script = format!(
            "{discovery}\n[pscustomobject]@{{debuggerPath=$debugger}} | ConvertTo-Json -Compress",
            discovery = DEBUGGER_DISCOVERY
        );
        let output = crate::diagnostics::powershell::run(&script)
            .expect("the debugger discovery script must run");
        let value: serde_json::Value =
            serde_json::from_str(&output.stdout).expect("the discovery script must write JSON");
        let path = value
            .get("debuggerPath")
            .expect("the discovery script must write debuggerPath");

        assert!(
            path.is_string() || path.is_null(),
            "debuggerPath must be a string or null, got {path}"
        );
    }
}
