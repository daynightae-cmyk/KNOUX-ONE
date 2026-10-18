use rusqlite::{params, Connection};

use super::contracts::{ProjectRecord, ReportsExportResult};

pub fn save_project_record(connection: &Connection, record: &ProjectRecord) -> Result<(), String> {
    connection.execute(
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
    ).map_err(|error| format!("save_project_record_failed: {error}"))?;
    Ok(())
}

pub fn list_project_records(connection: &Connection) -> Result<Vec<ProjectRecord>, String> {
    let mut statement = connection.prepare(
        "SELECT id, canonical_path, name, ecosystems_json, frameworks_json, manifests_json,
                package_manager, git_repository, branch, file_count, source_file_count,
                manifest_count, size_bytes, build_artifact_bytes, last_modified, confidence,
                warnings_json
         FROM project_index ORDER BY updated_at DESC LIMIT 500",
    ).map_err(|error| format!("prepare_list_projects_failed: {error}"))?;
    let rows = statement.query_map([], |row| {
        let ecosystems_json: String = row.get(3)?;
        let frameworks_json: String = row.get(4)?;
        let manifests_json: String = row.get(5)?;
        let warnings_json: String = row.get(16)?;
        Ok(ProjectRecord {
            id: row.get(0)?, canonical_path: row.get(1)?, name: row.get(2)?,
            ecosystems: serde_json::from_str(&ecosystems_json).unwrap_or_default(),
            frameworks: serde_json::from_str(&frameworks_json).unwrap_or_default(),
            manifests: serde_json::from_str(&manifests_json).unwrap_or_default(),
            package_manager: row.get(6)?, git_repository: row.get::<_, i64>(7)? != 0,
            branch: row.get(8)?, file_count: row.get::<_, i64>(9)? as u64,
            source_file_count: row.get::<_, i64>(10)? as u64,
            manifest_count: row.get::<_, i64>(11)? as u64,
            size_bytes: row.get::<_, i64>(12)? as u64,
            build_artifact_bytes: row.get::<_, i64>(13)? as u64,
            last_modified: row.get(14)?, confidence: row.get::<_, f64>(15)? as f32,
            warnings: serde_json::from_str(&warnings_json).unwrap_or_default(),
        })
    }).map_err(|error| format!("query_list_projects_failed: {error}"))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| format!("decode_project_records_failed: {error}"))
}

pub fn save_report(connection: &Connection, project_path: &str, report: &ReportsExportResult) -> Result<(), String> {
    connection.execute(
        "INSERT OR REPLACE INTO project_reports(id, project_path, format, exported_path, size_bytes, created_at)
         VALUES (?1,?2,?3,?4,?5,?6)",
        params![report.report_id, project_path, report.format, report.report_path, report.size_bytes as i64, report.created_at],
    ).map_err(|error| format!("save_project_report_failed: {error}"))?;
    Ok(())
}
