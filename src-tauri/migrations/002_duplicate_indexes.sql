CREATE INDEX IF NOT EXISTS idx_duplicate_files_session_size
  ON duplicate_files(scan_session_id, size_bytes);

CREATE INDEX IF NOT EXISTS idx_duplicate_files_partial_hash
  ON duplicate_files(partial_hash);

CREATE INDEX IF NOT EXISTS idx_duplicate_files_full_hash
  ON duplicate_files(full_hash);

CREATE INDEX IF NOT EXISTS idx_duplicate_groups_session
  ON duplicate_groups(scan_session_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_members_file
  ON duplicate_group_members(file_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_actions_created
  ON duplicate_actions(created_at DESC);
