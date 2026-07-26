use crate::cleanup::{
    contracts::{CleanupExecuteResult, CleanupFailureItem, CleanupProgress, CleanupScanResult},
    safety,
};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::{AppHandle, Emitter};

pub fn execute_cleanup(
    app: &AppHandle,
    operation_id: &str,
    scan: &CleanupScanResult,
    selected_categories: &[String],
    confirmation: &str,
    cancelled: Arc<AtomicBool>,
) -> Result<CleanupExecuteResult, String> {
    if confirmation != "CLEAN" {
        return Err("cleanup_confirmation_required: type CLEAN to continue".into());
    }

    let selected = selected_categories.iter().cloned().collect::<HashSet<_>>();
    let mut deleted_files = 0_u64;
    let mut deleted_bytes = 0_u64;
    let mut skipped_files = 0_u64;
    let mut failed_files = Vec::new();
    let mut warnings = Vec::new();
    let mut was_cancelled = false;

    'categories: for category in &scan.categories {
        if !selected.contains(&category.id) {
            continue;
        }
        if category.scan_only {
            warnings.push(format!("scan_only_category_skipped:{}", category.id));
            skipped_files = skipped_files.saturating_add(category.items.len() as u64);
            continue;
        }

        for evidence in &category.items {
            if cancelled.load(Ordering::Relaxed) {
                was_cancelled = true;
                break 'categories;
            }
            if !evidence.safe_to_clean {
                skipped_files += 1;
                continue;
            }

            let path = PathBuf::from(&evidence.path);
            let root = Path::new(&evidence.root_path);
            if !path.exists() {
                skipped_files += 1;
                continue;
            }

            let symlink_metadata = match fs::symlink_metadata(&path) {
                Ok(value) => value,
                Err(error) => {
                    failed_files.push(CleanupFailureItem {
                        path: evidence.path.clone(),
                        reason: format!("symlink_metadata_failed:{error}"),
                    });
                    continue;
                }
            };
            if symlink_metadata.file_type().is_symlink() || !symlink_metadata.is_file() {
                failed_files.push(CleanupFailureItem {
                    path: evidence.path.clone(),
                    reason: "unsafe_file_type".into(),
                });
                continue;
            }
            if !safety::path_is_within(&path, root) {
                failed_files.push(CleanupFailureItem {
                    path: evidence.path.clone(),
                    reason: "path_left_allowlisted_root".into(),
                });
                continue;
            }

            match safety::snapshot_still_matches(&path, evidence) {
                Ok(true) => {}
                Ok(false) => {
                    failed_files.push(CleanupFailureItem {
                        path: evidence.path.clone(),
                        reason: "file_changed_since_scan".into(),
                    });
                    continue;
                }
                Err(error) => {
                    failed_files.push(CleanupFailureItem {
                        path: evidence.path.clone(),
                        reason: error,
                    });
                    continue;
                }
            }

            match fs::remove_file(&path) {
                Ok(()) => {
                    deleted_files += 1;
                    deleted_bytes = deleted_bytes.saturating_add(evidence.size_bytes);
                }
                Err(error) => failed_files.push(CleanupFailureItem {
                    path: evidence.path.clone(),
                    reason: format!("delete_failed:{error}"),
                }),
            }

            if (deleted_files + failed_files.len() as u64) % 64 == 0 {
                let _ = app.emit(
                    "m02://progress",
                    CleanupProgress {
                        operation_id: operation_id.into(),
                        phase: "cleaning".into(),
                        category: Some(category.id.clone()),
                        files_processed: deleted_files + skipped_files + failed_files.len() as u64,
                        bytes_processed: deleted_bytes,
                        current_path: Some(evidence.path.clone()),
                    },
                );
            }
        }
    }

    if !failed_files.is_empty() {
        warnings.push(format!("cleanup_failures:{}", failed_files.len()));
    }
    let _ = app.emit(
        "m02://progress",
        CleanupProgress {
            operation_id: operation_id.into(),
            phase: if was_cancelled { "cancelled" } else { "cleanup_complete" }.into(),
            category: None,
            files_processed: deleted_files + skipped_files + failed_files.len() as u64,
            bytes_processed: deleted_bytes,
            current_path: None,
        },
    );

    Ok(CleanupExecuteResult {
        scan_id: scan.scan_id.clone(),
        deleted_files,
        deleted_bytes,
        skipped_files,
        failed_files,
        cancelled: was_cancelled,
        warnings,
    })
}
