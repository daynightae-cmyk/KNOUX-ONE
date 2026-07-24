use crate::duplicates::{contracts::{DuplicateFileItem, DuplicateGroup, DuplicateJobProgress, DuplicateScanRequest, DuplicateScanResult, DuplicateScanSummary}, errors::DuplicateError, hashing::{full_blake3, partial_blake3, verify_unchanged}, jobs::JobControl, traversal::{collect_files, FileCandidate}};
use chrono::Utc;
use std::{collections::{HashMap, HashSet}, fs};
use uuid::Uuid;

pub type ProgressCallback<'a> = &'a dyn Fn(DuplicateJobProgress);

fn category_for_extension(extension: &str) -> &'static str {
    match extension {
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "tif" | "tiff" | "webp" | "heic" => "images",
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "webm" | "m4v" => "videos",
        "mp3" | "wav" | "flac" | "aac" | "m4a" | "ogg" | "wma" => "audio",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "csv" | "rtf" | "md" | "json" | "yaml" | "yml" | "xml" | "toml" | "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "cs" | "java" | "go" => "documents",
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => "archives",
        _ => "other",
    }
}

fn build_file_item(candidate: &FileCandidate, full_hash: String, partial_hash: Option<String>, identity_is_alias: bool) -> DuplicateFileItem {
    DuplicateFileItem { id: Uuid::new_v4().to_string(), path: candidate.path.to_string_lossy().to_string(), canonical_path: candidate.canonical_path.to_string_lossy().to_string(), name: candidate.name.clone(), extension: candidate.extension.clone(), size_bytes: candidate.size_bytes, modified_time: candidate.modified_time.clone(), created_time: candidate.created_time.clone(), hash: full_hash, partial_hash, perceptual_hash: None, similarity_score: None, mime_type: candidate.mime_type.clone(), width: None, height: None, file_identity: candidate.file_identity.clone(), hard_link_count: candidate.hard_link_count, is_hard_link_alias: identity_is_alias, protected_path: candidate.protected_path }
}

#[allow(clippy::too_many_arguments)]
fn emit_progress(callback: ProgressCallback<'_>, job_id: &str, operation_id: &str, phase: &str, scanned_files: u64, total_files: Option<u64>, scanned_bytes: u64, current_path: Option<String>, candidate_groups: u64, verified_groups: u64, errors: u64) {
    callback(DuplicateJobProgress { job_id: job_id.to_string(), operation_id: operation_id.to_string(), phase: phase.to_string(), mode: if total_files.is_some() { "determinate".into() } else { "indeterminate".into() }, scanned_files, total_files, scanned_bytes, current_path, candidate_groups, verified_groups, errors, can_pause: true, can_cancel: true });
}

pub fn scan_exact(operation_id: &str, job_id: &str, mode: &str, request: &DuplicateScanRequest, control: &JobControl, progress: ProgressCallback<'_>) -> Result<DuplicateScanResult, DuplicateError> {
    let started_at = Utc::now().to_rfc3339();
    emit_progress(progress, job_id, operation_id, "enumerating", 0, None, 0, None, 0, 0, 0);
    let traversal = collect_files(request, control)?;
    let total_files = traversal.files.len() as u64;
    let total_bytes = traversal.scanned_bytes;
    let mut errors = traversal.errors;
    let mut by_size: HashMap<u64, Vec<FileCandidate>> = HashMap::new();

    for (index, candidate) in traversal.files.into_iter().enumerate() {
        control.checkpoint()?;
        by_size.entry(candidate.size_bytes).or_default().push(candidate.clone());
        if index % 128 == 0 { emit_progress(progress, job_id, operation_id, "grouping_by_size", index as u64, Some(total_files), 0, Some(candidate.path.to_string_lossy().to_string()), 0, 0, errors.len() as u64); }
    }

    let candidate_size_groups: Vec<Vec<FileCandidate>> = by_size.into_values().filter(|group| group.len() > 1).collect();
    let candidate_groups_count = candidate_size_groups.len() as u64;
    let mut partial_groups: HashMap<(u64, String), Vec<(FileCandidate, String)>> = HashMap::new();
    let mut processed = 0u64;
    let mut processed_bytes = 0u64;

    for group in candidate_size_groups {
        for candidate in group {
            control.checkpoint()?;
            match partial_blake3(&candidate.canonical_path, candidate.size_bytes) {
                Ok(hash) => { partial_groups.entry((candidate.size_bytes, hash.clone())).or_default().push((candidate.clone(), hash)); }
                Err(error) => errors.push(error.to_string()),
            }
            processed += 1;
            processed_bytes = processed_bytes.saturating_add(candidate.size_bytes);
            emit_progress(progress, job_id, operation_id, "partial_hashing", processed, Some(total_files), processed_bytes, Some(candidate.path.to_string_lossy().to_string()), candidate_groups_count, 0, errors.len() as u64);
        }
    }

    let partial_candidates: Vec<Vec<(FileCandidate, String)>> = partial_groups.into_values().filter(|group| group.len() > 1).collect();
    if mode == "fast_partial" {
        let mut groups = Vec::new();
        for group in partial_candidates {
            let common_hash = group[0].1.clone();
            let files = group.into_iter().map(|(candidate, partial)| build_file_item(&candidate, String::new(), Some(partial), false)).collect::<Vec<_>>();
            groups.push(DuplicateGroup { group_id: Uuid::new_v4().to_string(), mode: mode.into(), category: category_for_extension(&files[0].extension).into(), wasted_size_bytes: 0, common_hash, proof_status: "candidate".into(), confidence: 0.55, actionable: false, warnings: vec!["Full verification is required before quarantine.".into()], files });
        }
        let duplicate_files = groups.iter().map(|group| group.files.len() as u64).sum();
        return Ok(DuplicateScanResult { job_id: job_id.into(), groups, summary: DuplicateScanSummary { scan_id: Uuid::new_v4().to_string(), operation_id: operation_id.into(), started_at, completed_at: Utc::now().to_rfc3339(), target_folders: request.paths.clone(), total_files_scanned: total_files, total_bytes_scanned: total_bytes, duplicate_groups_found: candidate_groups_count, duplicate_files_found: duplicate_files, total_wasted_bytes: 0, scan_mode: mode.into(), error_count: errors.len() as u64 }, warnings: errors });
    }

    let mut full_groups: HashMap<String, Vec<(FileCandidate, String)>> = HashMap::new();
    let mut verified_files = 0u64;
    for group in partial_candidates {
        for (candidate, partial_hash) in group {
            control.checkpoint()?;
            let metadata_before = fs::metadata(&candidate.canonical_path)?;
            let modified_before = metadata_before.modified().ok();
            match full_blake3(&candidate.canonical_path) {
                Ok(hash) => { verify_unchanged(&candidate.canonical_path, metadata_before.len(), modified_before)?; full_groups.entry(hash).or_default().push((candidate.clone(), partial_hash)); }
                Err(error) => errors.push(error.to_string()),
            }
            verified_files += 1;
            emit_progress(progress, job_id, operation_id, "full_hashing", verified_files, Some(total_files), processed_bytes, Some(candidate.path.to_string_lossy().to_string()), candidate_groups_count, full_groups.len() as u64, errors.len() as u64);
        }
    }

    let mut groups = Vec::new();
    for (common_hash, members) in full_groups {
        if members.len() < 2 { continue; }
        let mut seen_identities = HashSet::new();
        let mut files = Vec::with_capacity(members.len());
        for (candidate, partial_hash) in members {
            let is_alias = !seen_identities.insert(candidate.file_identity.clone());
            files.push(build_file_item(&candidate, common_hash.clone(), Some(partial_hash), is_alias));
        }
        let unique_physical_files = seen_identities.len() as u64;
        let size = files.first().map(|file| file.size_bytes).unwrap_or_default();
        let wasted_size_bytes = unique_physical_files.saturating_sub(1).saturating_mul(size);
        let only_hard_links = unique_physical_files < 2;
        let mut warnings = Vec::new();
        if files.iter().any(|file| file.hard_link_count > 1) { warnings.push("Hard-link aliases were detected and are not counted as reclaimable storage.".into()); }
        groups.push(DuplicateGroup { group_id: Uuid::new_v4().to_string(), mode: mode.into(), category: category_for_extension(&files[0].extension).into(), files, wasted_size_bytes, common_hash, proof_status: if only_hard_links { "hard_link_aliases".into() } else { "verified_exact".into() }, confidence: 1.0, actionable: !only_hard_links, warnings });
    }

    groups.sort_by(|left, right| right.wasted_size_bytes.cmp(&left.wasted_size_bytes));
    let duplicate_files = groups.iter().map(|group| group.files.len() as u64).sum();
    let total_wasted_bytes = groups.iter().map(|group| group.wasted_size_bytes).sum();
    emit_progress(progress, job_id, operation_id, "completed", total_files, Some(total_files), total_bytes, None, candidate_groups_count, groups.len() as u64, errors.len() as u64);
    Ok(DuplicateScanResult { job_id: job_id.into(), groups, summary: DuplicateScanSummary { scan_id: Uuid::new_v4().to_string(), operation_id: operation_id.into(), started_at, completed_at: Utc::now().to_rfc3339(), target_folders: request.paths.clone(), total_files_scanned: total_files, total_bytes_scanned: total_bytes, duplicate_groups_found: candidate_groups_count, duplicate_files_found: duplicate_files, total_wasted_bytes, scan_mode: mode.into(), error_count: errors.len() as u64 }, warnings: errors })
}

pub fn with_extensions(request: &DuplicateScanRequest, extensions: &[&str]) -> DuplicateScanRequest { let mut filtered = request.clone(); filtered.extensions = extensions.iter().map(|value| value.to_string()).collect(); filtered }

pub fn exact_for_extensions(operation_id: &str, job_id: &str, mode: &str, request: &DuplicateScanRequest, extensions: &[&str], control: &JobControl, progress: ProgressCallback<'_>) -> Result<DuplicateScanResult, DuplicateError> {
    scan_exact(operation_id, job_id, mode, &with_extensions(request, extensions), control, progress)
}

#[cfg(test)]
mod tests {
    use super::scan_exact;
    use crate::duplicates::{contracts::{DuplicateJobProgress, DuplicateScanRequest}, jobs::JobControl};
    use std::fs;
    fn request(path: &std::path::Path) -> DuplicateScanRequest { DuplicateScanRequest { paths: vec![path.to_string_lossy().to_string()], excluded_paths: vec![], min_size_bytes: 0, max_size_bytes: None, include_subfolders: true, similarity_threshold: 90.0, extensions: vec![], max_workers: 2 } }

    #[test]
    fn exact_scan_groups_identical_files_but_not_equal_size_different_files() {
        let directory = tempfile::tempdir().expect("tempdir");
        fs::write(directory.path().join("a.bin"), b"same payload").unwrap();
        fs::write(directory.path().join("b.bin"), b"same payload").unwrap();
        fs::write(directory.path().join("c.bin"), b"diff payload").unwrap();
        let control = JobControl::new();
        let callback = |_progress: DuplicateJobProgress| {};
        let result = scan_exact("op_test", "job_test", "exact_blake3", &request(directory.path()), &control, &callback).expect("scan");
        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.groups[0].files.len(), 2);
        assert!(result.groups[0].actionable);
    }

    #[cfg(unix)]
    #[test]
    fn hard_links_are_not_counted_as_reclaimable_duplicates() {
        let directory = tempfile::tempdir().expect("tempdir");
        let original = directory.path().join("original.bin");
        let alias = directory.path().join("alias.bin");
        fs::write(&original, b"same physical file").unwrap();
        fs::hard_link(&original, &alias).unwrap();
        let control = JobControl::new();
        let callback = |_progress: DuplicateJobProgress| {};
        let result = scan_exact("op_test", "job_test", "exact_blake3", &request(directory.path()), &control, &callback).expect("scan");
        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.groups[0].wasted_size_bytes, 0);
        assert!(!result.groups[0].actionable);
    }
}
