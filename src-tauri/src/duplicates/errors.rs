use thiserror::Error;

#[derive(Debug, Error)]
pub enum DuplicateError {
    #[error("invalid_scan_source: {0}")]
    InvalidScanSource(String),
    #[error("source_access_denied: {0}")]
    SourceAccessDenied(String),
    #[error("protected_path_selected: {0}")]
    ProtectedPathSelected(String),
    #[error("file_changed_during_scan: {0}")]
    FileChangedDuringScan(String),
    #[error("file_locked: {0}")]
    FileLocked(String),
    #[error("hash_read_failed: {0}")]
    HashReadFailed(String),
    #[error("scan_cancelled")]
    ScanCancelled,
    #[error("scan_database_failed: {0}")]
    ScanDatabaseFailed(String),
    #[error("keeper_missing: {0}")]
    KeeperMissing(String),
    #[error("quarantine_copy_failed: {0}")]
    QuarantineCopyFailed(String),
    #[error("quarantine_verify_failed: {0}")]
    QuarantineVerifyFailed(String),
    #[error("restore_conflict: {0}")]
    RestoreConflict(String),
    #[error("restore_verify_failed: {0}")]
    RestoreVerifyFailed(String),
    #[error("permanent_delete_failed: {0}")]
    PermanentDeleteFailed(String),
    #[error("io_error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database_error: {0}")]
    Database(#[from] rusqlite::Error),
}

impl DuplicateError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidScanSource(_) => "invalid_scan_source",
            Self::SourceAccessDenied(_) => "source_access_denied",
            Self::ProtectedPathSelected(_) => "protected_path_selected",
            Self::FileChangedDuringScan(_) => "file_changed_during_scan",
            Self::FileLocked(_) => "file_locked",
            Self::HashReadFailed(_) => "hash_read_failed",
            Self::ScanCancelled => "scan_cancelled",
            Self::ScanDatabaseFailed(_) => "scan_database_failed",
            Self::KeeperMissing(_) => "keeper_missing",
            Self::QuarantineCopyFailed(_) => "quarantine_copy_failed",
            Self::QuarantineVerifyFailed(_) => "quarantine_verify_failed",
            Self::RestoreConflict(_) => "restore_conflict",
            Self::RestoreVerifyFailed(_) => "restore_verify_failed",
            Self::PermanentDeleteFailed(_) => "permanent_delete_failed",
            Self::Io(_) => "io_error",
            Self::Database(_) => "database_error",
        }
    }
}
