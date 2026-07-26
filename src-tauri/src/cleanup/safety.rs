use crate::cleanup::{contracts::CleanupFileEvidence, discovery::TargetFilter};
use std::{fs::Metadata, path::Path, time::UNIX_EPOCH};

pub fn modified_unix_ms(metadata: &Metadata) -> u128 {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis())
        .unwrap_or_default()
}

pub fn old_enough(metadata: &Metadata, minimum_age_seconds: u64) -> bool {
    if minimum_age_seconds == 0 {
        return true;
    }
    metadata
        .modified()
        .ok()
        .and_then(|value| value.elapsed().ok())
        .map(|age| age.as_secs() >= minimum_age_seconds)
        .unwrap_or(false)
}

pub fn matches_filter(path: &Path, filter: TargetFilter) -> bool {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match filter {
        TargetFilter::AnyFile => true,
        TargetFilter::ThumbnailDatabase => {
            extension == "db"
                && (file_name.starts_with("thumbcache_")
                    || file_name.starts_with("iconcache_"))
        }
        TargetFilter::CrashDump => {
            matches!(extension.as_str(), "dmp" | "hdmp" | "mdmp" | "wer" | "xml" | "txt")
        }
        TargetFilter::OldLog => matches!(extension.as_str(), "log" | "etl" | "tmp"),
        TargetFilter::OldInstaller => matches!(
            extension.as_str(),
            "exe" | "msi" | "msix" | "msixbundle" | "appx" | "appxbundle" | "zip" | "7z" | "rar" | "iso"
        ),
    }
}

pub fn path_is_within(path: &Path, root: &Path) -> bool {
    let canonical_path = dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let canonical_root = dunce::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    canonical_path.starts_with(canonical_root)
}

pub fn snapshot_still_matches(path: &Path, evidence: &CleanupFileEvidence) -> Result<bool, String> {
    let metadata = path
        .metadata()
        .map_err(|error| format!("metadata_failed:{error}"))?;
    Ok(metadata.is_file()
        && metadata.len() == evidence.size_bytes
        && modified_unix_ms(&metadata) == evidence.modified_unix_ms)
}
