use crate::{
    duplicates::contracts::{DuplicateScanRequest, DuplicateScanResult},
    storage::database,
};
use rusqlite::{params, Connection};
use tauri::AppHandle;

pub fn persist_scan(
    app: &AppHandle,
    request: &DuplicateScanRequest,
    result: &DuplicateScanResult,
) -> Result<(), String> {
    let mut connection = database::open(app)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("scan_transaction_failed: {error}"))?;
    transaction.execute("INSERT OR REPLACE INTO duplicate_scan_sessions (id, operation_id, mode, status, started_at, completed_at, scanned_files, scanned_bytes, duplicate_groups, reclaimable_bytes, error_count, warnings_json) VALUES (?1, ?2, ?3, 'completed', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)", params![&result.summary.scan_id, &result.summary.operation_id, &result.summary.scan_mode, &result.summary.started_at, &result.summary.completed_at, result.summary.total_files_scanned as i64, result.summary.total_bytes_scanned as i64, result.summary.duplicate_groups_found as i64, result.summary.total_wasted_bytes as i64, result.summary.error_count as i64, serde_json::to_string(&result.warnings).unwrap_or_else(|_| "[]".into())]).map_err(|error| format!("scan_session_persist_failed: {error}"))?;
    for source in &request.paths {
        transaction
            .execute(
                "INSERT INTO duplicate_scan_sources(scan_session_id, path) VALUES (?1, ?2)",
                params![&result.summary.scan_id, source],
            )
            .map_err(|error| format!("scan_source_persist_failed: {error}"))?;
    }
    for exclusion in &request.excluded_paths {
        transaction
            .execute(
                "INSERT INTO duplicate_scan_exclusions(scan_session_id, path) VALUES (?1, ?2)",
                params![&result.summary.scan_id, exclusion],
            )
            .map_err(|error| format!("scan_exclusion_persist_failed: {error}"))?;
    }
    for group in &result.groups {
        transaction.execute("INSERT OR REPLACE INTO duplicate_groups (id, scan_session_id, mode, category, common_hash, proof_status, confidence, actionable, wasted_size_bytes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)", params![&group.group_id, &result.summary.scan_id, &group.mode, &group.category, &group.common_hash, &group.proof_status, group.confidence as f64, if group.actionable { 1i64 } else { 0i64 }, group.wasted_size_bytes as i64]).map_err(|error| format!("duplicate_group_persist_failed: {error}"))?;
        for file in &group.files {
            transaction.execute("INSERT OR REPLACE INTO duplicate_files (id, scan_session_id, canonical_path, display_path, file_name, extension, size_bytes, modified_time, created_time, mime_type, partial_hash, full_hash, perceptual_hash, file_identity, hard_link_count, is_hard_link_alias, protected_path) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)", params![&file.id, &result.summary.scan_id, &file.canonical_path, &file.path, &file.name, &file.extension, file.size_bytes as i64, &file.modified_time, &file.created_time, &file.mime_type, file.partial_hash.as_deref(), &file.hash, file.perceptual_hash.as_deref(), &file.file_identity, file.hard_link_count as i64, if file.is_hard_link_alias { 1i64 } else { 0i64 }, if file.protected_path { 1i64 } else { 0i64 }]).map_err(|error| format!("duplicate_file_persist_failed: {error}"))?;
            transaction.execute("INSERT OR REPLACE INTO duplicate_group_members (group_id, file_id, similarity_score) VALUES (?1, ?2, ?3)", params![&group.group_id, &file.id, file.similarity_score]).map_err(|error| format!("duplicate_member_persist_failed: {error}"))?;
        }
    }
    transaction
        .commit()
        .map_err(|error| format!("scan_commit_failed: {error}"))
}

pub fn load_scan_history(connection: &Connection) -> Result<Vec<serde_json::Value>, String> {
    let mut statement = connection.prepare("SELECT s.id, s.operation_id, s.mode, s.status, s.started_at, s.completed_at, s.scanned_files, s.scanned_bytes, s.duplicate_groups, s.reclaimable_bytes, s.error_count, (SELECT COUNT(*) FROM duplicate_group_members gm JOIN duplicate_groups g ON g.id = gm.group_id WHERE g.scan_session_id = s.id) AS duplicate_files FROM duplicate_scan_sessions s ORDER BY s.started_at DESC LIMIT 100").map_err(|error| format!("scan_history_prepare_failed: {error}"))?;
    let rows = statement.query_map([], |row| {
        let scan_id: String = row.get(0)?;
        let mut source_statement = connection.prepare("SELECT path FROM duplicate_scan_sources WHERE scan_session_id = ?1 ORDER BY id")?;
        let target_folders = source_statement.query_map(params![&scan_id], |source_row| source_row.get::<_, String>(0))?.collect::<Result<Vec<_>, _>>()?;
        Ok(serde_json::json!({"scanId": scan_id, "operationId": row.get::<_, String>(1)?, "scanMode": row.get::<_, String>(2)?, "status": row.get::<_, String>(3)?, "startedAt": row.get::<_, String>(4)?, "completedAt": row.get::<_, Option<String>>(5)?, "targetFolders": target_folders, "totalFilesScanned": row.get::<_, i64>(6)?, "totalBytesScanned": row.get::<_, i64>(7)?, "duplicateGroupsFound": row.get::<_, i64>(8)?, "totalWastedBytes": row.get::<_, i64>(9)?, "errorCount": row.get::<_, i64>(10)?, "duplicateFilesFound": row.get::<_, i64>(11)?}))
    }).map_err(|error| format!("scan_history_query_failed: {error}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("scan_history_decode_failed: {error}"))
}

pub fn load_scan_result(
    connection: &Connection,
    scan_id: &str,
) -> Result<DuplicateScanResult, String> {
    use crate::duplicates::contracts::{DuplicateFileItem, DuplicateGroup, DuplicateScanSummary};
    let (mut summary, warnings) = connection.query_row("SELECT id, operation_id, mode, started_at, completed_at, scanned_files, scanned_bytes, duplicate_groups, reclaimable_bytes, error_count, warnings_json FROM duplicate_scan_sessions WHERE id = ?1", params![scan_id], |row| {
        let warnings_json: String = row.get(10)?;
        Ok((DuplicateScanSummary { scan_id: row.get(0)?, operation_id: row.get(1)?, scan_mode: row.get(2)?, started_at: row.get(3)?, completed_at: row.get::<_, Option<String>>(4)?.unwrap_or_default(), target_folders: Vec::new(), total_files_scanned: row.get::<_, i64>(5)? as u64, total_bytes_scanned: row.get::<_, i64>(6)? as u64, duplicate_groups_found: row.get::<_, i64>(7)? as u64, duplicate_files_found: 0, total_wasted_bytes: row.get::<_, i64>(8)? as u64, error_count: row.get::<_, i64>(9)? as u64 }, serde_json::from_str::<Vec<String>>(&warnings_json).unwrap_or_default()))
    }).map_err(|error| format!("scan_result_summary_failed: {error}"))?;
    let mut source_statement = connection
        .prepare("SELECT path FROM duplicate_scan_sources WHERE scan_session_id = ?1 ORDER BY id")
        .map_err(|error| format!("scan_result_sources_prepare_failed: {error}"))?;
    summary.target_folders = source_statement
        .query_map(params![scan_id], |row| row.get::<_, String>(0))
        .map_err(|error| format!("scan_result_sources_query_failed: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("scan_result_sources_decode_failed: {error}"))?;
    let mut group_statement = connection.prepare("SELECT id, mode, category, common_hash, proof_status, confidence, actionable, wasted_size_bytes FROM duplicate_groups WHERE scan_session_id = ?1 ORDER BY wasted_size_bytes DESC").map_err(|error| format!("scan_result_groups_prepare_failed: {error}"))?;
    let group_rows = group_statement
        .query_map(params![scan_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, f64>(5)? as f32,
                row.get::<_, i64>(6)? != 0,
                row.get::<_, i64>(7)? as u64,
            ))
        })
        .map_err(|error| format!("scan_result_groups_query_failed: {error}"))?;
    let mut groups = Vec::new();
    for group_row in group_rows {
        let (
            group_id,
            mode,
            category,
            common_hash,
            proof_status,
            confidence,
            actionable,
            wasted_size_bytes,
        ) = group_row.map_err(|error| format!("scan_result_group_decode_failed: {error}"))?;
        let mut file_statement = connection.prepare("SELECT f.id, f.display_path, f.canonical_path, f.file_name, f.extension, f.size_bytes, f.modified_time, f.created_time, f.full_hash, f.partial_hash, f.perceptual_hash, gm.similarity_score, f.mime_type, f.file_identity, f.hard_link_count, f.is_hard_link_alias, f.protected_path FROM duplicate_group_members gm JOIN duplicate_files f ON f.id = gm.file_id WHERE gm.group_id = ?1 ORDER BY f.display_path").map_err(|error| format!("scan_result_files_prepare_failed: {error}"))?;
        let files = file_statement
            .query_map(params![&group_id], |row| {
                Ok(DuplicateFileItem {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    canonical_path: row.get(2)?,
                    name: row.get(3)?,
                    extension: row.get(4)?,
                    size_bytes: row.get::<_, i64>(5)? as u64,
                    modified_time: row.get(6)?,
                    created_time: row.get(7)?,
                    hash: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
                    partial_hash: row.get(9)?,
                    perceptual_hash: row.get(10)?,
                    similarity_score: row.get::<_, Option<f64>>(11)?.map(|value| value as f32),
                    mime_type: row.get(12)?,
                    width: None,
                    height: None,
                    file_identity: row.get(13)?,
                    hard_link_count: row.get::<_, i64>(14)? as u64,
                    is_hard_link_alias: row.get::<_, i64>(15)? != 0,
                    protected_path: row.get::<_, i64>(16)? != 0,
                })
            })
            .map_err(|error| format!("scan_result_files_query_failed: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("scan_result_files_decode_failed: {error}"))?;
        groups.push(DuplicateGroup {
            group_id,
            mode,
            category,
            files,
            wasted_size_bytes,
            common_hash,
            proof_status,
            confidence,
            actionable,
            warnings: Vec::new(),
        });
    }
    summary.duplicate_files_found = groups.iter().map(|group| group.files.len() as u64).sum();
    Ok(DuplicateScanResult {
        job_id: format!("history:{scan_id}"),
        groups,
        summary,
        warnings,
    })
}
