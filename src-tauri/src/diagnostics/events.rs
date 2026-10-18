use crate::diagnostics::{
    contracts::{DiagnosticEvent, EventQueryRequest, EventQueryResult},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;
use std::collections::HashSet;

const ALLOWED_CHANNELS: &[&str] = &[
    "System",
    "Application",
    "Microsoft-Windows-WindowsUpdateClient/Operational",
    "Microsoft-Windows-NetworkProfile/Operational",
    "Microsoft-Windows-WLAN-AutoConfig/Operational",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEvent {
    record_id: Option<u64>,
    channel: Option<String>,
    provider: Option<String>,
    event_id: Option<u32>,
    level: Option<String>,
    time_created: Option<String>,
    machine_name: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawEnvelope { events: Vec<RawEvent>, warnings: Vec<String> }

fn requested_channels(request: &EventQueryRequest) -> Result<Vec<String>, DiagnosticError> {
    let input = if request.channels.is_empty() { vec!["System".into(), "Application".into()] } else { request.channels.clone() };
    let mut unique = HashSet::new();
    let mut output = Vec::new();
    for channel in input {
        if !ALLOWED_CHANNELS.iter().any(|allowed| allowed.eq_ignore_ascii_case(channel.trim())) {
            return Err(DiagnosticError::InvalidRequest(format!("unsupported_event_channel: {channel}")));
        }
        let canonical = ALLOWED_CHANNELS.iter().find(|allowed| allowed.eq_ignore_ascii_case(channel.trim())).unwrap().to_string();
        if unique.insert(canonical.clone()) { output.push(canonical); }
    }
    Ok(output)
}

fn ps_array(values: &[String]) -> String {
    values.iter().map(|value| format!("'{}'", value.replace('\'', "''"))).collect::<Vec<_>>().join(",")
}

pub fn query(request: &EventQueryRequest) -> Result<EventQueryResult, DiagnosticError> {
    let channels = requested_channels(request)?;
    let hours = request.hours.clamp(1, 24 * 90);
    let limit = request.limit.clamp(1, 2_000);
    let levels = if request.levels.is_empty() { vec![1u8, 2, 3] } else { request.levels.iter().copied().filter(|level| (1..=5).contains(level)).collect() };
    let script = format!(r#"
$start = (Get-Date).AddHours(-{hours})
$events = @()
$warnings = @()
$channels = @({channels})
$levels = @({levels})
foreach ($channel in $channels) {{
  try {{
    $items = Get-WinEvent -FilterHashtable @{{LogName=$channel; StartTime=$start; Level=$levels}} -ErrorAction Stop |
      Select-Object -First {limit}
    foreach ($event in $items) {{
      $events += [pscustomobject]@{{
        recordId = if ($null -ne $event.RecordId) {{ [uint64]$event.RecordId }} else {{ $null }}
        channel = [string]$event.LogName
        provider = [string]$event.ProviderName
        eventId = [uint32]$event.Id
        level = [string]$event.LevelDisplayName
        timeCreated = if ($event.TimeCreated) {{ $event.TimeCreated.ToUniversalTime().ToString('o') }} else {{ '' }}
        machineName = [string]$event.MachineName
        message = if ($event.Message) {{ [string]$event.Message }} else {{ '' }}
      }}
    }}
  }} catch {{ $warnings += "$channel: $($_.Exception.Message)" }}
}}
[pscustomobject]@{{events=@($events | Sort-Object timeCreated -Descending | Select-Object -First {limit}); warnings=@($warnings)}} | ConvertTo-Json -Depth 6 -Compress
"#, channels=ps_array(&channels), levels=levels.iter().map(u8::to_string).collect::<Vec<_>>().join(","));
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    let providers = request.providers.iter().map(|value| value.to_lowercase()).collect::<Vec<_>>();
    let events = raw.events.into_iter().filter_map(|event| {
        let provider = event.provider.unwrap_or_else(|| "Unknown".into());
        if !providers.is_empty() && !providers.iter().any(|filter| provider.to_lowercase().contains(filter)) { return None; }
        let channel = event.channel.unwrap_or_else(|| "Unknown".into());
        let event_id = event.event_id.unwrap_or_default();
        let time_created = event.time_created.unwrap_or_default();
        Some(DiagnosticEvent {
            record_id: event.record_id,
            channel: channel.clone(),
            provider: provider.clone(),
            event_id,
            level: event.level.unwrap_or_else(|| "Unknown".into()),
            time_created: time_created.clone(),
            machine_name: event.machine_name.filter(|value| !value.is_empty()),
            message: event.message.unwrap_or_default(),
            correlation_key: format!("{}:{}:{}", provider, event_id, time_created),
        })
    }).collect::<Vec<_>>();
    let critical_count = events.iter().filter(|event| event.level.eq_ignore_ascii_case("critical")).count();
    let error_count = events.iter().filter(|event| event.level.eq_ignore_ascii_case("error")).count();
    let warning_count = events.iter().filter(|event| event.level.eq_ignore_ascii_case("warning")).count();
    Ok(EventQueryResult { events, queried_channels: channels, hours, critical_count, error_count, warning_count, warnings: raw.warnings })
}

#[cfg(test)]
mod tests {
    use super::requested_channels;
    use crate::diagnostics::contracts::EventQueryRequest;

    #[test]
    fn rejects_arbitrary_log_channel() {
        let request = EventQueryRequest { hours: 24, limit: 10, channels: vec!["$(whoami)".into()], providers: vec![], levels: vec![] };
        assert!(requested_channels(&request).is_err());
    }
}
