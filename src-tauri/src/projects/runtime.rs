use std::{path::Path, process::Command};

use super::{
    contracts::{RuntimeManageRequest, RuntimeManageResult, RuntimeProcess},
    safety::{normalize, validate_project_root},
};

fn protected_process(name: &str, pid: u32) -> bool {
    pid <= 4 || matches!(
        name.to_ascii_lowercase().trim_end_matches(".exe"),
        "system" | "registry" | "smss" | "csrss" | "wininit" | "services" | "lsass" |
        "winlogon" | "svchost" | "dwm" | "explorer" | "fontdrvhost" | "memory compression"
    )
}

#[cfg(target_os = "windows")]
fn inspect_windows(root: &Path) -> (Vec<RuntimeProcess>, Vec<String>) {
    let escaped = root.to_string_lossy().replace('\'', "''");
    let script = format!(r#"
$ErrorActionPreference = 'SilentlyContinue'
$root = [IO.Path]::GetFullPath('{escaped}').ToLowerInvariant()
$ports = @{{}}
Get-NetTCPConnection -State Listen | ForEach-Object {{
  $pidKey = [string]$_.OwningProcess
  if (-not $ports.ContainsKey($pidKey)) {{ $ports[$pidKey] = @() }}
  $ports[$pidKey] += [int]$_.LocalPort
}}
$items = Get-CimInstance Win32_Process | ForEach-Object {{
  $exe = [string]$_.ExecutablePath
  $cmd = [string]$_.CommandLine
  $match = $false
  if ($exe -and $exe.ToLowerInvariant().Contains($root)) {{ $match = $true }}
  if ($cmd -and $cmd.ToLowerInvariant().Contains($root)) {{ $match = $true }}
  if ($match) {{
    [pscustomobject]@{{
      pid = [int]$_.ProcessId
      processName = [string]$_.Name
      executablePath = $exe
      commandLine = $cmd
      ports = @($ports[[string]$_.ProcessId] | Sort-Object -Unique)
      projectMatchEvidence = if ($cmd -and $cmd.ToLowerInvariant().Contains($root)) {{ 'command_line_contains_project_path' }} else {{ 'executable_path_contains_project_path' }}
    }}
  }}
}}
[Console]::OutputEncoding = [Text.Encoding]::UTF8
@($items) | ConvertTo-Json -Compress -Depth 5
"#);
    let output = match Command::new("powershell.exe").args(["-NoProfile", "-NonInteractive", "-Command", &script]).output() {
        Ok(output) => output,
        Err(error) => return (Vec::new(), vec![format!("runtime_inspection_launch_failed: {error}")]),
    };
    if !output.status.success() {
        return (Vec::new(), vec![format!("runtime_inspection_failed: {}", String::from_utf8_lossy(&output.stderr).trim())]);
    }
    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() || raw == "null" { return (Vec::new(), Vec::new()); }
    let value = match serde_json::from_str::<serde_json::Value>(&raw) {
        Ok(value) => value,
        Err(error) => return (Vec::new(), vec![format!("runtime_inspection_parse_failed: {error}")]),
    };
    let rows = value.as_array().cloned().unwrap_or_else(|| vec![value]);
    let mut processes = Vec::new();
    for row in rows {
        let pid = row.get("pid").and_then(|value| value.as_u64()).unwrap_or(0) as u32;
        let process_name = row.get("processName").and_then(|value| value.as_str()).unwrap_or("unknown").to_string();
        let ports = row.get("ports").and_then(|value| value.as_array()).map(|values| values.iter().filter_map(|value| value.as_u64().map(|port| port as u16)).collect()).unwrap_or_default();
        processes.push(RuntimeProcess {
            pid,
            protected: protected_process(&process_name, pid),
            process_name,
            executable_path: row.get("executablePath").and_then(|value| value.as_str()).map(str::to_string),
            command_line: row.get("commandLine").and_then(|value| value.as_str()).map(str::to_string),
            ports,
            project_match_evidence: row.get("projectMatchEvidence").and_then(|value| value.as_str()).unwrap_or("unknown").to_string(),
        });
    }
    (processes, Vec::new())
}

#[cfg(not(target_os = "windows"))]
fn inspect_windows(_root: &Path) -> (Vec<RuntimeProcess>, Vec<String>) {
    (Vec::new(), vec!["runtime_orchestration_requires_windows".into()])
}

pub fn manage_runtime(request: RuntimeManageRequest) -> RuntimeManageResult {
    let (project_path, termination) = match request {
        RuntimeManageRequest::Inspect { project_path } => (project_path, None),
        RuntimeManageRequest::Terminate { project_path, pid, confirmation } => (project_path, Some((pid, confirmation))),
    };
    let root = match validate_project_root(&project_path) {
        Ok(path) => path,
        Err(error) => return RuntimeManageResult { processes: Vec::new(), terminated_pid: None, warnings: vec![error.to_string()] },
    };
    let (processes, mut warnings) = inspect_windows(&root);
    let Some((pid, confirmation)) = termination else {
        return RuntimeManageResult { processes, terminated_pid: None, warnings };
    };
    if confirmation != format!("STOP {pid}") {
        warnings.push(format!("confirmation_required: type STOP {pid}"));
        return RuntimeManageResult { processes, terminated_pid: None, warnings };
    }
    let Some(process) = processes.iter().find(|process| process.pid == pid) else {
        warnings.push(format!("project_process_not_found: {pid}"));
        return RuntimeManageResult { processes, terminated_pid: None, warnings };
    };
    if process.protected {
        warnings.push(format!("protected_process_blocked: {} ({pid})", process.process_name));
        return RuntimeManageResult { processes, terminated_pid: None, warnings };
    }
    let evidence = process.command_line.as_deref().or(process.executable_path.as_deref()).unwrap_or_default();
    if !normalize(Path::new(evidence)).contains(&normalize(&root)) {
        warnings.push(format!("project_process_evidence_failed: {pid}"));
        return RuntimeManageResult { processes, terminated_pid: None, warnings };
    }
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("taskkill.exe").args(["/PID", &pid.to_string(), "/T"]).output();
        match output {
            Ok(output) if output.status.success() => RuntimeManageResult { processes: inspect_windows(&root).0, terminated_pid: Some(pid), warnings },
            Ok(output) => {
                warnings.push(format!("process_termination_failed: {}", String::from_utf8_lossy(&output.stderr).trim()));
                RuntimeManageResult { processes, terminated_pid: None, warnings }
            }
            Err(error) => {
                warnings.push(format!("process_termination_launch_failed: {error}"));
                RuntimeManageResult { processes, terminated_pid: None, warnings }
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        warnings.push("process_termination_requires_windows".into());
        RuntimeManageResult { processes, terminated_pid: None, warnings }
    }
}

#[cfg(test)]
mod tests {
    use super::protected_process;
    #[test]
    fn protects_critical_windows_processes() {
        assert!(protected_process("lsass.exe", 500));
        assert!(protected_process("node.exe", 4));
        assert!(!protected_process("node.exe", 9000));
    }
}
