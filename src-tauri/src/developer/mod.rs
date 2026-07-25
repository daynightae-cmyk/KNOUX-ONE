use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainItem {
    pub id: String,
    pub name: String,
    pub category: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentDiscovery {
    pub tools: Vec<ToolchainItem>,
    pub computer_name: String,
    pub user_name: String,
    pub shell: String,
    pub architecture: String,
    pub discovered_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathEntry {
    pub id: String,
    pub path: String,
    pub scope: String,
    pub exists: bool,
    pub is_duplicate: bool,
    pub normalized_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathAudit {
    pub entries: Vec<PathEntry>,
    pub duplicate_count: usize,
    pub missing_count: usize,
    pub user_entry_count: usize,
    pub system_entry_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeManager {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInspection {
    pub managers: Vec<RuntimeManager>,
    pub node_prefix: Option<String>,
    pub python_home: Option<String>,
    pub rustup_home: Option<String>,
    pub cargo_home: Option<String>,
    pub dotnet_root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitAudit {
    pub installed: bool,
    pub version: Option<String>,
    pub executable_path: Option<String>,
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub default_branch: Option<String>,
    pub autocrlf: Option<String>,
    pub credential_helper: Option<String>,
    pub signing_key_configured: bool,
    pub commit_signing_enabled: bool,
    pub findings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryScanRequest {
    pub roots: Vec<String>,
    #[serde(default = "default_repo_depth")]
    pub max_depth: usize,
}

fn default_repo_depth() -> usize {
    6
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInfo {
    pub path: String,
    pub name: String,
    pub branch: String,
    pub dirty: bool,
    pub ahead: i64,
    pub behind: i64,
    pub remote: Option<String>,
    pub last_commit: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryScanResult {
    pub repositories: Vec<RepositoryInfo>,
    pub scanned_roots: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortProcess {
    pub pid: u32,
    pub process_name: String,
    pub port: u16,
    pub protocol: String,
    pub state: String,
    pub local_address: String,
    pub command_line: Option<String>,
    pub protected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum PortManageRequest {
    #[serde(rename = "inspect")]
    Inspect,
    #[serde(rename = "terminate")]
    Terminate { pid: u32, confirmation: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortManageResult {
    pub processes: Vec<PortProcess>,
    pub terminated_pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAuditRequest {
    pub roots: Vec<String>,
    #[serde(default = "default_repo_depth")]
    pub max_depth: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectHealthItem {
    pub path: String,
    pub name: String,
    pub ecosystem: String,
    pub manifest: String,
    pub lockfiles: Vec<String>,
    pub status: String,
    pub findings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAuditResult {
    pub projects: Vec<ProjectHealthItem>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub category: String,
    pub size_bytes: u64,
    pub exists: bool,
    pub safe_to_clean: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum CacheManageRequest {
    #[serde(rename = "inspect")]
    Inspect { project_roots: Vec<String> },
    #[serde(rename = "clean")]
    Clean {
        paths: Vec<String>,
        confirmation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheManageResult {
    pub entries: Vec<CacheEntry>,
    pub reclaimed_bytes: u64,
    pub cleaned_paths: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpLabRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    #[serde(default = "default_http_timeout")]
    pub timeout_seconds: u64,
}

fn default_http_timeout() -> u64 {
    30
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpLabResponse {
    pub status_code: u16,
    pub reason: String,
    pub duration_ms: u64,
    pub content_type: Option<String>,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeveloperReportRequest {
    pub title: String,
    pub format: String,
    pub sections: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeveloperReportResult {
    pub report_id: String,
    pub path: String,
    pub format: String,
    pub created_at: String,
}

fn success<T>(
    operation_id: String,
    capability_id: &str,
    handler_id: &str,
    started_at: String,
    timer: Instant,
    summary_en: String,
    summary_ar: String,
    data: T,
    warnings: Vec<String>,
) -> OperationResult<T> {
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: if warnings.is_empty() {
            "completed".into()
        } else {
            "completed_with_warnings".into()
        },
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(0),
        stdout: None,
        stderr: None,
        summary_en,
        summary_ar,
        warnings,
        error_code: None,
        data: Some(data),
    }
}

fn failure<T>(
    operation_id: String,
    capability_id: &str,
    handler_id: &str,
    started_at: String,
    timer: Instant,
    code: &str,
    message: String,
) -> OperationResult<T> {
    OperationResult {
        operation_id,
        capability_id: capability_id.into(),
        handler_id: handler_id.into(),
        status: "failed".into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(1),
        stdout: None,
        stderr: Some(message.clone()),
        summary_en: message.clone(),
        summary_ar: format!("فشلت عملية استوديو المطور: {message}"),
        warnings: Vec::new(),
        error_code: Some(code.into()),
        data: None,
    }
}

fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let mut command = if program.to_ascii_lowercase().ends_with(".cmd")
        || program.to_ascii_lowercase().ends_with(".bat")
    {
        let mut command = Command::new("cmd.exe");
        command.arg("/D").arg("/C").arg(program).args(args);
        command
    } else {
        let mut command = Command::new(program);
        command.args(args);
        command
    };
    let output = command
        .output()
        .map_err(|error| format!("command_launch_failed:{program}:{error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(if stderr.is_empty() {
            format!("command_failed:{program}:{}", output.status)
        } else {
            stderr
        })
    }
}

#[cfg(target_os = "windows")]
fn resolve_executable(name: &str) -> Option<String> {
    let output = Command::new("where.exe").arg(name).output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

#[cfg(not(target_os = "windows"))]
fn resolve_executable(_name: &str) -> Option<String> {
    None
}

fn probe_tool(id: &str, name: &str, category: &str, executable: &str, args: &[&str]) -> ToolchainItem {
    let path = resolve_executable(executable);
    let version = path
        .as_deref()
        .and_then(|resolved| command_output(resolved, args).ok())
        .map(|value| value.lines().next().unwrap_or_default().trim().to_string())
        .filter(|value| !value.is_empty());
    ToolchainItem {
        id: id.into(),
        name: name.into(),
        category: category.into(),
        installed: path.is_some(),
        status: if path.is_none() {
            "missing".into()
        } else if version.is_some() {
            "healthy".into()
        } else {
            "misconfigured".into()
        },
        version,
        path,
    }
}

#[tauri::command]
pub fn m15_environment_discover(
    op_id: String,
) -> Result<OperationResult<EnvironmentDiscovery>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    #[cfg(not(target_os = "windows"))]
    {
        return Ok(failure(
            op_id,
            "m15_s01",
            "m15.environment.discover",
            started_at,
            timer,
            "unsupported_os",
            "Developer environment discovery requires Windows.".into(),
        ));
    }
    #[cfg(target_os = "windows")]
    {
        let specifications = [
            ("git", "Git", "vcs", "git.exe", vec!["--version"]),
            ("node", "Node.js", "runtime", "node.exe", vec!["--version"]),
            ("npm", "npm", "package_manager", "npm.cmd", vec!["--version"]),
            ("pnpm", "pnpm", "package_manager", "pnpm.cmd", vec!["--version"]),
            ("yarn", "Yarn", "package_manager", "yarn.cmd", vec!["--version"]),
            ("bun", "Bun", "runtime", "bun.exe", vec!["--version"]),
            ("deno", "Deno", "runtime", "deno.exe", vec!["--version"]),
            ("python", "Python", "runtime", "python.exe", vec!["--version"]),
            ("py", "Python Launcher", "runtime", "py.exe", vec!["--version"]),
            ("pip", "pip", "package_manager", "pip.exe", vec!["--version"]),
            ("rustc", "Rust Compiler", "compiler", "rustc.exe", vec!["--version"]),
            ("cargo", "Cargo", "package_manager", "cargo.exe", vec!["--version"]),
            ("rustup", "Rustup", "runtime_manager", "rustup.exe", vec!["--version"]),
            ("go", "Go", "compiler", "go.exe", vec!["version"]),
            ("dotnet", ".NET SDK", "runtime", "dotnet.exe", vec!["--version"]),
            ("java", "Java", "runtime", "java.exe", vec!["-version"]),
            ("javac", "Java Compiler", "compiler", "javac.exe", vec!["-version"]),
            ("docker", "Docker", "container", "docker.exe", vec!["--version"]),
            ("podman", "Podman", "container", "podman.exe", vec!["--version"]),
            ("code", "Visual Studio Code", "editor", "code.cmd", vec!["--version"]),
        ];
        let tools = specifications
            .iter()
            .map(|(id, name, category, executable, args)| {
                probe_tool(id, name, category, executable, args)
            })
            .collect::<Vec<_>>();
        let data = EnvironmentDiscovery {
            tools,
            computer_name: std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows Host".into()),
            user_name: std::env::var("USERNAME").unwrap_or_else(|_| "Unknown".into()),
            shell: std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".into()),
            architecture: std::env::consts::ARCH.into(),
            discovered_at: Utc::now().to_rfc3339(),
        };
        Ok(success(
            op_id,
            "m15_s01",
            "m15.environment.discover",
            started_at,
            timer,
            format!("Discovered {} developer tools from the Windows host.", data.tools.len()),
            format!("تم اكتشاف {} أداة تطوير من جهاز ويندوز.", data.tools.len()),
            data,
            Vec::new(),
        ))
    }
}

#[cfg(target_os = "windows")]
fn read_path_scope(scope: &str) -> Result<Vec<String>, String> {
    let target = if scope == "system" { "Machine" } else { "User" };
    let script = format!(
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8; [Environment]::GetEnvironmentVariable('Path','{target}')"
    );
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|error| format!("path_read_failed:{error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into_owned());
    }
    Ok(String::from_utf8_lossy(&output.stdout)
        .split(';')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect())
}

#[tauri::command]
pub fn m15_path_audit(op_id: String) -> Result<OperationResult<PathAudit>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    #[cfg(not(target_os = "windows"))]
    {
        return Ok(failure(
            op_id,
            "m15_s02",
            "m15.path.audit",
            started_at,
            timer,
            "unsupported_os",
            "PATH audit requires Windows.".into(),
        ));
    }
    #[cfg(target_os = "windows")]
    {
        let user = read_path_scope("user")?;
        let system = read_path_scope("system")?;
        let mut counts = HashMap::<String, usize>::new();
        for path in user.iter().chain(system.iter()) {
            let normalized = path.trim_end_matches(['\\', '/']).to_ascii_lowercase();
            *counts.entry(normalized).or_default() += 1;
        }
        let mut entries = Vec::new();
        for (scope, paths) in [("user", &user), ("system", &system)] {
            for path in paths {
                let expanded = std::env::vars().fold(path.clone(), |value, (key, replacement)| {
                    value.replace(&format!("%{key}%"), &replacement)
                });
                let normalized = expanded
                    .trim_end_matches(['\\', '/'])
                    .to_ascii_lowercase();
                entries.push(PathEntry {
                    id: Uuid::new_v4().to_string(),
                    path: path.clone(),
                    scope: scope.into(),
                    exists: Path::new(&expanded).exists(),
                    is_duplicate: counts.get(&normalized).copied().unwrap_or_default() > 1,
                    normalized_path: normalized,
                });
            }
        }
        let data = PathAudit {
            duplicate_count: entries.iter().filter(|entry| entry.is_duplicate).count(),
            missing_count: entries.iter().filter(|entry| !entry.exists).count(),
            user_entry_count: user.len(),
            system_entry_count: system.len(),
            entries,
        };
        let mut warnings = Vec::new();
        if data.duplicate_count > 0 {
            warnings.push(format!("{} duplicate PATH entries require review.", data.duplicate_count));
        }
        if data.missing_count > 0 {
            warnings.push(format!("{} PATH entries do not exist.", data.missing_count));
        }
        Ok(success(
            op_id,
            "m15_s02",
            "m15.path.audit",
            started_at,
            timer,
            "User and system PATH entries were audited without modification.".into(),
            "تم تدقيق مسارات PATH للمستخدم والنظام دون تعديلها.".into(),
            data,
            warnings,
        ))
    }
}

#[tauri::command]
pub fn m15_runtime_inspect(
    op_id: String,
) -> Result<OperationResult<RuntimeInspection>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let managers = [
        ("nvm", "NVM for Windows", "nvm.exe", vec!["version"]),
        ("fnm", "Fast Node Manager", "fnm.exe", vec!["--version"]),
        ("volta", "Volta", "volta.exe", vec!["--version"]),
        ("pyenv", "pyenv-win", "pyenv.bat", vec!["--version"]),
        ("rustup", "Rustup", "rustup.exe", vec!["--version"]),
    ]
    .iter()
    .map(|(id, name, executable, args)| {
        let item = probe_tool(id, name, "runtime_manager", executable, args);
        RuntimeManager {
            id: item.id,
            name: item.name,
            installed: item.installed,
            version: item.version,
            path: item.path,
        }
    })
    .collect();
    let data = RuntimeInspection {
        managers,
        node_prefix: command_output("npm.cmd", &["config", "get", "prefix"]).ok(),
        python_home: std::env::var("PYTHONHOME").ok(),
        rustup_home: std::env::var("RUSTUP_HOME").ok(),
        cargo_home: std::env::var("CARGO_HOME").ok(),
        dotnet_root: std::env::var("DOTNET_ROOT").ok(),
    };
    Ok(success(
        op_id,
        "m15_s03",
        "m15.runtime.inspect",
        started_at,
        timer,
        "Runtime managers and developer homes were inspected.".into(),
        "تم فحص مديري الإصدارات ومجلدات بيئات التطوير.".into(),
        data,
        Vec::new(),
    ))
}

fn git_config(key: &str) -> Option<String> {
    command_output("git.exe", &["config", "--global", "--get", key])
        .ok()
        .filter(|value| !value.trim().is_empty())
}

#[tauri::command]
pub fn m15_git_audit(op_id: String) -> Result<OperationResult<GitAudit>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let path = resolve_executable("git.exe");
    let version = path
        .as_deref()
        .and_then(|git| command_output(git, &["--version"]).ok());
    let user_name = git_config("user.name");
    let user_email = git_config("user.email");
    let default_branch = git_config("init.defaultBranch");
    let autocrlf = git_config("core.autocrlf");
    let credential_helper = git_config("credential.helper");
    let signing_key = git_config("user.signingkey");
    let signing_enabled = git_config("commit.gpgsign")
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let mut findings = Vec::new();
    if path.is_none() {
        findings.push("Git is not installed or is not reachable through PATH.".into());
    }
    if user_name.is_none() {
        findings.push("Global Git user.name is not configured.".into());
    }
    if user_email.is_none() {
        findings.push("Global Git user.email is not configured.".into());
    }
    if default_branch.is_none() {
        findings.push("init.defaultBranch is not configured.".into());
    }
    let data = GitAudit {
        installed: path.is_some(),
        version,
        executable_path: path,
        user_name,
        user_email,
        default_branch,
        autocrlf,
        credential_helper,
        signing_key_configured: signing_key.is_some(),
        commit_signing_enabled: signing_enabled,
        findings: findings.clone(),
    };
    Ok(success(
        op_id,
        "m15_s04",
        "m15.git.audit",
        started_at,
        timer,
        "Global Git configuration was audited without reading credentials or tokens.".into(),
        "تم تدقيق إعدادات Git العامة دون قراءة بيانات الاعتماد أو الرموز السرية.".into(),
        data,
        findings,
    ))
}

fn git_in(repo: &Path, args: &[&str]) -> Option<String> {
    let repo_text = repo.to_string_lossy().to_string();
    let mut full_args = vec!["-C", repo_text.as_str()];
    full_args.extend_from_slice(args);
    command_output("git.exe", &full_args).ok()
}

fn redact_remote(remote: String) -> String {
    if let Some((scheme, rest)) = remote.split_once("://") {
        if let Some((_, host_and_path)) = rest.rsplit_once('@') {
            return format!("{scheme}://{host_and_path}");
        }
    }
    remote
}

#[tauri::command]
pub async fn m15_repositories_scan(
    op_id: String,
    request: RepositoryScanRequest,
) -> Result<OperationResult<RepositoryScanResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut repositories = Vec::new();
        let mut warnings = Vec::new();
        let mut visited = HashSet::new();
        for root in &request.roots {
            let root_path = PathBuf::from(root);
            if !root_path.exists() {
                warnings.push(format!("repository_root_not_found:{root}"));
                continue;
            }
            for entry in WalkDir::new(&root_path)
                .max_depth(request.max_depth.clamp(1, 12))
                .follow_links(false)
                .into_iter()
                .filter_map(Result::ok)
            {
                if repositories.len() >= 250 {
                    warnings.push("Repository result limit of 250 was reached.".into());
                    break;
                }
                if entry.file_type().is_dir() && entry.file_name() == ".git" {
                    let repo = entry.path().parent().unwrap_or(entry.path()).to_path_buf();
                    let canonical = dunce::canonicalize(&repo).unwrap_or(repo.clone());
                    if !visited.insert(canonical.clone()) {
                        continue;
                    }
                    let branch = git_in(&canonical, &["branch", "--show-current"])
                        .unwrap_or_else(|| "detached".into());
                    let porcelain = git_in(&canonical, &["status", "--porcelain=v1"])
                        .unwrap_or_default();
                    let counts = git_in(
                        &canonical,
                        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
                    )
                    .unwrap_or_default();
                    let count_values = counts
                        .split_whitespace()
                        .filter_map(|value| value.parse::<i64>().ok())
                        .collect::<Vec<_>>();
                    let remote = git_in(&canonical, &["remote", "get-url", "origin"])
                        .map(redact_remote);
                    let last_commit = git_in(
                        &canonical,
                        &["log", "-1", "--pretty=format:%h %ad %s", "--date=iso-strict"],
                    );
                    repositories.push(RepositoryInfo {
                        path: canonical.to_string_lossy().to_string(),
                        name: canonical
                            .file_name()
                            .and_then(|value| value.to_str())
                            .unwrap_or("repository")
                            .to_string(),
                        branch,
                        dirty: !porcelain.trim().is_empty(),
                        ahead: count_values.first().copied().unwrap_or_default(),
                        behind: count_values.get(1).copied().unwrap_or_default(),
                        remote,
                        last_commit,
                        status: if porcelain.trim().is_empty() {
                            "clean".into()
                        } else {
                            "dirty".into()
                        },
                    });
                }
            }
        }
        RepositoryScanResult {
            repositories,
            scanned_roots: request.roots,
            warnings,
        }
    })
    .await
    .map_err(|error| format!("repository_scan_join_failed:{error}"))?;
    Ok(success(
        op_id,
        "m15_s05",
        "m15.repositories.scan",
        started_at,
        timer,
        format!("Discovered {} Git repositories.", result.repositories.len()),
        format!("تم اكتشاف {} مستودع Git.", result.repositories.len()),
        result.clone(),
        result.warnings,
    ))
}

#[cfg(target_os = "windows")]
fn inspect_ports() -> Result<Vec<PortProcess>, String> {
    let script = r#"
$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$protected=@('System','Registry','smss','csrss','wininit','services','lsass','svchost','winlogon')
$tcp=Get-NetTCPConnection -State Listen | ForEach-Object {
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
  [pscustomobject]@{pid=[uint32]$_.OwningProcess;processName=[string]$p.Name;port=[uint16]$_.LocalPort;protocol='TCP';state='LISTEN';localAddress=[string]$_.LocalAddress;commandLine=[string]$p.CommandLine;protected=($protected -contains [IO.Path]::GetFileNameWithoutExtension([string]$p.Name))}
}
$udp=Get-NetUDPEndpoint | ForEach-Object {
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
  [pscustomobject]@{pid=[uint32]$_.OwningProcess;processName=[string]$p.Name;port=[uint16]$_.LocalPort;protocol='UDP';state='BOUND';localAddress=[string]$_.LocalAddress;commandLine=[string]$p.CommandLine;protected=($protected -contains [IO.Path]::GetFileNameWithoutExtension([string]$p.Name))}
}
@($tcp)+@($udp) | Sort-Object port,protocol | ConvertTo-Json -Compress -Depth 4
"#;
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|error| format!("port_inspection_launch_failed:{error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into_owned());
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "null" {
        return Ok(Vec::new());
    }
    if stdout.starts_with('[') {
        serde_json::from_str(&stdout).map_err(|error| format!("port_json_failed:{error}"))
    } else {
        serde_json::from_str::<PortProcess>(&stdout)
            .map(|item| vec![item])
            .map_err(|error| format!("port_json_failed:{error}"))
    }
}

#[tauri::command]
pub fn m15_ports_manage(
    op_id: String,
    request: PortManageRequest,
) -> Result<OperationResult<PortManageResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    #[cfg(not(target_os = "windows"))]
    {
        return Ok(failure(
            op_id,
            "m15_s06",
            "m15.ports.manage",
            started_at,
            timer,
            "unsupported_os",
            "Port management requires Windows.".into(),
        ));
    }
    #[cfg(target_os = "windows")]
    {
        let mut terminated_pid = None;
        if let PortManageRequest::Terminate { pid, confirmation } = request {
            if confirmation != format!("STOP {pid}") {
                return Ok(failure(
                    op_id,
                    "m15_s06",
                    "m15.ports.manage",
                    started_at,
                    timer,
                    "confirmation_required",
                    format!("Type STOP {pid} to terminate the selected process."),
                ));
            }
            if pid <= 4 || pid == std::process::id() {
                return Ok(failure(
                    op_id,
                    "m15_s06",
                    "m15.ports.manage",
                    started_at,
                    timer,
                    "protected_process",
                    "The selected process is protected and cannot be terminated.".into(),
                ));
            }
            let current = inspect_ports()?;
            let process = current.iter().find(|item| item.pid == pid);
            if process.is_none() {
                return Ok(failure(
                    op_id,
                    "m15_s06",
                    "m15.ports.manage",
                    started_at,
                    timer,
                    "process_not_found",
                    format!("Process {pid} is no longer listening."),
                ));
            }
            if process.is_some_and(|item| item.protected) {
                return Ok(failure(
                    op_id,
                    "m15_s06",
                    "m15.ports.manage",
                    started_at,
                    timer,
                    "protected_process",
                    "Windows protected processes cannot be terminated by Developer Studio.".into(),
                ));
            }
            let status = Command::new("taskkill.exe")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .status()
                .map_err(|error| format!("taskkill_launch_failed:{error}"))?;
            if !status.success() {
                return Ok(failure(
                    op_id,
                    "m15_s06",
                    "m15.ports.manage",
                    started_at,
                    timer,
                    "process_termination_failed",
                    format!("Windows rejected termination of process {pid}."),
                ));
            }
            terminated_pid = Some(pid);
        }
        let processes = inspect_ports()?;
        Ok(success(
            op_id,
            "m15_s06",
            "m15.ports.manage",
            started_at,
            timer,
            "Listening TCP/UDP endpoints were inspected from Windows networking providers.".into(),
            "تم فحص منافذ TCP وUDP النشطة من مزودي شبكة ويندوز.".into(),
            PortManageResult {
                processes,
                terminated_pid,
            },
            Vec::new(),
        ))
    }
}

fn manifest_ecosystem(name: &str) -> Option<&'static str> {
    match name {
        "package.json" => Some("node"),
        "Cargo.toml" => Some("rust"),
        "pyproject.toml" | "requirements.txt" | "Pipfile" => Some("python"),
        "go.mod" => Some("go"),
        "pom.xml" | "build.gradle" | "build.gradle.kts" => Some("java"),
        name if name.ends_with(".csproj") || name.ends_with(".sln") => Some("dotnet"),
        _ => None,
    }
}

#[tauri::command]
pub async fn m15_projects_audit(
    op_id: String,
    request: ProjectAuditRequest,
) -> Result<OperationResult<ProjectAuditResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut projects = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        for root in &request.roots {
            let path = PathBuf::from(root);
            if !path.exists() {
                warnings.push(format!("project_root_not_found:{root}"));
                continue;
            }
            for entry in WalkDir::new(&path)
                .max_depth(request.max_depth.clamp(1, 10))
                .follow_links(false)
                .into_iter()
                .filter_map(Result::ok)
            {
                if projects.len() >= 300 {
                    warnings.push("Project result limit of 300 was reached.".into());
                    break;
                }
                if !entry.file_type().is_file() {
                    continue;
                }
                let file_name = entry.file_name().to_string_lossy().to_string();
                let Some(ecosystem) = manifest_ecosystem(&file_name) else {
                    continue;
                };
                let directory = entry.path().parent().unwrap_or(entry.path()).to_path_buf();
                let key = format!("{}:{ecosystem}", directory.to_string_lossy());
                if !seen.insert(key) {
                    continue;
                }
                let lock_candidates = match ecosystem {
                    "node" => vec!["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"],
                    "rust" => vec!["Cargo.lock"],
                    "python" => vec!["poetry.lock", "Pipfile.lock", "uv.lock"],
                    "go" => vec!["go.sum"],
                    "java" => vec!["gradle.lockfile"],
                    "dotnet" => vec!["packages.lock.json"],
                    _ => Vec::new(),
                };
                let lockfiles = lock_candidates
                    .iter()
                    .filter(|candidate| directory.join(candidate).exists())
                    .map(|candidate| candidate.to_string())
                    .collect::<Vec<_>>();
                let mut findings = Vec::new();
                if lockfiles.is_empty() && matches!(ecosystem, "node" | "rust" | "go") {
                    findings.push("No recognized dependency lockfile was found.".into());
                }
                if ecosystem == "node" && directory.join("node_modules").exists() {
                    findings.push("node_modules is present; cache size can be inspected separately.".into());
                }
                projects.push(ProjectHealthItem {
                    path: directory.to_string_lossy().to_string(),
                    name: directory
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or("project")
                        .to_string(),
                    ecosystem: ecosystem.into(),
                    manifest: entry.path().to_string_lossy().to_string(),
                    lockfiles,
                    status: if findings.is_empty() {
                        "healthy".into()
                    } else {
                        "review".into()
                    },
                    findings,
                });
            }
        }
        ProjectAuditResult { projects, warnings }
    })
    .await
    .map_err(|error| format!("project_audit_join_failed:{error}"))?;
    Ok(success(
        op_id,
        "m15_s07",
        "m15.projects.audit",
        started_at,
        timer,
        format!("Audited {} local developer projects.", result.projects.len()),
        format!("تم تدقيق {} مشروع تطوير محلي.", result.projects.len()),
        result.clone(),
        result.warnings,
    ))
}

fn directory_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| entry.metadata().ok())
        .map(|metadata| metadata.len())
        .sum()
}

fn known_cache_paths(project_roots: &[String]) -> Vec<(String, String, String)> {
    let mut paths = Vec::new();
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        paths.push(("npm-cache".into(), "npm cache".into(), format!("{local}\\npm-cache")));
        paths.push(("pnpm-store".into(), "pnpm store".into(), format!("{local}\\pnpm\\store")));
        paths.push(("nuget-cache".into(), "NuGet cache".into(), format!("{local}\\NuGet\\v3-cache")));
        paths.push(("pip-cache".into(), "pip cache".into(), format!("{local}\\pip\\Cache")));
    }
    if let Ok(home) = std::env::var("USERPROFILE") {
        paths.push(("cargo-registry".into(), "Cargo registry cache".into(), format!("{home}\\.cargo\\registry\\cache")));
        paths.push(("gradle-cache".into(), "Gradle cache".into(), format!("{home}\\.gradle\\caches")));
        paths.push(("yarn-cache".into(), "Yarn cache".into(), format!("{home}\\AppData\\Local\\Yarn\\Cache")));
    }
    for root in project_roots {
        for (suffix, name, category) in [
            ("target", "Rust target", "build"),
            (".next\\cache", "Next.js cache", "build"),
            ("node_modules\\.cache", "Node build cache", "build"),
            (".turbo", "Turborepo cache", "build"),
            (".vite", "Vite cache", "build"),
            ("__pycache__", "Python bytecode cache", "build"),
        ] {
            paths.push((
                format!("project-{}-{}", category, Uuid::new_v4()),
                name.into(),
                Path::new(root).join(suffix).to_string_lossy().to_string(),
            ));
        }
    }
    paths
}

fn is_known_safe_cache(path: &Path) -> bool {
    let normalized = path.to_string_lossy().replace('/', "\\").to_ascii_lowercase();
    [
        "\\npm-cache",
        "\\pnpm\\store",
        "\\nuget\\v3-cache",
        "\\pip\\cache",
        "\\.cargo\\registry\\cache",
        "\\.gradle\\caches",
        "\\yarn\\cache",
        "\\target",
        "\\.next\\cache",
        "\\node_modules\\.cache",
        "\\.turbo",
        "\\.vite",
        "\\__pycache__",
    ]
    .iter()
    .any(|marker| normalized.ends_with(marker))
}

#[tauri::command]
pub async fn m15_caches_manage(
    op_id: String,
    request: CacheManageRequest,
) -> Result<OperationResult<CacheManageResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || match request {
        CacheManageRequest::Inspect { project_roots } => {
            let entries = known_cache_paths(&project_roots)
                .into_iter()
                .map(|(id, name, path)| {
                    let path_value = PathBuf::from(&path);
                    CacheEntry {
                        id,
                        name,
                        category: if path.contains("target") || path.contains(".next") {
                            "build".into()
                        } else {
                            "package_manager".into()
                        },
                        size_bytes: directory_size(&path_value),
                        exists: path_value.exists(),
                        safe_to_clean: is_known_safe_cache(&path_value),
                        path,
                    }
                })
                .collect();
            CacheManageResult {
                entries,
                reclaimed_bytes: 0,
                cleaned_paths: Vec::new(),
                warnings: Vec::new(),
            }
        }
        CacheManageRequest::Clean { paths, confirmation } => {
            let mut reclaimed_bytes = 0;
            let mut cleaned_paths = Vec::new();
            let mut warnings = Vec::new();
            if confirmation != "CLEAN" {
                warnings.push("Typed confirmation CLEAN is required; no paths were changed.".into());
                return CacheManageResult {
                    entries: Vec::new(),
                    reclaimed_bytes,
                    cleaned_paths,
                    warnings,
                };
            }
            for path in paths {
                let candidate = PathBuf::from(&path);
                if !is_known_safe_cache(&candidate) {
                    warnings.push(format!("blocked_unrecognized_cache:{path}"));
                    continue;
                }
                if !candidate.exists() {
                    continue;
                }
                let size = directory_size(&candidate);
                match fs::remove_dir_all(&candidate) {
                    Ok(()) => {
                        reclaimed_bytes = reclaimed_bytes.saturating_add(size);
                        cleaned_paths.push(path);
                    }
                    Err(error) => warnings.push(format!("cache_clean_failed:{}:{error}", candidate.display())),
                }
            }
            CacheManageResult {
                entries: Vec::new(),
                reclaimed_bytes,
                cleaned_paths,
                warnings,
            }
        }
    })
    .await
    .map_err(|error| format!("cache_worker_join_failed:{error}"))?;
    Ok(success(
        op_id,
        "m15_s08",
        "m15.caches.manage",
        started_at,
        timer,
        format!("Developer cache operation completed; reclaimed {} bytes.", result.reclaimed_bytes),
        format!("اكتملت عملية كاش المطور وتم استرداد {} بايت.", result.reclaimed_bytes),
        result.clone(),
        result.warnings,
    ))
}

#[cfg(target_os = "windows")]
fn execute_http(request: &HttpLabRequest) -> Result<HttpLabResponse, String> {
    let method = request.method.to_ascii_uppercase();
    if !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].contains(&method.as_str()) {
        return Err("unsupported_http_method".into());
    }
    let lower_url = request.url.to_ascii_lowercase();
    if !(lower_url.starts_with("http://") || lower_url.starts_with("https://")) {
        return Err("Only HTTP and HTTPS URLs are allowed.".into());
    }
    let headers_json = serde_json::to_string(&request.headers).map_err(|error| error.to_string())?;
    let script = r#"
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$headers=@{}
if ($env:KNOUX_HTTP_HEADERS) { (ConvertFrom-Json $env:KNOUX_HTTP_HEADERS).psobject.Properties | ForEach-Object { $headers[$_.Name]=[string]$_.Value } }
$params=@{Uri=$env:KNOUX_HTTP_URL;Method=$env:KNOUX_HTTP_METHOD;Headers=$headers;TimeoutSec=[int]$env:KNOUX_HTTP_TIMEOUT;UseBasicParsing=$true;SkipHttpErrorCheck=$true}
if ($env:KNOUX_HTTP_BODY) { $params['Body']=$env:KNOUX_HTTP_BODY }
$sw=[Diagnostics.Stopwatch]::StartNew(); $r=Invoke-WebRequest @params; $sw.Stop()
$body=[string]$r.Content; $truncated=$false
if ($body.Length -gt 524288) { $body=$body.Substring(0,524288); $truncated=$true }
$headerMap=@{}; $r.Headers.Keys | ForEach-Object { $headerMap[$_]=[string]$r.Headers[$_] }
[pscustomobject]@{statusCode=[uint16]$r.StatusCode;reason=[string]$r.StatusDescription;durationMs=[uint64]$sw.ElapsedMilliseconds;contentType=[string]$r.Headers['Content-Type'];headers=$headerMap;body=$body;truncated=$truncated} | ConvertTo-Json -Compress -Depth 6
"#;
    let mut command = Command::new("powershell.exe");
    command
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .env("KNOUX_HTTP_URL", &request.url)
        .env("KNOUX_HTTP_METHOD", method)
        .env("KNOUX_HTTP_HEADERS", headers_json)
        .env("KNOUX_HTTP_TIMEOUT", request.timeout_seconds.clamp(1, 120).to_string());
    if let Some(body) = &request.body {
        command.env("KNOUX_HTTP_BODY", body);
    }
    let output = command
        .output()
        .map_err(|error| format!("http_lab_launch_failed:{error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    serde_json::from_slice(&output.stdout).map_err(|error| format!("http_lab_parse_failed:{error}"))
}

#[tauri::command]
pub async fn m15_http_execute(
    op_id: String,
    request: HttpLabRequest,
) -> Result<OperationResult<HttpLabResponse>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    #[cfg(not(target_os = "windows"))]
    {
        return Ok(failure(
            op_id,
            "m15_s09",
            "m15.http.execute",
            started_at,
            timer,
            "unsupported_os",
            "The HTTP laboratory currently requires Windows PowerShell.".into(),
        ));
    }
    #[cfg(target_os = "windows")]
    {
        let response = tauri::async_runtime::spawn_blocking(move || execute_http(&request))
            .await
            .map_err(|error| format!("http_lab_join_failed:{error}"))?;
        match response {
            Ok(data) => Ok(success(
                op_id,
                "m15_s09",
                "m15.http.execute",
                started_at,
                timer,
                format!("HTTP request completed with status {}.", data.status_code),
                format!("اكتمل طلب HTTP بالحالة {}.", data.status_code),
                data,
                Vec::new(),
            )),
            Err(error) => Ok(failure(
                op_id,
                "m15_s09",
                "m15.http.execute",
                started_at,
                timer,
                "http_request_failed",
                error,
            )),
        }
    }
}

#[tauri::command]
pub fn m15_report_export(
    app: AppHandle,
    op_id: String,
    request: DeveloperReportRequest,
) -> Result<OperationResult<DeveloperReportResult>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let report_id = Uuid::new_v4().to_string();
    let format = request.format.to_ascii_lowercase();
    if format != "json" && format != "markdown" && format != "md" {
        return Ok(failure(
            op_id,
            "m15_s10",
            "m15.report.export",
            started_at,
            timer,
            "unsupported_report_format",
            "Report format must be json or markdown.".into(),
        ));
    }
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app_data_dir_unavailable:{error}"))?
        .join("developer_reports");
    fs::create_dir_all(&directory).map_err(|error| format!("report_dir_create_failed:{error}"))?;
    let extension = if format == "json" { "json" } else { "md" };
    let path = directory.join(format!("developer-report-{report_id}.{extension}"));
    let content = if extension == "json" {
        serde_json::to_string_pretty(&serde_json::json!({
            "title": request.title,
            "createdAt": Utc::now().to_rfc3339(),
            "sections": request.sections
        }))
        .map_err(|error| format!("report_json_failed:{error}"))?
    } else {
        format!(
            "# {}\n\nGenerated: {}\n\n```json\n{}\n```\n",
            request.title,
            Utc::now().to_rfc3339(),
            serde_json::to_string_pretty(&request.sections)
                .map_err(|error| format!("report_markdown_failed:{error}"))?
        )
    };
    fs::write(&path, content).map_err(|error| format!("report_write_failed:{error}"))?;
    let data = DeveloperReportResult {
        report_id,
        path: path.to_string_lossy().to_string(),
        format: extension.into(),
        created_at: Utc::now().to_rfc3339(),
    };
    Ok(success(
        op_id,
        "m15_s10",
        "m15.report.export",
        started_at,
        timer,
        "Developer health report was exported to the protected application-data directory.".into(),
        "تم تصدير تقرير صحة بيئة التطوير إلى مجلد بيانات التطبيق المحمي.".into(),
        data,
        Vec::new(),
    ))
}
