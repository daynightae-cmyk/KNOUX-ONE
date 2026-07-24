use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResult<T = serde_json::Value> {
    pub operation_id: String,
    pub capability_id: String,
    pub handler_id: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub requires_restart: bool,
    pub exit_code: Option<i32>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub summary_en: String,
    pub summary_ar: String,
    pub warnings: Vec<String>,
    pub error_code: Option<String>,
    pub data: Option<T>,
}
