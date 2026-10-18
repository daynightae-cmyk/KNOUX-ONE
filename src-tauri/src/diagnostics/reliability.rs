use crate::diagnostics::{
    contracts::{DayCount, ReliabilityRecord, ReliabilityRequest, ReliabilityResult},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawRecord { time_generated: Option<String>, source_name: Option<String>, product_name: Option<String>, event_identifier: Option<u32>, message: Option<String> }
#[derive(Debug, Deserialize)]
struct RawEnvelope { records: Vec<RawRecord>, warnings: Vec<String> }

pub fn timeline(request: &ReliabilityRequest) -> Result<ReliabilityResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 365);
    let limit = request.limit.clamp(1, 2_000);
    let script = format!(r#"
$start=(Get-Date).AddHours(-{hours});$records=@();$warnings=@()
try {{
  Get-CimInstance -Namespace root\cimv2 -ClassName Win32_ReliabilityRecords -ErrorAction Stop |
    Where-Object {{$_.TimeGenerated -ge $start}} | Sort-Object TimeGenerated -Descending | Select-Object -First {limit} | ForEach-Object {{
      $records += [pscustomobject]@{{timeGenerated=$_.TimeGenerated.ToUniversalTime().ToString('o');sourceName=[string]$_.SourceName;productName=[string]$_.ProductName;eventIdentifier=if($null-ne$_.EventIdentifier){{[uint32]$_.EventIdentifier}}else{{$null}};message=[string]$_.Message}}
    }}
}} catch {{$warnings += $_.Exception.Message}}
[pscustomobject]@{{records=@($records);warnings=@($warnings)}} | ConvertTo-Json -Depth 6 -Compress
"#);
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    let records = raw.records.into_iter().map(|item| ReliabilityRecord { time_generated: item.time_generated.unwrap_or_default(), source_name: item.source_name.unwrap_or_else(|| "Unknown".into()), product_name: item.product_name.filter(|v| !v.is_empty()), event_identifier: item.event_identifier, message: item.message.unwrap_or_default() }).collect::<Vec<_>>();
    let mut days = BTreeMap::<String, u32>::new();
    for record in &records { let day = record.time_generated.get(0..10).unwrap_or("unknown").to_string(); *days.entry(day).or_default() += 1; }
    let day_counts = days.into_iter().map(|(day, incidents)| DayCount { day, incidents }).collect();
    Ok(ReliabilityResult { records, day_counts, warnings: raw.warnings })
}
