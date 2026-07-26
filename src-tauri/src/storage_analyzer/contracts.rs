use serde::{Deserialize, Serialize};

fn default_top_limit() -> usize {
    100
}

fn default_old_days() -> u64 {
    180
}

fn default_max_files() -> u64 {
    1_000_000
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageScanRequest {
    pub root_path: String,
    #[serde(default = "default_top_limit")]
    pub top_limit: usize,
    #[serde(default = "default_old_days")]
    pub old_days: u64,
    #[serde(default = "default_max_files")]
    pub max_files: u64,
}

impl StorageScanRequest {
    pub fn for_root(root_path: String) -> Self {
        Self {
            root_path,
            top_limit: default_top_limit(),
            old_days: default_old_days(),
            max_files: default_max_files(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageFileItem {
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub extension: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageFolderItem {
    pub path: String,
    pub size_bytes: u64,
    pub file_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageTypeItem {
    pub category: String,
    pub extension: String,
    pub size_bytes: u64,
    pub file_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageOldFilesSummary {
    pub threshold_days: u64,
    pub file_count: u64,
    pub size_bytes: u64,
    pub largest_files: Vec<StorageFileItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageAnalysisResult {
    pub scan_id: String,
    pub root_path: String,
    pub total_files: u64,
    pub total_directories: u64,
    pub total_bytes: u64,
    pub inaccessible_items: u64,
    pub truncated: bool,
    pub cancelled: bool,
    pub largest_files: Vec<StorageFileItem>,
    pub largest_folders: Vec<StorageFolderItem>,
    pub type_distribution: Vec<StorageTypeItem>,
    pub old_files: StorageOldFilesSummary,
    pub scanned_at: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDriveInfo {
    pub root_path: String,
    pub drive_type: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub free_percent: f64,
    pub is_external: bool,
    pub is_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDriveInventory {
    pub drives: Vec<StorageDriveInfo>,
    pub measured_at: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSpaceCheckRequest {
    #[serde(default = "default_threshold_percent")]
    pub threshold_percent: f64,
}

impl Default for StorageSpaceCheckRequest {
    fn default() -> Self {
        Self {
            threshold_percent: default_threshold_percent(),
        }
    }
}

fn default_threshold_percent() -> f64 {
    10.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSpaceAlert {
    pub root_path: String,
    pub free_percent: f64,
    pub free_bytes: u64,
    pub threshold_percent: f64,
    pub below_threshold: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSpaceCheckResult {
    pub alerts: Vec<StorageSpaceAlert>,
    pub checked_at: String,
    pub background_monitoring_enabled: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageReportExportRequest {
    pub scan_id: String,
    pub file_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageReportExportResult {
    pub scan_id: String,
    pub format: String,
    pub path: String,
    pub byte_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageProgress {
    pub operation_id: String,
    pub phase: String,
    pub files_processed: u64,
    pub directories_processed: u64,
    pub bytes_processed: u64,
    pub current_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCancelResult {
    pub target_operation_id: String,
    pub cancellation_requested: bool,
}
