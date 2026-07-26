use crate::diagnostics::{
    contracts::{CategoryCount, HardwareWarning, HardwareWarningsRequest, HardwareWarningsResult},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawWarning { time_created: Option<String>, provider: Option<String>, event_id: Option<u32>, level: Option<String>, category: Option<String>, message: Option<String> }
#[derive(Debug, Deserialize)]
struct RawEnvelope { events: Vec<RawWarning>, warnings: Vec<String> }

pub fn warnings(request: &HardwareWarningsRequest) -> Result<HardwareWarningsResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 365);
    let limit = request.limit.clamp(1, 2_000);
    let script = format!(r#"
$start=(Get-Date).AddHours(-{hours});$events=@();$warnings=@();$providers=@('Microsoft-Windows-WHEA-Logger','Disk','Ntfs','Microsoft-Windows-Kernel-Power','Display','Microsoft-Windows-Kernel-PnP','stornvme','storahci')
foreach($provider in $providers){{
  try {{ Get-WinEvent -FilterHashtable @{{LogName='System';ProviderName=$provider;StartTime=$start;Level=1,2,3}} -ErrorAction Stop | Select-Object -First {limit} | ForEach-Object {{
    $category = if($_.ProviderName -match 'WHEA'){{'hardware'}}elseif($_.ProviderName -match 'Disk|Ntfs|stor'){{'storage'}}elseif($_.ProviderName -match 'Display'){{'graphics'}}elseif($_.ProviderName -match 'PnP'){{'driver'}}else{{'kernel'}}
    $events += [pscustomobject]@{{timeCreated=$_.TimeCreated.ToUniversalTime().ToString('o');provider=[string]$_.ProviderName;eventId=[uint32]$_.Id;level=[string]$_.LevelDisplayName;category=$category;message=if($_.Message){{[string]$_.Message}}else{{''}}}}
  }} }} catch {{$warnings += "$provider: $($_.Exception.Message)"}}
}}
[pscustomobject]@{{events=@($events | Sort-Object timeCreated -Descending | Select-Object -First {limit});warnings=@($warnings)}} | ConvertTo-Json -Depth 6 -Compress
"#);
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    let events = raw.events.into_iter().map(|item| HardwareWarning { time_created: item.time_created.unwrap_or_default(), provider: item.provider.unwrap_or_else(|| "Unknown".into()), event_id: item.event_id.unwrap_or_default(), level: item.level.unwrap_or_else(|| "Unknown".into()), category: item.category.unwrap_or_else(|| "other".into()), message: item.message.unwrap_or_default() }).collect::<Vec<_>>();
    let mut counts = BTreeMap::<String, u32>::new(); for event in &events { *counts.entry(event.category.clone()).or_default() += 1; }
    Ok(HardwareWarningsResult { events, category_counts: counts.into_iter().map(|(category, count)| CategoryCount { category, count }).collect(), warnings: raw.warnings })
}
