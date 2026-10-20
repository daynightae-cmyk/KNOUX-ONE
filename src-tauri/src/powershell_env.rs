//! Shared configuration for every child PowerShell the application spawns.
//!
//! # Why the module path has to be set explicitly
//!
//! A child process inherits the environment of whatever launched it. Windows
//! PowerShell 5.1 honours an inherited `PSModulePath` instead of building its
//! own, so a launcher that exports a `PSModulePath` intended for a different
//! PowerShell edition — a PowerShell 7 terminal, a VS Code terminal, a CI
//! runner, or a path that lists the same directory twice — leaves the child
//! unable to autoload `Microsoft.PowerShell.Security`.
//!
//! The visible symptom is not a missing module. It is:
//!
//! ```text
//! Get-AuthenticodeSignature : The 'Get-AuthenticodeSignature' command was
//! found in the module 'Microsoft.PowerShell.Security', but the module could
//! not be loaded.
//! ```
//!
//! and because the discovery scripts run under `$ErrorActionPreference='Stop'`,
//! that enrichment failure destroyed the whole measurement: the startup
//! discovery returned zero entries instead of the real ones.
//!
//! Every child PowerShell therefore receives an explicit, de-duplicated module
//! path that always contains the Windows PowerShell system modules, so the
//! application behaves the same way however it was launched.

use std::env;
use std::path::Path;
use std::process::Command;

fn add_entry(entries: &mut Vec<String>, seen: &mut Vec<String>, path: &Path) {
    if !path.is_dir() {
        return;
    }
    let raw = path.to_string_lossy().to_string();
    let key = raw.trim().trim_end_matches('\\').to_lowercase();
    if key.is_empty() || seen.iter().any(|existing| existing == &key) {
        return;
    }
    seen.push(key);
    entries.push(raw);
}

/// The module search path handed to every child Windows PowerShell.
///
/// It contains, in order:
///
/// 1. the inherited `PSModulePath` entries that exist on this machine, so
///    user-installed modules keep working;
/// 2. the Windows PowerShell system modules, which are always present even
///    when the launcher replaced `PSModulePath`;
/// 3. the per-user Windows PowerShell modules directory.
pub fn windows_powershell_module_path() -> String {
    let mut entries: Vec<String> = Vec::new();
    let mut seen: Vec<String> = Vec::new();

    if let Ok(inherited) = env::var("PSModulePath") {
        for entry in inherited.split(';') {
            let trimmed = entry.trim();
            if trimmed.is_empty() {
                continue;
            }
            add_entry(&mut entries, &mut seen, Path::new(trimmed));
        }
    }

    let system_root = env::var_os("SystemRoot")
        .or_else(|| env::var_os("WINDIR"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from(r"C:\Windows"));
    add_entry(
        &mut entries,
        &mut seen,
        &system_root
            .join("System32")
            .join("WindowsPowerShell")
            .join("v1.0")
            .join("Modules"),
    );

    if let Some(user_profile) = env::var_os("USERPROFILE").map(std::path::PathBuf::from) {
        add_entry(
            &mut entries,
            &mut seen,
            &user_profile
                .join("Documents")
                .join("WindowsPowerShell")
                .join("Modules"),
        );
    }

    if entries.is_empty() {
        return String::new();
    }
    entries.join(";")
}

/// Applies the module path to a child PowerShell command.
pub fn with_module_path(mut command: Command) -> Command {
    let path = windows_powershell_module_path();
    if !path.is_empty() {
        command.env("PSModulePath", path);
    }
    command
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_path_always_contains_the_system_modules() {
        let path = windows_powershell_module_path();
        assert!(path.contains("WindowsPowerShell"), "{}", path);
    }

    #[test]
    fn module_path_has_no_duplicate_entries() {
        let path = windows_powershell_module_path();
        let mut seen: Vec<String> = Vec::new();
        for entry in path.split(';').filter(|value| !value.is_empty()) {
            let key = entry.trim().trim_end_matches('\\').to_lowercase();
            assert!(
                !seen.contains(&key),
                "duplicate module path entry: {}",
                entry
            );
            seen.push(key);
        }
    }
}
