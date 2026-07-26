use crate::{
    contracts::OperationResult,
    startup_services::{
        assessment,
        contracts::{
            BootHistoryRequest, BootHistoryResult, ScheduledTaskInventory,
            StartupAssessmentResult, StartupChangeHistory, StartupInventory,
            StartupRecommendationResult, StartupRestoreRequest, StartupRestoreResult,
            StartupToggleRequest, StartupToggleResult, WindowsServiceInventory,
        },
        discovery, inspection, mutations,
    },
};
use chrono::Utc;
use once_cell::sync::Lazy;
use std::{
    collections::HashMap,
    sync::Mutex,
    time::Instant,
};
use tauri::AppHandle;
use uuid::Uuid;

static STARTUP_SNAPSHOTS: Lazy<Mutex<HashMap<String, StartupInventory>>> =
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

fn save_snapshot(inventory: &StartupInventory) {
    if let Ok(mut snapshots) = STARTUP_SNAPSHOTS.lock() {
        snapshots.insert(inventory.scan_id.clone(), inventory.clone());
        while snapshots.len() > 30 {
            let Some(key) = snapshots.keys().next().cloned() else {
                break;
            };
            snapshots.remove(&key);
        }
    }
}

fn build_inventory(source_kind: Option<&str>) -> Result<StartupInventory, String> {
    let mut items = discovery::discover_startup_items()?;
    if let Some(source_kind) = source_kind {
        items.retain(|item| item.source_kind == source_kind);
    }
    let inventory = StartupInventory {
        scan_id: Uuid::new_v4().to_string(),
        items,
        measured_at: Utc::now().to_rfc3339(),
        warnings: Vec::new(),
    };
    save_snapshot(&inventory);
    Ok(inventory)
}

async fn inventory_command(
    op_id: String,
    source_kind: Option<&'static str>,
    capability_id: &'static str,
    handler_id: &'static str,
    label_en: &'static str,
    label_ar: &'static str,
) -> Result<OperationResult<StartupInventory>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let inventory = tauri::async_runtime::spawn_blocking(move || build_inventory(source_kind))
        .await
        .map_err(|error| format!("startup_inventory_join_failed:{error}"))?;
    match inventory {
        Ok(inventory) => Ok(success(
            op_id,
            capability_id,
            handler_id,
            started_at,
            timer,
            format!("Measured {} {label_en} entries from Windows.", inventory.items.len()),
            format!("تم قياس {} عنصر من {label_ar} في ويندوز.", inventory.items.len()),
            inventory,
            Vec::new(),
            "completed",
        )),
        Err(error) => Ok(failure(
            op_id,
            capability_id,
            handler_id,
            started_at,
            timer,
            "startup_inventory_failed",
            error,
        )),
    }
}

#[tauri::command]
pub async fn m05_registry_startup(
    op_id: String,
) -> Result<OperationResult<StartupInventory>, String> {
    inventory_command(
        op_id,
        Some("registry"),
        "m05_s01",
        "m05.registry.startup",
        "registry startup",
        "بدء التشغيل من السجل",
    )
    .await
}

#[tauri::command]
pub async fn m05_startup_folders(
    op_id: String,
) -> Result<OperationResult<StartupInventory>, String> {
    inventory_command(
        op_id,
        Some("startup_folder"),
        "m05_s02",
        "m05.folder.startup",
        "startup-folder",
        "مجلدات بدء التشغيل",
    )
    .await
}

#[tauri::command]
pub async fn m05_scheduled_tasks(
    op_id: String,
) -> Result<OperationResult<ScheduledTaskInventory>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(inspection::scheduled_tasks)
        .await
        .map_err(|error| format!("scheduled_tasks_join_failed:{error}"))?;
    match result {
        Ok(result) => {
            let warnings = result.warnings.clone();
            Ok(success(
                op_id,
                "m05_s03",
                "m05.tasks.inspect",
                started_at,
                timer,
                format!("Read {} scheduled tasks from Windows.", result.tasks.len()),
                format!("تمت قراءة {} مهمة مجدولة من ويندوز.", result.tasks.len()),
                result,
                warnings,
                "completed_with_warnings",
            ))
        }
        Err(error) => Ok(failure(
            op_id,
            "m05_s03",
            "m05.tasks.inspect",
            started_at,
            timer,
            "scheduled_tasks_failed",
            error,
        )),
    }
}

#[tauri::command]
pub async fn m05_windows_services(
    op_id: String,
) -> Result<OperationResult<WindowsServiceInventory>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(inspection::windows_services)
        .await
        .map_err(|error| format!("windows_services_join_failed:{error}"))?;
    match result {
        Ok(result) => {
            let warnings = result.warnings.clone();
            Ok(success(
                op_id,
                "m05_s04",
                "m05.services.inspect",
                started_at,
                timer,
                format!("Read {} Windows services without changing them.", result.services.len()),
                format!("تمت قراءة {} خدمة ويندوز دون تغييرها.", result.services.len()),
                result,
                warnings,
                "completed_with_warnings",
            ))
        }
        Err(error) => Ok(failure(
            op_id,
            "m05_s04",
            "m05.services.inspect",
            started_at,
            timer,
            "windows_services_failed",
            error,
        )),
    }
}

#[tauri::command]
pub async fn m05_startup_impact(
    op_id: String,
) -> Result<OperationResult<StartupAssessmentResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let inventory = tauri::async_runtime::spawn_blocking(|| build_inventory(None))
        .await
        .map_err(|error| format!("startup_assessment_join_failed:{error}"))?;
    match inventory {
        Ok(inventory) => {
            let result = assessment::assess(&inventory);
            let warnings = result.warnings.clone();
            Ok(success(
                op_id,
                "m05_s05",
                "m05.impact.assess",
                started_at,
                timer,
                format!("Calculated transparent attention indicators for {} startup entries.", result.items.len()),
                format!("تم حساب مؤشرات اهتمام شفافة لـ{} عنصر بدء تشغيل.", result.items.len()),
                result,
                warnings,
                "completed_with_warnings",
            ))
        }
        Err(error) => Ok(failure(
            op_id,
            "m05_s05",
            "m05.impact.assess",
            started_at,
            timer,
            "startup_assessment_failed",
            error,
        )),
    }
}

#[tauri::command]
pub async fn m05_safe_recommendations(
    op_id: String,
) -> Result<OperationResult<StartupRecommendationResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let inventory = tauri::async_runtime::spawn_blocking(|| build_inventory(None))
        .await
        .map_err(|error| format!("startup_recommendations_join_failed:{error}"))?;
    match inventory {
        Ok(inventory) => {
            let result = assessment::recommendations(&inventory);
            let warnings = result.warnings.clone();
            Ok(success(
                op_id,
                "m05_s06",
                "m05.recommendations.review",
                started_at,
                timer,
                format!("Prepared {} review-only startup classifications.", result.recommendations.len()),
                format!("تم إعداد {} تصنيف للمراجعة فقط.", result.recommendations.len()),
                result,
                warnings,
                "completed_with_warnings",
            ))
        }
        Err(error) => Ok(failure(
            op_id,
            "m05_s06",
            "m05.recommendations.review",
            started_at,
            timer,
            "startup_recommendations_failed",
            error,
        )),
    }
}

#[tauri::command]
pub fn m05_startup_toggle(
    app: AppHandle,
    op_id: String,
    request: StartupToggleRequest,
) -> Result<OperationResult<StartupToggleResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    if request.enabled {
        return Ok(failure(
            op_id,
            "m05_s01",
            "m05.startup.toggle",
            started_at,
            timer,
            "startup_enable_requires_restore",
            "Use the verified restore workflow to re-enable a previously disabled item.".into(),
        ));
    }
    let item = STARTUP_SNAPSHOTS
        .lock()
        .ok()
        .and_then(|snapshots| snapshots.get(&request.scan_id).cloned())
        .and_then(|inventory| inventory.items.into_iter().find(|item| item.id == request.item_id));
    let Some(item) = item else {
        return Ok(failure(
            op_id,
            "m05_s01",
            "m05.startup.toggle",
            started_at,
            timer,
            "startup_snapshot_item_missing",
            "The startup snapshot is unavailable or the item is not part of it. Run a new scan.".into(),
        ));
    };
    match mutations::disable_item(&app, &item, &request.confirmation) {
        Ok(result) => Ok(success(
            op_id,
            if item.source_kind == "registry" { "m05_s01" } else { "m05_s02" },
            "m05.startup.toggle",
            started_at,
            timer,
            format!("Disabled '{}' and recorded a verified restore entry.", item.name),
            format!("تم تعطيل '{}' وتسجيل استعادة موثقة.", item.name),
            result,
            Vec::new(),
            "completed",
        )),
        Err(error) => Ok(failure(
            op_id,
            if item.source_kind == "registry" { "m05_s01" } else { "m05_s02" },
            "m05.startup.toggle",
            started_at,
            timer,
            "startup_disable_failed",
            error,
        )),
    }
}

#[tauri::command]
pub fn m05_change_restore(
    app: AppHandle,
    op_id: String,
    request: StartupRestoreRequest,
) -> Result<OperationResult<StartupRestoreResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match mutations::restore_change(&app, &request.change_id, &request.confirmation) {
        Ok(result) => Ok(success(
            op_id,
            "m05_s09",
            "m05.changes.restore",
            started_at,
            timer,
            "Restored the selected startup change from verified local evidence.".into(),
            "تمت استعادة تغيير بدء التشغيل المحدد من الأدلة المحلية الموثقة.".into(),
            result,
            Vec::new(),
            "completed",
        )),
        Err(error) => Ok(failure(
            op_id,
            "m05_s09",
            "m05.changes.restore",
            started_at,
            timer,
            "startup_restore_failed",
            error,
        )),
    }
}

#[tauri::command]
pub fn m05_change_history(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<StartupChangeHistory>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match mutations::change_history(&app) {
        Ok(result) => Ok(success(
            op_id,
            "m05_s09",
            "m05.changes.history",
            started_at,
            timer,
            format!("Loaded {} startup change records.", result.entries.len()),
            format!("تم تحميل {} سجل لتغييرات بدء التشغيل.", result.entries.len()),
            result,
            Vec::new(),
            "completed",
        )),
        Err(error) => Ok(failure(
            op_id,
            "m05_s09",
            "m05.changes.history",
            started_at,
            timer,
            "startup_change_history_failed",
            error,
        )),
    }
}

#[tauri::command]
pub async fn m05_boot_history(
    op_id: String,
    request: Option<BootHistoryRequest>,
) -> Result<OperationResult<BootHistoryResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let limit = request.and_then(|value| value.limit).unwrap_or(30).clamp(1, 200);
    let result = tauri::async_runtime::spawn_blocking(move || inspection::boot_history(limit))
        .await
        .map_err(|error| format!("boot_history_join_failed:{error}"))?;
    match result {
        Ok(result) => {
            let warnings = result.warnings.clone();
            Ok(success(
                op_id,
                "m05_s10",
                "m05.boot.history",
                started_at,
                timer,
                format!("Read {} real boot-performance events from Windows.", result.entries.len()),
                format!("تمت قراءة {} حدث حقيقي لأداء إقلاع ويندوز.", result.entries.len()),
                result,
                warnings,
                "completed",
            ))
        }
        Err(error) => Ok(failure(
            op_id,
            "m05_s10",
            "m05.boot.history",
            started_at,
            timer,
            "boot_history_failed",
            error,
        )),
    }
}
