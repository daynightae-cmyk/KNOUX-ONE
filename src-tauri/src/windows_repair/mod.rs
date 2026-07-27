use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairRequest {
    pub action: String,
    pub confirmation: Option<String>,
    pub target_id: Option<String>,
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
pub struct RepairArtifact {
    pub path: String,
    pub size_bytes: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBackup {
    pub id: String,
    pub software_distribution_backup: Option<String>,
    pub catroot2_backup: Option<String>,
    pub created_at: String,
    pub restored_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairReport {
    pub service: String,
    pub action: String,
    pub elevated: bool,
    pub requires_restart: bool,
    pub commands: Vec<CommandEvidence>,
    pub artifacts: Vec<RepairArtifact>,
    pub update_backups: Vec<UpdateBackup>,
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
        .join("windows-repair");
    fs::create_dir_all(&path).map_err(|error| format!("app_data_create_failed:{error}"))?;
    Ok(path)
}

fn load_json<T: DeserializeOwned + Default>(path: &Path) -> Result<T, String> {
    if !path.exists() {
        return Ok(T::default());
    }
    let bytes = fs::read(path).map_err(|error| format!("read_failed:{}:{error}", path.display()))?;
    serde_json::from_slice(&bytes).map_err(|error| format!("json_invalid:{}:{error}", path.display()))
}

fn save_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("directory_create_failed:{error}"))?;
    }
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| format!("json_encode_failed:{error}"))?;
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

fn evidence_path(app: &AppHandle, operation_id: &str) -> Result<PathBuf, String> {
    let path = app_root(app)?.join("evidence");
    fs::create_dir_all(&path).map_err(|error| format!("evidence_directory_failed:{error}"))?;
    Ok(path.join(format!("{operation_id}.json")))
}

fn persist_evidence(app: &AppHandle, operation_id: &str, report: &RepairReport) -> Result<String, String> {
    let path = evidence_path(app, operation_id)?;
    save_json(&path, report)?;
    Ok(path.to_string_lossy().to_string())
}

fn update_history_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("windows-update-backups.json"))
}

fn update_history(app: &AppHandle) -> Result<Vec<UpdateBackup>, String> {
    load_json(&update_history_path(app)?)
}

fn save_update_history(app: &AppHandle, history: &[UpdateBackup]) -> Result<(), String> {
    save_json(&update_history_path(app)?, history)
}

fn report_result(
    app: &AppHandle,
    operation_id: String,
    capability_id: &str,
    handler_id: &str,
    started_at: String,
    timer: Instant,
    mut report: RepairReport,
    critical_failure: Option<String>,
    mut warnings: Vec<String>,
    summary_en: &str,
    summary_ar: &str,
) -> OperationResult<RepairReport> {
    match persist_evidence(app, &operation_id, &report) {
        Ok(path) => report.evidence_path = Some(path),
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
        requires_restart: report.requires_restart,
        exit_code: if failed { Some(1) } else { Some(0) },
        stdout: None,
        stderr: critical_failure.clone(),
        summary_en: if let Some(error) = &critical_failure {
            format!("{summary_en}: {error}")
        } else {
            summary_en.into()
        },
        summary_ar: if let Some(error) = &critical_failure {
            format!("{summary_ar}: {error}")
        } else {
            summary_ar.into()
        },
        warnings,
        error_code: critical_failure.map(|_| "repair_step_failed".into()),
        data: Some(report),
    }
}

fn execute_steps(
    app: &AppHandle,
    capability_id: &str,
    handler_id: &str,
    service: &str,
    action: &str,
    requires_admin: bool,
    requires_restart: bool,
    steps: Vec<Step>,
    artifacts: Vec<RepairArtifact>,
    update_backups: Vec<UpdateBackup>,
    notes: Vec<String>,
    summary_en: &str,
    summary_ar: &str,
) -> OperationResult<RepairReport> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let elevated = is_elevated();
    if requires_admin && !elevated {
        let report = RepairReport {
            service: service.into(),
            action: action.into(),
            elevated,
            requires_restart,
            commands: Vec::new(),
            artifacts,
            update_backups,
            notes,
            evidence_path: None,
            measured_at: Utc::now().to_rfc3339(),
        };
        return report_result(
            app,
            operation_id,
            capability_id,
            handler_id,
            started_at,
            timer,
            report,
            Some("administrator_required".into()),
            Vec::new(),
            summary_en,
            summary_ar,
        );
    }

    let mut commands = Vec::new();
    let mut warnings = Vec::new();
    let mut critical_failure = None;
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

    let report = RepairReport {
        service: service.into(),
        action: action.into(),
        elevated,
        requires_restart,
        commands,
        artifacts,
        update_backups,
        notes,
        evidence_path: None,
        measured_at: Utc::now().to_rfc3339(),
    };
    report_result(
        app,
        operation_id,
        capability_id,
        handler_id,
        started_at,
        timer,
        report,
        critical_failure,
        warnings,
        summary_en,
        summary_ar,
    )
}

fn confirmation(request: &RepairRequest, expected: &str) -> Result<(), String> {
    if request.confirmation.as_deref() == Some(expected) {
        Ok(())
    } else {
        Err(format!("typed_confirmation_required:{expected}"))
    }
}

fn invalid_action<T>(
    app: &AppHandle,
    capability_id: &str,
    handler_id: &str,
    service: &str,
    action: &str,
) -> OperationResult<T> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: "failed".into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(0),
        requires_restart: false,
        exit_code: Some(1),
        stdout: None,
        stderr: Some(format!("unsupported_action:{service}:{action}")),
        summary_en: format!("Unsupported {service} action: {action}"),
        summary_ar: format!("إجراء غير مدعوم في {service}: {action}"),
        warnings: Vec::new(),
        error_code: Some("unsupported_action".into()),
        data: None,
    }
}

fn confirmation_failure(
    app: &AppHandle,
    capability_id: &str,
    handler_id: &str,
    service: &str,
    action: &str,
    error: String,
) -> OperationResult<RepairReport> {
    execute_steps(
        app,
        capability_id,
        handler_id,
        service,
        action,
        false,
        false,
        Vec::new(),
        Vec::new(),
        Vec::new(),
        vec![error.clone()],
        &error,
        &format!("التأكيد المكتوب غير صحيح: {error}"),
    )
}

#[tauri::command]
pub fn m07_sfc_manage(app: AppHandle, request: RepairRequest) -> OperationResult<RepairReport> {
    let (args, action) = match request.action.as_str() {
        "verify" => (vec!["/verifyonly"], "verify"),
        "repair" => {
            if let Err(error) = confirmation(&request, "RUN SFC REPAIR") {
                return confirmation_failure(&app, "m07_s01", "m07.sfc.manage", "sfc", "repair", error);
            }
            (vec!["/scannow"], "repair")
        }
        other => return invalid_action(&app, "m07_s01", "m07.sfc.manage", "sfc", other),
    };
    execute_steps(
        &app,
        "m07_s01",
        "m07.sfc.manage",
        "sfc",
        action,
        true,
        false,
        vec![Step::new("sfc.exe", &args, true)],
        Vec::new(),
        Vec::new(),
        vec!["Official Windows System File Checker output is preserved without language-dependent result fabrication.".into()],
        "SFC operation completed with native Windows evidence",
        "اكتملت عملية SFC مع حفظ أدلة ويندوز الأصلية",
    )
}

#[tauri::command]
pub fn m07_dism_check_health(app: AppHandle) -> OperationResult<RepairReport> {
    execute_steps(
        &app,
        "m07_s02",
        "m07.dism.check_health",
        "dism_check_health",
        "inspect",
        true,
        false,
        vec![Step::new(
            "dism.exe",
            &["/Online", "/Cleanup-Image", "/CheckHealth", "/English"],
            true,
        )],
        Vec::new(),
        Vec::new(),
        Vec::new(),
        "DISM CheckHealth completed",
        "اكتمل فحص DISM CheckHealth",
    )
}

#[tauri::command]
pub fn m07_dism_scan_health(app: AppHandle) -> OperationResult<RepairReport> {
    execute_steps(
        &app,
        "m07_s03",
        "m07.dism.scan_health",
        "dism_scan_health",
        "scan",
        true,
        false,
        vec![Step::new(
            "dism.exe",
            &["/Online", "/Cleanup-Image", "/ScanHealth", "/English"],
            true,
        )],
        Vec::new(),
        Vec::new(),
        Vec::new(),
        "DISM ScanHealth completed",
        "اكتمل فحص DISM ScanHealth",
    )
}

#[tauri::command]
pub fn m07_dism_restore_health(
    app: AppHandle,
    request: RepairRequest,
) -> OperationResult<RepairReport> {
    if request.action != "repair" {
        return invalid_action(
            &app,
            "m07_s04",
            "m07.dism.restore_health",
            "dism_restore_health",
            &request.action,
        );
    }
    if let Err(error) = confirmation(&request, "RUN DISM RESTOREHEALTH") {
        return confirmation_failure(
            &app,
            "m07_s04",
            "m07.dism.restore_health",
            "dism_restore_health",
            "repair",
            error,
        );
    }
    execute_steps(
        &app,
        "m07_s04",
        "m07.dism.restore_health",
        "dism_restore_health",
        "repair",
        true,
        false,
        vec![Step::new(
            "dism.exe",
            &[
                "/Online",
                "/Cleanup-Image",
                "/RestoreHealth",
                "/NoRestart",
                "/English",
            ],
            true,
        )],
        Vec::new(),
        Vec::new(),
        vec!["The default official Windows repair source is used; no unverified image source is injected.".into()],
        "DISM RestoreHealth completed",
        "اكتمل إصلاح DISM RestoreHealth",
    )
}

fn update_diagnose_script() -> String {
    r#"
$ErrorActionPreference='Stop'
$services=@('wuauserv','bits','cryptsvc','msiserver') | ForEach-Object {
  $s=Get-Service -Name $_ -ErrorAction SilentlyContinue
  if($null -ne $s){[pscustomobject]@{name=$s.Name;status=[string]$s.Status;startType=[string]$s.StartType}}
}
$windir=$env:WINDIR
[pscustomobject]@{
  services=@($services)
  softwareDistributionExists=(Test-Path (Join-Path $windir 'SoftwareDistribution'))
  catroot2Exists=(Test-Path (Join-Path $windir 'System32\catroot2'))
  measuredAt=(Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 5 -Compress
"#
    .into()
}

#[tauri::command]
pub fn m07_windows_update_manage(
    app: AppHandle,
    request: RepairRequest,
) -> OperationResult<RepairReport> {
    match request.action.as_str() {
        "inspect" => execute_steps(
            &app,
            "m07_s05",
            "m07.update.manage",
            "windows_update",
            "inspect",
            true,
            false,
            vec![powershell_step(update_diagnose_script(), true)],
            Vec::new(),
            update_history(&app).unwrap_or_default(),
            Vec::new(),
            "Windows Update components inspected",
            "تم فحص مكونات Windows Update",
        ),
        "reset" => {
            if let Err(error) = confirmation(&request, "RESET WINDOWS UPDATE") {
                return confirmation_failure(
                    &app,
                    "m07_s05",
                    "m07.update.manage",
                    "windows_update",
                    "reset",
                    error,
                );
            }
            let elevated = is_elevated();
            if !elevated {
                return execute_steps(
                    &app,
                    "m07_s05",
                    "m07.update.manage",
                    "windows_update",
                    "reset",
                    true,
                    true,
                    Vec::new(),
                    Vec::new(),
                    update_history(&app).unwrap_or_default(),
                    Vec::new(),
                    "Windows Update reset requires administrator access",
                    "إعادة ضبط Windows Update تحتاج صلاحيات المسؤول",
                );
            }
            let windir = env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
            let id = Uuid::new_v4().to_string();
            let software = PathBuf::from(&windir).join("SoftwareDistribution");
            let catroot2 = PathBuf::from(&windir).join("System32").join("catroot2");
            let software_backup = software.with_file_name(format!("SoftwareDistribution.knoux-{id}"));
            let catroot_backup = catroot2.with_file_name(format!("catroot2.knoux-{id}"));
            let script = format!(
                "$ErrorActionPreference='Stop'; $names=@('bits','wuauserv','cryptsvc','msiserver'); foreach($n in $names){{Stop-Service -Name $n -Force -ErrorAction SilentlyContinue}}; if(Test-Path {software}){{Rename-Item -LiteralPath {software} -NewName {software_name}}}; if(Test-Path {catroot}){{Rename-Item -LiteralPath {catroot} -NewName {catroot_name}}}; foreach($n in @('cryptsvc','bits','wuauserv')){{Start-Service -Name $n -ErrorAction SilentlyContinue}}",
                software = ps_quote(&software.to_string_lossy()),
                software_name = ps_quote(software_backup.file_name().unwrap_or_default().to_string_lossy().as_ref()),
                catroot = ps_quote(&catroot2.to_string_lossy()),
                catroot_name = ps_quote(catroot_backup.file_name().unwrap_or_default().to_string_lossy().as_ref()),
            );
            let step = powershell_step(script, true);
            let evidence = run_step(&step);
            let mut history = update_history(&app).unwrap_or_default();
            if evidence.success {
                history.push(UpdateBackup {
                    id,
                    software_distribution_backup: software_backup.exists().then(|| software_backup.to_string_lossy().to_string()),
                    catroot2_backup: catroot_backup.exists().then(|| catroot_backup.to_string_lossy().to_string()),
                    created_at: Utc::now().to_rfc3339(),
                    restored_at: None,
                });
                let _ = save_update_history(&app, &history);
            }
            execute_steps(
                &app,
                "m07_s05",
                "m07.update.manage",
                "windows_update",
                "reset",
                true,
                true,
                vec![Step::owned(&evidence.program, evidence.arguments.clone(), true)],
                Vec::new(),
                history,
                vec!["SoftwareDistribution and catroot2 are renamed to unique KNOUX backup paths instead of being permanently deleted.".into()],
                "Windows Update reset completed with reversible backups",
                "اكتملت إعادة ضبط Windows Update مع نسخ احتياطية قابلة للاستعادة",
            )
        }
        "restore" => {
            if let Err(error) = confirmation(&request, "RESTORE WINDOWS UPDATE") {
                return confirmation_failure(
                    &app,
                    "m07_s05",
                    "m07.update.manage",
                    "windows_update",
                    "restore",
                    error,
                );
            }
            let mut history = update_history(&app).unwrap_or_default();
            let selected = if let Some(target) = request.target_id.as_deref() {
                history.iter().position(|item| item.id == target && item.restored_at.is_none())
            } else {
                history.iter().rposition(|item| item.restored_at.is_none())
            };
            let Some(index) = selected else {
                return invalid_action(
                    &app,
                    "m07_s05",
                    "m07.update.manage",
                    "windows_update",
                    "restore_without_backup",
                );
            };
            let windir = env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
            let software = PathBuf::from(&windir).join("SoftwareDistribution");
            let catroot2 = PathBuf::from(&windir).join("System32").join("catroot2");
            let current_id = Uuid::new_v4().to_string();
            let software_current = software.with_file_name(format!("SoftwareDistribution.post-reset-{current_id}"));
            let catroot_current = catroot2.with_file_name(format!("catroot2.post-reset-{current_id}"));
            let backup = history[index].clone();
            let mut restore_lines = vec![
                "$ErrorActionPreference='Stop'".to_string(),
                "$names=@('bits','wuauserv','cryptsvc','msiserver'); foreach($n in $names){Stop-Service -Name $n -Force -ErrorAction SilentlyContinue}".to_string(),
            ];
            if let Some(path) = &backup.software_distribution_backup {
                restore_lines.push(format!("if(Test-Path {original}){{Rename-Item -LiteralPath {original} -NewName {current_name}}}; if(Test-Path {backup}){{Rename-Item -LiteralPath {backup} -NewName 'SoftwareDistribution'}}", original=ps_quote(&software.to_string_lossy()), current_name=ps_quote(software_current.file_name().unwrap_or_default().to_string_lossy().as_ref()), backup=ps_quote(path)));
            }
            if let Some(path) = &backup.catroot2_backup {
                restore_lines.push(format!("if(Test-Path {original}){{Rename-Item -LiteralPath {original} -NewName {current_name}}}; if(Test-Path {backup}){{Rename-Item -LiteralPath {backup} -NewName 'catroot2'}}", original=ps_quote(&catroot2.to_string_lossy()), current_name=ps_quote(catroot_current.file_name().unwrap_or_default().to_string_lossy().as_ref()), backup=ps_quote(path)));
            }
            restore_lines.push("foreach($n in @('cryptsvc','bits','wuauserv')){Start-Service -Name $n -ErrorAction SilentlyContinue}".into());
            let result = execute_steps(
                &app,
                "m07_s05",
                "m07.update.manage",
                "windows_update",
                "restore",
                true,
                true,
                vec![powershell_step(restore_lines.join("; "), true)],
                Vec::new(),
                history.clone(),
                vec!["Newly recreated update folders are moved aside before the selected KNOUX backup is restored.".into()],
                "Windows Update backup restoration completed",
                "اكتملت استعادة النسخة الاحتياطية لمكونات Windows Update",
            );
            if result.status != "failed" {
                history[index].restored_at = Some(Utc::now().to_rfc3339());
                let _ = save_update_history(&app, &history);
            }
            result
        }
        other => invalid_action(&app, "m07_s05", "m07.update.manage", "windows_update", other),
    }
}

fn cache_files() -> Vec<RepairArtifact> {
    let local = env::var("LOCALAPPDATA").unwrap_or_default();
    let mut files = Vec::new();
    let direct = PathBuf::from(&local).join("IconCache.db");
    if direct.is_file() {
        files.push(RepairArtifact {
            path: direct.to_string_lossy().to_string(),
            size_bytes: direct.metadata().map(|item| item.len()).unwrap_or(0),
            status: "found".into(),
        });
    }
    let explorer = PathBuf::from(local).join("Microsoft").join("Windows").join("Explorer");
    if let Ok(entries) = fs::read_dir(explorer) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|item| item.to_str()).unwrap_or_default().to_ascii_lowercase();
            if path.is_file() && (name.starts_with("iconcache_") || name.starts_with("thumbcache_")) {
                files.push(RepairArtifact {
                    path: path.to_string_lossy().to_string(),
                    size_bytes: path.metadata().map(|item| item.len()).unwrap_or(0),
                    status: "found".into(),
                });
            }
        }
    }
    files
}

#[tauri::command]
pub fn m07_cache_manage(app: AppHandle, request: RepairRequest) -> OperationResult<RepairReport> {
    let mut artifacts = cache_files();
    match request.action.as_str() {
        "inspect" => execute_steps(
            &app,
            "m07_s06",
            "m07.cache.manage",
            "icon_thumbnail_cache",
            "inspect",
            false,
            false,
            Vec::new(),
            artifacts,
            Vec::new(),
            Vec::new(),
            "Icon and thumbnail cache files inspected",
            "تم فحص ملفات كاش الأيقونات والمصغرات",
        ),
        "rebuild" => {
            if let Err(error) = confirmation(&request, "REBUILD ICON CACHE") {
                return confirmation_failure(
                    &app,
                    "m07_s06",
                    "m07.cache.manage",
                    "icon_thumbnail_cache",
                    "rebuild",
                    error,
                );
            }
            let stop = run_step(&Step::new("taskkill.exe", &["/F", "/IM", "explorer.exe"], false));
            for artifact in &mut artifacts {
                artifact.status = match fs::remove_file(&artifact.path) {
                    Ok(()) => "deleted_for_rebuild".into(),
                    Err(error) => format!("delete_failed:{error}"),
                };
            }
            let start = run_step(&Step::new("explorer.exe", &[], false));
            let operation_id = Uuid::new_v4().to_string();
            let started_at = Utc::now().to_rfc3339();
            let timer = Instant::now();
            let warnings = artifacts
                .iter()
                .filter(|item| item.status.starts_with("delete_failed"))
                .map(|item| format!("{}:{}", item.path, item.status))
                .collect();
            let report = RepairReport {
                service: "icon_thumbnail_cache".into(),
                action: "rebuild".into(),
                elevated: is_elevated(),
                requires_restart: false,
                commands: vec![stop, start],
                artifacts,
                update_backups: Vec::new(),
                notes: vec!["Only allowlisted IconCache.db, iconcache_* and thumbcache_* files under LocalAppData are removed.".into()],
                evidence_path: None,
                measured_at: Utc::now().to_rfc3339(),
            };
            report_result(
                &app,
                operation_id,
                "m07_s06",
                "m07.cache.manage",
                started_at,
                timer,
                report,
                None,
                warnings,
                "Icon and thumbnail caches rebuilt",
                "تمت إعادة بناء كاش الأيقونات والمصغرات",
            )
        }
        other => invalid_action(&app, "m07_s06", "m07.cache.manage", "icon_thumbnail_cache", other),
    }
}

#[tauri::command]
pub fn m07_wmi_manage(app: AppHandle, request: RepairRequest) -> OperationResult<RepairReport> {
    let (args, action, restart) = match request.action.as_str() {
        "verify" => (vec!["/verifyrepository"], "verify", false),
        "salvage" => {
            if let Err(error) = confirmation(&request, "SALVAGE WMI") {
                return confirmation_failure(&app, "m07_s07", "m07.wmi.manage", "wmi", "salvage", error);
            }
            (vec!["/salvagerepository"], "salvage", true)
        }
        other => return invalid_action(&app, "m07_s07", "m07.wmi.manage", "wmi", other),
    };
    execute_steps(
        &app,
        "m07_s07",
        "m07.wmi.manage",
        "wmi",
        action,
        true,
        restart,
        vec![Step::new("winmgmt.exe", &args, true)],
        Vec::new(),
        Vec::new(),
        vec!["Destructive winmgmt /resetrepository is intentionally not exposed.".into()],
        "WMI operation completed",
        "اكتملت عملية WMI",
    )
}

#[tauri::command]
pub fn m07_installer_manage(
    app: AppHandle,
    request: RepairRequest,
) -> OperationResult<RepairReport> {
    match request.action.as_str() {
        "inspect" => execute_steps(
            &app,
            "m07_s08",
            "m07.installer.manage",
            "windows_installer",
            "inspect",
            true,
            false,
            vec![powershell_step("$s=Get-Service msiserver -ErrorAction Stop; [pscustomobject]@{name=$s.Name;status=[string]$s.Status;startType=[string]$s.StartType;systemMsiexec=(Join-Path $env:WINDIR 'System32\\msiexec.exe');wow64Msiexec=(Join-Path $env:WINDIR 'SysWOW64\\msiexec.exe')} | ConvertTo-Json -Compress".into(), true)],
            Vec::new(),
            Vec::new(),
            Vec::new(),
            "Windows Installer inspected",
            "تم فحص Windows Installer",
        ),
        "repair" => {
            if let Err(error) = confirmation(&request, "REPAIR WINDOWS INSTALLER") {
                return confirmation_failure(&app, "m07_s08", "m07.installer.manage", "windows_installer", "repair", error);
            }
            let windir = env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
            let system = PathBuf::from(&windir).join("System32").join("msiexec.exe");
            let wow64 = PathBuf::from(&windir).join("SysWOW64").join("msiexec.exe");
            let mut steps = vec![
                Step::owned(system.to_string_lossy().as_ref(), vec!["/unregister".into()], true),
                Step::owned(system.to_string_lossy().as_ref(), vec!["/regserver".into()], true),
            ];
            if wow64.is_file() {
                steps.push(Step::owned(wow64.to_string_lossy().as_ref(), vec!["/unregister".into()], false));
                steps.push(Step::owned(wow64.to_string_lossy().as_ref(), vec!["/regserver".into()], false));
            }
            steps.push(Step::new("sc.exe", &["config", "msiserver", "start=", "demand"], true));
            execute_steps(
                &app,
                "m07_s08",
                "m07.installer.manage",
                "windows_installer",
                "repair",
                true,
                false,
                steps,
                Vec::new(),
                Vec::new(),
                vec!["Only official System32 and SysWOW64 msiexec binaries are registered.".into()],
                "Windows Installer registration repaired",
                "تم إصلاح تسجيل Windows Installer",
            )
        }
        other => invalid_action(&app, "m07_s08", "m07.installer.manage", "windows_installer", other),
    }
}

#[tauri::command]
pub fn m07_vss_manage(app: AppHandle, request: RepairRequest) -> OperationResult<RepairReport> {
    match request.action.as_str() {
        "inspect" => execute_steps(
            &app,
            "m07_s09",
            "m07.vss.manage",
            "vss",
            "inspect",
            true,
            false,
            vec![
                Step::new("sc.exe", &["query", "vss"], false),
                Step::new("sc.exe", &["query", "swprv"], false),
                Step::new("vssadmin.exe", &["list", "writers"], true),
            ],
            Vec::new(),
            Vec::new(),
            Vec::new(),
            "VSS services and writers inspected",
            "تم فحص خدمات وكتّاب VSS",
        ),
        "repair" => {
            if let Err(error) = confirmation(&request, "REPAIR VSS") {
                return confirmation_failure(&app, "m07_s09", "m07.vss.manage", "vss", "repair", error);
            }
            execute_steps(
                &app,
                "m07_s09",
                "m07.vss.manage",
                "vss",
                "repair",
                true,
                false,
                vec![
                    Step::new("sc.exe", &["config", "vss", "start=", "demand"], true),
                    Step::new("sc.exe", &["config", "swprv", "start=", "demand"], true),
                    Step::new("net.exe", &["start", "swprv"], false),
                    Step::new("net.exe", &["start", "vss"], false),
                    Step::new("vssadmin.exe", &["list", "writers"], true),
                ],
                Vec::new(),
                Vec::new(),
                vec!["Broad regsvr32 DLL registration recipes are intentionally excluded because they are version-sensitive and unsafe.".into()],
                "VSS service configuration repaired and writers rechecked",
                "تم إصلاح إعداد خدمات VSS وإعادة فحص الكتّاب",
            )
        }
        other => invalid_action(&app, "m07_s09", "m07.vss.manage", "vss", other),
    }
}

#[tauri::command]
pub fn m07_store_manage(app: AppHandle, request: RepairRequest) -> OperationResult<RepairReport> {
    match request.action.as_str() {
        "inspect" => execute_steps(
            &app,
            "m07_s10",
            "m07.store.manage",
            "microsoft_store",
            "inspect",
            false,
            false,
            vec![powershell_step("$p=Get-AppxPackage -Name Microsoft.WindowsStore -ErrorAction SilentlyContinue; $a=Get-Service AppXSvc -ErrorAction SilentlyContinue; $c=Get-Service ClipSVC -ErrorAction SilentlyContinue; [pscustomobject]@{package=if($p){[pscustomobject]@{name=$p.Name;version=[string]$p.Version;installLocation=$p.InstallLocation}}else{$null};appxService=if($a){[string]$a.Status}else{'Missing'};clipService=if($c){[string]$c.Status}else{'Missing'}} | ConvertTo-Json -Depth 5 -Compress".into(), true)],
            Vec::new(),
            Vec::new(),
            Vec::new(),
            "Microsoft Store package and services inspected",
            "تم فحص حزمة Microsoft Store وخدماتها",
        ),
        "reset" => {
            if let Err(error) = confirmation(&request, "RESET MICROSOFT STORE") {
                return confirmation_failure(&app, "m07_s10", "m07.store.manage", "microsoft_store", "reset", error);
            }
            execute_steps(
                &app,
                "m07_s10",
                "m07.store.manage",
                "microsoft_store",
                "reset",
                false,
                false,
                vec![Step::new("wsreset.exe", &[], true)],
                Vec::new(),
                Vec::new(),
                vec!["The official wsreset.exe utility is used.".into()],
                "Microsoft Store cache reset completed",
                "اكتملت إعادة ضبط كاش Microsoft Store",
            )
        }
        "repair" => {
            if let Err(error) = confirmation(&request, "REPAIR MICROSOFT STORE") {
                return confirmation_failure(&app, "m07_s10", "m07.store.manage", "microsoft_store", "repair", error);
            }
            execute_steps(
                &app,
                "m07_s10",
                "m07.store.manage",
                "microsoft_store",
                "repair",
                false,
                false,
                vec![powershell_step("$ErrorActionPreference='Stop'; $package=Get-AppxPackage -Name Microsoft.WindowsStore | Select-Object -First 1; if($null -eq $package){throw 'microsoft_store_package_not_found'}; Add-AppxPackage -DisableDevelopmentMode -Register (Join-Path $package.InstallLocation 'AppxManifest.xml')".into(), true)],
                Vec::new(),
                Vec::new(),
                vec!["Only the current user's installed Microsoft.WindowsStore AppxManifest is re-registered.".into()],
                "Microsoft Store package registration repaired",
                "تم إصلاح تسجيل حزمة Microsoft Store",
            )
        }
        other => invalid_action(&app, "m07_s10", "m07.store.manage", "microsoft_store", other),
    }
}
