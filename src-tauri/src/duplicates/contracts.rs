use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateScanRequest {
    pub paths: Vec<String>,
    #[serde(default)]
    pub excluded_paths: Vec<String>,
    #[serde(default = "default_min_size")]
    pub min_size_bytes: u64,
    pub max_size_bytes: Option<u64>,
    #[serde(default = "default_true")]
    pub include_subfolders: bool,
    #[serde(default = "default_similarity_threshold")]
    pub similarity_threshold: f32,
    #[serde(default)]
    pub extensions: Vec<String>,
    #[serde(default = "default_workers")]
    pub max_workers: usize,
}

fn default_true() -> bool {
    true
}
fn default_min_size() -> u64 {
    1_024
}
fn default_similarity_threshold() -> f32 {
    90.0
}
fn default_workers() -> usize {
    4
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateFileItem {
    pub id: String,
    pub path: String,
    pub canonical_path: String,
    pub name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub modified_time: String,
    pub created_time: String,
    pub hash: String,
    pub partial_hash: Option<String>,
    pub perceptual_hash: Option<String>,
    pub similarity_score: Option<f32>,
    pub mime_type: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub file_identity: String,
    pub hard_link_count: u64,
    pub is_hard_link_alias: bool,
    pub protected_path: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub group_id: String,
    pub mode: String,
    pub category: String,
    pub files: Vec<DuplicateFileItem>,
    pub wasted_size_bytes: u64,
    pub common_hash: String,
    pub proof_status: String,
    pub confidence: f32,
    pub actionable: bool,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateScanSummary {
    pub scan_id: String,
    pub operation_id: String,
    pub started_at: String,
    pub completed_at: String,
    pub target_folders: Vec<String>,
    pub total_files_scanned: u64,
    pub total_bytes_scanned: u64,
    pub duplicate_groups_found: u64,
    pub duplicate_files_found: u64,
    pub total_wasted_bytes: u64,
    pub scan_mode: String,
    pub error_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateScanResult {
    pub job_id: String,
    pub groups: Vec<DuplicateGroup>,
    pub summary: DuplicateScanSummary,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateJobProgress {
    pub job_id: String,
    pub operation_id: String,
    pub phase: String,
    pub mode: String,
    pub scanned_files: u64,
    pub total_files: Option<u64>,
    pub scanned_bytes: u64,
    pub current_path: Option<String>,
    pub candidate_groups: u64,
    pub verified_groups: u64,
    pub errors: u64,
    pub can_pause: bool,
    pub can_cancel: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperRuleConfig {
    pub prefer_date: Option<String>,
    pub prefer_path: Option<String>,
    pub preferred_directory: Option<String>,
    pub prefer_resolution: Option<String>,
    #[serde(default)]
    pub protected_paths: Vec<String>,
    #[serde(default = "default_true")]
    pub auto_select_non_keepers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperPlanRequest {
    pub groups: Vec<DuplicateGroup>,
    pub rules: KeeperRuleConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperGroupPlan {
    pub group_id: String,
    pub keeper_file_id: String,
    pub selected_file_ids: Vec<String>,
    pub reason: String,
    pub blocked: bool,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperPlanResult {
    pub plans: Vec<KeeperGroupPlan>,
    pub blocked_group_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineInput {
    pub group_id: String,
    pub original_path: String,
    pub keeper_path: String,
    pub expected_hash: String,
    pub reason: String,
    pub scan_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RestoreConflictMode {
    Fail,
    Rename,
    Replace,
    Choose,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum QuarantineRequest {
    #[serde(rename = "quarantine")]
    Quarantine { items: Vec<QuarantineInput> },
    #[serde(rename = "restore")]
    Restore {
        quarantine_id: String,
        conflict_mode: RestoreConflictMode,
        destination: Option<String>,
    },
    #[serde(rename = "purge")]
    Purge {
        quarantine_id: String,
        confirmation: String,
    },
    #[serde(rename = "list")]
    List,
    #[serde(rename = "verify")]
    Verify { quarantine_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineRecord {
    pub quarantine_id: String,
    pub scan_session_id: Option<String>,
    pub group_id: Option<String>,
    pub original_path: String,
    pub quarantine_path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub hash: String,
    pub file_identity: String,
    pub created_time: String,
    pub modified_time: String,
    pub quarantined_at: String,
    pub reason: String,
    pub keeper_path: String,
    pub status: String,
    pub verification_state: String,
    pub purge_state: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineActionResult {
    pub records: Vec<QuarantineRecord>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderComparisonRequest {
    pub paths: Vec<String>,
    #[serde(default)]
    pub excluded_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderDigest {
    pub path: String,
    pub digest: String,
    pub file_count: u64,
    pub total_bytes: u64,
    pub entries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderComparison {
    pub left_path: String,
    pub right_path: String,
    pub classification: String,
    pub common_entries: u64,
    pub left_only_entries: u64,
    pub right_only_entries: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderComparisonResult {
    pub folders: Vec<FolderDigest>,
    pub comparisons: Vec<FolderComparison>,
}
