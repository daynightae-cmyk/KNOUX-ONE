use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{process::Command, time::Instant};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemDiscoveryData {
    pub computer_name: String,
    pub os_product_name: String,
    pub os_edition: String,
    pub build_number: String,
    pub architecture: String,
    pub total_ram_gb: Option<f64>,
    pub cpu_model: String,
    pub active_user: String,
    pub secure_boot_enabled: Option<bool>,
    pub tpm_available: Option<bool>,
}

#[tauri::command]
pub fn m01_system_discover(op_id: String) -> Result<OperationResult<SystemDiscoveryData>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$os = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$secureBoot = $null
$tpmPresent = $null
try { $secureBoot = Confirm-SecureBootUEFI } catch {}
try { $tpmPresent = (Get-Tpm).TpmPresent } catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[pscustomobject]@{
  computerName = $env:COMPUTERNAME
  osProductName = [string]$os.Caption
  osEdition = [string]$os.Caption
  buildNumber = [string]$os.BuildNumber
  architecture = [string]$os.OSArchitecture
  totalRamGB = if ($computer.TotalPhysicalMemory) { [math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
  cpuModel = [string]$cpu.Name
  activeUser = if ($computer.UserName) { [string]$computer.UserName } else { [string]$env:USERNAME }
  secureBootEnabled = $secureBoot
  tpmAvailable = $tpmPresent
} | ConvertTo-Json -Compress
"#;
        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|error| format!("system_discovery_launch_failed: {error}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if !output.status.success() {
            return Ok(OperationResult {
                operation_id: op_id,
                capability_id: "m01_s01".into(),
                handler_id: "m01.system.discover".into(),
                status: "failed".into(),
                started_at,
                completed_at: Some(Utc::now().to_rfc3339()),
                duration_ms: Some(timer.elapsed().as_millis() as u64),
                requires_restart: false,
                exit_code: output.status.code(),
                stdout: if stdout.is_empty() {
                    None
                } else {
                    Some(stdout)
                },
                stderr: if stderr.is_empty() {
                    None
                } else {
                    Some(stderr)
                },
                summary_en: "Windows system discovery failed.".into(),
                summary_ar: "فشل اكتشاف معلومات نظام ويندوز.".into(),
                warnings: Vec::new(),
                error_code: Some("system_discovery_failed".into()),
                data: None,
            });
        }

        let data = serde_json::from_str::<SystemDiscoveryData>(&stdout)
            .map_err(|error| format!("system_discovery_parse_failed: {error}"))?;
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s01".into(),
            handler_id: "m01.system.discover".into(),
            status: "completed".into(),
            started_at,
            completed_at: Some(Utc::now().to_rfc3339()),
            duration_ms: Some(timer.elapsed().as_millis() as u64),
            requires_restart: false,
            exit_code: output.status.code(),
            stdout: Some(stdout),
            stderr: if stderr.is_empty() {
                None
            } else {
                Some(stderr)
            },
            summary_en: "Windows system information was read from CIM and security providers."
                .into(),
            summary_ar: "تمت قراءة معلومات ويندوز من CIM ومصادر الأمان المحلية.".into(),
            warnings: Vec::new(),
            error_code: None,
            data: Some(data),
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s01".into(),
            handler_id: "m01.system.discover".into(),
            status: "unavailable".into(),
            started_at,
            completed_at: Some(Utc::now().to_rfc3339()),
            duration_ms: Some(timer.elapsed().as_millis() as u64),
            requires_restart: false,
            exit_code: None,
            stdout: None,
            stderr: Some("Windows host is required.".into()),
            summary_en: "Windows desktop runtime is unavailable on this host.".into(),
            summary_ar: "بيئة سطح مكتب ويندوز غير متاحة على هذا الجهاز.".into(),
            warnings: Vec::new(),
            error_code: Some("unsupported_os".into()),
            data: None,
        })
    }
}
