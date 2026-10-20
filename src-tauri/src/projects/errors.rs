use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProjectError {
    #[error("project_path_not_found: {0}")]
    PathNotFound(String),
    #[error("protected_project_path: {0}")]
    ProtectedPath(String),
    #[error("path_outside_project_root: {0}")]
    OutsideProjectRoot(String),
    #[error("io_error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database_error: {0}")]
    Database(#[from] rusqlite::Error),
}
