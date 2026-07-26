use thiserror::Error;

#[derive(Debug, Error)]
pub enum DiagnosticError {
    #[error("unsupported_os: Windows desktop is required")]
    UnsupportedOs,
    #[error("invalid_request: {0}")]
    InvalidRequest(String),
    #[error("powershell_launch_failed: {0}")]
    PowerShellLaunch(String),
    #[error("powershell_command_failed: {0}")]
    PowerShellFailed(String),
    #[error("powershell_json_failed: {0}")]
    PowerShellJson(String),
    #[error("filesystem_failed: {0}")]
    Filesystem(String),
    #[error("database_failed: {0}")]
    Database(String),
    #[error("export_failed: {0}")]
    Export(String),
}

impl DiagnosticError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::UnsupportedOs => "unsupported_os",
            Self::InvalidRequest(_) => "invalid_request",
            Self::PowerShellLaunch(_) => "powershell_launch_failed",
            Self::PowerShellFailed(_) => "powershell_command_failed",
            Self::PowerShellJson(_) => "powershell_json_failed",
            Self::Filesystem(_) => "filesystem_failed",
            Self::Database(_) => "database_failed",
            Self::Export(_) => "export_failed",
        }
    }
}
