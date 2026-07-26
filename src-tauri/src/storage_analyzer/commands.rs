use crate::{
    contracts::OperationResult,
    storage_analyzer::{
        contracts::{
            StorageAnalysisResult, StorageCancelResult, StorageDriveInventory,
            StorageReportExportRequest, StorageReportExportResult, StorageScanRequest,
            StorageSpaceAlert, StorageSpaceCheckRequest, StorageSpaceCheckResult,
        },
        drives, scanner,
    },
};
use chrono::Utc;
use once_cell::sync::Lazy;
use std::{
    collections::HashMap,
    env, fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};
use tauri::{AppHandle, Manager};

static ANALYSIS_SNAPSHOTS: Lazy<Mutex<HashMap<String, StorageAnalysisResult>>> =
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

fn save_snapshot(result: &StorageAnalysisResult) {
    if result.cancelled {
        return;
    }
    if let Ok(mut snapshots) = ANALYSIS_SNAPSHOTS.lock() {
        snapshots.insert(result.scan_id.clone(), result.clone());
        while snapshots.len() > 20 {
            let Some(key) = snapshots.keys().next().cloned() else {
                break;
            };
            snapshots.remove(&key);
        }
    }
}

async fn scan_internal(
    app: AppHandle,
    op_id: String,
    request: StorageScanRequest,
    capability_id: &'static str,
    handler_id: &'static str,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let token = register_token(&op_id);
    let worker_app = app.clone();
    let worker_op = op_id.clone();
    let worker_token = token.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_path(&worker_app, &worker_op, request, worker_token)
    })
    .await
    .map_err(|error| format!("storage_scan_join_failed:{error}"))?;
    remove_token(&op_id);

    let result = match result {
        Ok(value) => value,
        Err(error) => {
            return Ok(failure(
                op_id,
                capability_id,
                handler_id,
                started_at,
                timer,
                "storage_scan_failed",
                error,
            ))
        }
    };

    save_snapshot(&result);
    let status = if result.cancelled {
        "cancelled"
    } else if result.warnings.is_empty() {
        "completed"
    } else {
        "completed_with_warnings"
    };
    Ok(success(
        op_id,
        capability_id,
        handler_id,
        started_at,
        timer,
        if result.cancelled {
            format!(
                "Storage scan was cancelled after measuring {} files.",
                result.total_files
            )
        } else {
            format!(
                "Measured {} files and {} directories from the selected path.",
                result.total_files, result.total_directories
            )
        },
        if result.cancelled {
            format!(
                "تم إلغاء فحص التخزين بعد قياس {} ملف.",
                result.total_files
            )
        } else {
            format!(
                "تم قياس {} ملف و{} مجلد من المسار المحدد.",
                result.total_files, result.total_directories
            )
        },
        result.clone(),
        result.warnings.clone(),
        status,
    ))
}

#[tauri::command]
pub async fn m04_storage_scan(
    app: AppHandle,
    op_id: String,
    request: StorageScanRequest,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    scan_internal(app, op_id, request, "m04_s01", "m04.storage.scan").await
}

macro_rules! path_scan_command {
    ($name:ident, $capability:literal, $handler:literal) => {
        #[tauri::command]
        pub async fn $name(
            app: AppHandle,
            op_id: String,
            request: StorageScanRequest,
        ) -> Result<OperationResult<StorageAnalysisResult>, String> {
            scan_internal(app, op_id, request, $capability, $handler).await
        }
    };
}

path_scan_command!(m04_largest_files, "m04_s02", "m04.files.largest");
path_scan_command!(m04_largest_folders, "m04_s03", "m04.folders.largest");
path_scan_command!(
    m04_type_distribution,
    "m04_s04",
    "m04.types.distribution"
);
path_scan_command!(m04_old_files, "m04_s05", "m04.files.old");

fn preset_path(variable: &str, suffix: &str) -> Result<String, String> {
    let root = env::var_os(variable)
        .map(PathBuf::from)
        .ok_or_else(|| format!("storage_environment_variable_missing:{variable}"))?;
    let path = if suffix.is_empty() {
        root
    } else {
        root.join(suffix)
    };
    if !path.is_dir() {
        return Err(format!("storage_preset_directory_unavailable:{}", path.display()));
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn m04_downloads_analyze(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    let path = match preset_path("USERPROFILE", "Downloads") {
        Ok(value) => value,
        Err(error) => {
            let now = Utc::now().to_rfc3339();
            return Ok(failure(
                op_id,
                "m04_s06",
                "m04.downloads.analyze",
                now,
                Instant::now(),
                "storage_downloads_unavailable",
                error,
            ));
        }
    };
    scan_internal(
        app,
        op_id,
        StorageScanRequest::for_root(path),
        "m04_s06",
        "m04.downloads.analyze",
    )
    .await
}

#[tauri::command]
pub async fn m04_appdata_analyze(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    let path = match preset_path("LOCALAPPDATA", "") {
        Ok(value) => value,
        Err(error) => {
            let now = Utc::now().to_rfc3339();
            return Ok(failure(
                op_id,
                "m04_s07",
                "m04.appdata.analyze",
                now,
                Instant::now(),
                "storage_appdata_unavailable",
                error,
            ));
        }
    };
    scan_internal(
        app,
        op_id,
        StorageScanRequest::for_root(path),
        "m04_s07",
        "m04.appdata.analyze",
    )
    .await
}

#[tauri::command]
pub fn m04_external_drives(
    op_id: String,
) -> Result<OperationResult<StorageDriveInventory>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let inventory = drives::inventory();
    let status = if inventory.warnings.is_empty() {
        "completed"
    } else {
        "completed_with_warnings"
    };
    Ok(success(
        op_id,
        "m04_s08",
        "m04.drives.external",
        started_at,
        timer,
        format!("Measured {} logical drives from Windows.", inventory.drives.len()),
        format!("تم قياس {} قرص منطقي من ويندوز.", inventory.drives.len()),
        inventory.clone(),
        inventory.warnings.clone(),
        status,
    ))
}

#[tauri::command]
pub fn m04_space_check(
    op_id: String,
    request: Option<StorageSpaceCheckRequest>,
) -> Result<OperationResult<StorageSpaceCheckResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let inventory = drives::inventory();
    let threshold = request
        .unwrap_or_default()
        .threshold_percent
        .clamp(1.0, 50.0);
    let alerts = inventory
        .drives
        .iter()
        .map(|drive| StorageSpaceAlert {
            root_path: drive.root_path.clone(),
            free_percent: drive.free_percent,
            free_bytes: drive.free_bytes,
            threshold_percent: threshold,
            below_threshold: drive.free_percent < threshold,
        })
        .collect::<Vec<_>>();
    let warning_count = alerts.iter().filter(|alert| alert.below_threshold).count();
    let result = StorageSpaceCheckResult {
        alerts,
        checked_at: Utc::now().to_rfc3339(),
        background_monitoring_enabled: false,
        warnings: inventory.warnings.clone(),
    };
    let status = if result.warnings.is_empty() {
        "completed"
    } else {
        "completed_with_warnings"
    };
    Ok(success(
        op_id,
        "m04_s09",
        "m04.space.check",
        started_at,
        timer,
        format!("Checked free space; {warning_count} drives are below the threshold."),
        format!("تم فحص المساحة الحرة؛ يوجد {warning_count} قرص تحت الحد المحدد."),
        result.clone(),
        result.warnings.clone(),
        status,
    ))
}

fn sanitize_report_name(value: Option<String>, scan_id: &str) -> String {
    let fallback = format!("storage-report-{scan_id}.json");
    let Some(value) = value else {
        return fallback;
    };
    let cleaned = value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
        .collect::<String>();
    if cleaned.is_empty() {
        fallback
    } else if cleaned.to_ascii_lowercase().ends_with(".json") {
        cleaned
    } else {
        format!("{cleaned}.json")
    }
}

#[tauri::command]
pub fn m04_report_export(
    app: AppHandle,
    op_id: String,
    request: StorageReportExportRequest,
) -> Result<OperationResult<StorageReportExportResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let snapshot = ANALYSIS_SNAPSHOTS
        .lock()
        .ok()
        .and_then(|snapshots| snapshots.get(&request.scan_id).cloned());
    let Some(snapshot) = snapshot else {
        return Ok(failure(
            op_id,
            "m04_s10",
            "m04.report.export",
            started_at,
            timer,
            "storage_snapshot_missing",
            "The storage analysis snapshot is unavailable. Run a new scan before exporting.".into(),
        ));
    };

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("storage_app_data_unavailable:{error}"))?
        .join("storage-reports");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("storage_report_directory_failed:{error}"))?;
    let file_name = sanitize_report_name(request.file_name, &snapshot.scan_id);
    let path = directory.join(file_name);
    let payload = serde_json::to_vec_pretty(&snapshot)
        .map_err(|error| format!("storage_report_serialize_failed:{error}"))?;
    fs::write(&path, &payload)
        .map_err(|error| format!("storage_report_write_failed:{error}"))?;
    let result = StorageReportExportResult {
        scan_id: snapshot.scan_id.clone(),
        format: "json".into(),
        path: path.to_string_lossy().to_string(),
        byte_count: payload.len() as u64,
    };
    Ok(success(
        op_id,
        "m04_s10",
        "m04.report.export",
        started_at,
        timer,
        "Exported the measured storage analysis as a JSON evidence report.".into(),
        "تم تصدير تحليل التخزين المقاس كتقرير أدلة بصيغة JSON.".into(),
        result,
        Vec::new(),
        "completed",
    ))
}

#[tauri::command]
pub fn m04_scan_cancel(
    op_id: String,
    target_operation_id: String,
) -> Result<OperationResult<StorageCancelResult>, String> {
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
        "m04_s01",
        "m04.scan.cancel",
        started_at,
        timer,
        if cancellation_requested {
            "Cancellation was requested for the active storage scan.".into()
        } else {
            "No active storage scan matched the supplied operation identifier.".into()
        },
        if cancellation_requested {
            "تم إرسال طلب إلغاء لفحص التخزين النشط.".into()
        } else {
            "لم يتم العثور على فحص تخزين نشط مطابق.".into()
        },
        StorageCancelResult {
            target_operation_id,
            cancellation_requested,
        },
        Vec::new(),
        "completed",
    ))
}
