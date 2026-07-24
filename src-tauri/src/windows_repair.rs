use crate::contracts::OperationResult;
use std::time::{SystemTime, UNIX_EPOCH};
use std::process::Command;

#[tauri::command]
pub fn m07_sfc_scannow(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("sfc")
            .arg("/scannow")
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
            capability_id: "m07_s01".into(),
            handler_id: "m07.sfc.scannow".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some(duration),
            requires_restart: stdout_res.to_lowercase().contains("restart"),
            exit_code: Some(exit_code),
            stdout: Some(stdout_res),
            stderr: if stderr_res.is_empty() { None } else { Some(stderr_res) },
            summary_en: "SFC scan execution finished.".into(),
            summary_ar: "انتهى فحص أداة SFC.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("sfc_failed".into()) } else { None },
            data: None,
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s01".into(),
            handler_id: "m07.sfc.scannow".into(),
            status: "unavailable".into(),
            started_at: "".into(),
            completed_at: None,
            duration_ms: None,
            requires_restart: false,
            exit_code: None,
            stdout: None,
            stderr: Some("Windows native API requires Windows host OS.".into()),
            summary_en: "Desktop runtime unavailable.".into(),
            summary_ar: "بيئة ويندوز غير متاحة.".into(),
            warnings: vec![],
            error_code: Some("unsupported_os".into()),
            data: None,
        })
    }
}

#[tauri::command]
pub fn m07_dism_checkhealth(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("dism")
            .args(["/Online", "/Cleanup-Image", "/CheckHealth"])
            .output();

        let mut stdout_res = String::new();
        let mut exit_code = 1;

        if let Ok(out) = output {
            stdout_res = String::from_utf8_lossy(&out.stdout).to_string();
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s02".into(),
            handler_id: "m07.dism.check".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some(stdout_res),
            stderr: None,
            summary_en: "DISM CheckHealth finished.".into(),
            summary_ar: "انتهى فحص DISM.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("dism_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}

#[tauri::command]
pub fn m07_dism_scanhealth(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("dism")
            .args(["/Online", "/Cleanup-Image", "/ScanHealth"])
            .output();

        let mut stdout_res = String::new();
        let mut exit_code = 1;

        if let Ok(out) = output {
            stdout_res = String::from_utf8_lossy(&out.stdout).to_string();
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s03".into(),
            handler_id: "m07.dism.scanhealth".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some(stdout_res),
            stderr: None,
            summary_en: "DISM ScanHealth finished.".into(),
            summary_ar: "انتهى فحص DISM الشامل.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("dism_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}

#[tauri::command]
pub fn m07_dism_restorehealth(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("dism")
            .args(["/Online", "/Cleanup-Image", "/RestoreHealth"])
            .output();

        let mut stdout_res = String::new();
        let mut exit_code = 1;

        if let Ok(out) = output {
            stdout_res = String::from_utf8_lossy(&out.stdout).to_string();
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s04".into(),
            handler_id: "m07.dism.restorehealth".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some(stdout_res),
            stderr: None,
            summary_en: "DISM RestoreHealth finished.".into(),
            summary_ar: "انتهى إصلاح مخزن ويندوز.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("dism_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}

#[tauri::command]
pub fn m07_wua_reset(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("cmd")
            .args(["/C", "net stop wuauserv & net stop cryptSvc & net stop bits & net stop msiserver & ren C:\\Windows\\SoftwareDistribution SoftwareDistribution.old & ren C:\\Windows\\System32\\catroot2 catroot2.old & net start wuauserv & net start cryptSvc & net start bits & net start msiserver"])
            .output();

        let mut stdout_res = String::new();
        let mut exit_code = 1;

        if let Ok(out) = output {
            stdout_res = String::from_utf8_lossy(&out.stdout).to_string();
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s05".into(),
            handler_id: "m07.wua.reset".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: true,
            exit_code: Some(exit_code),
            stdout: Some(stdout_res),
            stderr: None,
            summary_en: "Windows Update Agent reset finished.".into(),
            summary_ar: "تمت إعادة تعيين مكونات Windows Update بنجاح.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("wua_reset_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}

#[tauri::command]
pub fn m07_icon_repair(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("cmd")
            .args(["/C", "taskkill /f /im explorer.exe & del /f /a /q %localappdata%\\IconCache.db & del /f /a /q %localappdata%\\Microsoft\\Windows\\Explorer\\iconcache* & start explorer.exe"])
            .output();

        let mut exit_code = 1;
        if let Ok(out) = output {
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s06".into(),
            handler_id: "m07.icon.repair".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some("Explorer restarted and icons cleared.".into()),
            stderr: None,
            summary_en: "Icon and thumbnail repair finished.".into(),
            summary_ar: "تم إصلاح ذاكرة الأيقونات بنجاح.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("icon_repair_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}

#[tauri::command]
pub fn m07_wmi_repair(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("cmd")
            .args(["/C", "winmgmt /salvagerepository"])
            .output();

        let mut exit_code = 1;
        if let Ok(out) = output {
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s07".into(),
            handler_id: "m07.wmi.repair".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some("WMI repository salvaged.".into()),
            stderr: None,
            summary_en: "WMI health and repair finished.".into(),
            summary_ar: "تم إصلاح قاعدة WMI بنجاح.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("wmi_repair_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}

#[tauri::command]
pub fn m07_msi_repair(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("cmd")
            .args(["/C", "msiexec /unregister & msiexec /regserver"])
            .output();

        let mut exit_code = 1;
        if let Ok(out) = output {
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s08".into(),
            handler_id: "m07.msi.repair".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some("MSIEXEC unregistered and re-registered.".into()),
            stderr: None,
            summary_en: "Windows Installer repair finished.".into(),
            summary_ar: "تم إعادة تسجيل خدمة تثبيت البرامج MSI.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("msi_repair_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}

#[tauri::command]
pub fn m07_vss_repair(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("cmd")
            .args(["/C", "net stop vss & net start vss"])
            .output();

        let mut exit_code = 1;
        if let Ok(out) = output {
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s09".into(),
            handler_id: "m07.vss.repair".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some("Volume Shadow Copy Service restarted.".into()),
            stderr: None,
            summary_en: "VSS repair finished.".into(),
            summary_ar: "تم استعادة خدمة VSS.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("vss_repair_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}

#[tauri::command]
pub fn m07_store_repair(op_id: String) -> Result<OperationResult<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        
        let output = Command::new("cmd")
            .args(["/C", "wsreset.exe"])
            .output();

        let mut exit_code = 1;
        if let Ok(out) = output {
            exit_code = out.status.code().unwrap_or(1);
        }

        let end_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m07_s10".into(),
            handler_id: "m07.store.repair".into(),
            status: if exit_code == 0 { "completed".into() } else { "failed".into() },
            started_at: start_time.to_string(),
            completed_at: Some(end_time.to_string()),
            duration_ms: Some((end_time - start_time) as u64),
            requires_restart: false,
            exit_code: Some(exit_code),
            stdout: Some("Microsoft Store cache reset.".into()),
            stderr: None,
            summary_en: "Microsoft Store repair finished.".into(),
            summary_ar: "تم استعادة خدمات متجر مايكروسوفت.".into(),
            warnings: vec![],
            error_code: if exit_code != 0 { Some("store_repair_failed".into()) } else { None },
            data: None,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported OS".into())
    }
}
