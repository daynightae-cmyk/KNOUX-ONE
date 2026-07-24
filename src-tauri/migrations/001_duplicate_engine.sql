PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS duplicate_scan_sessions (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  scanned_files INTEGER NOT NULL DEFAULT 0,
  scanned_bytes INTEGER NOT NULL DEFAULT 0,
  duplicate_groups INTEGER NOT NULL DEFAULT 0,
  reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS duplicate_scan_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  FOREIGN KEY(scan_session_id) REFERENCES duplicate_scan_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS duplicate_scan_exclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  FOREIGN KEY(scan_session_id) REFERENCES duplicate_scan_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS duplicate_files (
  id TEXT PRIMARY KEY,
  scan_session_id TEXT NOT NULL,
  canonical_path TEXT NOT NULL,
  display_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  modified_time TEXT NOT NULL,
  created_time TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  partial_hash TEXT,
  full_hash TEXT,
  perceptual_hash TEXT,
  file_identity TEXT NOT NULL,
  hard_link_count INTEGER NOT NULL DEFAULT 1,
  is_hard_link_alias INTEGER NOT NULL DEFAULT 0,
  protected_path INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(scan_session_id) REFERENCES duplicate_scan_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS duplicate_groups (
  id TEXT PRIMARY KEY,
  scan_session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  category TEXT NOT NULL,
  common_hash TEXT NOT NULL,
  proof_status TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  actionable INTEGER NOT NULL DEFAULT 0,
  wasted_size_bytes INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(scan_session_id) REFERENCES duplicate_scan_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS duplicate_group_members (
  group_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  similarity_score REAL,
  PRIMARY KEY(group_id, file_id),
  FOREIGN KEY(group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(file_id) REFERENCES duplicate_files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS duplicate_keeper_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL,
  rule_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS duplicate_selection_plans (
  id TEXT PRIMARY KEY,
  scan_session_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  keeper_file_id TEXT NOT NULL,
  selected_file_ids_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(scan_session_id) REFERENCES duplicate_scan_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS duplicate_actions (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  scan_session_id TEXT,
  group_id TEXT,
  file_id TEXT,
  status TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
