use crate::storage_analyzer::contracts::{
    StorageAnalysisResult, StorageFileItem, StorageFolderItem, StorageOldFilesSummary,
    StorageProgress, StorageScanRequest, StorageTypeItem,
};
use chrono::{DateTime, Utc};
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use walkdir::WalkDir;

const MAX_TRACKED_DIRECTORIES: usize = 100_000;

fn file_category(extension: &str) -> &'static str {
    match extension {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "tif" | "tiff" | "webp" | "svg" | "heic" => "images",
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "webm" | "m4v" | "flv" => "videos",
        "mp3" | "wav" | "flac" | "aac" | "m4a" | "ogg" | "wma" => "audio",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "rtf" | "odt" | "csv" => "documents",
        "zip" | "7z" | "rar" | "tar" | "gz" | "bz2" | "xz" | "iso" => "archives",
        "exe" | "msi" | "msix" | "dll" | "sys" | "appx" | "appxbundle" => "applications",
        "js" | "jsx" | "ts" | "tsx" | "rs" | "py" | "go" | "java" | "cs" | "cpp" | "c" | "h" | "html" | "css" | "json" | "toml" | "yaml" | "yml" | "xml" | "sql" => "source_code",
        "tmp" | "log" | "etl" | "dmp" | "cache" => "temporary_and_logs",
        "" => "no_extension",
        _ => "other",
    }
}

fn push_top_file(items: &mut Vec<StorageFileItem>, item: StorageFileItem, limit: usize) {
    if limit == 0 {
        return;
    }
    items.push(item);
    items.sort_by(|left, right| right.size_bytes.cmp(&left.size_bytes));
    items.truncate(limit);
}

fn push_top_old_file(items: &mut Vec<StorageFileItem>, item: StorageFileItem, limit: usize) {
    push_top_file(items, item, limit);
}

fn add_folder_usage(
    root: &Path,
    file_path: &Path,
    size_bytes: u64,
    folders: &mut HashMap<PathBuf, (u64, u64)>,
    directory_limit_reached: &mut bool,
) {
    let mut current = file_path.parent();
    while let Some(directory) = current {
        if !directory.starts_with(root) {
            break;
        }
        if folders.contains_key(directory) || folders.len() < MAX_TRACKED_DIRECTORIES {
            let entry = folders.entry(directory.to_path_buf()).or_insert((0, 0));
            entry.0 = entry.0.saturating_add(size_bytes);
            entry.1 = entry.1.saturating_add(1);
        } else {
            *directory_limit_reached = true;
        }
        if directory == root {
            break;
        }
        current = directory.parent();
    }
}

pub fn scan_path(
    app: &AppHandle,
    operation_id: &str,
    request: StorageScanRequest,
    cancelled: Arc<AtomicBool>,
) -> Result<StorageAnalysisResult, String> {
    let requested_root = PathBuf::from(request.root_path.trim());
    if request.root_path.trim().is_empty() {
        return Err("storage_root_required".into());
    }
    if !requested_root.is_dir() {
        return Err(format!("storage_root_not_directory:{}", requested_root.display()));
    }

    let root = dunce::canonicalize(&requested_root)
        .map_err(|error| format!("storage_root_canonicalize_failed:{error}"))?;
    let top_limit = request.top_limit.clamp(10, 500);
    let max_files = request.max_files.clamp(1_000, 10_000_000);
    let old_seconds = request.old_days.saturating_mul(24 * 60 * 60);

    let mut largest_files = Vec::new();
    let mut old_largest_files = Vec::new();
    let mut folders: HashMap<PathBuf, (u64, u64)> = HashMap::new();
    let mut type_totals: HashMap<(String, String), (u64, u64)> = HashMap::new();
    let mut seen_files = HashSet::new();
    let mut warnings = Vec::new();
    let mut total_files = 0_u64;
    let mut total_directories = 0_u64;
    let mut total_bytes = 0_u64;
    let mut inaccessible_items = 0_u64;
    let mut old_file_count = 0_u64;
    let mut old_file_bytes = 0_u64;
    let mut truncated = false;
    let mut directory_limit_reached = false;

    for item in WalkDir::new(&root).follow_links(false).into_iter() {
        if cancelled.load(Ordering::Relaxed) {
            warnings.push("storage_scan_cancelled".into());
            break;
        }

        let entry = match item {
            Ok(value) => value,
            Err(error) => {
                inaccessible_items = inaccessible_items.saturating_add(1);
                if warnings.len() < 100 {
                    warnings.push(format!("storage_walk_error:{error}"));
                }
                continue;
            }
        };

        if entry.file_type().is_symlink() {
            continue;
        }
        if entry.file_type().is_dir() {
            total_directories = total_directories.saturating_add(1);
            continue;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        if total_files >= max_files {
            truncated = true;
            warnings.push(format!("storage_max_files_reached:{max_files}"));
            break;
        }

        let metadata = match entry.metadata() {
            Ok(value) => value,
            Err(error) => {
                inaccessible_items = inaccessible_items.saturating_add(1);
                if warnings.len() < 100 {
                    warnings.push(format!("storage_metadata_error:{}:{error}", entry.path().display()));
                }
                continue;
            }
        };
        let canonical = match dunce::canonicalize(entry.path()) {
            Ok(value) => value,
            Err(_) => entry.path().to_path_buf(),
        };
        if !canonical.starts_with(&root) {
            continue;
        }
        let canonical_text = canonical.to_string_lossy().to_string();
        if !seen_files.insert(canonical_text.clone()) {
            continue;
        }

        let size_bytes = metadata.len();
        let extension = canonical
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let category = file_category(&extension).to_string();
        let modified = metadata.modified().ok();
        let modified_at = modified
            .map(DateTime::<Utc>::from)
            .unwrap_or_else(Utc::now)
            .to_rfc3339();
        let file_item = StorageFileItem {
            path: canonical_text.clone(),
            size_bytes,
            modified_at,
            extension: extension.clone(),
            category: category.clone(),
        };

        total_files = total_files.saturating_add(1);
        total_bytes = total_bytes.saturating_add(size_bytes);
        push_top_file(&mut largest_files, file_item.clone(), top_limit);
        add_folder_usage(
            &root,
            &canonical,
            size_bytes,
            &mut folders,
            &mut directory_limit_reached,
        );
        let type_entry = type_totals.entry((category, extension)).or_insert((0, 0));
        type_entry.0 = type_entry.0.saturating_add(size_bytes);
        type_entry.1 = type_entry.1.saturating_add(1);

        let is_old = modified
            .and_then(|value| value.elapsed().ok())
            .map(|age| age.as_secs() >= old_seconds)
            .unwrap_or(false);
        if is_old {
            old_file_count = old_file_count.saturating_add(1);
            old_file_bytes = old_file_bytes.saturating_add(size_bytes);
            push_top_old_file(&mut old_largest_files, file_item, top_limit);
        }

        if total_files.is_multiple_of(256) {
            let _ = app.emit(
                "m04://progress",
                StorageProgress {
                    operation_id: operation_id.into(),
                    phase: "scanning".into(),
                    files_processed: total_files,
                    directories_processed: total_directories,
                    bytes_processed: total_bytes,
                    current_path: Some(canonical_text),
                },
            );
        }
    }

    if directory_limit_reached {
        warnings.push(format!(
            "storage_directory_tracking_limit_reached:{MAX_TRACKED_DIRECTORIES}"
        ));
    }

    let mut largest_folders = folders
        .into_iter()
        .map(|(path, (size_bytes, file_count))| StorageFolderItem {
            path: path.to_string_lossy().to_string(),
            size_bytes,
            file_count,
        })
        .collect::<Vec<_>>();
    largest_folders.sort_by(|left, right| right.size_bytes.cmp(&left.size_bytes));
    largest_folders.truncate(top_limit);

    let mut type_distribution = type_totals
        .into_iter()
        .map(|((category, extension), (size_bytes, file_count))| StorageTypeItem {
            category,
            extension,
            size_bytes,
            file_count,
        })
        .collect::<Vec<_>>();
    type_distribution.sort_by(|left, right| right.size_bytes.cmp(&left.size_bytes));

    let cancelled_status = cancelled.load(Ordering::Relaxed);
    let _ = app.emit(
        "m04://progress",
        StorageProgress {
            operation_id: operation_id.into(),
            phase: if cancelled_status {
                "cancelled"
            } else {
                "scan_complete"
            }
            .into(),
            files_processed: total_files,
            directories_processed: total_directories,
            bytes_processed: total_bytes,
            current_path: None,
        },
    );

    Ok(StorageAnalysisResult {
        scan_id: Uuid::new_v4().to_string(),
        root_path: root.to_string_lossy().to_string(),
        total_files,
        total_directories,
        total_bytes,
        inaccessible_items,
        truncated,
        largest_files,
        largest_folders,
        type_distribution,
        old_files: StorageOldFilesSummary {
            threshold_days: request.old_days,
            file_count: old_file_count,
            size_bytes: old_file_bytes,
            largest_files: old_largest_files,
        },
        scanned_at: Utc::now().to_rfc3339(),
        warnings,
    })
}
