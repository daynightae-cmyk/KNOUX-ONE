use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupItem {
    pub id: String,
    pub name: String,
    pub source_kind: String,
    pub source_scope: String,
    pub source_path: String,
    pub command: String,
    pub target_path: Option<String>,
    pub enabled: bool,
    pub requires_admin: bool,
    pub protected: bool,
    pub protection_reason_en: Option<String>,
    pub protection_reason_ar: Option<String>,
    pub target_exists: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupInventory {
    pub scan_id: String,
    pub items: Vec<StartupItem>,
    pub measured_at: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupToggleRequest {
    pub scan_id: String,
    pub item_id: String,
    pub enabled: bool,
    pub confirmation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupToggleResult {
    pub item_id: String,
    pub change_id: String,
    pub previous_enabled: bool,
    pub enabled: bool,
    pub backup_path: String,
    pub requires_restart: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupChangeRecord {
    pub change_id: String,
    pub item_id: String,
    pub item_name: String,
    pub source_kind: String,
    pub source_scope: String,
    pub source_path: String,
    pub command: String,
    pub previous_enabled: bool,
    pub enabled: bool,
    pub backup_path: String,
    pub created_at: String,
    pub restored_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupChangeHistory {
    pub entries: Vec<StartupChangeRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupRestoreRequest {
    pub change_id: String,
    pub confirmation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupRestoreResult {
    pub change_id: String,
    pub item_id: String,
    pub restored_enabled: bool,
    pub restored_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskItem {
    pub task_path: String,
    pub task_name: String,
    pub state: String,
    pub enabled: bool,
    pub author: Option<String>,
    pub description: Option<String>,
    pub last_run_time: Option<String>,
    pub next_run_time: Option<String>,
    pub last_task_result: Option<i64>,
    pub protected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskInventory {
    pub tasks: Vec<ScheduledTaskItem>,
    pub measured_at: String,
    pub read_only: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsServiceItem {
    pub name: String,
    pub display_name: String,
    pub state: String,
    pub start_mode: String,
    pub path_name: Option<String>,
    pub start_name: Option<String>,
    pub process_id: Option<u32>,
    pub protected: bool,
    pub protection_reason_en: Option<String>,
    pub protection_reason_ar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsServiceInventory {
    pub services: Vec<WindowsServiceItem>,
    pub measured_at: String,
    pub read_only: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupAssessmentItem {
    pub item_id: String,
    pub item_name: String,
    pub attention_level: String,
    pub attention_score: u8,
    pub reasons_en: Vec<String>,
    pub reasons_ar: Vec<String>,
    pub measured_boot_delay_ms: Option<u64>,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupAssessmentResult {
    pub scan_id: String,
    pub items: Vec<StartupAssessmentItem>,
    pub methodology_en: String,
    pub methodology_ar: String,
    pub measured_at: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupRecommendation {
    pub item_id: String,
    pub item_name: String,
    pub classification: String,
    pub action_available: bool,
    pub reason_en: String,
    pub reason_ar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupRecommendationResult {
    pub scan_id: String,
    pub recommendations: Vec<StartupRecommendation>,
    pub automatic_disable_performed: bool,
    pub measured_at: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootHistoryRequest {
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootHistoryItem {
    pub recorded_at: String,
    pub boot_duration_ms: Option<u64>,
    pub main_path_boot_time_ms: Option<u64>,
    pub boot_post_boot_time_ms: Option<u64>,
    pub event_id: u32,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootHistoryResult {
    pub entries: Vec<BootHistoryItem>,
    pub source: String,
    pub measured_at: String,
    pub warnings: Vec<String>,
}
