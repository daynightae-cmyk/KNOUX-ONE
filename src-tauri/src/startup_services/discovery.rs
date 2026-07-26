use crate::startup_services::{contracts::StartupItem, powershell};
use serde::Deserialize;
use std::{collections::HashMap, path::PathBuf};
use uuid::Uuid;

const STARTUP_DISCOVERY_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$results = @()
$locations = @(
  @{ SourceKind = 'registry'; Scope = 'user'; Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; RequiresAdmin = $false },
  @{ SourceKind = 'registry'; Scope = 'user'; Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce'; RequiresAdmin = $false },
  @{ SourceKind = 'registry'; Scope = 'machine'; Path = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'; RequiresAdmin = $true },
  @{ SourceKind = 'registry'; Scope = 'machine'; Path = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce'; RequiresAdmin = $true },
  @{ SourceKind = 'registry'; Scope = 'machine'; Path = 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'; RequiresAdmin = $true }
)

foreach ($location in $locations) {
  if (-not (Test-Path -LiteralPath $location.Path)) { continue }
  $item = Get-ItemProperty -LiteralPath $location.Path
  foreach ($property in $item.PSObject.Properties) {
    if ($property.Name -like 'PS*') { continue }
    if ($null -eq $property.Value) { continue }
    $results += [pscustomobject]@{
      Name = [string]$property.Name
      SourceKind = [string]$location.SourceKind
      SourceScope = [string]$location.Scope
      SourcePath = [string]$location.Path
      Command = [string]$property.Value
      TargetPath = $null
      RequiresAdmin = [bool]$location.RequiresAdmin
    }
  }
}

$shell = New-Object -ComObject WScript.Shell
$folders = @(
  @{ Scope = 'user'; Path = [Environment]::GetFolderPath('Startup'); RequiresAdmin = $false },
  @{ Scope = 'machine'; Path = [Environment]::GetFolderPath('CommonStartup'); RequiresAdmin = $true }
)
foreach ($folder in $folders) {
  if ([string]::IsNullOrWhiteSpace($folder.Path) -or -not (Test-Path -LiteralPath $folder.Path)) { continue }
  Get-ChildItem -LiteralPath $folder.Path -File -Force | ForEach-Object {
    $target = $null
    $command = $_.FullName
    if ($_.Extension -ieq '.lnk') {
      try {
        $shortcut = $shell.CreateShortcut($_.FullName)
        $target = [string]$shortcut.TargetPath
        $arguments = [string]$shortcut.Arguments
        $command = if ([string]::IsNullOrWhiteSpace($arguments)) { $target } else { '"' + $target + '" ' + $arguments }
      } catch {
        $target = $null
        $command = $_.FullName
      }
    } else {
      $target = $_.FullName
    }
    $results += [pscustomobject]@{
      Name = [string]$_.BaseName
      SourceKind = 'startup_folder'
      SourceScope = [string]$folder.Scope
      SourcePath = [string]$_.FullName
      Command = [string]$command
      TargetPath = $target
      RequiresAdmin = [bool]$folder.RequiresAdmin
    }
  }
}

@($results) | ConvertTo-Json -Depth 6 -Compress
"#;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct RawStartupItem {
    name: String,
    source_kind: String,
    source_scope: String,
    source_path: String,
    command: String,
    target_path: Option<String>,
    requires_admin: bool,
}

fn first_command_path(command: &str) -> Option<String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(rest) = trimmed.strip_prefix('"') {
        return rest.find('"').map(|index| rest[..index].to_string());
    }
    trimmed.split_whitespace().next().map(ToString::to_string)
}

fn normalize_target(raw: &RawStartupItem) -> Option<String> {
    raw.target_path
        .as_ref()
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .or_else(|| first_command_path(&raw.command))
        .map(|value| value.trim_matches('"').to_string())
}

fn protection(name: &str, command: &str, target: Option<&str>) -> (bool, Option<String>, Option<String>) {
    let combined = format!("{name} {command} {}", target.unwrap_or_default()).to_ascii_lowercase();
    let critical_names = [
        "securityhealth",
        "windows defender",
        "windowssecurity",
        "ctfmon",
        "userinit",
        "explorer.exe",
    ];
    let is_windows_path = combined.contains("\\windows\\system32\\")
        || combined.contains("\\windows\\syswow64\\")
        || combined.contains("\\windows\\explorer.exe");
    let is_known_critical = critical_names.iter().any(|value| combined.contains(value));
    if is_windows_path || is_known_critical {
        return (
            true,
            Some("Protected Windows startup component; KNOUX ONE will not disable it.".into()),
            Some("مكوّن محمي لبدء تشغيل ويندوز؛ لن يقوم KNOUX ONE بتعطيله.".into()),
        );
    }
    (false, None, None)
}

fn target_exists(target: Option<&str>) -> Option<bool> {
    target.map(|value| PathBuf::from(value).exists())
}

pub fn discover_startup_items() -> Result<Vec<StartupItem>, String> {
    let raw: Vec<RawStartupItem> = powershell::run_json(STARTUP_DISCOVERY_SCRIPT, HashMap::new())?;
    let mut items = raw
        .into_iter()
        .map(|entry| {
            let target = normalize_target(&entry);
            let (protected, reason_en, reason_ar) =
                protection(&entry.name, &entry.command, target.as_deref());
            StartupItem {
                id: Uuid::new_v4().to_string(),
                name: entry.name,
                source_kind: entry.source_kind,
                source_scope: entry.source_scope,
                source_path: entry.source_path,
                command: entry.command,
                target_path: target.clone(),
                enabled: true,
                requires_admin: entry.requires_admin,
                protected,
                protection_reason_en: reason_en,
                protection_reason_ar: reason_ar,
                target_exists: target_exists(target.as_deref()),
            }
        })
        .collect::<Vec<_>>();
    items.sort_by(|left, right| {
        left.source_kind
            .cmp(&right.source_kind)
            .then_with(|| left.source_scope.cmp(&right.source_scope))
            .then_with(|| left.name.to_ascii_lowercase().cmp(&right.name.to_ascii_lowercase()))
    });
    Ok(items)
}

pub fn is_protected_service(name: &str, start_name: Option<&str>, path_name: Option<&str>) -> (bool, Option<String>, Option<String>) {
    let lower_name = name.to_ascii_lowercase();
    let critical = [
        "rpcss", "dcomlaunch", "eventlog", "winmgmt", "plugplay", "power", "samss",
        "lsm", "profsvc", "schedule", "gpsvc", "cryptsvc", "wuauserv", "windefend",
        "mpssvc", "bfe", "dhcp", "dnscache", "nlasvc", "lanmanworkstation",
    ];
    let system_account = start_name
        .map(|value| value.to_ascii_lowercase())
        .map(|value| value.contains("localsystem") || value.contains("nt authority"))
        .unwrap_or(false);
    let windows_binary = path_name
        .map(|value| value.to_ascii_lowercase())
        .map(|value| value.contains("\\windows\\system32\\") || value.contains("svchost.exe"))
        .unwrap_or(false);
    if critical.contains(&lower_name.as_str()) || (system_account && windows_binary) {
        return (
            true,
            Some("Protected Windows service; this phase is inspection-only and does not change it.".into()),
            Some("خدمة ويندوز محمية؛ هذه المرحلة للعرض فقط ولا تقوم بتغييرها.".into()),
        );
    }
    (false, None, None)
}
