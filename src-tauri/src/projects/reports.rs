use std::{fs, path::PathBuf};

use chrono::Utc;
use serde_json::json;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::{
    contracts::{
        DependencyAuditRequest, EnvironmentAuditRequest, GitWorkspaceRequest, ProjectHealthRequest,
        ReportsExportRequest, ReportsExportResult, SourceAnalyzeRequest,
    },
    dependencies::audit_dependencies,
    environment::audit_environment,
    git::workspace_status,
    health::audit_health,
    safety::{redacted_path, validate_project_root},
    source_map::analyze_source,
};

fn sanitize_file_name(value: &str) -> String {
    value.chars().map(|character| if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') { character } else { '_' }).collect()
}

pub fn export_report(app: &AppHandle, request: ReportsExportRequest) -> ReportsExportResult {
    let root = match validate_project_root(&request.project_path) {
        Ok(path) => path,
        Err(error) => return ReportsExportResult { report_id: String::new(), report_path: String::new(), format: request.format, size_bytes: 0, created_at: Utc::now().to_rfc3339(), warnings: vec![error.to_string()] },
    };
    let format = request.format.to_ascii_lowercase();
    if !matches!(format.as_str(), "json" | "markdown" | "md" | "html" | "csv") {
        return ReportsExportResult { report_id: String::new(), report_path: String::new(), format, size_bytes: 0, created_at: Utc::now().to_rfc3339(), warnings: vec!["unsupported_report_format".into()] };
    }
    let health = audit_health(ProjectHealthRequest { project_path: root.to_string_lossy().to_string() });
    let dependencies = audit_dependencies(DependencyAuditRequest { project_path: root.to_string_lossy().to_string() });
    let environment = audit_environment(EnvironmentAuditRequest { project_path: root.to_string_lossy().to_string() });
    let source = analyze_source(SourceAnalyzeRequest { project_path: root.to_string_lossy().to_string() });
    let git = workspace_status(GitWorkspaceRequest { project_path: root.to_string_lossy().to_string() });
    let created_at = Utc::now().to_rfc3339();
    let project_name = root.file_name().and_then(|value| value.to_str()).unwrap_or("project");
    let report_id = Uuid::new_v4().to_string();
    let displayed_path = if request.redact_absolute_paths { redacted_path(&root) } else { root.to_string_lossy().to_string() };
    let evidence = json!({
        "reportId": report_id,
        "createdAt": created_at,
        "project": { "name": project_name, "path": displayed_path },
        "health": health,
        "dependencies": dependencies,
        "environment": environment,
        "source": source,
        "git": git,
        "redaction": { "absolutePaths": request.redact_absolute_paths, "secretValues": true },
        "limitations": [
            "Dependency vulnerability commands are not executed automatically.",
            "Runtime process evidence is exported only when separately inspected.",
        ]
    });

    let content = match format.as_str() {
        "json" => serde_json::to_string_pretty(&evidence).unwrap_or_else(|_| "{}".into()),
        "markdown" | "md" => format!(
            "# KNOUX Project Engineering Report\n\n- Report ID: `{}`\n- Created: `{}`\n- Project: `{}`\n- Health score: **{}**\n- Source files: **{}**\n- Dependencies: **{}**\n- Git branch: `{}`\n\n## Findings\n{}\n\n## Warnings\n{}\n",
            report_id,
            created_at,
            displayed_path,
            evidence["health"]["healthScore"].as_u64().unwrap_or(0),
            evidence["source"]["sourceFileCount"].as_u64().unwrap_or(0),
            evidence["dependencies"]["dependencies"].as_array().map(Vec::len).unwrap_or(0),
            evidence["git"]["branch"].as_str().unwrap_or(""),
            evidence["health"]["findings"].as_array().map(|rows| rows.iter().map(|row| format!("- {}", row["title"].as_str().unwrap_or("finding"))).collect::<Vec<_>>().join("\n")).unwrap_or_default(),
            evidence["health"]["warnings"].as_array().map(|rows| rows.iter().map(|row| format!("- {}", row.as_str().unwrap_or("warning"))).collect::<Vec<_>>().join("\n")).unwrap_or_default(),
        ),
        "html" => format!(
            "<!doctype html><html><head><meta charset=\"utf-8\"><title>KNOUX Project Report</title><style>body{{font-family:Segoe UI,Arial,sans-serif;max-width:1100px;margin:40px auto;padding:0 24px;color:#151526}}pre{{white-space:pre-wrap;background:#f3f4f8;padding:16px;border-radius:12px}}</style></head><body><h1>KNOUX Project Engineering Report</h1><p><strong>Project:</strong> {}</p><p><strong>Created:</strong> {}</p><p><strong>Health score:</strong> {}</p><h2>Evidence JSON</h2><pre>{}</pre></body></html>",
            html_escape(&displayed_path), html_escape(&created_at), evidence["health"]["healthScore"], html_escape(&serde_json::to_string_pretty(&evidence).unwrap_or_default())
        ),
        "csv" => {
            let mut rows = vec!["section,key,value".to_string()];
            rows.push(format!("project,name,{}", csv_escape(project_name)));
            rows.push(format!("project,path,{}", csv_escape(&displayed_path)));
            rows.push(format!("health,score,{}", evidence["health"]["healthScore"]));
            rows.push(format!("source,file_count,{}", evidence["source"]["sourceFileCount"]));
            rows.push(format!("dependencies,count,{}", evidence["dependencies"]["dependencies"].as_array().map(Vec::len).unwrap_or(0)));
            rows.join("\n")
        }
        _ => unreachable!(),
    };

    let extension = if format == "markdown" { "md" } else { format.as_str() };
    let reports_dir = match app.path().app_data_dir() {
        Ok(path) => path.join("project-reports"),
        Err(error) => return ReportsExportResult { report_id, report_path: String::new(), format, size_bytes: 0, created_at, warnings: vec![format!("app_data_dir_unavailable: {error}")] },
    };
    if let Err(error) = fs::create_dir_all(&reports_dir) {
        return ReportsExportResult { report_id, report_path: String::new(), format, size_bytes: 0, created_at, warnings: vec![format!("report_directory_create_failed: {error}")] };
    }
    let file_name = format!("{}-{}-{}.{}", sanitize_file_name(project_name), Utc::now().format("%Y%m%d-%H%M%S"), &report_id[..8], extension);
    let report_path: PathBuf = reports_dir.join(file_name);
    if let Err(error) = fs::write(&report_path, content.as_bytes()) {
        return ReportsExportResult { report_id, report_path: String::new(), format, size_bytes: 0, created_at, warnings: vec![format!("report_write_failed: {error}")] };
    }
    let size_bytes = fs::metadata(&report_path).map(|metadata| metadata.len()).unwrap_or(0);
    if size_bytes == 0 {
        return ReportsExportResult { report_id, report_path: report_path.to_string_lossy().to_string(), format, size_bytes, created_at, warnings: vec!["report_verification_failed: empty_file".into()] };
    }
    ReportsExportResult { report_id, report_path: report_path.to_string_lossy().to_string(), format, size_bytes, created_at, warnings: Vec::new() }
}

fn html_escape(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn csv_escape(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

#[cfg(test)]
mod tests {
    use super::{csv_escape, html_escape};
    #[test]
    fn escapes_report_content() {
        assert_eq!(html_escape("<secret>"), "&lt;secret&gt;");
        assert_eq!(csv_escape("a,b"), "\"a,b\"");
    }
}
