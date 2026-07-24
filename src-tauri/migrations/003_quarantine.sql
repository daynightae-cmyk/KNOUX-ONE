CREATE TABLE IF NOT EXISTS duplicate_quarantine (
  id TEXT PRIMARY KEY,
  scan_session_id TEXT,
  group_id TEXT,
  original_path TEXT NOT NULL,
  quarantine_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  blake3 TEXT NOT NULL,
  sha256_optional TEXT,
  file_identity TEXT NOT NULL,
  created_time TEXT NOT NULL,
  modified_time TEXT NOT NULL,
  attributes_json TEXT NOT NULL DEFAULT '{}',
  quarantined_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  keeper_path TEXT NOT NULL,
  restore_state TEXT NOT NULL DEFAULT 'quarantined',
  verification_state TEXT NOT NULL DEFAULT 'verified',
  purge_state TEXT NOT NULL DEFAULT 'active',
  restore_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_duplicate_quarantine_state
  ON duplicate_quarantine(restore_state, purge_state);

CREATE INDEX IF NOT EXISTS idx_duplicate_quarantine_original
  ON duplicate_quarantine(original_path);
