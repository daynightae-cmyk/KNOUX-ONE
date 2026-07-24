use crate::contracts::OperationResult;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub fn m01_winget_verify(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("winget")
            .args(["--version"])
            .output();

        let mut stdout_res = String::new();
        let mut stderr_res = String::new();
        let mut exit_code = 1;

        if let Ok(out) = output {
            stdout_res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            stderr_res = String::from_utf8_lossy(&out.stderr).to_string();
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        let duration = (end_time - start_time) as u64;

        if exit_code == 0 {
            Ok(OperationResult {
                operation_id: op_id,
                capability_id: "m01_s02".into(),
                handler_id: "m01.winget.verify".into(),
                status: "completed".into(),
                started_at: start_time.to_string(),
                completed_at: Some(end_time.to_string()),
                duration_ms: Some(duration),
                requires_restart: false,
                exit_code: Some(exit_code),
                stdout: Some(stdout_res.clone()),
                stderr: if stderr_res.is_empty() { None } else { Some(stderr_res) },
                summary_en: format!("Winget is available (version: {})", stdout_res),
                summary_ar: format!("أداة Winget متوفرة (إصدار: {})", stdout_res),
                warnings: vec![],
                error_code: None,
                data: Some(stdout_res),
            })
        } else {
            Ok(OperationResult {
                operation_id: op_id,
                capability_id: "m01_s02".into(),
                handler_id: "m01.winget.verify".into(),
                status: "failed".into(),
                started_at: start_time.to_string(),
                completed_at: Some(end_time.to_string()),
                duration_ms: Some(duration),
                requires_restart: false,
                exit_code: Some(exit_code),
                stdout: Some(stdout_res),
                stderr: Some(stderr_res.clone()),
                summary_en: "Winget verification failed. Ensure App Installer is installed.".into(),
                summary_ar: "فشل التحقق من Winget. تأكد من تثبيت App Installer.".into(),
                warnings: vec![],
                error_code: Some("winget_not_found".into()),
                data: None,
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s02".into(),
            handler_id: "m01.winget.verify".into(),
            status: "unavailable".into(),
            started_at: "".into(),
            completed_at: None,
            duration_ms: None,
            requires_restart: false,
            exit_code: None,
            stdout: None,
            stderr: Some("Winget requires Windows OS.".into()),
            summary_en: "Desktop runtime unavailable.".into(),
            summary_ar: "بيئة سطح المكتب غير متاحة.".into(),
            warnings: vec![],
            error_code: Some("unsupported_os".into()),
            data: None,
        })
    }
}

#[tauri::command]
pub fn m01_winget_install(op_id: String, package_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("winget")
            .args(["install", "--id", &package_id, "--exact", "--accept-package-agreements", "--accept-source-agreements"])
            .output();

        let mut stdout_res = String::new();
        let mut stderr_res = String::new();
        let mut exit_code = 1;

        if let Ok(out) = output {
            stdout_res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            stderr_res = String::from_utf8_lossy(&out.stderr).to_string();
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        let duration = (end_time - start_time) as u64;

        if exit_code == 0 {
            Ok(OperationResult {
                operation_id: op_id,
                capability_id: "m01_s05".into(),
                handler_id: "m01.winget.install".into(),
                status: "completed".into(),
                started_at: start_time.to_string(),
                completed_at: Some(end_time.to_string()),
                duration_ms: Some(duration),
                requires_restart: stdout_res.to_lowercase().contains("restart"),
                exit_code: Some(exit_code),
                stdout: Some(stdout_res),
                stderr: if stderr_res.is_empty() { None } else { Some(stderr_res) },
                summary_en: format!("Successfully installed {}", package_id),
                summary_ar: format!("تم تثبيت {} بنجاح", package_id),
                warnings: vec![],
                error_code: None,
                data: None,
            })
        } else {
            Ok(OperationResult {
                operation_id: op_id,
                capability_id: "m01_s05".into(),
                handler_id: "m01.winget.install".into(),
                status: "failed".into(),
                started_at: start_time.to_string(),
                completed_at: Some(end_time.to_string()),
                duration_ms: Some(duration),
                requires_restart: false,
                exit_code: Some(exit_code),
                stdout: Some(stdout_res),
                stderr: Some(stderr_res),
                summary_en: format!("Failed to install {}", package_id),
                summary_ar: format!("فشل تثبيت {}", package_id),
                warnings: vec![],
                error_code: Some("winget_install_failed".into()),
                data: None,
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s05".into(),
            handler_id: "m01.winget.install".into(),
            status: "unavailable".into(),
            started_at: "".into(),
            completed_at: None,
            duration_ms: None,
            requires_restart: false,
            exit_code: None,
            stdout: None,
            stderr: Some("Winget requires Windows OS.".into()),
            summary_en: "Desktop runtime unavailable.".into(),
            summary_ar: "بيئة سطح المكتب غير متاحة.".into(),
            warnings: vec![],
            error_code: Some("unsupported_os".into()),
            data: None,
        })
    }
}
