use crate::contracts::OperationResult;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemDiscoveryData {
    pub computer_name: String,
    pub os_product_name: String,
    pub os_edition: String,
    pub build_number: String,
    pub architecture: String,
    pub total_ram_gb: f64,
    pub cpu_model: String,
    pub active_user: String,
    pub secure_boot_enabled: bool,
    pub tpm_available: bool,
}

#[tauri::command]
pub fn m01_system_discover(op_id: String) -> Result<OperationResult<SystemDiscoveryData>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        // Execute real command to get system info
        let output = Command::new("cmd")
            .args(["/C", "systeminfo"])
            .output();

        let mut stdout_res = String::new();
        let mut stderr_res = String::new();
        let mut exit_code = 1;

        if let Ok(out) = output {
            stdout_res = String::from_utf8_lossy(&out.stdout).to_string();
            stderr_res = String::from_utf8_lossy(&out.stderr).to_string();
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        let duration = (end_time - start_time) as u64;

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s01".into(),
            handler_id: "m01.system.discover".into(),
            status: "completed".into(),
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some(duration),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some(stdout_res),
            stderr: if stderr_res.is_empty() { None } else { Some(stderr_res) },
            summary_en: "System discovery process executed.".into(),
            summary_ar: "تم تنفيذ عملية اكتشاف النظام.".into(),
            warnings: vec![],
            error_code: None,
            data: Some(SystemDiscoveryData {
                computer_name: std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Unknown".into()),
                os_product_name: "Discovered via CMD".into(),
                os_edition: "Unknown".into(),
                build_number: "Unknown".into(),
                architecture: std::env::var("PROCESSOR_ARCHITECTURE").unwrap_or_else(|_| "Unknown".into()),
                total_ram_gb: 0.0,
                cpu_model: std::env::var("PROCESSOR_IDENTIFIER").unwrap_or_else(|_| "Unknown".into()),
                active_user: std::env::var("USERNAME").unwrap_or_else(|_| "Unknown".into()),
                secure_boot_enabled: false,
                tpm_available: false,
            }),
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s01".into(),
            handler_id: "m01.system.discover".into(),
            status: "unavailable".into(),
            started_at: "".into(),
            completed_at: None,
            duration_ms: None,
            requires_restart: false,
            exit_code: None,
            stdout: None,
            stderr: Some("Windows native API requires Windows host OS.".into()),
            summary_en: "Desktop runtime unavailable.".into(),
            summary_ar: "فحص بيئة ويندوز المحلية غير متاح.".into(),
            warnings: vec![],
            error_code: Some("unsupported_os".into()),
            data: None,
        })
    }
}
