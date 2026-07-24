use crate::contracts::OperationResult;
use chrono::Utc;
use std::{collections::HashSet, process::Command, time::Instant};

fn allowed_package_ids() -> HashSet<&'static str> {
    [
        "Google.Chrome", "Mozilla.Firefox", "Brave.Brave", "7zip.7zip",
        "Microsoft.PowerToys", "voidtools.Everything", "Notepad++.Notepad++",
        "Telegram.TelegramDesktop", "WhatsApp.WhatsApp", "Discord.Discord",
        "VideoLAN.VLC", "Spotify.Spotify", "Microsoft.VisualStudioCode",
        "Git.Git", "OpenJS.NodeJS.LTS", "Python.Python.3.12",
        "Microsoft.WindowsTerminal", "Figma.Figma",
    ]
    .into_iter()
    .collect()
}

#[tauri::command]
pub fn m01_winget_verify(op_id: String) -> Result<OperationResult<String>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(target_os = "windows")]
    {
        let resolved = Command::new("where.exe")
            .arg("winget.exe")
            .output()
            .map_err(|error| format!("winget_resolve_failed: {error}"))?;
        let resolved_path = String::from_utf8_lossy(&resolved.stdout)
            .lines()
            .next()
            .unwrap_or_default()
            .trim()
            .to_string();
        if !resolved.status.success() || resolved_path.is_empty() {
            return Ok(OperationResult {
                operation_id: op_id,
                capability_id: "m01_s02".into(),
                handler_id: "m01.winget.verify".into(),
                status: "failed".into(),
                started_at,
                completed_at: Some(Utc::now().to_rfc3339()),
                duration_ms: Some(timer.elapsed().as_millis() as u64),
                requires_restart: false,
                exit_code: resolved.status.code(),
                stdout: None,
                stderr: Some(String::from_utf8_lossy(&resolved.stderr).into_owned()),
                summary_en: "Winget executable was not found.".into(),
                summary_ar: "لم يتم العثور على ملف Winget التنفيذي.".into(),
                warnings: Vec::new(),
                error_code: Some("winget_not_found".into()),
                data: None,
            });
        }

        let output = Command::new(&resolved_path)
            .arg("--version")
            .output()
            .map_err(|error| format!("winget_version_failed: {error}"))?;
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let success = output.status.success() && !version.is_empty();
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s02".into(),
            handler_id: "m01.winget.verify".into(),
            status: if success { "completed" } else { "failed" }.into(),
            started_at,
            completed_at: Some(Utc::now().to_rfc3339()),
            duration_ms: Some(timer.elapsed().as_millis() as u64),
            requires_restart: false,
            exit_code: output.status.code(),
            stdout: Some(format!("path={resolved_path}\nversion={version}")),
            stderr: if stderr.is_empty() { None } else { Some(stderr) },
            summary_en: if success { format!("Winget {version} verified at {resolved_path}.") } else { "Winget version verification failed.".into() },
            summary_ar: if success { format!("تم التحقق من Winget {version} في {resolved_path}.") } else { "فشل التحقق من إصدار Winget.".into() },
            warnings: Vec::new(),
            error_code: if success { None } else { Some("winget_version_failed".into()) },
            data: if success { Some(version) } else { None },
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s02".into(),
            handler_id: "m01.winget.verify".into(),
            status: "unavailable".into(),
            started_at,
            completed_at: Some(Utc::now().to_rfc3339()),
            duration_ms: Some(timer.elapsed().as_millis() as u64),
            requires_restart: false,
            exit_code: None,
            stdout: None,
            stderr: Some("Windows host is required.".into()),
            summary_en: "Winget is available only on Windows.".into(),
            summary_ar: "Winget متاح على ويندوز فقط.".into(),
            warnings: Vec::new(),
            error_code: Some("unsupported_os".into()),
            data: None,
        })
    }
}

#[tauri::command]
pub fn m01_winget_install(
    op_id: String,
    package_id: String,
) -> Result<OperationResult<String>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    if !allowed_package_ids().contains(package_id.as_str()) {
        return Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s05".into(),
            handler_id: "m01.winget.install".into(),
            status: "failed".into(),
            started_at,
            completed_at: Some(Utc::now().to_rfc3339()),
            duration_ms: Some(timer.elapsed().as_millis() as u64),
            requires_restart: false,
            exit_code: Some(1),
            stdout: None,
            stderr: Some(format!("Package is not allowlisted: {package_id}")),
            summary_en: "Installation was blocked because the package ID is not in the curated manifest.".into(),
            summary_ar: "تم منع التثبيت لأن معرف الحزمة غير موجود في القائمة المعتمدة.".into(),
            warnings: Vec::new(),
            error_code: Some("package_not_allowlisted".into()),
            data: None,
        });
    }

    #[cfg(target_os = "windows")]
    {
        let install = Command::new("winget.exe")
            .args([
                "install", "--id", &package_id, "--exact", "--silent",
                "--disable-interactivity", "--accept-package-agreements",
                "--accept-source-agreements",
            ])
            .output()
            .map_err(|error| format!("winget_install_launch_failed: {error}"))?;
        let install_stdout = String::from_utf8_lossy(&install.stdout).into_owned();
        let install_stderr = String::from_utf8_lossy(&install.stderr).into_owned();
        if !install.status.success() {
            return Ok(OperationResult {
                operation_id: op_id,
                capability_id: "m01_s05".into(),
                handler_id: "m01.winget.install".into(),
                status: "failed".into(),
                started_at,
                completed_at: Some(Utc::now().to_rfc3339()),
                duration_ms: Some(timer.elapsed().as_millis() as u64),
                requires_restart: false,
                exit_code: install.status.code(),
                stdout: Some(install_stdout),
                stderr: Some(install_stderr),
                summary_en: format!("Winget failed to install {package_id}."),
                summary_ar: format!("فشل Winget في تثبيت {package_id}."),
                warnings: Vec::new(),
                error_code: Some("winget_install_failed".into()),
                data: None,
            });
        }

        let verify = Command::new("winget.exe")
            .args([
                "list", "--id", &package_id, "--exact",
                "--disable-interactivity", "--accept-source-agreements",
            ])
            .output()
            .map_err(|error| format!("winget_post_verify_launch_failed: {error}"))?;
        let verify_stdout = String::from_utf8_lossy(&verify.stdout).into_owned();
        let verified = verify.status.success()
            && verify_stdout.to_lowercase().contains(&package_id.to_lowercase());
        let mut warnings = Vec::new();
        if !verified {
            warnings.push("Winget exited successfully, but post-install verification was inconclusive.".into());
        }

        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s05".into(),
            handler_id: "m01.winget.install".into(),
            status: if verified { "completed" } else { "completed_with_warnings" }.into(),
            started_at,
            completed_at: Some(Utc::now().to_rfc3339()),
            duration_ms: Some(timer.elapsed().as_millis() as u64),
            requires_restart: install_stdout.to_lowercase().contains("restart"),
            exit_code: install.status.code(),
            stdout: Some(format!("{install_stdout}\n--- post verification ---\n{verify_stdout}")),
            stderr: if install_stderr.trim().is_empty() { None } else { Some(install_stderr) },
            summary_en: if verified { format!("{package_id} was installed and verified.") } else { format!("{package_id} installation completed, but verification requires review.") },
            summary_ar: if verified { format!("تم تثبيت {package_id} والتحقق منه.") } else { format!("اكتمل تثبيت {package_id} لكن نتيجة التحقق تحتاج إلى مراجعة.") },
            warnings,
            error_code: if verified { None } else { Some("post_install_verification_inconclusive".into()) },
            data: Some(package_id),
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(OperationResult {
            operation_id: op_id,
            capability_id: "m01_s05".into(),
            handler_id: "m01.winget.install".into(),
            status: "unavailable".into(),
            started_at,
            completed_at: Some(Utc::now().to_rfc3339()),
            duration_ms: Some(timer.elapsed().as_millis() as u64),
            requires_restart: false,
            exit_code: None,
            stdout: None,
            stderr: Some("Windows host is required.".into()),
            summary_en: "Winget installation is available only on Windows.".into(),
            summary_ar: "تثبيت Winget متاح على ويندوز فقط.".into(),
            warnings: Vec::new(),
            error_code: Some("unsupported_os".into()),
            data: None,
        })
    }
}
