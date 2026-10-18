use crate::storage::database;
use chrono::Utc;
use rusqlite::params;
use serde_json::Value;
use tauri::AppHandle;
use uuid::Uuid;

pub fn record_session(app: &AppHandle, service_id: &str, status: &str, evidence: &Value, warnings: &[String]) -> Result<String, String> {
    let connection = database::open(app)?;
    let id = Uuid::new_v4().to_string();
    connection.execute(
        "INSERT INTO diagnostic_sessions(id, service_id, status, started_at, completed_at, evidence_json, warnings_json) VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6)",
        params![id, service_id, status, Utc::now().to_rfc3339(), evidence.to_string(), serde_json::to_string(warnings).unwrap_or_else(|_| "[]".into())],
    ).map_err(|error| format!("diagnostic_session_persist_failed: {error}"))?;
    Ok(id)
}

pub fn record_export(app: &AppHandle, export_id: &str, export_type: &str, path: &str, sha256: &str, size_bytes: u64, redaction_count: usize) -> Result<(), String> {
    let connection = database::open(app)?;
    connection.execute(
        "INSERT INTO diagnostic_exports(id, export_type, path, sha256, size_bytes, redaction_count, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![export_id, export_type, path, sha256, size_bytes as i64, redaction_count as i64, Utc::now().to_rfc3339()],
    ).map_err(|error| format!("diagnostic_export_persist_failed: {error}"))?;
    Ok(())
}
