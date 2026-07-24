use crate::duplicates::{contracts::{FolderComparison, FolderComparisonRequest, FolderComparisonResult, FolderDigest}, errors::DuplicateError, hashing::full_blake3, traversal::is_protected_path};
use std::{collections::HashSet, path::{Path, PathBuf}};
use walkdir::WalkDir;

fn digest_folder(path: &Path, exclusions: &[PathBuf]) -> Result<FolderDigest, DuplicateError> {
    let canonical_root = dunce::canonicalize(path).map_err(|error| DuplicateError::InvalidScanSource(error.to_string()))?;
    if is_protected_path(&canonical_root) { return Err(DuplicateError::ProtectedPathSelected(canonical_root.display().to_string())); }
    let mut entries = Vec::new();
    let mut total_bytes = 0u64;
    for entry in WalkDir::new(&canonical_root).follow_links(false) {
        let entry = match entry { Ok(value) => value, Err(_) => continue };
        if !entry.file_type().is_file() { continue; }
        let canonical = match dunce::canonicalize(entry.path()) { Ok(value) => value, Err(_) => continue };
        if exclusions.iter().any(|excluded| canonical.starts_with(excluded)) { continue; }
        let relative = canonical.strip_prefix(&canonical_root).unwrap_or(&canonical).to_string_lossy().replace('\\', "/");
        let metadata = std::fs::metadata(&canonical)?;
        let hash = full_blake3(&canonical)?;
        total_bytes = total_bytes.saturating_add(metadata.len());
        entries.push(format!("{relative}\t{}\t{hash}", metadata.len()));
    }
    entries.sort();
    let mut hasher = blake3::Hasher::new();
    for entry in &entries { hasher.update(entry.as_bytes()); hasher.update(b"\n"); }
    Ok(FolderDigest { path: canonical_root.to_string_lossy().to_string(), digest: hasher.finalize().to_hex().to_string(), file_count: entries.len() as u64, total_bytes, entries })
}

pub fn compare_folders(request: &FolderComparisonRequest) -> Result<FolderComparisonResult, DuplicateError> {
    if request.paths.len() < 2 { return Err(DuplicateError::InvalidScanSource("At least two folders are required for comparison.".into())); }
    let exclusions = request.excluded_paths.iter().filter_map(|path| dunce::canonicalize(path).ok()).collect::<Vec<_>>();
    let mut folders = Vec::new();
    for path in &request.paths { folders.push(digest_folder(Path::new(path), &exclusions)?); }
    let mut comparisons = Vec::new();
    for left_index in 0..folders.len() {
        for right_index in (left_index + 1)..folders.len() {
            let left = &folders[left_index];
            let right = &folders[right_index];
            let left_set: HashSet<&String> = left.entries.iter().collect();
            let right_set: HashSet<&String> = right.entries.iter().collect();
            let common = left_set.intersection(&right_set).count() as u64;
            let left_only = left_set.difference(&right_set).count() as u64;
            let right_only = right_set.difference(&left_set).count() as u64;
            let classification = if left.digest == right.digest { "identical" } else if left_only == 0 { "right_contains_left" } else if right_only == 0 { "left_contains_right" } else if common > 0 { "overlapping" } else { "different" };
            comparisons.push(FolderComparison { left_path: left.path.clone(), right_path: right.path.clone(), classification: classification.into(), common_entries: common, left_only_entries: left_only, right_only_entries: right_only });
        }
    }
    Ok(FolderComparisonResult { folders, comparisons })
}
