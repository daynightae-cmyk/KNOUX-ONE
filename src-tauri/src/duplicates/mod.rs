pub mod contracts;
mod errors;
mod folder_digest;
mod hashing;
mod image_similarity;
mod jobs;
mod keeper;
mod persistence;
mod quarantine;
mod scanner;
mod traversal;

use crate::{contracts::OperationResult, duplicates::{contracts::{DuplicateJobProgress, DuplicateScanRequest, DuplicateScanResult, FolderComparisonRequest, FolderComparisonResult, KeeperPlanRequest, KeeperPlanResult, QuarantineActionResult, QuarantineRequest}, errors::DuplicateError}};
use chrono::Utc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

fn failure<T>(operation_id: &str, capability_id: &str, handler_id: &str, started_at: &str, error: DuplicateError) -> OperationResult<T> {
    OperationResult { operation_id: operation_id.into(), capability_id: capability_id.into(), handler_id: handler_id.into(), status: if matches!(&error, DuplicateError::ScanCancelled) { "cancelled" } else { "failed" }.into(), started_at: started_at.into(), completed_at: Some(Utc::now().to_rfc3339()), duration_ms: None, requires_restart: false, exit_code: Some(1), stdout: None, stderr: Some(error.to_string()), summary_en: error.to_string(), summary_ar: format!("فشلت العملية المحلية: {error}"), warnings: Vec::new(), error_code: Some(error.code().into()), data: None }
}

type ScanWorker = for<'a> fn(&str, &str, &DuplicateScanRequest, &jobs::JobControl, scanner::ProgressCallback<'a>) -> Result<DuplicateScanResult, DuplicateError>;

async fn execute_scan(app: AppHandle, op_id: String, capability_id: &'static str, handler_id: &'static str, request: DuplicateScanRequest, worker: ScanWorker) -> Result<OperationResult<DuplicateScanResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let job_id = Uuid::new_v4().to_string();
    let control = jobs::register(&job_id);
    let app_for_worker = app.clone();
    let operation_id = op_id.clone();
    let job_for_worker = job_id.clone();
    let request_for_worker = request.clone();
    let execution = tauri::async_runtime::spawn_blocking(move || {
        let emit = |progress: DuplicateJobProgress| { let _ = app_for_worker.emit("m03://progress", progress); };
        worker(&operation_id, &job_for_worker, &request_for_worker, &control, &emit)
    }).await.map_err(|error| format!("duplicate_worker_join_failed: {error}"))?;
    jobs::remove(&job_id);
    match execution {
        Ok(result) => {
            if let Err(error) = persistence::persist_scan(&app, &request, &result) {
                return Ok(OperationResult { operation_id: op_id, capability_id: capability_id.into(), handler_id: handler_id.into(), status: "completed_with_warnings".into(), started_at, completed_at: Some(Utc::now().to_rfc3339()), duration_ms: None, requires_restart: false, exit_code: Some(0), stdout: None, stderr: Some(error.clone()), summary_en: "Duplicate scan completed, but history persistence failed.".into(), summary_ar: "اكتمل فحص التكرار، ولكن تعذر حفظ سجل الفحص.".into(), warnings: vec![error], error_code: Some("scan_database_failed".into()), data: Some(result) });
            }
            Ok(OperationResult { operation_id: op_id, capability_id: capability_id.into(), handler_id: handler_id.into(), status: if result.warnings.is_empty() { "completed" } else { "completed_with_warnings" }.into(), started_at, completed_at: Some(Utc::now().to_rfc3339()), duration_ms: None, requires_restart: false, exit_code: Some(0), stdout: None, stderr: None, summary_en: format!("Scan completed with {} verified result groups.", result.groups.len()), summary_ar: format!("اكتمل الفحص وتم العثور على {} مجموعة نتائج موثقة.", result.groups.len()), warnings: result.warnings.clone(), error_code: None, data: Some(result) })
        }
        Err(error) => Ok(failure(&op_id, capability_id, handler_id, &started_at, error)),
    }
}

#[tauri::command]
pub async fn m03_scan_exact(app: AppHandle, op_id: String, request: DuplicateScanRequest) -> Result<OperationResult<DuplicateScanResult>, String> {
    execute_scan(app, op_id, "m03_s01", "m03.scan.exact", request, |operation_id, job_id, request, control, progress| scanner::scan_exact(operation_id, job_id, "exact_blake3", request, control, progress)).await
}

#[tauri::command]
pub async fn m03_scan_fast(app: AppHandle, op_id: String, request: DuplicateScanRequest) -> Result<OperationResult<DuplicateScanResult>, String> {
    execute_scan(app, op_id, "m03_s02", "m03.scan.fast", request, |operation_id, job_id, request, control, progress| scanner::scan_exact(operation_id, job_id, "fast_partial", request, control, progress)).await
}

#[tauri::command]
pub async fn m03_scan_images(app: AppHandle, op_id: String, request: DuplicateScanRequest) -> Result<OperationResult<DuplicateScanResult>, String> {
    execute_scan(app, op_id, "m03_s03", "m03.scan.images", request, image_similarity::scan_images).await
}

#[tauri::command]
pub async fn m03_scan_videos(app: AppHandle, op_id: String, request: DuplicateScanRequest) -> Result<OperationResult<DuplicateScanResult>, String> {
    execute_scan(app, op_id, "m03_s04", "m03.scan.videos", request, |operation_id, job_id, request, control, progress| { let mut result = scanner::exact_for_extensions(operation_id, job_id, "video_streams", request, &["mp4", "mkv", "avi", "mov", "wmv", "webm", "m4v"], control, progress)?; result.warnings.push("Exact video duplicates are verified. Advanced stream similarity requires ffprobe configuration.".into()); Ok(result) }).await
}

#[tauri::command]
pub async fn m03_scan_audio(app: AppHandle, op_id: String, request: DuplicateScanRequest) -> Result<OperationResult<DuplicateScanResult>, String> {
    execute_scan(app, op_id, "m03_s05", "m03.scan.audio", request, |operation_id, job_id, request, control, progress| { let mut result = scanner::exact_for_extensions(operation_id, job_id, "audio_fingerprint", request, &["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"], control, progress)?; result.warnings.push("Exact audio duplicates are verified. Acoustic fingerprinting requires a reviewed fingerprint engine.".into()); Ok(result) }).await
}

#[tauri::command]
pub async fn m03_scan_documents(app: AppHandle, op_id: String, request: DuplicateScanRequest) -> Result<OperationResult<DuplicateScanResult>, String> {
    execute_scan(app, op_id, "m03_s06", "m03.scan.documents", request, |operation_id, job_id, request, control, progress| scanner::exact_for_extensions(operation_id, job_id, "documents", request, &["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "md", "json", "yaml", "yml", "xml", "toml", "rs", "ts", "tsx", "js", "jsx", "py", "cs", "java", "go"], control, progress)).await
}

#[tauri::command]
pub async fn m03_scan_archives(app: AppHandle, op_id: String, request: DuplicateScanRequest) -> Result<OperationResult<DuplicateScanResult>, String> {
    execute_scan(app, op_id, "m03_s07", "m03.scan.archives", request, |operation_id, job_id, request, control, progress| { let mut result = scanner::exact_for_extensions(operation_id, job_id, "archives", request, &["zip", "rar", "7z", "tar", "gz", "bz2", "xz"], control, progress)?; result.warnings.push("Exact archive duplicates are verified. Internal-manifest comparison remains review-only.".into()); Ok(result) }).await
}

#[tauri::command]
pub async fn m03_scan_folders(op_id: String, request: FolderComparisonRequest) -> Result<OperationResult<FolderComparisonResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    match tauri::async_runtime::spawn_blocking(move || folder_digest::compare_folders(&request)).await.map_err(|error| format!("folder_compare_join_failed: {error}"))? {
        Ok(data) => Ok(OperationResult { operation_id: op_id, capability_id: "m03_s08".into(), handler_id: "m03.scan.folders".into(), status: "completed".into(), started_at, completed_at: Some(Utc::now().to_rfc3339()), duration_ms: None, requires_restart: false, exit_code: Some(0), stdout: None, stderr: None, summary_en: "Folder comparison completed with item-level evidence.".into(), summary_ar: "اكتملت مقارنة المجلدات مع أدلة تفصيلية لكل عنصر.".into(), warnings: Vec::new(), error_code: None, data: Some(data) }),
        Err(error) => Ok(failure(&op_id, "m03_s08", "m03.scan.folders", &started_at, error)),
    }
}

#[tauri::command]
pub fn m03_keeper_plan(op_id: String, request: KeeperPlanRequest) -> OperationResult<KeeperPlanResult> {
    let started_at = Utc::now().to_rfc3339();
    let data = keeper::build_plan(request);
    OperationResult { operation_id: op_id, capability_id: "m03_s09".into(), handler_id: "m03.keeper.plan".into(), status: if data.blocked_group_ids.is_empty() { "completed" } else { "completed_with_warnings" }.into(), started_at, completed_at: Some(Utc::now().to_rfc3339()), duration_ms: None, requires_restart: false, exit_code: Some(0), stdout: None, stderr: None, summary_en: "Keeper selection plan generated without deleting files.".into(), summary_ar: "تم إنشاء خطة اختيار النسخ المحتفظ بها دون حذف أي ملفات.".into(), warnings: data.blocked_group_ids.iter().map(|group| format!("keeper_missing: {group}")).collect(), error_code: None, data: Some(data) }
}

#[tauri::command]
pub async fn m03_quarantine_manage(app: AppHandle, op_id: String, request: QuarantineRequest) -> Result<OperationResult<QuarantineActionResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let app_for_worker = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || quarantine::manage(&app_for_worker, request)).await.map_err(|error| format!("quarantine_worker_join_failed: {error}"))?;
    match result {
        Ok(data) => Ok(OperationResult { operation_id: op_id, capability_id: "m03_s10".into(), handler_id: "m03.quarantine.manage".into(), status: if data.warnings.is_empty() { "completed" } else { "completed_with_warnings" }.into(), started_at, completed_at: Some(Utc::now().to_rfc3339()), duration_ms: None, requires_restart: false, exit_code: Some(0), stdout: None, stderr: None, summary_en: "Quarantine operation completed with checksum verification.".into(), summary_ar: "اكتملت عملية المحجر مع التحقق من البصمة الرقمية.".into(), warnings: data.warnings.clone(), error_code: None, data: Some(data) }),
        Err(error) => Ok(failure(&op_id, "m03_s10", "m03.quarantine.manage", &started_at, error)),
    }
}

#[tauri::command]
pub fn m03_pick_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let script = r#"Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Choose a folder for KNOUX Duplicate Control Center'
$dialog.ShowNewFolderButton = $false
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.SelectedPath
}"#;
        let output = Command::new("powershell.exe").args(["-NoProfile", "-STA", "-Command", script]).output().map_err(|error| format!("folder_picker_failed: {error}"))?;
        if !output.status.success() { return Err(format!("folder_picker_failed: {}", String::from_utf8_lossy(&output.stderr))); }
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() { Ok(None) } else { Ok(Some(path)) }
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(None) }
}

#[tauri::command]
pub fn m03_job_pause(job_id: String) -> Result<bool, String> { jobs::control(&job_id).ok_or_else(|| "job_not_found".to_string()).map(|control| { control.pause(); true }) }
#[tauri::command]
pub fn m03_job_resume(job_id: String) -> Result<bool, String> { jobs::control(&job_id).ok_or_else(|| "job_not_found".to_string()).map(|control| { control.resume(); true }) }
#[tauri::command]
pub fn m03_job_cancel(job_id: String) -> Result<bool, String> { jobs::control(&job_id).ok_or_else(|| "job_not_found".to_string()).map(|control| { control.cancel(); true }) }
#[tauri::command]
pub fn m03_job_list() -> Vec<String> { jobs::list() }
#[tauri::command]
pub fn m03_scan_history(app: AppHandle) -> Result<Vec<serde_json::Value>, String> { let connection = crate::storage::database::open(&app)?; persistence::load_scan_history(&connection) }
#[tauri::command]
pub fn m03_scan_result(app: AppHandle, scan_id: String) -> Result<DuplicateScanResult, String> { let connection = crate::storage::database::open(&app)?; persistence::load_scan_result(&connection, &scan_id) }
