use serde::{Deserialize, Serialize};

fn default_item_limit() -> usize {
    5_000
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupScanRequest {
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default = "default_item_limit")]
    pub max_items_per_category: usize,
}

impl Default for CleanupScanRequest {
    fn default() -> Self {
        Self {
            categories: Vec::new(),
            max_items_per_category: default_item_limit(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupExecuteRequest {
    pub scan_id: String,
    pub categories: Vec<String>,
    pub confirmation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupFileEvidence {
    pub path: String,
    pub root_path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub modified_unix_ms: u128,
    pub safe_to_clean: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupCategorySummary {
    pub id: String,
    pub name_en: String,
    pub name_ar: String,
    pub file_count: u64,
    pub size_bytes: u64,
    pub requires_admin: bool,
    pub scan_only: bool,
    pub truncated: bool,
    pub items: Vec<CleanupFileEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupScanResult {
    pub scan_id: String,
    pub categories: Vec<CleanupCategorySummary>,
    pub total_files: u64,
    pub total_bytes: u64,
    pub cancelled: bool,
    pub scanned_at: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupFailureItem {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupExecuteResult {
    pub scan_id: String,
    pub deleted_files: u64,
    pub deleted_bytes: u64,
    pub skipped_files: u64,
    pub failed_files: Vec<CleanupFailureItem>,
    pub cancelled: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupProgress {
    pub operation_id: String,
    pub phase: String,
    pub category: Option<String>,
    pub files_processed: u64,
    pub bytes_processed: u64,
    pub current_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupCancelResult {
    pub target_operation_id: String,
    pub cancellation_requested: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupHistoryEntry {
    pub operation_id: String,
    pub operation_type: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: String,
    pub file_count: u64,
    pub byte_count: u64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupHistoryResult {
    pub entries: Vec<CleanupHistoryEntry>,
}
