use crate::diagnostics::errors::DiagnosticError;
use serde::de::DeserializeOwned;
use std::process::Command;

#[derive(Debug)]
pub struct PowerShellOutput {
    pub stdout: String,
}

#[cfg(target_os = "windows")]
pub fn run(script: &str) -> Result<PowerShellOutput, DiagnosticError> {
    let wrapped = format!(
        "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); {script}"
    );
    let output = Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &wrapped])
        .output()
        .map_err(|error| DiagnosticError::PowerShellLaunch(error.to_string()))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(DiagnosticError::PowerShellFailed(if stderr.is_empty() { stdout } else { stderr }));
    }
    Ok(PowerShellOutput { stdout })
}

#[cfg(not(target_os = "windows"))]
pub fn run(_script: &str) -> Result<PowerShellOutput, DiagnosticError> { Err(DiagnosticError::UnsupportedOs) }

pub fn run_json<T: DeserializeOwned>(script: &str) -> Result<(T, PowerShellOutput), DiagnosticError> {
    let output = run(script)?;
    let value = serde_json::from_str::<T>(&output.stdout)
        .map_err(|error| DiagnosticError::PowerShellJson(format!("{error}; stdout={}", output.stdout)))?;
    Ok((value, output))
}
