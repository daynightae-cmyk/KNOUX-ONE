-- Durable evidence for Module 16 (project engineering) and Module 17 (logs and diagnostics).
--
-- Purpose: keep the project index, exported project reports, diagnostic sessions and
-- exported diagnostic artifacts across application restarts, so the interface can show
-- what was actually inspected on this machine instead of reconstructing it from memory.
-- Rows are only ever written by the native engines after a real inspection or export.

CREATE TABLE IF NOT EXISTS project_index (
  id TEXT PRIMARY KEY,
  canonical_path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  ecosystems_json TEXT NOT NULL DEFAULT '[]',
  frameworks_json TEXT NOT NULL DEFAULT '[]',
  manifests_json TEXT NOT NULL DEFAULT '[]',
  package_manager TEXT,
  git_repository INTEGER NOT NULL DEFAULT 0,
  branch TEXT,
  file_count INTEGER NOT NULL DEFAULT 0,
  source_file_count INTEGER NOT NULL DEFAULT 0,
  manifest_count INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  build_artifact_bytes INTEGER NOT NULL DEFAULT 0,
  last_modified TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_project_index_updated
  ON project_index(updated_at DESC);

CREATE TABLE IF NOT EXISTS project_reports (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  format TEXT NOT NULL,
  exported_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_reports_time
  ON project_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  warnings_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_service_time
  ON diagnostic_sessions(service_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_exports (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  redaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_exports_time
  ON diagnostic_exports(created_at DESC);
