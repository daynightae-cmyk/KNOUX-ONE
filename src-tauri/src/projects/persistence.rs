use rusqlite::{params, Connection};

use super::contracts::{ProjectRecord, ReportsExportResult};

pub fn save_project_record(connection: &Connection, record: &ProjectRecord) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO project_index(
            id, canonical_path, name, ecosystems_json, frameworks_json, manifests_json,
            package_manager, git_repository, branch, file_count, source_file_count,
            manifest_count, size_bytes, build_artifact_bytes, last_modified, confidence,
            warnings_json, updated_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,datetime('now'))
         ON CONFLICT(canonical_path) DO UPDATE SET
            name=excluded.name, ecosystems_json=excluded.ecosystems_json,
            frameworks_json=excluded.frameworks_json, manifests_json=excluded.manifests_json,
            package_manager=excluded.package_manager, git_repository=excluded.git_repository,
            branch=excluded.branch, file_count=excluded.file_count,
            source_file_count=excluded.source_file_count, manifest_count=excluded.manifest_count,
            size_bytes=excluded.size_bytes, build_artifact_bytes=excluded.build_artifact_bytes,
            last_modified=excluded.last_modified, confidence=excluded.confidence,
            warnings_json=excluded.warnings_json, updated_at=datetime('now')",
            params![
                record.id,
                record.canonical_path,
                record.name,
                serde_json::to_string(&record.ecosystems).unwrap_or_else(|_| "[]".into()),
                serde_json::to_string(&record.frameworks).unwrap_or_else(|_| "[]".into()),
                serde_json::to_string(&record.manifests).unwrap_or_else(|_| "[]".into()),
                record.package_manager,
                if record.git_repository { 1i64 } else { 0i64 },
                record.branch,
                record.file_count as i64,
                record.source_file_count as i64,
                record.manifest_count as i64,
                record.size_bytes as i64,
                record.build_artifact_bytes as i64,
                record.last_modified,
                record.confidence as f64,
                serde_json::to_string(&record.warnings).unwrap_or_else(|_| "[]".into()),
            ],
        )
        .map_err(|error| format!("save_project_record_failed: {error}"))?;
    Ok(())
}

pub fn save_report(
    connection: &Connection,
    project_path: &str,
    report: &ReportsExportResult,
) -> Result<(), String> {
    connection.execute(
        "INSERT OR REPLACE INTO project_reports(id, project_path, format, exported_path, size_bytes, created_at)
         VALUES (?1,?2,?3,?4,?5,?6)",
        params![report.report_id, project_path, report.format, report.report_path, report.size_bytes as i64, report.created_at],
    ).map_err(|error| format!("save_project_report_failed: {error}"))?;
    Ok(())
}
