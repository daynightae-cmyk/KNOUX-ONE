use std::path::{Path, PathBuf};

use super::errors::ProjectError;

pub fn canonical_existing(path: &str) -> Result<PathBuf, ProjectError> {
    let candidate = PathBuf::from(path);
    if !candidate.exists() {
        return Err(ProjectError::PathNotFound(path.to_string()));
    }
    dunce::canonicalize(&candidate).map_err(|error| ProjectError::PathNotFound(format!("{path}: {error}")))
}

pub fn normalize(path: &Path) -> String {
    path.to_string_lossy().replace('/', "\\").to_lowercase()
}

pub fn is_protected_windows_path(path: &Path) -> bool {
    let normalized = normalize(path);
    let mut roots = Vec::new();
    for variable in ["WINDIR", "ProgramFiles", "ProgramFiles(x86)", "ProgramData"] {
        if let Ok(value) = std::env::var(variable) {
            roots.push(normalize(Path::new(&value)));
        }
    }
    if roots.is_empty() {
        roots.extend([
            "c:\\windows".into(),
            "c:\\program files".into(),
            "c:\\program files (x86)".into(),
            "c:\\programdata".into(),
        ]);
    }
    roots.iter().any(|root| normalized == *root || normalized.starts_with(&format!("{root}\\")))
        || normalized.contains(":\\system volume information")
        || normalized.contains(":\\$recycle.bin")
        || normalized.contains("\\windowsapps")
}

pub fn validate_project_root(path: &str) -> Result<PathBuf, ProjectError> {
    let canonical = canonical_existing(path)?;
    if !canonical.is_dir() {
        return Err(ProjectError::PathNotFound(format!("Not a directory: {}", canonical.display())));
    }
    if is_protected_windows_path(&canonical) {
        return Err(ProjectError::ProtectedPath(canonical.display().to_string()));
    }
    Ok(canonical)
}

pub fn validate_inside_root(root: &Path, candidate: &Path) -> Result<PathBuf, ProjectError> {
    let canonical = dunce::canonicalize(candidate)
        .map_err(|error| ProjectError::PathNotFound(format!("{}: {error}", candidate.display())))?;
    if !canonical.starts_with(root) {
        return Err(ProjectError::OutsideProjectRoot(canonical.display().to_string()));
    }
    Ok(canonical)
}

pub fn redacted_path(path: &Path) -> String {
    let value = path.to_string_lossy().to_string();
    if let Ok(profile) = std::env::var("USERPROFILE") {
        return value.replace(&profile, "%USERPROFILE%");
    }
    if let Ok(home) = std::env::var("HOME") {
        return value.replace(&home, "$HOME");
    }
    value
}

pub fn contains_shell_metacharacters(value: &str) -> bool {
    ['&', '|', ';', '>', '<', '`', '\n', '\r'].iter().any(|character| value.contains(*character))
}
