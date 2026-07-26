use std::time::Instant;

use chrono::Utc;
use tauri::AppHandle;

use crate::contracts::OperationResult;
use contracts::*;

pub mod cache;
pub mod commands;
pub mod contracts;
pub mod dependencies;
pub mod discovery;
pub mod environment;
pub mod errors;
pub mod git;
pub mod health;
pub mod persistence;
pub mod reports;
pub mod runtime;
pub mod safety;
pub mod source_map;

fn operation<T>(
    operation_id: String,
    capability_id: &str,
    handler_id: &str,
    started_at: String,
    timer: Instant,
    summary_en: String,
    summary_ar: String,
    data: T,
    warnings: Vec<String>,
) -> OperationResult<T> {
    let hard_failure = warnings.iter().any(|warning| {
        warning.starts_with("project_path_not_found")
            || warning.starts_with("protected_project_path")
            || warning.starts_with("project_root_not_found")
            || warning.starts_with("path_outside_project_root")
            || warning.starts_with("project_command_")
            || warning.starts_with("report_")
    });
    let status = if hard_failure {
        "failed"
    } else if warnings.is_empty() {
        "completed"
    } else {
        "completed_with_warnings"
    };
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: status.into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(if hard_failure { 1 } else { 0 }),
        stdout: None,
        stderr: hard_failure.then(|| warnings.join("\n")),
        summary_en,
        summary_ar,
        warnings: warnings.clone(),
        error_code: hard_failure.then(|| warnings.first().and_then(|warning| warning.split(':').next()).unwrap_or("project_operation_failed").to_string()),
        data: Some(data),
    }
}

#[tauri::command]
pub async fn m16_projects_discover(
    app: AppHandle,
    op_id: String,
    request: ProjectDiscoverRequest,
) -> Result<OperationResult<ProjectDiscoverResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let app_for_worker = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let result = discovery::discover_projects(request);
        if let Ok(connection) = crate::storage::database::open(&app_for_worker) {
            for project in &result.projects {
                let _ = persistence::save_project_record(&connection, project);
            }
        }
        result
    })
    .await
    .map_err(|error| format!("m16_projects_discover_join_failed: {error}"))?;
    Ok(operation(
        op_id,
        "m16_s01",
        "m16.projects.discover",
        started_at,
        timer,
        format!("Discovered {} project(s) from user-selected roots.", result.projects.len()),
        format!("تم اكتشاف {} مشروع من المسارات التي اختارها المستخدم.", result.projects.len()),
        result.clone(),
        result.warnings.clone(),
    ))
}

#[tauri::command]
pub async fn m16_projects_health(
    op_id: String,
    request: ProjectHealthRequest,
) -> Result<OperationResult<ProjectHealthResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || health::audit_health(request))
        .await
        .map_err(|error| format!("m16_projects_health_join_failed: {error}"))?;
    Ok(operation(
        op_id,
        "m16_s02",
        "m16.projects.health",
        started_at,
        timer,
        format!("Calculated a health score of {} from {} evidence finding(s).", result.health_score, result.findings.len()),
        format!("تم حساب مؤشر صحة {} من خلال {} نتيجة موثقة.", result.health_score, result.findings.len()),
        result.clone(),
        result.warnings.clone(),
    ))
}

#[tauri::command]
pub async fn m16_dependencies_audit(
    op_id: String,
    request: DependencyAuditRequest,
) -> Result<OperationResult<DependencyAuditResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || dependencies::audit_dependencies(request))
        .await
        .map_err(|error| format!("m16_dependencies_audit_join_failed: {error}"))?;
    Ok(operation(
        op_id,
        "m16_s03",
        "m16.dependencies.audit",
        started_at,
        timer,
        format!("Read {} declared dependencies from {} manifest(s).", result.dependencies.len(), result.manifests.len()),
        format!("تمت قراءة {} تبعية معلنة من {} ملف مشروع.", result.dependencies.len(), result.manifests.len()),
        result.clone(),
        result.warnings.clone(),
    ))
}

#[tauri::command]
pub async fn m16_commands_execute(
    op_id: String,
    request: CommandManageRequest,
) -> Result<OperationResult<CommandManageResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || commands::manage_commands(request))
        .await
        .map_err(|error| format!("m16_commands_execute_join_failed: {error}"))?;
    Ok(operation(
        op_id,
        "m16_s04",
        "m16.commands.execute",
        started_at,
        timer,
        if let Some(run) = &result.run { format!("Task {} exited with code {}.", run.task_id, run.exit_code) } else { format!("Discovered {} project-defined task(s).", result.tasks.len()) },
        if let Some(run) = &result.run { format!("انتهت المهمة {} برمز خروج {}.", run.task_id, run.exit_code) } else { format!("تم اكتشاف {} مهمة معرفة داخل المشروع.", result.tasks.len()) },
        result.clone(),
        result.warnings.clone(),
    ))
}

#[tauri::command]
pub async fn m16_environment_audit(
    op_id: String,
    request: EnvironmentAuditRequest,
) -> Result<OperationResult<EnvironmentAuditResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || environment::audit_environment(request))
        .await
        .map_err(|error| format!("m16_environment_audit_join_failed: {error}"))?;
    Ok(operation(op_id, "m16_s05", "m16.environment.audit", started_at, timer, format!("Compared {} environment key name(s) without exposing values.", result.keys.len()), format!("تمت مقارنة {} من أسماء مفاتيح البيئة دون كشف القيم.", result.keys.len()), result.clone(), result.warnings.clone()))
}

#[tauri::command]
pub async fn m16_source_analyze(
    op_id: String,
    request: SourceAnalyzeRequest,
) -> Result<OperationResult<SourceAnalyzeResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || source_map::analyze_source(request))
        .await
        .map_err(|error| format!("m16_source_analyze_join_failed: {error}"))?;
    Ok(operation(op_id, "m16_s06", "m16.source.analyze", started_at, timer, format!("Mapped {} source file(s) across {} language group(s).", result.source_file_count, result.languages.len()), format!("تم تحليل {} ملف مصدر ضمن {} مجموعة لغات.", result.source_file_count, result.languages.len()), result.clone(), result.warnings.clone()))
}

#[tauri::command]
pub async fn m16_cache_manage(
    op_id: String,
    request: CacheManageRequest,
) -> Result<OperationResult<CacheManageResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || cache::manage_cache(request))
        .await
        .map_err(|error| format!("m16_cache_manage_join_failed: {error}"))?;
    Ok(operation(op_id, "m16_s07", "m16.cache.manage", started_at, timer, format!("Measured {} allowlisted target(s); reclaimed {} byte(s).", result.targets.len(), result.reclaimed_bytes), format!("تم قياس {} مسار مسموح واسترداد {} بايت.", result.targets.len(), result.reclaimed_bytes), result.clone(), result.warnings.clone()))
}

#[tauri::command]
pub async fn m16_git_workspace(
    op_id: String,
    request: GitWorkspaceRequest,
) -> Result<OperationResult<GitWorkspaceResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || git::workspace_status(request))
        .await
        .map_err(|error| format!("m16_git_workspace_join_failed: {error}"))?;
    Ok(operation(op_id, "m16_s08", "m16.git.workspace", started_at, timer, format!("Read Git workspace state for branch '{}'.", result.branch), format!("تمت قراءة حالة Git للفرع '{}'.", result.branch), result.clone(), result.warnings.clone()))
}

#[tauri::command]
pub async fn m16_runtime_orchestrate(
    op_id: String,
    request: RuntimeManageRequest,
) -> Result<OperationResult<RuntimeManageResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || runtime::manage_runtime(request))
        .await
        .map_err(|error| format!("m16_runtime_orchestrate_join_failed: {error}"))?;
    Ok(operation(op_id, "m16_s09", "m16.runtime.orchestrate", started_at, timer, format!("Found {} process(es) with project-path evidence.", result.processes.len()), format!("تم العثور على {} عملية مرتبطة بمسار المشروع بأدلة فعلية.", result.processes.len()), result.clone(), result.warnings.clone()))
}

#[tauri::command]
pub async fn m16_reports_export(
    app: AppHandle,
    op_id: String,
    request: ReportsExportRequest,
) -> Result<OperationResult<ReportsExportResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let app_for_worker = app.clone();
    let project_path = request.project_path.clone();
    let result = tauri::async_runtime::spawn_blocking(move || reports::export_report(&app_for_worker, request))
        .await
        .map_err(|error| format!("m16_reports_export_join_failed: {error}"))?;
    if !result.report_id.is_empty() {
        if let Ok(connection) = crate::storage::database::open(&app) {
            let _ = persistence::save_report(&connection, &project_path, &result);
        }
    }
    Ok(operation(op_id, "m16_s10", "m16.reports.export", started_at, timer, format!("Exported a {} report containing {} byte(s).", result.format, result.size_bytes), format!("تم تصدير تقرير {} بحجم {} بايت.", result.format, result.size_bytes), result.clone(), result.warnings.clone()))
}
