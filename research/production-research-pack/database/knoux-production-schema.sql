PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS services (
  service_id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  repository_state TEXT NOT NULL CHECK(repository_state IN ('PLANNED','PARTIAL','STATIC_VERIFIED','RUNTIME_VERIFIED','BLOCKED')),
  contract_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operations (
  operation_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(service_id),
  binary_sha TEXT,
  status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  privilege TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  input_json TEXT,
  summary_json TEXT,
  warnings_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operations_service_started ON operations(service_id, started_at DESC);

CREATE TABLE IF NOT EXISTS operation_steps (
  step_id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL REFERENCES operations(operation_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  message TEXT,
  detail_json TEXT,
  UNIQUE(operation_id, ordinal)
);

CREATE TABLE IF NOT EXISTS evidence (
  evidence_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(operation_id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK(sensitivity IN ('PUBLIC','LOCAL_MACHINE','PERSONAL','SENSITIVE','SECRET')),
  source TEXT,
  collected_at TEXT NOT NULL,
  payload_json TEXT,
  content_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_evidence_operation ON evidence(operation_id);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  operation_id TEXT REFERENCES operations(operation_id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  byte_count INTEGER,
  sha256 TEXT,
  blake3 TEXT,
  created_at TEXT NOT NULL,
  retention_policy TEXT
);

CREATE TABLE IF NOT EXISTS service_settings (
  service_id TEXT NOT NULL REFERENCES services(service_id),
  profile_name TEXT NOT NULL DEFAULT 'default',
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(service_id, profile_name)
);

CREATE TABLE IF NOT EXISTS scan_sessions (
  scan_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(service_id),
  operation_id TEXT REFERENCES operations(operation_id),
  root_json TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  totals_json TEXT,
  warnings_json TEXT
);

CREATE TABLE IF NOT EXISTS duplicate_groups (
  group_id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scan_sessions(scan_id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  proof_status TEXT NOT NULL,
  confidence REAL,
  signature TEXT,
  actionable INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS duplicate_items (
  item_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES duplicate_groups(group_id) ON DELETE CASCADE,
  canonical_path TEXT NOT NULL,
  file_identity TEXT,
  size_bytes INTEGER,
  modified_at TEXT,
  exact_hash TEXT,
  perceptual_json TEXT,
  similarity REAL,
  protected_path INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quarantine_items (
  quarantine_id TEXT PRIMARY KEY,
  operation_id TEXT REFERENCES operations(operation_id),
  original_path TEXT NOT NULL,
  quarantine_path TEXT NOT NULL,
  original_identity TEXT,
  size_bytes INTEGER,
  content_hash TEXT NOT NULL,
  acl_metadata_json TEXT,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  restored_at TEXT,
  purged_at TEXT
);

CREATE TABLE IF NOT EXISTS storage_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  operation_id TEXT REFERENCES operations(operation_id),
  root_path TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  total_files INTEGER NOT NULL,
  total_directories INTEGER NOT NULL,
  total_bytes INTEGER NOT NULL,
  aggregate_json TEXT NOT NULL,
  detailed_artifact_id TEXT REFERENCES artifacts(artifact_id)
);
CREATE INDEX IF NOT EXISTS idx_storage_root_time ON storage_snapshots(root_path, captured_at DESC);

CREATE TABLE IF NOT EXISTS performance_samples (
  sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_key TEXT NOT NULL,
  entity_key TEXT,
  sampled_at TEXT NOT NULL,
  value_real REAL,
  unit TEXT,
  detail_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_perf_metric_time ON performance_samples(metric_key, sampled_at DESC);

CREATE TABLE IF NOT EXISTS network_measurements (
  measurement_id TEXT PRIMARY KEY,
  operation_id TEXT REFERENCES operations(operation_id),
  measurement_type TEXT NOT NULL,
  target TEXT,
  measured_at TEXT NOT NULL,
  result_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS startup_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  entries_json TEXT NOT NULL,
  boot_evidence_json TEXT
);

CREATE TABLE IF NOT EXISTS application_inventory (
  app_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  version TEXT,
  provider TEXT,
  package_id TEXT,
  architecture TEXT,
  install_scope TEXT,
  detected_at TEXT NOT NULL,
  evidence_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_inventory (
  driver_key TEXT PRIMARY KEY,
  device_instance_id TEXT,
  inf_name TEXT,
  provider TEXT,
  version TEXT,
  date TEXT,
  signer TEXT,
  detected_at TEXT NOT NULL,
  evidence_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_jobs (
  job_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_json TEXT NOT NULL,
  destination_json TEXT NOT NULL,
  schedule_json TEXT,
  retention_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_rules (
  rule_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  safety_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  scheduled_job_id TEXT PRIMARY KEY,
  owner_service_id TEXT REFERENCES services(service_id),
  windows_task_path TEXT,
  trigger_json TEXT NOT NULL,
  action_contract_json TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  last_verified_at TEXT
);

CREATE TABLE IF NOT EXISTS hardware_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  machine_fingerprint_hash TEXT,
  components_json TEXT NOT NULL,
  warnings_json TEXT
);

CREATE TABLE IF NOT EXISTS report_exports (
  report_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(service_id),
  source_operation_id TEXT REFERENCES operations(operation_id),
  source_scan_id TEXT,
  format TEXT NOT NULL,
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  redaction_profile TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_metadata (
  provider_id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL,
  endpoint_origin TEXT,
  config_json TEXT,
  updated_at TEXT NOT NULL
);

-- Secrets/tokens/passwords deliberately do not belong in this database.
