-- Durable storage analysis evidence.
--
-- Purpose: make M04 report export survive an application restart by persisting the
-- measured snapshot itself, and make every exported artifact verifiable by content
-- hash. Export reads from these tables; nothing is reconstructed from memory.

CREATE TABLE IF NOT EXISTS storage_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  operation_id TEXT,
  root_path TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  total_files INTEGER NOT NULL,
  total_directories INTEGER NOT NULL,
  total_bytes INTEGER NOT NULL,
  inaccessible_items INTEGER NOT NULL DEFAULT 0,
  truncated INTEGER NOT NULL DEFAULT 0,
  old_threshold_days INTEGER NOT NULL,
  old_file_count INTEGER NOT NULL DEFAULT 0,
  old_size_bytes INTEGER NOT NULL DEFAULT 0,
  age_policy_json TEXT NOT NULL DEFAULT '{}',
  aggregate_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_storage_snapshots_root_time
  ON storage_snapshots(root_path, captured_at DESC);

-- Largest-file rows are bounded by the scan top_limit, so this stays small by design
-- and is sufficient to regenerate the CSV/HTML/JSON report tables.
CREATE TABLE IF NOT EXISTS storage_snapshot_files (
  snapshot_id TEXT NOT NULL REFERENCES storage_snapshots(snapshot_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  modified_at TEXT,
  accessed_at TEXT,
  created_at TEXT,
  age_basis TEXT NOT NULL,
  extension TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  is_old INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_id, ordinal)
);

CREATE TABLE IF NOT EXISTS storage_snapshot_folders (
  snapshot_id TEXT NOT NULL REFERENCES storage_snapshots(snapshot_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_count INTEGER NOT NULL,
  PRIMARY KEY (snapshot_id, ordinal)
);

CREATE TABLE IF NOT EXISTS storage_snapshot_types (
  snapshot_id TEXT NOT NULL REFERENCES storage_snapshots(snapshot_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  category TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_count INTEGER NOT NULL,
  PRIMARY KEY (snapshot_id, ordinal)
);

-- Paths scanned but rejected by a user exclusion, retained so an excluded result is
-- explainable instead of silently smaller.
CREATE TABLE IF NOT EXISTS storage_snapshot_exclusions (
  snapshot_id TEXT NOT NULL REFERENCES storage_snapshots(snapshot_id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  PRIMARY KEY (snapshot_id, path)
);

CREATE TABLE IF NOT EXISTS knoux_artifacts (
  artifact_id TEXT PRIMARY KEY,
  operation_id TEXT,
  kind TEXT NOT NULL,
  format TEXT NOT NULL,
  path TEXT NOT NULL,
  byte_count INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  blake3 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retention_policy TEXT NOT NULL DEFAULT 'keep'
);

CREATE TABLE IF NOT EXISTS storage_report_exports (
  report_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL DEFAULT 'm04_s10',
  operation_id TEXT,
  source_scan_id TEXT NOT NULL,
  format TEXT NOT NULL,
  artifact_id TEXT NOT NULL REFERENCES knoux_artifacts(artifact_id) ON DELETE CASCADE,
  redaction_profile TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_storage_report_exports_scan
  ON storage_report_exports(source_scan_id, created_at DESC);
