use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub id: String,
    pub canonical_path: String,
    pub name: String,
    pub ecosystems: Vec<String>,
    pub frameworks: Vec<String>,
    pub manifests: Vec<String>,
    pub package_manager: Option<String>,
    pub git_repository: bool,
    pub branch: Option<String>,
    pub file_count: u64,
    pub source_file_count: u64,
    pub manifest_count: u64,
    pub size_bytes: u64,
    pub build_artifact_bytes: u64,
    pub last_modified: String,
    pub confidence: f32,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiscoverRequest {
    pub roots: Vec<String>,
    #[serde(default = "default_depth")]
    pub max_depth: usize,
}

fn default_depth() -> usize { 6 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiscoverResult {
    pub projects: Vec<ProjectRecord>,
    pub scanned_roots: Vec<String>,
    pub skipped_protected_roots: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectHealthRequest { pub project_path: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthFinding {
    pub code: String,
    pub severity: String,
    pub title: String,
    pub evidence_path: Option<String>,
    pub line: Option<u64>,
    pub redacted_preview: Option<String>,
    pub weight: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectHealthResult {
    pub health_score: u8,
    pub score_formula: String,
    pub findings: Vec<HealthFinding>,
    pub checked_files: u64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyItem {
    pub name: String,
    pub version: String,
    pub dep_type: String,
    pub is_pinned: bool,
    pub source_manifest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyAuditRequest { pub project_path: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyAuditResult {
    pub ecosystems: Vec<String>,
    pub manifests: Vec<String>,
    pub lockfiles: Vec<String>,
    pub lockfile_status: String,
    pub dependencies: Vec<DependencyItem>,
    pub unpinned_count: usize,
    pub risk_findings: Vec<String>,
    pub audit_commands: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTask {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args: Vec<String>,
    pub preview: String,
    pub risk: String,
    pub requires_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum CommandManageRequest {
    #[serde(rename = "list")]
    List { project_path: String },
    #[serde(rename = "execute")]
    Execute { project_path: String, task_id: String, confirmation: Option<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandRun {
    pub task_id: String,
    pub command_preview: String,
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandManageResult {
    pub tasks: Vec<ProjectTask>,
    pub run: Option<CommandRun>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentAuditRequest { pub project_path: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentKeyFinding {
    pub key: String,
    pub present_in_runtime_file: bool,
    pub present_in_template: bool,
    pub empty_value: bool,
    pub duplicate_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentAuditResult {
    pub runtime_files: Vec<String>,
    pub template_files: Vec<String>,
    pub keys: Vec<EnvironmentKeyFinding>,
    pub missing_keys: Vec<String>,
    pub obsolete_keys: Vec<String>,
    pub malformed_lines: Vec<String>,
    pub runtime_versions: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceAnalyzeRequest { pub project_path: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMetric { pub language: String, pub files: u64, pub bytes: u64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFileMetric { pub path: String, pub size_bytes: u64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceAnalyzeResult {
    pub file_count: u64,
    pub source_file_count: u64,
    pub test_file_count: u64,
    pub config_file_count: u64,
    pub todo_count: u64,
    pub merge_conflict_count: u64,
    pub languages: Vec<SourceMetric>,
    pub largest_files: Vec<SourceFileMetric>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheTarget {
    pub id: String,
    pub path: String,
    pub relative_path: String,
    pub category: String,
    pub size_bytes: u64,
    pub safe_to_clean: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum CacheManageRequest {
    #[serde(rename = "inspect")]
    Inspect { project_path: String },
    #[serde(rename = "clean")]
    Clean { project_path: String, paths: Vec<String>, confirmation: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheManageResult {
    pub targets: Vec<CacheTarget>,
    pub reclaimed_bytes: u64,
    pub cleaned_paths: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorkspaceRequest { pub project_path: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorkspaceResult {
    pub repository_root: Option<String>,
    pub branch: String,
    pub detached: bool,
    pub is_clean: bool,
    pub staged: Vec<String>,
    pub modified: Vec<String>,
    pub untracked: Vec<String>,
    pub conflicted: Vec<String>,
    pub ahead: i64,
    pub behind: i64,
    pub remote: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProcess {
    pub pid: u32,
    pub process_name: String,
    pub executable_path: Option<String>,
    pub command_line: Option<String>,
    pub ports: Vec<u16>,
    pub project_match_evidence: String,
    pub protected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum RuntimeManageRequest {
    #[serde(rename = "inspect")]
    Inspect { project_path: String },
    #[serde(rename = "terminate")]
    Terminate { project_path: String, pid: u32, confirmation: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeManageResult {
    pub processes: Vec<RuntimeProcess>,
    pub terminated_pid: Option<u32>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportsExportRequest {
    pub project_path: String,
    #[serde(default = "default_report_format")]
    pub format: String,
    #[serde(default)]
    pub redact_absolute_paths: bool,
}

fn default_report_format() -> String { "json".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportsExportResult {
    pub report_id: String,
    pub report_path: String,
    pub format: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub warnings: Vec<String>,
}
