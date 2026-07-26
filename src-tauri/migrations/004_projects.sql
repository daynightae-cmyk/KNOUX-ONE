CREATE TABLE IF NOT EXISTS project_index (
  id TEXT PRIMARY KEY, canonical_path TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  ecosystems_json TEXT NOT NULL DEFAULT '[]', frameworks_json TEXT NOT NULL DEFAULT '[]',
  manifests_json TEXT NOT NULL DEFAULT '[]', package_manager TEXT, git_repository INTEGER NOT NULL DEFAULT 0,
  branch TEXT, file_count INTEGER NOT NULL DEFAULT 0, source_file_count INTEGER NOT NULL DEFAULT 0,
  manifest_count INTEGER NOT NULL DEFAULT 0, size_bytes INTEGER NOT NULL DEFAULT 0,
  build_artifact_bytes INTEGER NOT NULL DEFAULT 0, last_modified TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0, warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_project_index_updated ON project_index(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_index_name ON project_index(name);
