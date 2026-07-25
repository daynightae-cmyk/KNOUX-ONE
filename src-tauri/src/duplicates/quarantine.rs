use crate::{
    duplicates::{
        contracts::{
            QuarantineActionResult, QuarantineInput, QuarantineRecord, QuarantineRequest,
            RestoreConflictMode,
        },
        errors::DuplicateError,
        hashing::{full_blake3, sha256},
        traversal::{is_protected_path, normalize_path},
    },
    storage::database,
};
use chrono::{DateTime, Utc};
use filetime::{set_file_times, FileTime};
use rusqlite::params;
use std::{
    fs::{self, File},
    path::{Path, PathBuf},
    time::SystemTime,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

fn rfc3339(value: Result<SystemTime, std::io::Error>) -> String {
    value
        .ok()
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(Utc::now)
        .to_rfc3339()
}
fn quarantine_root(app: &AppHandle) -> Result<PathBuf, DuplicateError> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| DuplicateError::QuarantineCopyFailed(error.to_string()))?
        .join("duplicate_quarantine")
        .join("files");
    fs::create_dir_all(&root)?;
    Ok(root)
}
fn unique_restore_path(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("restored");
    let extension = path.extension().and_then(|value| value.to_str());
    for index in 1..10_000 {
        let name = match extension {
            Some(extension) if !extension.is_empty() => {
                format!("{stem} (restored {index}).{extension}")
            }
            _ => format!("{stem} (restored {index})"),
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!("{stem} (restored {})", Uuid::new_v4()))
}
fn sync_file(path: &Path) -> Result<(), DuplicateError> {
    File::open(path)?
        .sync_all()
        .map_err(|error| DuplicateError::QuarantineCopyFailed(error.to_string()))
}

pub(crate) fn copy_verify_delete(
    source: &Path,
    destination: &Path,
    expected_hash: &str,
) -> Result<(), DuplicateError> {
    fs::copy(source, destination)
        .map_err(|error| DuplicateError::QuarantineCopyFailed(error.to_string()))?;
    sync_file(destination)?;
    if full_blake3(destination)? != expected_hash {
        let tombstone =
            destination.with_file_name(format!(".knoux-rejected-{}.tmp", Uuid::new_v4()));
        let cleanup_path = match fs::rename(destination, &tombstone) {
            Ok(()) => tombstone,
            Err(_) => destination.to_path_buf(),
        };
        for _ in 0..80 {
            match fs::remove_file(&cleanup_path) {
                Ok(()) => break,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
                Err(_) => std::thread::sleep(std::time::Duration::from_millis(25)),
            }
        }
        if destination.exists() {
            return Err(DuplicateError::QuarantineVerifyFailed(format!(
                "failed_to_isolate_unverified_copy:{}",
                destination.display()
            )));
        }
        return Err(DuplicateError::QuarantineVerifyFailed(
            destination.display().to_string(),
        ));
    }
    fs::remove_file(source)
        .map_err(|error| DuplicateError::QuarantineCopyFailed(error.to_string()))?;
    Ok(())
}

pub(crate) fn move_verified(
    source: &Path,
    destination: &Path,
    expected_hash: &str,
) -> Result<(), DuplicateError> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    match fs::rename(source, destination) {
        Ok(()) => {
            if full_blake3(destination)? != expected_hash {
                let _ = fs::rename(destination, source);
                return Err(DuplicateError::QuarantineVerifyFailed(
                    destination.display().to_string(),
                ));
            }
            Ok(())
        }
        Err(_) => copy_verify_delete(source, destination, expected_hash),
    }
}

fn load_record(
    connection: &rusqlite::Connection,
    quarantine_id: &str,
) -> Result<QuarantineRecord, DuplicateError> {
    connection.query_row("SELECT id, scan_session_id, group_id, original_path, quarantine_path, file_name, size_bytes, blake3, file_identity, created_time, modified_time, quarantined_at, reason, keeper_path, restore_state, verification_state, purge_state, last_error FROM duplicate_quarantine WHERE id = ?1", params![quarantine_id], |row| Ok(QuarantineRecord { quarantine_id: row.get(0)?, scan_session_id: row.get(1)?, group_id: row.get(2)?, original_path: row.get(3)?, quarantine_path: row.get(4)?, file_name: row.get(5)?, size_bytes: row.get::<_, i64>(6)? as u64, hash: row.get(7)?, file_identity: row.get(8)?, created_time: row.get(9)?, modified_time: row.get(10)?, quarantined_at: row.get(11)?, reason: row.get(12)?, keeper_path: row.get(13)?, status: row.get(14)?, verification_state: row.get(15)?, purge_state: row.get(16)?, last_error: row.get(17)? })).map_err(DuplicateError::from)
}

fn list_records(
    connection: &rusqlite::Connection,
) -> Result<Vec<QuarantineRecord>, DuplicateError> {
    let mut statement = connection.prepare("SELECT id, scan_session_id, group_id, original_path, quarantine_path, file_name, size_bytes, blake3, file_identity, created_time, modified_time, quarantined_at, reason, keeper_path, restore_state, verification_state, purge_state, last_error FROM duplicate_quarantine ORDER BY quarantined_at DESC")?;
    let rows = statement.query_map([], |row| {
        Ok(QuarantineRecord {
            quarantine_id: row.get(0)?,
            scan_session_id: row.get(1)?,
            group_id: row.get(2)?,
            original_path: row.get(3)?,
            quarantine_path: row.get(4)?,
            file_name: row.get(5)?,
            size_bytes: row.get::<_, i64>(6)? as u64,
            hash: row.get(7)?,
            file_identity: row.get(8)?,
            created_time: row.get(9)?,
            modified_time: row.get(10)?,
            quarantined_at: row.get(11)?,
            reason: row.get(12)?,
            keeper_path: row.get(13)?,
            status: row.get(14)?,
            verification_state: row.get(15)?,
            purge_state: row.get(16)?,
            last_error: row.get(17)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn quarantine_item(
    app: &AppHandle,
    connection: &rusqlite::Connection,
    item: &QuarantineInput,
) -> Result<QuarantineRecord, DuplicateError> {
    let source = dunce::canonicalize(&item.original_path)
        .map_err(|error| DuplicateError::InvalidScanSource(error.to_string()))?;
    let keeper = dunce::canonicalize(&item.keeper_path)
        .map_err(|error| DuplicateError::KeeperMissing(error.to_string()))?;
    if source == keeper || !keeper.is_file() {
        return Err(DuplicateError::KeeperMissing(item.group_id.clone()));
    }
    if full_blake3(&keeper)? != item.expected_hash {
        return Err(DuplicateError::KeeperMissing(format!(
            "{}: keeper is not a verified copy",
            item.group_id
        )));
    }
    if is_protected_path(&source) {
        return Err(DuplicateError::ProtectedPathSelected(
            source.display().to_string(),
        ));
    }
    let source_hash = full_blake3(&source)?;
    if source_hash != item.expected_hash {
        return Err(DuplicateError::FileChangedDuringScan(
            source.display().to_string(),
        ));
    }
    let metadata = fs::metadata(&source)?;
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("quarantined-file")
        .to_string();
    let quarantine_id = Uuid::new_v4().to_string();
    let destination = quarantine_root(app)?.join(&quarantine_id).join(&file_name);
    move_verified(&source, &destination, &source_hash)?;
    let destination_hash = full_blake3(&destination)?;
    if destination_hash != source_hash {
        let _ = move_verified(&destination, &source, &source_hash);
        return Err(DuplicateError::QuarantineVerifyFailed(
            destination.display().to_string(),
        ));
    }
    let file_identity = format!("path:{}", normalize_path(&destination));
    let created_time = rfc3339(metadata.created());
    let modified_time = rfc3339(metadata.modified());
    let quarantined_at = Utc::now().to_rfc3339();
    let sha256_value = sha256(&destination).ok();
    let attributes = serde_json::json!({"readonly": metadata.permissions().readonly()}).to_string();
    let insert_result = connection.execute("INSERT INTO duplicate_quarantine (id, scan_session_id, group_id, original_path, quarantine_path, file_name, size_bytes, blake3, sha256_optional, file_identity, created_time, modified_time, attributes_json, quarantined_at, reason, keeper_path, restore_state, verification_state, purge_state) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'quarantined', 'verified', 'active')", params![quarantine_id, item.scan_session_id, item.group_id, source.to_string_lossy().to_string(), destination.to_string_lossy().to_string(), file_name, metadata.len() as i64, source_hash, sha256_value, file_identity, created_time, modified_time, attributes, quarantined_at, item.reason, keeper.to_string_lossy().to_string()]);
    if let Err(error) = insert_result {
        let _ = move_verified(&destination, &source, &destination_hash);
        return Err(DuplicateError::ScanDatabaseFailed(error.to_string()));
    }
    load_record(connection, &quarantine_id)
}

fn record_attributes(
    connection: &rusqlite::Connection,
    quarantine_id: &str,
) -> Result<String, DuplicateError> {
    connection
        .query_row(
            "SELECT attributes_json FROM duplicate_quarantine WHERE id = ?1",
            params![quarantine_id],
            |row| row.get(0),
        )
        .map_err(DuplicateError::from)
}

fn restore_item(
    connection: &rusqlite::Connection,
    quarantine_id: &str,
    conflict_mode: RestoreConflictMode,
    destination: Option<String>,
) -> Result<QuarantineRecord, DuplicateError> {
    let record = load_record(connection, quarantine_id)?;
    if record.status != "quarantined" {
        return Err(DuplicateError::RestoreConflict(
            "Item is not in quarantined state.".into(),
        ));
    }
    let source = PathBuf::from(&record.quarantine_path);
    if !source.exists() || full_blake3(&source)? != record.hash {
        return Err(DuplicateError::RestoreVerifyFailed(
            "Quarantine checksum mismatch or file missing.".into(),
        ));
    }
    let requested = destination
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(&record.original_path));
    let mut replacement_backup: Option<PathBuf> = None;
    let target = if requested.exists() {
        match conflict_mode {
            RestoreConflictMode::Fail => {
                return Err(DuplicateError::RestoreConflict(
                    requested.display().to_string(),
                ))
            }
            RestoreConflictMode::Rename => unique_restore_path(&requested),
            RestoreConflictMode::Replace => {
                if !requested.is_file() {
                    return Err(DuplicateError::RestoreConflict(
                        "Replacement target is not a regular file.".into(),
                    ));
                }
                let backup =
                    requested.with_extension(format!("knoux-restore-backup-{}", Uuid::new_v4()));
                fs::rename(&requested, &backup)?;
                replacement_backup = Some(backup);
                requested
            }
            RestoreConflictMode::Choose => requested,
        }
    } else {
        requested
    };
    if let Err(error) = move_verified(&source, &target, &record.hash) {
        if let Some(backup) = replacement_backup.as_ref() {
            let _ = fs::rename(backup, &target);
        }
        return Err(error);
    }
    if full_blake3(&target)? != record.hash {
        let _ = fs::remove_file(&target);
        if let Some(backup) = replacement_backup.as_ref() {
            let _ = fs::rename(backup, &target);
        }
        return Err(DuplicateError::RestoreVerifyFailed(
            target.display().to_string(),
        ));
    }
    if let Some(backup) = replacement_backup {
        let _ = fs::remove_file(backup);
    }
    if let Ok(modified) = DateTime::parse_from_rfc3339(&record.modified_time) {
        let time =
            FileTime::from_unix_time(modified.timestamp(), modified.timestamp_subsec_nanos());
        let _ = set_file_times(&target, time, time);
    }
    if let Ok(attributes) =
        serde_json::from_str::<serde_json::Value>(&record_attributes(connection, quarantine_id)?)
    {
        if let Some(readonly) = attributes.get("readonly").and_then(|value| value.as_bool()) {
            if let Ok(metadata) = fs::metadata(&target) {
                let mut permissions = metadata.permissions();
                permissions.set_readonly(readonly);
                let _ = fs::set_permissions(&target, permissions);
            }
        }
    }
    connection.execute("UPDATE duplicate_quarantine SET restore_state = 'restored', restore_attempts = restore_attempts + 1, last_error = NULL WHERE id = ?1", params![quarantine_id])?;
    load_record(connection, quarantine_id)
}

fn purge_item(
    connection: &rusqlite::Connection,
    quarantine_id: &str,
    confirmation: &str,
) -> Result<QuarantineRecord, DuplicateError> {
    if confirmation != "PURGE" {
        return Err(DuplicateError::PermanentDeleteFailed(
            "Typed confirmation PURGE is required.".into(),
        ));
    }
    let record = load_record(connection, quarantine_id)?;
    if record.status != "quarantined" {
        return Err(DuplicateError::PermanentDeleteFailed(
            "Only quarantined items can be purged.".into(),
        ));
    }
    let path = PathBuf::from(&record.quarantine_path);
    if path.exists() {
        if full_blake3(&path)? != record.hash {
            return Err(DuplicateError::PermanentDeleteFailed(
                "Quarantine checksum verification failed before purge.".into(),
            ));
        }
        fs::remove_file(&path)
            .map_err(|error| DuplicateError::PermanentDeleteFailed(error.to_string()))?;
    }
    connection.execute("UPDATE duplicate_quarantine SET restore_state = 'purged', purge_state = 'purged', last_error = NULL WHERE id = ?1", params![quarantine_id])?;
    load_record(connection, quarantine_id)
}

pub fn manage(
    app: &AppHandle,
    request: QuarantineRequest,
) -> Result<QuarantineActionResult, DuplicateError> {
    let connection = database::open(app).map_err(DuplicateError::ScanDatabaseFailed)?;
    let mut warnings = Vec::new();
    let records = match request {
        QuarantineRequest::Quarantine { items } => {
            let mut records = Vec::new();
            for item in items {
                match quarantine_item(app, &connection, &item) {
                    Ok(record) => records.push(record),
                    Err(error) => warnings.push(error.to_string()),
                }
            }
            records
        }
        QuarantineRequest::Restore {
            quarantine_id,
            conflict_mode,
            destination,
        } => vec![restore_item(
            &connection,
            &quarantine_id,
            conflict_mode,
            destination,
        )?],
        QuarantineRequest::Purge {
            quarantine_id,
            confirmation,
        } => vec![purge_item(&connection, &quarantine_id, &confirmation)?],
        QuarantineRequest::List => list_records(&connection)?,
        QuarantineRequest::Verify { quarantine_id } => {
            let record = load_record(&connection, &quarantine_id)?;
            let actual = full_blake3(Path::new(&record.quarantine_path))?;
            let state = if actual == record.hash {
                "verified"
            } else {
                "failed"
            };
            connection.execute(
                "UPDATE duplicate_quarantine SET verification_state = ?2 WHERE id = ?1",
                params![quarantine_id, state],
            )?;
            vec![load_record(&connection, &quarantine_id)?]
        }
    };
    Ok(QuarantineActionResult { records, warnings })
}

#[cfg(test)]
mod tests {
    use super::{copy_verify_delete, move_verified};
    use crate::duplicates::hashing::full_blake3;
    use std::fs;
    #[test]
    fn verified_move_preserves_content_and_removes_source() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source.bin");
        let destination = directory.path().join("vault").join("destination.bin");
        fs::write(&source, b"quarantine payload").unwrap();
        let hash = full_blake3(&source).unwrap();
        move_verified(&source, &destination, &hash).unwrap();
        assert!(!source.exists());
        assert!(destination.exists());
        assert_eq!(full_blake3(&destination).unwrap(), hash);
    }
    #[test]
    fn copy_verify_delete_preserves_source_on_hash_mismatch() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source.bin");
        let destination = directory.path().join("destination.bin");
        fs::write(&source, b"payload").unwrap();
        let result = copy_verify_delete(&source, &destination, "wrong-hash");
        assert!(result.is_err());
        assert!(source.exists());
        assert!(!destination.exists());
    }
}
