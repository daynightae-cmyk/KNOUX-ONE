use crate::cleanup::{
    contracts::{CleanupCategorySummary, CleanupFileEvidence, CleanupProgress, CleanupScanResult},
    discovery::CleanupTarget,
    safety,
};
use chrono::{DateTime, Utc};
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use walkdir::WalkDir;

pub fn scan_targets(
    app: &AppHandle,
    operation_id: &str,
    targets: Vec<CleanupTarget>,
    max_items_per_category: usize,
    cancelled: Arc<AtomicBool>,
) -> Result<CleanupScanResult, String> {
    let mut categories = Vec::new();
    let mut warnings = Vec::new();
    let mut seen_paths = HashSet::new();
    let mut total_processed_files = 0_u64;
    let mut total_processed_bytes = 0_u64;
    let item_limit = max_items_per_category.clamp(100, 25_000);
    let mut was_cancelled = false;

    'targets: for target in targets {
        let mut summary = CleanupCategorySummary {
            id: target.id.clone(),
            name_en: target.name_en.clone(),
            name_ar: target.name_ar.clone(),
            file_count: 0,
            size_bytes: 0,
            requires_admin: target.requires_admin,
            scan_only: target.scan_only,
            truncated: false,
            items: Vec::new(),
        };

        if target.roots.is_empty() {
            warnings.push(format!("cleanup_root_unavailable:{}", target.id));
            categories.push(summary);
            continue;
        }

        for root in &target.roots {
            if cancelled.load(Ordering::Relaxed) {
                was_cancelled = true;
                categories.push(summary);
                break 'targets;
            }

            if !root.is_dir() {
                warnings.push(format!("cleanup_root_not_directory:{}", root.display()));
                continue;
            }

            for item in WalkDir::new(root).follow_links(false).into_iter() {
                if cancelled.load(Ordering::Relaxed) {
                    was_cancelled = true;
                    categories.push(summary);
                    break 'targets;
                }

                let entry = match item {
                    Ok(value) => value,
                    Err(error) => {
                        warnings.push(format!("walk_error:{error}"));
                        continue;
                    }
                };
                if !entry.file_type().is_file() || entry.file_type().is_symlink() {
                    continue;
                }

                let path = entry.path();
                if !safety::matches_filter(path, target.filter) {
                    continue;
                }

                let metadata = match entry.metadata() {
                    Ok(value) => value,
                    Err(error) => {
                        warnings.push(format!("metadata_error:{}:{error}", path.display()));
                        continue;
                    }
                };
                if !safety::old_enough(&metadata, target.minimum_age_seconds) {
                    continue;
                }

                let canonical = dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
                let canonical_text = canonical.to_string_lossy().to_string();
                if !seen_paths.insert(canonical_text.clone()) {
                    continue;
                }

                let size_bytes = metadata.len();
                let modified_at = metadata
                    .modified()
                    .map(DateTime::<Utc>::from)
                    .unwrap_or_else(|_| Utc::now())
                    .to_rfc3339();

                summary.file_count += 1;
                summary.size_bytes = summary.size_bytes.saturating_add(size_bytes);
                total_processed_files += 1;
                total_processed_bytes = total_processed_bytes.saturating_add(size_bytes);

                if summary.items.len() < item_limit {
                    summary.items.push(CleanupFileEvidence {
                        path: canonical_text.clone(),
                        root_path: root.to_string_lossy().to_string(),
                        size_bytes,
                        modified_at,
                        modified_unix_ms: safety::modified_unix_ms(&metadata),
                        safe_to_clean: !target.scan_only,
                    });
                } else {
                    summary.truncated = true;
                }

                if total_processed_files % 128 == 0 {
                    let _ = app.emit(
                        "m02://progress",
                        CleanupProgress {
                            operation_id: operation_id.into(),
                            phase: "scanning".into(),
                            category: Some(target.id.clone()),
                            files_processed: total_processed_files,
                            bytes_processed: total_processed_bytes,
                            current_path: Some(canonical_text),
                        },
                    );
                }
            }
        }

        if summary.truncated {
            warnings.push(format!(
                "category_item_limit_reached:{}:{}",
                summary.id, item_limit
            ));
        }
        categories.push(summary);
    }

    let total_files = categories.iter().map(|category| category.file_count).sum();
    let total_bytes = categories.iter().map(|category| category.size_bytes).sum();
    let _ = app.emit(
        "m02://progress",
        CleanupProgress {
            operation_id: operation_id.into(),
            phase: if was_cancelled { "cancelled" } else { "scan_complete" }.into(),
            category: None,
            files_processed: total_files,
            bytes_processed: total_bytes,
            current_path: None,
        },
    );

    Ok(CleanupScanResult {
        scan_id: Uuid::new_v4().to_string(),
        categories,
        total_files,
        total_bytes,
        cancelled: was_cancelled,
        scanned_at: Utc::now().to_rfc3339(),
        warnings,
    })
}
