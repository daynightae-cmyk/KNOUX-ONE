use serde::de::DeserializeOwned;
use std::collections::HashMap;

#[cfg(target_os = "windows")]
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
fn execute(script: &str, environment: &HashMap<String, String>) -> Result<String, String> {
    let mut command = Command::new("powershell.exe");
    command
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    for (key, value) in environment {
        command.env(key, value);
    }

    let output = command
        .output()
        .map_err(|error| format!("powershell_start_failed:{error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        return Err(format!(
            "powershell_failed:{}:{}",
            output.status.code().unwrap_or(-1),
            if stderr.is_empty() { stdout } else { stderr }
        ));
    }
    if stdout.is_empty() {
        return Err("powershell_empty_output".into());
    }
    Ok(stdout)
}

#[cfg(not(target_os = "windows"))]
fn execute(_script: &str, _environment: &HashMap<String, String>) -> Result<String, String> {
    Err("powershell_supported_on_windows_only".into())
}

pub fn run_json<T: DeserializeOwned>(
    script: &str,
    environment: HashMap<String, String>,
) -> Result<T, String> {
    let output = execute(script, &environment)?;
    serde_json::from_str(&output).map_err(|error| format!("powershell_json_failed:{error}"))
}

pub fn run_text(
    script: &str,
    environment: HashMap<String, String>,
) -> Result<String, String> {
    execute(script, &environment)
}
