use serde::{Deserialize, Serialize};
use serde_json::Value;

fn default_hours() -> u32 { 72 }
fn default_limit() -> usize { 250 }
fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventQueryRequest {
    #[serde(default = "default_hours")]
    pub hours: u32,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub channels: Vec<String>,
    #[serde(default)]
    pub providers: Vec<String>,
    #[serde(default)]
    pub levels: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEvent {
    pub record_id: Option<u64>,
    pub channel: String,
    pub provider: String,
    pub event_id: u32,
    pub level: String,
    pub time_created: String,
    pub machine_name: Option<String>,
    pub message: String,
    pub correlation_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventQueryResult {
    pub events: Vec<DiagnosticEvent>,
    pub queried_channels: Vec<String>,
    pub hours: u32,
    pub critical_count: usize,
    pub error_count: usize,
    pub warning_count: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashCorrelationRequest {
    #[serde(default = "default_hours")]
    pub hours: u32,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationCrash {
    pub application: String,
    pub faulting_module: Option<String>,
    pub exception_code: Option<String>,
    pub event_id: u32,
    pub provider: String,
    pub time_created: String,
    pub occurrence_count: u32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashCorrelationResult {
    pub crashes: Vec<ApplicationCrash>,
    pub total_events: usize,
    pub recurring_applications: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BsodTriageRequest {
    #[serde(default = "default_hours")]
    pub hours: u32,
    #[serde(default = "default_true")]
    pub include_minidump_inventory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MinidumpEvidence {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub readable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BugcheckEvidence {
    pub time_created: String,
    pub code: Option<String>,
    pub parameters: Vec<String>,
    pub dump_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BsodTriageResult {
    pub bugchecks: Vec<BugcheckEvidence>,
    pub minidumps: Vec<MinidumpEvidence>,
    pub debugger_available: bool,
    pub debugger_path: Option<String>,
    pub analysis_level: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReliabilityRequest {
    #[serde(default = "default_hours")]
    pub hours: u32,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReliabilityRecord {
    pub time_generated: String,
    pub source_name: String,
    pub product_name: Option<String>,
    pub event_identifier: Option<u32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReliabilityResult {
    pub records: Vec<ReliabilityRecord>,
    pub day_counts: Vec<DayCount>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayCount { pub day: String, pub incidents: u32 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDiagnosticsRequest {
    #[serde(default = "default_hours")]
    pub hours: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceFailure {
    pub service_name: Option<String>,
    pub display_name: Option<String>,
    pub start_mode: Option<String>,
    pub state: Option<String>,
    pub process_id: Option<u32>,
    pub event_id: Option<u32>,
    pub time_created: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDiagnosticsResult {
    pub failures: Vec<ServiceFailure>,
    pub automatic_not_running: Vec<ServiceFailure>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiagnosticsRequest {
    #[serde(default = "default_hours")]
    pub hours: u32,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEvidence {
    pub time_created: String,
    pub event_id: u32,
    pub level: String,
    pub kb: Option<String>,
    pub error_code: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledUpdate { pub hotfix_id: String, pub description: String, pub installed_on: Option<String> }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiagnosticsResult {
    pub events: Vec<UpdateEvidence>,
    pub installed_updates: Vec<InstalledUpdate>,
    pub failure_count: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareWarningsRequest {
    #[serde(default = "default_hours")]
    pub hours: u32,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareWarning {
    pub time_created: String,
    pub provider: String,
    pub event_id: u32,
    pub level: String,
    pub category: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareWarningsResult {
    pub events: Vec<HardwareWarning>,
    pub category_counts: Vec<CategoryCount>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryCount { pub category: String, pub count: u32 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkDiagnosticsRequest {
    #[serde(default = "default_hours")]
    pub hours: u32,
    #[serde(default)]
    pub target: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkAdapterEvidence {
    pub name: String,
    pub description: String,
    pub status: String,
    pub link_speed: Option<String>,
    pub mac_address: Option<String>,
    pub ipv4: Vec<String>,
    pub gateways: Vec<String>,
    pub dns_servers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProbe {
    pub target: String,
    pub resolved_addresses: Vec<String>,
    pub ping_succeeded: bool,
    pub tcp_succeeded: Option<bool>,
    pub remote_port: Option<u16>,
    pub source_address: Option<String>,
    pub interface_alias: Option<String>,
    pub latency_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkDiagnosticsResult {
    pub adapters: Vec<NetworkAdapterEvidence>,
    pub probe: Option<NetworkProbe>,
    pub events: Vec<DiagnosticEvent>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticExportRequest {
    pub title: String,
    pub format: String,
    pub evidence: Value,
    #[serde(default = "default_true")]
    pub redact: bool,
    #[serde(default)]
    pub include_system_summary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticExportResult {
    pub export_id: String,
    pub path: String,
    pub format: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub redaction_count: usize,
    pub sha256: String,
    pub included_files: Vec<String>,
    pub warnings: Vec<String>,
}
