use crate::diagnostics::{
    contracts::{DiagnosticEvent, NetworkAdapterEvidence, NetworkDiagnosticsRequest, NetworkDiagnosticsResult, NetworkProbe},
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawAdapter { name: Option<String>, description: Option<String>, status: Option<String>, link_speed: Option<String>, mac_address: Option<String>, ipv4: Option<Vec<String>>, gateways: Option<Vec<String>>, dns_servers: Option<Vec<String>> }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawProbe { target: Option<String>, resolved_addresses: Option<Vec<String>>, ping_succeeded: Option<bool>, tcp_succeeded: Option<bool>, remote_port: Option<u16>, source_address: Option<String>, interface_alias: Option<String>, latency_ms: Option<u64> }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEvent { record_id: Option<u64>, channel: Option<String>, provider: Option<String>, event_id: Option<u32>, level: Option<String>, time_created: Option<String>, message: Option<String> }
#[derive(Debug, Deserialize)]
struct RawEnvelope { adapters: Vec<RawAdapter>, probe: Option<RawProbe>, events: Vec<RawEvent>, warnings: Vec<String> }

fn validate_target(value: Option<&str>) -> Result<String, DiagnosticError> {
    let target = value.unwrap_or("1.1.1.1").trim();
    if target.is_empty() || target.len() > 253 || !target.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | ':' | '[' | ']')) {
        return Err(DiagnosticError::InvalidRequest("network target must be a hostname or IP address".into()));
    }
    Ok(target.to_string())
}

pub fn diagnose(request: &NetworkDiagnosticsRequest) -> Result<NetworkDiagnosticsResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 90);
    let target = validate_target(request.target.as_deref())?;
    let escaped = target.replace('\'', "''");
    let script = format!(r#"
$warnings=@();$adapters=@();$events=@();$probe=$null;$start=(Get-Date).AddHours(-{hours})
try {{
  Get-NetIPConfiguration -ErrorAction Stop | ForEach-Object {{
    $adapter=Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue
    $adapters += [pscustomobject]@{{name=[string]$_.InterfaceAlias;description=[string]$adapter.InterfaceDescription;status=[string]$adapter.Status;linkSpeed=[string]$adapter.LinkSpeed;macAddress=[string]$adapter.MacAddress;ipv4=@($_.IPv4Address|ForEach-Object{{$_.IPAddress}});gateways=@($_.IPv4DefaultGateway|ForEach-Object{{$_.NextHop}});dnsServers=@($_.DNSServer.ServerAddresses)}}
  }}
}} catch {{$warnings += "Adapter inventory: $($_.Exception.Message)"}}
try {{
  $watch=[Diagnostics.Stopwatch]::StartNew();$test=Test-NetConnection -ComputerName '{target}' -Port 443 -InformationLevel Detailed -WarningAction SilentlyContinue;$watch.Stop()
  $resolved=@();try{{$resolved=@([Net.Dns]::GetHostAddresses('{target}')|ForEach-Object{{$_.IPAddressToString}})}}catch{{}}
  $probe=[pscustomobject]@{{target='{target}';resolvedAddresses=$resolved;pingSucceeded=[bool]$test.PingSucceeded;tcpSucceeded=[bool]$test.TcpTestSucceeded;remotePort=443;sourceAddress=[string]$test.SourceAddress;interfaceAlias=[string]$test.InterfaceAlias;latencyMs=[uint64]$watch.ElapsedMilliseconds}}
}} catch {{$warnings += "Network probe: $($_.Exception.Message)"}}
$providers=@('Microsoft-Windows-NetworkProfile','Microsoft-Windows-DNS-Client','Tcpip','Microsoft-Windows-WLAN-AutoConfig','NlaSvc')
foreach($provider in $providers){{try{{Get-WinEvent -FilterHashtable @{{LogName='System';ProviderName=$provider;StartTime=$start;Level=1,2,3}} -ErrorAction Stop | Select-Object -First 100 | ForEach-Object{{$events += [pscustomobject]@{{recordId=if($null-ne$_.RecordId){{[uint64]$_.RecordId}}else{{$null}};channel=[string]$_.LogName;provider=[string]$_.ProviderName;eventId=[uint32]$_.Id;level=[string]$_.LevelDisplayName;timeCreated=$_.TimeCreated.ToUniversalTime().ToString('o');message=if($_.Message){{[string]$_.Message}}else{{''}}}}}}}}catch{{}}}}
[pscustomobject]@{{adapters=@($adapters);probe=$probe;events=@($events|Sort-Object timeCreated -Descending|Select-Object -First 200);warnings=@($warnings)}}|ConvertTo-Json -Depth 8 -Compress
"#, target=escaped);
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    let adapters = raw.adapters.into_iter().map(|item| NetworkAdapterEvidence { name: item.name.unwrap_or_default(), description: item.description.unwrap_or_default(), status: item.status.unwrap_or_default(), link_speed: item.link_speed.filter(|v| !v.is_empty()), mac_address: item.mac_address.filter(|v| !v.is_empty()), ipv4: item.ipv4.unwrap_or_default(), gateways: item.gateways.unwrap_or_default(), dns_servers: item.dns_servers.unwrap_or_default() }).collect();
    let probe = raw.probe.map(|item| NetworkProbe { target: item.target.unwrap_or(target), resolved_addresses: item.resolved_addresses.unwrap_or_default(), ping_succeeded: item.ping_succeeded.unwrap_or(false), tcp_succeeded: item.tcp_succeeded, remote_port: item.remote_port, source_address: item.source_address.filter(|v| !v.is_empty()), interface_alias: item.interface_alias.filter(|v| !v.is_empty()), latency_ms: item.latency_ms });
    let events = raw.events.into_iter().map(|item| { let provider=item.provider.unwrap_or_else(||"Unknown".into()); let event_id=item.event_id.unwrap_or_default(); let time=item.time_created.unwrap_or_default(); DiagnosticEvent { record_id:item.record_id, channel:item.channel.unwrap_or_else(||"System".into()), provider:provider.clone(), event_id, level:item.level.unwrap_or_else(||"Unknown".into()), time_created:time.clone(), machine_name:None, message:item.message.unwrap_or_default(), correlation_key:format!("{provider}:{event_id}:{time}") } }).collect();
    Ok(NetworkDiagnosticsResult { adapters, probe, events, warnings: raw.warnings })
}

#[cfg(test)]
mod tests {
    use super::validate_target;
    #[test] fn rejects_command_injection_target(){ assert!(validate_target(Some("1.1.1.1;Remove-Item C:\\")).is_err()); }
    #[test] fn accepts_hostname(){ assert_eq!(validate_target(Some("example.com")).unwrap(), "example.com"); }
}
