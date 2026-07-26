use crate::{
    cleanup::{
        cleaner,
        contracts::{
            CleanupCancelResult, CleanupExecuteRequest, CleanupExecuteResult, CleanupHistoryEntry,
            CleanupHistoryResult, CleanupScanRequest, CleanupScanResult,
        },
        discovery, scanner,
    },
    contracts::OperationResult,
};
use chrono::Utc;
use once_cell::sync::Lazy;
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};
use tauri::{AppHandle, Manager};

static SCAN_SNAPSHOTS: Lazy<Mutex<HashMap<String, CleanupScanResult>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static CANCELLATION_TOKENS: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

fn success<T>(
    operation_id: String,
    capability_id: &str,
    handler_id: &str,
    started_at: String,
    timer: Instant,
    summary_en: String,
    summary_ar: String,
    data: T,
    warnings: Vec<String>,
    status: &str,
) -> OperationResult<T> {
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: status.into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(if status == "cancelled" { 2 } else { 0 }),
        stdout: None,
        stderr: None,
        summary_en,
        summary_ar,
        warnings,
        error_code: None,
        data: Some(data),
    }
}

fn failure<T>(
    operation_id: String,
    capability_id: &str,
    handler_id: &str,
    started_at: String,
    timer: Instant,
    error_code: &str,
    message: String,
) -> OperationResult<T> {
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: "failed".into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(1),
        stdout: None,
        stderr: Some(message.clone()),
        summary_en: message.clone(),
        summary_ar: message,
        warnings: Vec::new(),
        error_code: Some(error_code.into()),
        data: None,
    }
}

fn history_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("cleanup_app_data_unavailable:{error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("cleanup_history_directory_failed:{error}"))?;
    Ok(directory.join("m02-cleanup-history.json"))
}

fn load_history(app: &AppHandle) -> Result<Vec<CleanupHistoryEntry>, String> {
    let path = history_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)
        .map_err(|error| format!("cleanup_history_read_failed:{error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("cleanup_history_parse_failed:{error}"))
}

fn append_history(app: &AppHandle, entry: CleanupHistoryEntry) -> Result<(), String> {
    let path = history_path(app)?;
    let mut entries = load_history(app).unwrap_or_default();
    entries.insert(0, entry);
    entries.truncate(100);
    let payload = serde_json::to_vec_pretty(&entries)
        .map_err(|error| format!("cleanup_history_serialize_failed:{error}"))?;
    fs::write(path, payload).map_err(|error| format!("cleanup_history_write_failed:{error}"))
}

fn register_token(operation_id: &str) -> Arc<AtomicBool> {
    let token = Arc::new(AtomicBool::new(false));
    if let Ok(mut tokens) = CANCELLATION_TOKENS.lock() {
        tokens.insert(operation_id.into(), token.clone());
    }
    token
}

fn remove_token(operation_id: &str) {
    if let Ok(mut tokens) = CANCELLATION_TOKENS.lock() {
        tokens.remove(operation_id);
    }
}

async fn scan_internal(
    app: AppHandle,
    op_id: String,
    request: CleanupScanRequest,
    capability_id: &'static str,
    handler_id: &'static str,
) -> Result<OperationResult<CleanupScanResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let targets = discovery::discover_targets(&request.categories);
    if targets.is_empty() {
        return Ok(failure(
            op_id,
            capability_id,
            handler_id,
            started_at,
            timer,
            "cleanup_no_supported_categories",
            "No supported cleanup categories were selected.".into(),
        ));
    }

    let token = register_token(&op_id);
    let worker_app = app.clone();
    let worker_op = op_id.clone();
    let item_limit = request.max_items_per_category;
    let worker_token = token.clone();
    let scan = tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_targets(&worker_app, &worker_op, targets, item_limit, worker_token)
    })
    .await
    .map_err(|error| format!("cleanup_scan_join_failed:{error}"))?;
    remove_token(&op_id);

    let scan = match scan {
        Ok(value) => value,
        Err(error) => {
            return Ok(failure(
                op_id,
                capability_id,
                handler_id,
                started_at,
                timer,
                "cleanup_scan_failed",
                error,
            ))
        }
    };

    if !scan.cancelled {
        if let Ok(mut snapshots) = SCAN_SNAPSHOTS.lock() {
            snapshots.insert(scan.scan_id.clone(), scan.clone());
            if snapshots.len() > 20 {
                if let Some(oldest) = snapshots.keys().next().cloned() {
                    snapshots.remove(&oldest);
                }
            }
        }
    }

    let status = if scan.cancelled {
        "cancelled"
    } else if scan.warnings.is_empty() {
        "completed"
    } else {
        "completed_with_warnings"
    };
    let completed_at = Utc::now().to_rfc3339();
    let _ = append_history(
        &app,
        CleanupHistoryEntry {
            operation_id: op_id.clone(),
            operation_type: "scan".into(),
            status: status.into(),
            started_at: started_at.clone(),
            completed_at,
            file_count: scan.total_files,
            byte_count: scan.total_bytes,
            warnings: scan.warnings.clone(),
        },
    );

    Ok(success(
        op_id,
        capability_id,
        handler_id,
        started_at,
        timer,
        if scan.cancelled {
            format!("Cleanup scan was cancelled after inspecting {} files.", scan.total_files)
        } else {
            format!("Inspected {} real files across selected cleanup locations.", scan.total_files)
        },
        if scan.cancelled {
            format!("تم إلغاء الفحص بعد معاينة {} ملف حقيقي.", scan.total_files)
        } else {
            format!("تم فحص {} ملف حقيقي في مواقع التنظيف المحددة.", scan.total_files)
        },
        scan.clone(),
        scan.warnings.clone(),
        status,
    ))
}

#[tauri::command]
pub async fn m02_cleanup_scan(
    app: AppHandle,
    op_id: String,
    request: Option<CleanupScanRequest>,
) -> Result<OperationResult<CleanupScanResult>, String> {
    scan_internal(
        app,
        op_id,
        request.unwrap_or_default(),
        "m02_s01",
        "m02.cleanup.scan",
    )
    .await
}

macro_rules! category_scan_command {
    ($name:ident, $category:literal, $capability:literal, $handler:literal) => {
        #[tauri::command]
        pub async fn $name(
            app: AppHandle,
            op_id: String,
        ) -> Result<OperationResult<CleanupScanResult>, String> {
            scan_internal(
                app,
                op_id,
                CleanupScanRequest {
                    categories: vec![$category.into()],
                    max_items_per_category: 5_000,
                },
                $capability,
                $handler,
            )
            .await
        }
    };
}

category_scan_command!(m02_scan_user_temp, "user_temp", "m02_s01", "m02.scan.user_temp");
category_scan_command!(m02_scan_windows_temp, "windows_temp", "m02_s02", "m02.scan.windows_temp");
category_scan_command!(m02_scan_browser_cache, "browser_cache", "m02_s03", "m02.scan.browser_cache");
category_scan_command!(m02_scan_thumbnail_cache, "thumbnail_cache", "m02_s04", "m02.scan.thumbnail_cache");
category_scan_command!(m02_scan_crash_dumps, "crash_dumps", "m02_s05", "m02.scan.crash_dumps");
category_scan_command!(m02_scan_application_logs, "application_logs", "m02_s07", "m02.scan.application_logs");
category_scan_command!(m02_scan_old_downloads, "old_downloads", "m02_s09", "m02.scan.old_downloads");

#[tauri::command]
pub async fn m02_cleanup_execute(
    app: AppHandle,
    op_id: String,
    request: CleanupExecuteRequest,
) -> Result<OperationResult<CleanupExecuteResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let scan = SCAN_SNAPSHOTS
        .lock()
        .ok()
        .and_then(|snapshots| snapshots.get(&request.scan_id).cloned());
    let Some(scan) = scan else {
        return Ok(failure(
            op_id,
            "m02_s01",
            "m02.cleanup.execute",
            started_at,
            timer,
            "cleanup_scan_snapshot_missing",
            "The cleanup preview is no longer available. Run a new scan before cleaning.".into(),
        ));
    };

    let token = register_token(&op_id);
    let worker_app = app.clone();
    let worker_op = op_id.clone();
    let categories = request.categories.clone();
    let confirmation = request.confirmation.clone();
    let worker_scan = scan.clone();
    let worker_token = token.clone();
    let execution = tauri::async_runtime::spawn_blocking(move || {
        cleaner::execute_cleanup(
            &worker_app,
            &worker_op,
            &worker_scan,
            &categories,
            &confirmation,
            worker_token,
        )
    })
    .await
    .map_err(|error| format!("cleanup_execute_join_failed:{error}"))?;
    remove_token(&op_id);

    let execution = match execution {
        Ok(value) => value,
        Err(error) => {
            return Ok(failure(
                op_id,
                "m02_s01",
                "m02.cleanup.execute",
                started_at,
                timer,
                "cleanup_execute_failed",
                error,
            ))
        }
    };

    let status = if execution.cancelled {
        "cancelled"
    } else if execution.failed_files.is_empty() && execution.warnings.is_empty() {
        "completed"
    } else {
        "completed_with_warnings"
    };
    let completed_at = Utc::now().to_rfc3339();
    let mut history_warnings = execution.warnings.clone();
    if !execution.failed_files.is_empty() {
        history_warnings.push(format!("failed_files:{}", execution.failed_files.len()));
    }
    let _ = append_history(
        &app,
        CleanupHistoryEntry {
            operation_id: op_id.clone(),
            operation_type: "clean".into(),
            status: status.into(),
            started_at: started_at.clone(),
            completed_at,
            file_count: execution.deleted_files,
            byte_count: execution.deleted_bytes,
            warnings: history_warnings.clone(),
        },
    );

    Ok(success(
        op_id,
        "m02_s01",
        "m02.cleanup.execute",
        started_at,
        timer,
        format!(
            "Removed {} verified files and reclaimed {} bytes.",
            execution.deleted_files, execution.deleted_bytes
        ),
        format!(
            "تم حذف {} ملف متحقق منه واستعادة {} بايت.",
            execution.deleted_files, execution.deleted_bytes
        ),
        execution,
        history_warnings,
        status,
    ))
}

#[tauri::command]
pub fn m02_cleanup_cancel(
    op_id: String,
    target_operation_id: String,
) -> Result<OperationResult<CleanupCancelResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let cancellation_requested = CANCELLATION_TOKENS
        .lock()
        .ok()
        .and_then(|tokens| tokens.get(&target_operation_id).cloned())
        .map(|token| {
            token.store(true, Ordering::Relaxed);
            true
        })
        .unwrap_or(false);

    Ok(success(
        op_id,
        "m02_s01",
        "m02.cleanup.cancel",
        started_at,
        timer,
        if cancellation_requested {
            "Cancellation was requested for the active cleanup operation.".into()
        } else {
            "No active cleanup operation matched the supplied identifier.".into()
        },
        if cancellation_requested {
            "تم إرسال طلب إلغاء لعملية التنظيف النشطة.".into()
        } else {
            "لم يتم العثور على عملية تنظيف نشطة مطابقة.".into()
        },
        CleanupCancelResult {
            target_operation_id,
            cancellation_requested,
        },
        Vec::new(),
        "completed",
    ))
}

#[tauri::command]
pub fn m02_cleanup_history(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<CleanupHistoryResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match load_history(&app) {
        Ok(entries) => Ok(success(
            op_id,
            "m02_s01",
            "m02.cleanup.history",
            started_at,
            timer,
            format!("Loaded {} cleanup history entries.", entries.len()),
            format!("تم تحميل {} سجل لعمليات التنظيف.", entries.len()),
            CleanupHistoryResult { entries },
            Vec::new(),
            "completed",
        )),
        Err(error) => Ok(failure(
            op_id,
            "m02_s01",
            "m02.cleanup.history",
            started_at,
            timer,
            "cleanup_history_failed",
            error,
        )),
    }
}
