use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    net::IpAddr,
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkRequest {
    pub action: String,
    pub target: Option<String>,
    pub count: Option<u32>,
    pub timeout_ms: Option<u64>,
    pub max_hops: Option<u32>,
    pub confirmation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandEvidence {
    pub program: String,
    pub arguments: Vec<String>,
    pub exit_code: Option<i32>,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkArtifact {
    pub path: String,
    pub kind: String,
    pub exists: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkReport {
    pub service: String,
    pub action: String,
    pub elevated: bool,
    pub requires_restart: bool,
    pub target: Option<String>,
    pub details: Value,
    pub commands: Vec<CommandEvidence>,
    pub artifacts: Vec<NetworkArtifact>,
    pub notes: Vec<String>,
    pub evidence_path: Option<String>,
    pub measured_at: String,
}

#[derive(Clone)]
struct Step {
    program: String,
    arguments: Vec<String>,
    critical: bool,
}

impl Step {
    fn new(program: &str, arguments: &[&str], critical: bool) -> Self {
        Self {
            program: program.into(),
            arguments: arguments.iter().map(|item| (*item).to_string()).collect(),
            critical,
        }
    }

    fn owned(program: &str, arguments: Vec<String>, critical: bool) -> Self {
        Self {
            program: program.into(),
            arguments,
            critical,
        }
    }
}

fn app_root(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app_data_unavailable:{error}"))?
        .join("network-internet");
    fs::create_dir_all(&path).map_err(|error| format!("app_data_create_failed:{error}"))?;
    Ok(path)
}

fn save_json<T: Serialize + ?Sized>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("directory_create_failed:{error}"))?;
    }
    let bytes =
        serde_json::to_vec_pretty(value).map_err(|error| format!("json_encode_failed:{error}"))?;
    fs::write(path, bytes).map_err(|error| format!("write_failed:{}:{error}", path.display()))
}

fn run_step(step: &Step) -> CommandEvidence {
    let started = Instant::now();
    match Command::new(&step.program).args(&step.arguments).output() {
        Ok(output) => CommandEvidence {
            program: step.program.clone(),
            arguments: step.arguments.clone(),
            exit_code: output.status.code(),
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            duration_ms: started.elapsed().as_millis() as u64,
        },
        Err(error) => CommandEvidence {
            program: step.program.clone(),
            arguments: step.arguments.clone(),
            exit_code: None,
            success: false,
            stdout: String::new(),
            stderr: format!("process_launch_failed:{error}"),
            duration_ms: started.elapsed().as_millis() as u64,
        },
    }
}

fn powershell_step(script: String, critical: bool) -> Step {
    Step::owned(
        "powershell.exe",
        vec![
            "-NoLogo".into(),
            "-NoProfile".into(),
            "-NonInteractive".into(),
            "-ExecutionPolicy".into(),
            "Bypass".into(),
            "-Command".into(),
            script,
        ],
        critical,
    )
}

fn is_elevated() -> bool {
    let script = "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)";
    let evidence = run_step(&powershell_step(script.into(), true));
    evidence.success && evidence.stdout.trim().eq_ignore_ascii_case("true")
}

fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn validate_target(input: Option<&str>) -> Result<String, String> {
    let value = input.unwrap_or_default().trim();
    if value.is_empty() || value.len() > 253 {
        return Err("target_length_invalid".into());
    }
    if value.contains("://")
        || value.contains('/')
        || value.contains('\\')
        || value.chars().any(char::is_whitespace)
    {
        return Err("target_format_invalid".into());
    }
    if value.parse::<IpAddr>().is_ok() {
        return Ok(value.to_string());
    }
    for label in value.split('.') {
        if label.is_empty()
            || label.len() > 63
            || label.starts_with('-')
            || label.ends_with('-')
            || !label
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
        {
            return Err("target_hostname_invalid".into());
        }
    }
    Ok(value.to_string())
}

fn validate_action(request: &NetworkRequest, expected: &str) -> Result<(), String> {
    if request.action == expected {
        Ok(())
    } else {
        Err(format!("unsupported_action:{}", request.action))
    }
}

fn require_confirmation(request: &NetworkRequest, expected: &str) -> Result<(), String> {
    if request.confirmation.as_deref() == Some(expected) {
        Ok(())
    } else {
        Err(format!("typed_confirmation_required:{expected}"))
    }
}

fn failure_result(
    app: &AppHandle,
    capability_id: &str,
    handler_id: &str,
    service: &str,
    action: &str,
    target: Option<String>,
    message: String,
) -> OperationResult<NetworkReport> {
    run_service(
        app,
        capability_id,
        handler_id,
        service,
        action,
        target,
        false,
        false,
        Vec::new(),
        false,
        Vec::new(),
        vec![message.clone()],
        None,
        &message,
        &format!("فشلت عملية الشبكة: {message}"),
        Some(message.clone()),
    )
}

#[allow(clippy::too_many_arguments)]
fn run_service(
    app: &AppHandle,
    capability_id: &str,
    handler_id: &str,
    service: &str,
    action: &str,
    target: Option<String>,
    requires_admin: bool,
    requires_restart: bool,
    steps: Vec<Step>,
    parse_last_json: bool,
    artifact_candidates: Vec<(PathBuf, String)>,
    notes: Vec<String>,
    export_name: Option<String>,
    summary_en: &str,
    summary_ar: &str,
    initial_failure: Option<String>,
) -> OperationResult<NetworkReport> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let elevated = is_elevated();
    let mut commands = Vec::new();
    let mut warnings = Vec::new();
    let mut critical_failure = initial_failure;

    if requires_admin && !elevated && critical_failure.is_none() {
        critical_failure = Some("administrator_required".into());
    }

    if critical_failure.is_none() {
        for step in steps {
            let critical = step.critical;
            let evidence = run_step(&step);
            if !evidence.success {
                let message = format!(
                    "{} failed with {:?}: {}",
                    evidence.program, evidence.exit_code, evidence.stderr
                );
                if critical && critical_failure.is_none() {
                    critical_failure = Some(message);
                } else {
                    warnings.push(message);
                }
            }
            commands.push(evidence);
            if critical_failure.is_some() {
                break;
            }
        }
    }

    let mut details = Value::Null;
    if let Some(last) = commands.last() {
        if parse_last_json && last.success {
            match serde_json::from_str::<Value>(&last.stdout) {
                Ok(value) => details = value,
                Err(error) => {
                    warnings.push(format!("structured_output_invalid:{error}"));
                    details = json!({ "stdout": last.stdout });
                }
            }
        } else {
            details = json!({ "stdout": last.stdout, "stderr": last.stderr });
        }
    }

    let mut artifacts = Vec::new();
    for (path, kind) in artifact_candidates {
        let metadata = path.metadata().ok();
        artifacts.push(NetworkArtifact {
            path: path.to_string_lossy().to_string(),
            kind,
            exists: metadata.is_some(),
            size_bytes: metadata.map(|item| item.len()).unwrap_or(0),
        });
    }

    if critical_failure.is_none() {
        if let Some(name) = export_name {
            match app_root(app).and_then(|root| {
                let path = root.join("reports").join(name);
                save_json(&path, &details)?;
                Ok(path)
            }) {
                Ok(path) => {
                    let size = path.metadata().map(|item| item.len()).unwrap_or(0);
                    artifacts.push(NetworkArtifact {
                        path: path.to_string_lossy().to_string(),
                        kind: "network_report_json".into(),
                        exists: true,
                        size_bytes: size,
                    });
                }
                Err(error) => warnings.push(error),
            }
        }
    }

    let mut report = NetworkReport {
        service: service.into(),
        action: action.into(),
        elevated,
        requires_restart,
        target,
        details,
        commands,
        artifacts,
        notes,
        evidence_path: None,
        measured_at: Utc::now().to_rfc3339(),
    };

    match app_root(app).and_then(|root| {
        let path = root.join("evidence").join(format!("{operation_id}.json"));
        report.evidence_path = Some(path.to_string_lossy().to_string());
        save_json(&path, &report)?;
        Ok(())
    }) {
        Ok(()) => {}
        Err(error) => warnings.push(error),
    }

    let failed = critical_failure.is_some();
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: if failed {
            "failed".into()
        } else if warnings.is_empty() {
            "completed".into()
        } else {
            "completed_with_warnings".into()
        },
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart,
        exit_code: if failed { Some(1) } else { Some(0) },
        stdout: None,
        stderr: critical_failure.clone(),
        summary_en: critical_failure
            .as_ref()
            .map(|error| format!("{summary_en}: {error}"))
            .unwrap_or_else(|| summary_en.into()),
        summary_ar: critical_failure
            .as_ref()
            .map(|error| format!("{summary_ar}: {error}"))
            .unwrap_or_else(|| summary_ar.into()),
        warnings,
        error_code: critical_failure.map(|_| "network_operation_failed".into()),
        data: Some(report),
    }
}

fn adapter_script() -> String {
    r#"
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$drivers=@{}
Get-CimInstance Win32_PnPSignedDriver -Filter "DeviceClass='NET'" -ErrorAction SilentlyContinue | ForEach-Object {
  if($_.DeviceID){$drivers[[string]$_.DeviceID]=[pscustomobject]@{version=[string]$_.DriverVersion;provider=[string]$_.DriverProviderName;date=[string]$_.DriverDate;inf=[string]$_.InfName}}
}
$items=@(Get-CimInstance Win32_NetworkAdapter | Where-Object {$_.NetConnectionID -or $_.PhysicalAdapter} | ForEach-Object {
  $driver=$drivers[[string]$_.PNPDeviceID]
  [pscustomobject]@{
    name=[string]$_.Name
    connectionName=[string]$_.NetConnectionID
    manufacturer=[string]$_.Manufacturer
    adapterType=[string]$_.AdapterType
    macAddress=[string]$_.MACAddress
    speedBitsPerSecond=[uint64]($(if($null -eq $_.Speed){0}else{$_.Speed}))
    physical=[bool]$_.PhysicalAdapter
    enabled=[bool]$_.NetEnabled
    status=[string]$_.NetConnectionStatus
    pnpDeviceId=[string]$_.PNPDeviceID
    driver=$driver
  }
})
[pscustomobject]@{adapters=$items;count=$items.Count;measuredAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json -Depth 7 -Compress
"#
    .into()
}

fn ip_configuration_script() -> String {
    r#"
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$items=@(Get-NetIPConfiguration -All | ForEach-Object {
  $dns=@(Get-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue | ForEach-Object {$_.ServerAddresses} | Where-Object {$_})
  $ipInterface=Get-NetIPInterface -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
  [pscustomobject]@{
    interfaceAlias=[string]$_.InterfaceAlias
    interfaceDescription=[string]$_.InterfaceDescription
    interfaceIndex=[uint32]$_.InterfaceIndex
    netProfileName=[string]$_.NetProfile.Name
    ipv4=@($_.IPv4Address | ForEach-Object {$_.IPAddress})
    ipv6=@($_.IPv6Address | ForEach-Object {$_.IPAddress})
    ipv4Gateway=@($_.IPv4DefaultGateway | ForEach-Object {$_.NextHop})
    ipv6Gateway=@($_.IPv6DefaultGateway | ForEach-Object {$_.NextHop})
    dnsServers=$dns
    dhcp=[string]$ipInterface.Dhcp
    connectionState=[string]$_.NetAdapter.Status
  }
})
$routes=@(Get-NetRoute -ErrorAction SilentlyContinue | Where-Object {$_.DestinationPrefix -in @('0.0.0.0/0','::/0')} | Sort-Object RouteMetric | Select-Object InterfaceAlias,DestinationPrefix,NextHop,RouteMetric,State)
[pscustomobject]@{interfaces=$items;defaultRoutes=$routes;measuredAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json -Depth 8 -Compress
"#
    .into()
}

fn ping_script(target: &str, count: u32, timeout_ms: u64) -> String {
    format!(
        r#"
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$target={target}
$count={count}
$timeout={timeout}
$pinger=[System.Net.NetworkInformation.Ping]::new()
$items=@()
for($index=1;$index -le $count;$index++){{
  try{{
    $reply=$pinger.Send($target,$timeout)
    $items += [pscustomobject]@{{sequence=$index;status=[string]$reply.Status;roundtripMs=[int64]$reply.RoundtripTime;address=[string]$reply.Address}}
  }}catch{{
    $items += [pscustomobject]@{{sequence=$index;status='Error';roundtripMs=$null;address='';error=$_.Exception.Message}}
  }}
}}
$ok=@($items | Where-Object {{$_.status -eq 'Success'}})
$times=@($ok | ForEach-Object {{$_.roundtripMs}})
[pscustomobject]@{{
  target=$target
  sent=$count
  received=$ok.Count
  lost=$count-$ok.Count
  lossPercent=[math]::Round((($count-$ok.Count)*100.0)/$count,2)
  minimumMs=if($times.Count){{($times | Measure-Object -Minimum).Minimum}}else{{$null}}
  maximumMs=if($times.Count){{($times | Measure-Object -Maximum).Maximum}}else{{$null}}
  averageMs=if($times.Count){{[math]::Round(($times | Measure-Object -Average).Average,2)}}else{{$null}}
  replies=$items
  measuredAt=(Get-Date).ToUniversalTime().ToString('o')
}} | ConvertTo-Json -Depth 6 -Compress
"#,
        target = ps_quote(target),
        count = count,
        timeout = timeout_ms,
    )
}

fn dns_benchmark_script(domain: &str) -> String {
    format!(
        r#"
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$domain={domain}
$servers=@(
  [pscustomobject]@{{name='Cloudflare';address='1.1.1.1'}},
  [pscustomobject]@{{name='Google';address='8.8.8.8'}},
  [pscustomobject]@{{name='Quad9';address='9.9.9.9'}}
)
$results=@($servers | ForEach-Object {{
  $server=$_
  $samples=@()
  for($round=1;$round -le 3;$round++){{
    $watch=[Diagnostics.Stopwatch]::StartNew()
    try{{
      $answer=@(Resolve-DnsName -Name $domain -Server $server.address -DnsOnly -Type A -ErrorAction Stop)
      $watch.Stop()
      $samples += [pscustomobject]@{{round=$round;success=$true;durationMs=$watch.Elapsed.TotalMilliseconds;addresses=@($answer | Where-Object {{$_.IPAddress}} | ForEach-Object {{$_.IPAddress}})}}
    }}catch{{
      $watch.Stop()
      $samples += [pscustomobject]@{{round=$round;success=$false;durationMs=$watch.Elapsed.TotalMilliseconds;error=$_.Exception.Message}}
    }}
  }}
  $successful=@($samples | Where-Object {{$_.success}})
  [pscustomobject]@{{name=$server.name;server=$server.address;successful=$successful.Count;averageMs=if($successful.Count){{[math]::Round(($successful.durationMs | Measure-Object -Average).Average,2)}}else{{$null}};samples=$samples}}
}})
[pscustomobject]@{{domain=$domain;servers=$results;measuredAt=(Get-Date).ToUniversalTime().ToString('o')}} | ConvertTo-Json -Depth 8 -Compress
"#,
        domain = ps_quote(domain),
    )
}

fn proxy_firewall_script() -> String {
    r#"
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$internetSettings=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
$profiles=@(Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction,NotifyOnListen,LogAllowed,LogBlocked,LogFileName)
$ruleCounts=@(Get-NetFirewallRule -ErrorAction SilentlyContinue | Group-Object Enabled,Direction,Action | ForEach-Object {[pscustomobject]@{group=$_.Name;count=$_.Count}})
[pscustomobject]@{
  userProxy=[pscustomobject]@{enabled=[bool]$internetSettings.ProxyEnable;server=[string]$internetSettings.ProxyServer;override=[string]$internetSettings.ProxyOverride;autoConfigUrl=[string]$internetSettings.AutoConfigURL}
  firewallProfiles=$profiles
  firewallRuleCounts=$ruleCounts
  measuredAt=(Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 8 -Compress
"#
    .into()
}

fn report_script(target: &str, count: u32, timeout_ms: u64) -> String {
    format!(
        r#"
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$target={target}
$adapters=@(Get-NetAdapter -IncludeHidden -ErrorAction SilentlyContinue | Select-Object Name,InterfaceDescription,Status,MacAddress,LinkSpeed,MediaType,PhysicalMediaType,DriverInformation)
$ip=@(Get-NetIPConfiguration -All | ForEach-Object {{[pscustomobject]@{{interfaceAlias=$_.InterfaceAlias;ipv4=@($_.IPv4Address.IPAddress);ipv6=@($_.IPv6Address.IPAddress);gateway=@($_.IPv4DefaultGateway.NextHop);dns=@((Get-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).ServerAddresses)}}}})
$profiles=@(Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction)
$proxy=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
$pinger=[System.Net.NetworkInformation.Ping]::new()
$replies=@()
for($i=1;$i -le {count};$i++){{try{{$r=$pinger.Send($target,{timeout});$replies += [pscustomobject]@{{status=[string]$r.Status;roundtripMs=[int64]$r.RoundtripTime;address=[string]$r.Address}}}}catch{{$replies += [pscustomobject]@{{status='Error';error=$_.Exception.Message}}}}}}
[pscustomobject]@{{
  computerName=$env:COMPUTERNAME
  adapters=$adapters
  ipConfiguration=$ip
  userProxy=[pscustomobject]@{{enabled=[bool]$proxy.ProxyEnable;server=[string]$proxy.ProxyServer;autoConfigUrl=[string]$proxy.AutoConfigURL}}
  firewallProfiles=$profiles
  tcpStatistics=Get-NetTCPStatistics -ErrorAction SilentlyContinue
  udpStatistics=Get-NetUDPStatistics -ErrorAction SilentlyContinue
  ping=[pscustomobject]@{{target=$target;replies=$replies}}
  measuredAt=(Get-Date).ToUniversalTime().ToString('o')
}} | ConvertTo-Json -Depth 10 -Compress
"#,
        target = ps_quote(target),
        count = count,
        timeout = timeout_ms,
    )
}

#[tauri::command]
pub fn m08_adapter_inventory(app: AppHandle) -> OperationResult<NetworkReport> {
    run_service(
        &app,
        "m08_s01",
        "m08.adapters.inspect",
        "adapter_inventory",
        "inspect",
        None,
        false,
        false,
        vec![powershell_step(adapter_script(), true)],
        true,
        Vec::new(),
        vec!["Physical and virtual adapters are reported from Windows CIM without changing adapter state.".into()],
        None,
        "Network adapters inspected",
        "تم فحص محولات الشبكة",
        None,
    )
}

#[tauri::command]
pub fn m08_ip_configuration(app: AppHandle) -> OperationResult<NetworkReport> {
    run_service(
        &app,
        "m08_s02",
        "m08.ip.inspect",
        "ip_configuration",
        "inspect",
        None,
        false,
        false,
        vec![powershell_step(ip_configuration_script(), true)],
        true,
        Vec::new(),
        vec!["Only local interface, gateway, route, DHCP and configured DNS evidence is read; no public-IP web service is contacted.".into()],
        None,
        "IP, gateway and DNS configuration inspected",
        "تم فحص إعدادات IP والبوابة وDNS",
        None,
    )
}

#[tauri::command]
pub fn m08_ping_test(app: AppHandle, request: NetworkRequest) -> OperationResult<NetworkReport> {
    if let Err(error) = validate_action(&request, "test") {
        return failure_result(
            &app,
            "m08_s03",
            "m08.ping.test",
            "ping",
            "test",
            request.target,
            error,
        );
    }
    let target = match validate_target(request.target.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return failure_result(
                &app,
                "m08_s03",
                "m08.ping.test",
                "ping",
                "test",
                request.target,
                error,
            )
        }
    };
    let count = request.count.unwrap_or(4).clamp(1, 10);
    let timeout = request.timeout_ms.unwrap_or(1_000).clamp(100, 5_000);
    run_service(
        &app,
        "m08_s03",
        "m08.ping.test",
        "ping",
        "test",
        Some(target.clone()),
        false,
        false,
        vec![powershell_step(ping_script(&target, count, timeout), true)],
        true,
        Vec::new(),
        vec!["Latency and packet loss are calculated from bounded .NET Ping replies; no synthetic speed score is generated.".into()],
        None,
        "Ping test completed",
        "اكتمل اختبار سرعة الاستجابة Ping",
        None,
    )
}

#[tauri::command]
pub fn m08_traceroute(app: AppHandle, request: NetworkRequest) -> OperationResult<NetworkReport> {
    if let Err(error) = validate_action(&request, "trace") {
        return failure_result(
            &app,
            "m08_s04",
            "m08.traceroute.run",
            "traceroute",
            "trace",
            request.target,
            error,
        );
    }
    let target = match validate_target(request.target.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return failure_result(
                &app,
                "m08_s04",
                "m08.traceroute.run",
                "traceroute",
                "trace",
                request.target,
                error,
            )
        }
    };
    let max_hops = request.max_hops.unwrap_or(12).clamp(1, 30);
    let timeout = request.timeout_ms.unwrap_or(1_000).clamp(100, 3_000);
    run_service(
        &app,
        "m08_s04",
        "m08.traceroute.run",
        "traceroute",
        "trace",
        Some(target.clone()),
        false,
        false,
        vec![Step::owned(
            "tracert.exe",
            vec![
                "-d".into(),
                "-h".into(),
                max_hops.to_string(),
                "-w".into(),
                timeout.to_string(),
                target,
            ],
            true,
        )],
        false,
        Vec::new(),
        vec!["Traceroute is bounded by the requested hop and per-hop timeout limits.".into()],
        None,
        "Traceroute completed",
        "اكتمل تتبع مسار الاتصال",
        None,
    )
}

#[tauri::command]
pub fn m08_dns_benchmark(
    app: AppHandle,
    request: NetworkRequest,
) -> OperationResult<NetworkReport> {
    if let Err(error) = validate_action(&request, "benchmark") {
        return failure_result(
            &app,
            "m08_s05",
            "m08.dns.benchmark",
            "dns_benchmark",
            "benchmark",
            request.target,
            error,
        );
    }
    let domain = match validate_target(request.target.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return failure_result(
                &app,
                "m08_s05",
                "m08.dns.benchmark",
                "dns_benchmark",
                "benchmark",
                request.target,
                error,
            )
        }
    };
    run_service(
        &app,
        "m08_s05",
        "m08.dns.benchmark",
        "dns_benchmark",
        "benchmark",
        Some(domain.clone()),
        false,
        false,
        vec![powershell_step(dns_benchmark_script(&domain), true)],
        true,
        Vec::new(),
        vec!["Cloudflare, Google and Quad9 are measured read-only; configured DNS servers are never changed.".into()],
        None,
        "DNS benchmark completed",
        "اكتمل اختبار خوادم DNS",
        None,
    )
}

#[tauri::command]
pub fn m08_flush_dns(app: AppHandle, request: NetworkRequest) -> OperationResult<NetworkReport> {
    if let Err(error) = validate_action(&request, "flush") {
        return failure_result(
            &app,
            "m08_s06",
            "m08.dns.flush",
            "dns_flush",
            "flush",
            None,
            error,
        );
    }
    run_service(
        &app,
        "m08_s06",
        "m08.dns.flush",
        "dns_flush",
        "flush",
        None,
        false,
        false,
        vec![Step::new("ipconfig.exe", &["/flushdns"], true)],
        false,
        Vec::new(),
        vec!["Only the Windows DNS resolver cache is flushed; DNS server configuration is untouched.".into()],
        None,
        "Windows DNS cache flushed",
        "تم تنظيف ذاكرة DNS في ويندوز",
        None,
    )
}

#[tauri::command]
pub fn m08_renew_ip(app: AppHandle, request: NetworkRequest) -> OperationResult<NetworkReport> {
    if let Err(error) = validate_action(&request, "renew")
        .and_then(|_| require_confirmation(&request, "RENEW IP LEASE"))
    {
        return failure_result(
            &app,
            "m08_s07",
            "m08.ip.renew",
            "ip_renew",
            "renew",
            None,
            error,
        );
    }
    run_service(
        &app,
        "m08_s07",
        "m08.ip.renew",
        "ip_renew",
        "renew",
        None,
        true,
        false,
        vec![
            powershell_step(ip_configuration_script(), false),
            Step::new("ipconfig.exe", &["/release"], false),
            Step::new("ipconfig.exe", &["/renew"], true),
            powershell_step(ip_configuration_script(), false),
        ],
        true,
        Vec::new(),
        vec!["The DHCP lease operation may temporarily interrupt connectivity; pre/post command evidence is preserved.".into()],
        None,
        "DHCP lease renewed",
        "تم تجديد عنوان IP من DHCP",
        None,
    )
}

#[tauri::command]
pub fn m08_stack_reset(app: AppHandle, request: NetworkRequest) -> OperationResult<NetworkReport> {
    if let Err(error) = validate_action(&request, "reset")
        .and_then(|_| require_confirmation(&request, "RESET NETWORK STACK"))
    {
        return failure_result(
            &app,
            "m08_s08",
            "m08.stack.reset",
            "network_stack",
            "reset",
            None,
            error,
        );
    }
    let log_path = match app_root(&app).and_then(|root| {
        let directory = root.join("reset-logs");
        fs::create_dir_all(&directory)
            .map_err(|error| format!("reset_log_directory_failed:{error}"))?;
        Ok(directory.join(format!("ip-reset-{}.log", Uuid::new_v4())))
    }) {
        Ok(path) => path,
        Err(error) => {
            return failure_result(
                &app,
                "m08_s08",
                "m08.stack.reset",
                "network_stack",
                "reset",
                None,
                error,
            )
        }
    };
    run_service(
        &app,
        "m08_s08",
        "m08.stack.reset",
        "network_stack",
        "reset",
        None,
        true,
        true,
        vec![
            Step::new("netsh.exe", &["winsock", "reset"], true),
            Step::owned(
                "netsh.exe",
                vec![
                    "int".into(),
                    "ip".into(),
                    "reset".into(),
                    log_path.to_string_lossy().to_string(),
                ],
                true,
            ),
        ],
        false,
        vec![(log_path, "tcp_ip_reset_log".into())],
        vec!["Only official netsh Winsock and TCP/IP reset operations are executed; a Windows restart is required.".into()],
        None,
        "Winsock and TCP/IP reset completed",
        "اكتملت إعادة ضبط Winsock وTCP/IP",
        None,
    )
}

#[tauri::command]
pub fn m08_proxy_firewall_status(app: AppHandle) -> OperationResult<NetworkReport> {
    run_service(
        &app,
        "m08_s09",
        "m08.proxy_firewall.inspect",
        "proxy_firewall",
        "inspect",
        None,
        false,
        false,
        vec![
            Step::new("netsh.exe", &["winhttp", "show", "proxy"], false),
            powershell_step(proxy_firewall_script(), true),
        ],
        true,
        Vec::new(),
        vec!["Proxy and Windows Defender Firewall state are inspected read-only; no profile or rule is disabled.".into()],
        None,
        "Proxy and firewall state inspected",
        "تم فحص البروكسي وجدار الحماية",
        None,
    )
}

#[tauri::command]
pub fn m08_report_export(
    app: AppHandle,
    request: NetworkRequest,
) -> OperationResult<NetworkReport> {
    if let Err(error) = validate_action(&request, "export") {
        return failure_result(
            &app,
            "m08_s10",
            "m08.report.export",
            "network_report",
            "export",
            request.target,
            error,
        );
    }
    let target = match validate_target(request.target.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return failure_result(
                &app,
                "m08_s10",
                "m08.report.export",
                "network_report",
                "export",
                request.target,
                error,
            )
        }
    };
    let count = request.count.unwrap_or(4).clamp(1, 10);
    let timeout = request.timeout_ms.unwrap_or(1_000).clamp(100, 5_000);
    let filename = format!("network-report-{}.json", Utc::now().format("%Y%m%d-%H%M%S"));
    run_service(
        &app,
        "m08_s10",
        "m08.report.export",
        "network_report",
        "export",
        Some(target.clone()),
        false,
        false,
        vec![powershell_step(report_script(&target, count, timeout), true)],
        true,
        Vec::new(),
        vec!["The exported JSON contains measured local Windows evidence and a bounded ping sample; no external public-IP lookup is used.".into()],
        Some(filename),
        "Network diagnostic report exported",
        "تم تصدير تقرير تشخيص الشبكة",
        None,
    )
}
