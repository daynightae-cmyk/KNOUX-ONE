use rusqlite::Connection;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

pub fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app_data_dir_unavailable: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("app_data_dir_create_failed: {error}"))?;
    Ok(directory.join("knoux-one.sqlite3"))
}

pub fn open(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let connection =
        Connection::open(path).map_err(|error| format!("database_open_failed: {error}"))?;
    connection
        .busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|error| format!("database_busy_timeout_failed: {error}"))?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;")
        .map_err(|error| format!("database_pragma_failed: {error}"))?;
    migrate(&connection)?;
    Ok(connection)
}

pub fn migrate(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(include_str!("../../migrations/001_duplicate_engine.sql"))
        .map_err(|error| format!("migration_001_failed: {error}"))?;
    connection
        .execute_batch(include_str!("../../migrations/002_duplicate_indexes.sql"))
        .map_err(|error| format!("migration_002_failed: {error}"))?;
    connection
        .execute_batch(include_str!("../../migrations/003_quarantine.sql"))
        .map_err(|error| format!("migration_003_failed: {error}"))?;
    connection
        .execute(
            "INSERT INTO app_meta(key, value, updated_at) VALUES ('schema_version', '3', datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            [],
        )
        .map_err(|error| format!("schema_version_update_failed: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate;
    use rusqlite::Connection;

    #[test]
    fn migrations_create_duplicate_and_quarantine_tables() {
        let connection = Connection::open_in_memory().expect("in-memory database");
        migrate(&connection).expect("migrations");
        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
                  'duplicate_scan_sessions',
                  'duplicate_files',
                  'duplicate_groups',
                  'duplicate_quarantine'
                )",
                [],
                |row| row.get(0),
            )
            .expect("table count");
        assert_eq!(count, 4);
    }
}
