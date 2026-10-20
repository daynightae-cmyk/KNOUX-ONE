use crate::diagnostics::{
    contracts::{
        DiagnosticEvent, NetworkAdapterEvidence, NetworkDiagnosticsRequest,
        NetworkDiagnosticsResult, NetworkProbe,
    },
    errors::DiagnosticError,
    powershell::run_json,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawAdapter {
    name: Option<String>,
    description: Option<String>,
    status: Option<String>,
    link_speed: Option<String>,
    mac_address: Option<String>,
    ipv4: Option<Vec<String>>,
    gateways: Option<Vec<String>>,
    dns_servers: Option<Vec<String>>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawProbe {
    target: Option<String>,
    resolved_addresses: Option<Vec<String>>,
    ping_succeeded: Option<bool>,
    tcp_succeeded: Option<bool>,
    remote_port: Option<u16>,
    source_address: Option<String>,
    interface_alias: Option<String>,
    latency_ms: Option<u64>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEvent {
    record_id: Option<u64>,
    channel: Option<String>,
    provider: Option<String>,
    event_id: Option<u32>,
    level: Option<String>,
    time_created: Option<String>,
    message: Option<String>,
}
#[derive(Debug, Deserialize)]
struct RawEnvelope {
    adapters: Vec<RawAdapter>,
    probe: Option<RawProbe>,
    events: Vec<RawEvent>,
    warnings: Vec<String>,
}

/// The port the probe connects to.
const PROBE_PORT: u16 = 443;

/// How long the ICMP probe may take.
const PING_TIMEOUT_MS: u64 = 3_000;

/// How long the TCP connect may take.
const TCP_TIMEOUT_MS: u64 = 5_000;

fn validate_target(value: Option<&str>) -> Result<String, DiagnosticError> {
    let target = value.unwrap_or("1.1.1.1").trim();
    if target.is_empty()
        || target.len() > 253
        || !target
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | ':' | '[' | ']'))
    {
        return Err(DiagnosticError::InvalidRequest(
            "network target must be a hostname or IP address".into(),
        ));
    }
    Ok(target.to_string())
}

/// The network diagnostics script.
///
/// The probe is written against .NET directly rather than with
/// `Test-NetConnection`, because that cmdlet has no timeout of its own: it
/// waits for the ICMP reply to expire before it tries TCP, which took 48
/// seconds on the cycle host and more than two minutes on a filtered network.
/// The query never came back, and the user saw a diagnostic that never
/// finished.
fn network_script(hours: u32, target: &str) -> String {
    let escaped = target.replace('\'', "''");
    format!(
        r#"
$warnings=@();$adapters=@();$events=@();$probe=$null;$start=(Get-Date).AddHours(-{hours})
try {{
  Get-NetIPConfiguration -ErrorAction Stop | ForEach-Object {{
    $adapter=Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue
    $adapters += [pscustomobject]@{{name=[string]$_.InterfaceAlias;description=[string]$adapter.InterfaceDescription;status=[string]$adapter.Status;linkSpeed=[string]$adapter.LinkSpeed;macAddress=[string]$adapter.MacAddress;ipv4=@($_.IPv4Address|ForEach-Object{{$_.IPAddress}});gateways=@($_.IPv4DefaultGateway|ForEach-Object{{$_.NextHop}});dnsServers=@($_.DNSServer.ServerAddresses)}}
  }}
}} catch {{$warnings += "Adapter inventory: $($_.Exception.Message)"}}
try {{
  $resolved=@();try{{$resolved=@([Net.Dns]::GetHostAddresses('{target}')|ForEach-Object{{$_.IPAddressToString}})}}catch{{}}
  $pingSucceeded=$false;$pingLatency=$null
  try {{
    $pinger=New-Object System.Net.NetworkInformation.Ping
    $reply=$pinger.Send('{target}',{ping_timeout_ms})
    if($reply.Status -eq 'Success'){{$pingSucceeded=$true;$pingLatency=[uint64]$reply.RoundTripTime}}
    $pinger.Dispose()
  }} catch {{}}
  $tcpSucceeded=$false;$tcpLatency=$null;$sourceAddress=''
  try {{
    $client=New-Object System.Net.Sockets.TcpClient
    $clock=[Diagnostics.Stopwatch]::StartNew()
    $connect=$client.BeginConnect('{target}',{port},$null,$null)
    if($connect.AsyncWaitHandle.WaitOne({tcp_timeout_ms},$false)){{
      $client.EndConnect($connect);$tcpSucceeded=$true
      try{{$sourceAddress=[string]$client.Client.LocalEndPoint.Address}}catch{{}}
    }}
    $clock.Stop();$tcpLatency=[uint64]$clock.ElapsedMilliseconds
    $client.Close()
  }} catch {{}}
  $interfaceAlias=''
  try {{$routeTarget=if($resolved.Count -gt 0){{[string]$resolved[0]}}else{{'{target}'}};$route=Find-NetRoute -RemoteIPAddress $routeTarget -ErrorAction SilentlyContinue|Select-Object -First 1;if($route){{$interfaceAlias=[string]$route.InterfaceAlias}}}} catch {{}}
  $latency=if($null-ne$pingLatency){{$pingLatency}}else{{$tcpLatency}}
  $probe=[pscustomobject]@{{target='{target}';resolvedAddresses=$resolved;pingSucceeded=[bool]$pingSucceeded;tcpSucceeded=[bool]$tcpSucceeded;remotePort={port};sourceAddress=$sourceAddress;interfaceAlias=$interfaceAlias;latencyMs=$latency}}
}} catch {{$warnings += "Network probe: $($_.Exception.Message)"}}
$providers=@('Microsoft-Windows-NetworkProfile','Microsoft-Windows-DNS-Client','Tcpip','Microsoft-Windows-WLAN-AutoConfig','NlaSvc')
foreach($provider in $providers){{try{{Get-WinEvent -FilterHashtable @{{LogName='System';ProviderName=$provider;StartTime=$start;Level=1,2,3}} -ErrorAction SilentlyContinue | Select-Object -First 100 | ForEach-Object{{$events += [pscustomobject]@{{recordId=if($null-ne$_.RecordId){{[uint64]$_.RecordId}}else{{$null}};channel=[string]$_.LogName;provider=[string]$_.ProviderName;eventId=[uint32]$_.Id;level=[string]$_.LevelDisplayName;timeCreated=$_.TimeCreated.ToUniversalTime().ToString('o');message=if($_.Message){{[string]$_.Message}}else{{''}}}}}}}}catch{{}}}}
[pscustomobject]@{{adapters=@($adapters);probe=$probe;events=@($events|Sort-Object timeCreated -Descending|Select-Object -First 200);warnings=@($warnings)}}|ConvertTo-Json -Depth 8 -Compress
"#,
        target = escaped,
        port = PROBE_PORT,
        ping_timeout_ms = PING_TIMEOUT_MS,
        tcp_timeout_ms = TCP_TIMEOUT_MS
    )
}

pub fn diagnose(
    request: &NetworkDiagnosticsRequest,
) -> Result<NetworkDiagnosticsResult, DiagnosticError> {
    let hours = request.hours.clamp(1, 24 * 90);
    let target = validate_target(request.target.as_deref())?;
    let script = network_script(hours, &target);
    let (raw, _) = run_json::<RawEnvelope>(&script)?;
    let adapters = raw
        .adapters
        .into_iter()
        .map(|item| NetworkAdapterEvidence {
            name: item.name.unwrap_or_default(),
            description: item.description.unwrap_or_default(),
            status: item.status.unwrap_or_default(),
            link_speed: item.link_speed.filter(|v| !v.is_empty()),
            mac_address: item.mac_address.filter(|v| !v.is_empty()),
            ipv4: item.ipv4.unwrap_or_default(),
            gateways: item.gateways.unwrap_or_default(),
            dns_servers: item.dns_servers.unwrap_or_default(),
        })
        .collect();
    let probe = raw.probe.map(|item| NetworkProbe {
        target: item.target.unwrap_or(target),
        resolved_addresses: item.resolved_addresses.unwrap_or_default(),
        ping_succeeded: item.ping_succeeded.unwrap_or(false),
        tcp_succeeded: item.tcp_succeeded,
        remote_port: item.remote_port,
        source_address: item.source_address.filter(|v| !v.is_empty()),
        interface_alias: item.interface_alias.filter(|v| !v.is_empty()),
        latency_ms: item.latency_ms,
    });
    let events = raw
        .events
        .into_iter()
        .map(|item| {
            let provider = item.provider.unwrap_or_else(|| "Unknown".into());
            let event_id = item.event_id.unwrap_or_default();
            let time = item.time_created.unwrap_or_default();
            DiagnosticEvent {
                record_id: item.record_id,
                channel: item.channel.unwrap_or_else(|| "System".into()),
                provider: provider.clone(),
                event_id,
                level: item.level.unwrap_or_else(|| "Unknown".into()),
                time_created: time.clone(),
                machine_name: None,
                message: item.message.unwrap_or_default(),
                correlation_key: format!("{provider}:{event_id}:{time}"),
            }
        })
        .collect();
    Ok(NetworkDiagnosticsResult {
        adapters,
        probe,
        events,
        warnings: raw.warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::validate_target;
    #[test]
    fn rejects_command_injection_target() {
        assert!(validate_target(Some("1.1.1.1;Remove-Item C:\\")).is_err());
    }
    #[test]
    fn accepts_hostname() {
        assert_eq!(validate_target(Some("example.com")).unwrap(), "example.com");
    }

    /// `Test-NetConnection` has no timeout of its own. It waits for the ICMP
    /// reply to expire before it tries TCP, which took 48 seconds on the cycle
    /// host and more than two minutes on a filtered network, so the query never
    /// came back. The probe has to be bounded.
    #[test]
    fn the_probe_is_bounded() {
        let script = network_script(24, "1.1.1.1");

        assert!(
            !script.contains("Test-NetConnection"),
            "Test-NetConnection cannot be bounded and blocks the query"
        );
        assert!(
            script.contains("WaitOne"),
            "the TCP probe has to be bounded by a wait"
        );
        assert!(
            script.contains("Ping"),
            "the ICMP probe has to use a bounded ping"
        );
    }
}
