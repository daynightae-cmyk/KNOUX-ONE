use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProjectError {
    #[error("project_path_not_found: {0}")]
    PathNotFound(String),
    #[error("protected_project_path: {0}")]
    ProtectedPath(String),
    #[error("path_outside_project_root: {0}")]
    OutsideProjectRoot(String),
    #[error("confirmation_required: {0}")]
    ConfirmationRequired(String),
    #[error("unsupported_project_task: {0}")]
    UnsupportedTask(String),
    #[error("project_command_failed: {0}")]
    CommandFailed(String),
    #[error("manifest_parse_failed: {0}")]
    ParseError(String),
    #[error("project_db_error: {0}")]
    DatabaseError(String),
    #[error("report_export_failed: {0}")]
    ReportExport(String),
    #[error("io_error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database_error: {0}")]
    Database(#[from] rusqlite::Error),
}

impl ProjectError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::PathNotFound(_) => "project_path_not_found",
            Self::ProtectedPath(_) => "protected_project_path",
            Self::OutsideProjectRoot(_) => "path_outside_project_root",
            Self::ConfirmationRequired(_) => "confirmation_required",
            Self::UnsupportedTask(_) => "unsupported_project_task",
            Self::CommandFailed(_) => "project_command_failed",
            Self::ParseError(_) => "manifest_parse_failed",
            Self::DatabaseError(_) | Self::Database(_) => "project_db_error",
            Self::ReportExport(_) => "report_export_failed",
            Self::Io(_) => "io_error",
        }
    }
}
