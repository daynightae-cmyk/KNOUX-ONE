use crate::contracts::OperationResult;
use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;
use walkdir::WalkDir;

static CANCEL: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

fn default_top() -> usize {
    100
}
fn default_days() -> u64 {
    180
}
fn default_max() -> u64 {
    1_000_000
}
/// Which timestamp a row's "age" actually came from. The three values are not
/// interchangeable and the UI must not collapse them into one word.
pub mod age_basis {
    /// Windows was measured to keep last-access timestamps, so access time is real.
    pub const LAST_ACCESS: &str = "LAST_ACCESS";
    /// Access time is not trustworthy on this machine, so modification time is used
    /// and the row must be described as "not modified since".
    pub const LAST_WRITE_FALLBACK: &str = "LAST_WRITE_FALLBACK";
    /// Neither timestamp could be read, so no age claim is made at all.
    pub const UNKNOWN: &str = "UNKNOWN";
}

/// Measured evidence about the machine's NTFS last-access policy.
///
/// Without this, "old" silently becomes "unused" even on a system that stopped
/// recording last-access times, which is the specific lie this service must not tell.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageAgePolicy {
    /// `fsutil`, `registry`, or `unknown`.
    pub source: String,
    /// The exact value the operating system reported, kept verbatim as evidence.
    pub raw_value: String,
    /// `last_access_updates_enabled`, `last_access_updates_disabled`,
    /// `system_managed`, or `unknown`.
    pub state: String,
    /// True only when access time can be treated as a real "last used" signal.
    pub last_access_reliable_for_files: bool,
    pub note_en: String,
    pub note_ar: String,
}

impl Default for StorageAgePolicy {
    fn default() -> Self {
        Self {
            source: "unknown".into(),
            raw_value: String::new(),
            state: "unknown".into(),
            last_access_reliable_for_files: false,
            note_en: "The last-access policy could not be measured, so no row is described \
                      as unused."
                .into(),
            note_ar: "تعذّر قياس سياسة وقت الوصول، لذلك لا يُوصف أي صف بأنه غير مستخدم.".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageScanRequest {
    pub root_path: String,
    #[serde(default = "default_top")]
    pub top_limit: usize,
    #[serde(default = "default_days")]
    pub old_days: u64,
    #[serde(default = "default_max")]
    pub max_files: u64,
    /// Absolute paths whose subtrees are skipped. Excluded roots are reported back so a
    /// smaller result is explainable rather than mysterious.
    #[serde(default)]
    pub excludes: Vec<String>,
}
impl StorageScanRequest {
    fn root(path: String) -> Self {
        Self {
            root_path: path,
            top_limit: 100,
            old_days: 180,
            max_files: 1_000_000,
            excludes: Vec::new(),
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageFileItem {
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub accessed_at: Option<String>,
    pub created_at: Option<String>,
    pub age_basis: String,
    /// True only when the row crossed the age threshold on its own recorded basis.
    pub is_old: bool,
    pub extension: String,
    pub category: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageFolderItem {
    pub path: String,
    pub size_bytes: u64,
    pub file_count: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageTypeItem {
    pub category: String,
    pub extension: String,
    pub size_bytes: u64,
    pub file_count: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageOldFilesSummary {
    pub threshold_days: u64,
    pub file_count: u64,
    pub size_bytes: u64,
    pub largest_files: Vec<StorageFileItem>,
    /// Kept for compatibility, but now derived from the measured policy rather than
    /// from whether any single file happened to return an access time.
    pub access_time_supported: bool,
    pub fallback_file_count: u64,
    pub unknown_count: u64,
    pub age_policy: StorageAgePolicy,
    /// This service is analysis only. It never deletes, moves, or quarantines.
    pub read_only: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageAnalysisResult {
    pub scan_id: String,
    pub root_path: String,
    pub total_files: u64,
    pub total_directories: u64,
    pub total_bytes: u64,
    pub inaccessible_items: u64,
    pub truncated: bool,
    pub cancelled: bool,
    pub largest_files: Vec<StorageFileItem>,
    pub largest_folders: Vec<StorageFolderItem>,
    pub type_distribution: Vec<StorageTypeItem>,
    pub old_files: StorageOldFilesSummary,
    pub age_policy: StorageAgePolicy,
    pub excluded_paths: Vec<String>,
    pub scanned_at: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhysicalStorageDevice {
    pub friendly_name: String,
    pub serial_number: String,
    pub media_type: String,
    pub bus_type: String,
    pub health_status: String,
    pub size_bytes: Option<u64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDriveInfo {
    pub root_path: String,
    pub drive_type: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub free_percent: f64,
    pub is_external: bool,
    pub is_remote: bool,
    pub volume_label: String,
    pub file_system: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDriveInventory {
    pub drives: Vec<StorageDriveInfo>,
    pub devices: Vec<PhysicalStorageDevice>,
    pub measured_at: String,
    pub warnings: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StorageSpaceCheckRequest {
    #[serde(default = "default_threshold")]
    pub threshold_percent: f64,
    #[serde(default = "default_interval")]
    pub interval_minutes: u64,
}
fn default_threshold() -> f64 {
    10.0
}
fn default_interval() -> u64 {
    5
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSpaceAlert {
    pub root_path: String,
    pub free_percent: f64,
    pub free_bytes: u64,
    pub threshold_percent: f64,
    pub below_threshold: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSpaceCheckResult {
    pub alerts: Vec<StorageSpaceAlert>,
    pub checked_at: String,
    pub background_monitoring_enabled: bool,
    pub monitor_interval_minutes: u64,
    pub warnings: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageReportExportRequest {
    pub scan_id: String,
    pub file_name: Option<String>,
    /// `json`, `csv`, `html`, or `all`. PDF is not accepted; see `m04_report_formats`.
    #[serde(default)]
    pub format: Option<String>,
    /// `none` or `user_profile`.
    #[serde(default)]
    pub redaction: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageReportExportResult {
    pub scan_id: String,
    pub format: String,
    pub path: String,
    pub byte_count: u64,
    pub json_evidence_path: String,
    /// Every written document with its content hash and format-signature verdict.
    pub artifacts: Vec<super::m04_reports::StorageReportArtifact>,
    pub redaction_profile: String,
    pub source_operation_id: Option<String>,
    pub formats_supported: Vec<String>,
    /// Formats a user may reasonably ask for that this build cannot honestly produce,
    /// each with the reason. A format is never silently skipped.
    pub formats_unsupported: Vec<StorageUnsupportedFormat>,
    pub warnings: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUnsupportedFormat {
    pub format: String,
    pub reason_en: String,
    pub reason_ar: String,
}

/// The report formats this build can produce. PDF is deliberately absent: producing a
/// PDF requires a vetted renderer, and a hand-built document that silently drops
/// non-ASCII paths would misrepresent the evidence.
pub const SUPPORTED_REPORT_FORMATS: [&str; 3] = ["json", "csv", "html"];

fn unsupported_formats() -> Vec<StorageUnsupportedFormat> {
    vec![StorageUnsupportedFormat {
        format: "pdf".into(),
        reason_en: "PDF is not produced. It needs a vetted renderer with embedded Unicode \
                    fonts; a hand-assembled document would drop non-ASCII paths. Use the \
                    HTML report, which renders Arabic and every measured path exactly."
            .into(),
        reason_ar: "لا يُنتج ملف PDF. يتطلب محركًا موثوقًا بخطوط Unicode مدمجة، والوثيقة \
                    المُركّبة يدويًا ستحذف المسارات غير اللاتينية. استخدم تقرير HTML الذي \
                    يعرض العربية وكل مسار مقيس بدقة."
            .into(),
    }]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageProgress {
    pub operation_id: String,
    pub phase: String,
    pub files_processed: u64,
    pub directories_processed: u64,
    pub bytes_processed: u64,
    pub current_path: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCancelResult {
    pub target_operation_id: String,
    pub cancellation_requested: bool,
}

fn op<T>(
    op_id: String,
    capability: &str,
    handler: &str,
    started: String,
    timer: Instant,
    status: &str,
    data: Option<T>,
    en: String,
    ar: String,
    warnings: Vec<String>,
    error: Option<String>,
) -> OperationResult<T> {
    OperationResult {
        operation_id: op_id,
        capability_id: capability.into(),
        handler_id: handler.into(),
        status: status.into(),
        started_at: started,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(if status == "failed" { 1 } else { 0 }),
        stdout: None,
        stderr: error.clone(),
        summary_en: en,
        summary_ar: ar,
        warnings,
        error_code: error.map(|_| "storage_completion_failed".into()),
        data,
    }
}
fn category(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" => "images",
        "mp4" | "mkv" | "avi" | "mov" | "webm" => "videos",
        "mp3" | "wav" | "flac" | "aac" | "m4a" | "ogg" => "audio",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "csv" => "documents",
        "zip" | "7z" | "rar" | "tar" | "gz" | "iso" => "archives",
        "exe" | "msi" | "dll" | "sys" => "applications",
        "rs" | "ts" | "tsx" | "js" | "py" | "go" | "java" | "cs" | "cpp" | "json" | "toml"
        | "yaml" | "yml" => "source_code",
        _ => "other",
    }
}
fn push_file(items: &mut Vec<StorageFileItem>, item: StorageFileItem, limit: usize) {
    items.push(item);
    // Total order so the list is stable across runs: size descending, then path. Without
    // the tiebreak, two equal-size files can swap places between scans and a report
    // re-export would not be reproducible.
    items.sort_by(|a, b| {
        b.size_bytes
            .cmp(&a.size_bytes)
            .then_with(|| a.path.cmp(&b.path))
    });
    items.truncate(limit)
}

/// Extracts the integer that follows `key` in `fsutil behavior query` output, whose
/// real shape is `disablelastaccess = 1 (disabled)`.
fn parse_fsutil_value(output: &str, key: &str) -> Option<String> {
    let lowered = output.to_ascii_lowercase();
    let position = lowered.find(key)?;
    let rest = &output[position + key.len()..];
    let after_equals = rest.split_once('=')?.1;
    let digits: String = after_equals
        .trim_start()
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    if digits.is_empty() {
        None
    } else {
        Some(digits)
    }
}

fn policy_state(raw: &str) -> &'static str {
    match raw {
        "0" => "last_access_updates_enabled",
        "1" => "last_access_updates_disabled",
        // Value 2 means only NTFS *directories* update their own last-access time, so
        // file access times are not a usable "last used" signal.
        "2" => "system_managed",
        _ => "unknown",
    }
}

/// Measures the machine's real last-access policy.
///
/// `fsutil behavior query disablelastaccess` is the authoritative surface. The
/// registry value behind it is used only as a fallback, and the source used is always
/// reported so the evidence is attributable.
fn detect_age_policy() -> StorageAgePolicy {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("fsutil.exe")
            .args(["behavior", "query", "disablelastaccess"])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                if let Some(raw) = parse_fsutil_value(&text, "disablelastaccess") {
                    let state = policy_state(&raw);
                    let reliable = state == "last_access_updates_enabled";
                    return StorageAgePolicy {
                        source: "fsutil".into(),
                        raw_value: raw.clone(),
                        state: state.into(),
                        last_access_reliable_for_files: reliable,
                        note_en: if reliable {
                            "Windows reports that last-access timestamps are updated, so \
                             access time is a real last-used signal."
                                .into()
                        } else {
                            format!(
                                "Windows reports disablelastaccess = {raw}, so last-access \
                                 timestamps are not a reliable last-used signal. Rows fall back \
                                 to modification time and are described as \"not modified since\"."
                            )
                        },
                        note_ar: if reliable {
                            "تعرض ويندوز أن وقت الوصول يُحدَّث، لذلك هو دليل حقيقي على آخر استخدام."
                                .into()
                        } else {
                            format!(
                                "تعرض ويندوز أن disablelastaccess = {raw}، لذلك وقت الوصول ليس \
                                 دليلًا موثوقًا على آخر استخدام. تعتمد الصفوف على وقت التعديل \
                                 وتُوصف بأنها \"لم يتم تعديلها منذ\"."
                            )
                        },
                    };
                }
            }
        }

        let script = r#"$ErrorActionPreference='Stop';$v=(Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name NtfsDisableLastAccessUpdate -ErrorAction Stop).NtfsDisableLastAccessUpdate;[string]$v"#;
        if let Ok(output) = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
        {
            if output.status.success() {
                let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !raw.is_empty() {
                    let state = policy_state(&raw);
                    let reliable = state == "last_access_updates_enabled";
                    return StorageAgePolicy {
                        source: "registry".into(),
                        raw_value: raw.clone(),
                        state: state.into(),
                        last_access_reliable_for_files: reliable,
                        note_en: format!(
                            "Read NtfsDisableLastAccessUpdate = {raw} from the registry, so \
                             last-access timestamps are {} a reliable last-used signal.",
                            if reliable { "a" } else { "not a" }
                        ),
                        note_ar: format!(
                            "قُرئت القيمة NtfsDisableLastAccessUpdate = {raw} من السجل، لذلك وقت \
                             الوصول {} دليل موثوق على آخر استخدام.",
                            if reliable {
                                "يُعدّ"
                            } else {
                                "لا يُعدّ"
                            }
                        ),
                    };
                }
            }
        }
    }
    StorageAgePolicy::default()
}

fn add_folders(root: &Path, file: &Path, size: u64, map: &mut HashMap<PathBuf, (u64, u64)>) {
    let mut current = file.parent();
    while let Some(dir) = current {
        if !dir.starts_with(root) {
            break;
        }
        let v = map.entry(dir.to_path_buf()).or_insert((0, 0));
        v.0 = v.0.saturating_add(size);
        v.1 = v.1.saturating_add(1);
        if dir == root {
            break;
        }
        current = dir.parent();
    }
}
fn scan(
    app: &AppHandle,
    op_id: &str,
    request: StorageScanRequest,
    token: Arc<AtomicBool>,
) -> Result<StorageAnalysisResult, String> {
    let requested = PathBuf::from(request.root_path.trim());
    if !requested.is_dir() {
        return Err("storage_root_not_directory".into());
    }
    let root = dunce::canonicalize(requested).map_err(|e| format!("storage_root_failed:{e}"))?;
    let limit = request.top_limit.clamp(10, 500);
    let max = request.max_files.clamp(1000, 10_000_000);
    let threshold = request.old_days.saturating_mul(86400);
    let policy = detect_age_policy();
    // Canonicalize the user exclusions once so comparison is not defeated by `..`,
    // a different separator, or a relative spelling of the same directory.
    let mut exclusions: Vec<PathBuf> = Vec::new();
    for raw in &request.excludes {
        match dunce::canonicalize(PathBuf::from(raw.trim())) {
            Ok(path) if path != root => exclusions.push(path),
            Ok(_) => {
                return Err("storage_exclusion_equals_root".into());
            }
            Err(_) => {
                return Err(format!("storage_exclusion_not_found:{}", raw.trim()));
            }
        }
    }
    let mut largest = Vec::new();
    let mut old = Vec::new();
    let mut folders = HashMap::new();
    let mut types = HashMap::<(String, String), (u64, u64)>::new();
    let mut seen = HashSet::new();
    let mut total_files = 0u64;
    let mut total_dirs = 0u64;
    let mut total_bytes = 0u64;
    let mut inaccessible = 0u64;
    let mut old_count = 0u64;
    let mut old_bytes = 0u64;
    let mut fallback = 0u64;
    let mut unknown = 0u64;
    let mut excluded_hits = HashSet::new();
    let mut warnings = Vec::new();
    let mut truncated = false;
    for item in WalkDir::new(&root).follow_links(false).into_iter() {
        if token.load(Ordering::Relaxed) {
            break;
        }
        let entry = match item {
            Ok(v) => v,
            Err(e) => {
                inaccessible += 1;
                if warnings.len() < 50 {
                    warnings.push(format!("walk_error:{e}"));
                }
                continue;
            }
        };
        if entry.file_type().is_symlink() {
            continue;
        }
        // `filter_entry` semantics: skipping a directory prunes its whole subtree, and
        // the skip is recorded so the smaller result stays explainable.
        if let Some(hit) = exclusions
            .iter()
            .find(|excluded| entry.path().starts_with(excluded))
        {
            excluded_hits.insert(hit.to_string_lossy().to_string());
            continue;
        }
        if entry.file_type().is_dir() {
            total_dirs += 1;
            continue;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        if total_files >= max {
            truncated = true;
            warnings.push(format!("max_files_reached:{max}"));
            break;
        }
        let canonical = match dunce::canonicalize(entry.path()) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if !canonical.starts_with(&root) || !seen.insert(canonical.clone()) {
            continue;
        }
        let metadata = match fs::metadata(&canonical) {
            Ok(v) => v,
            Err(_) => {
                inaccessible += 1;
                continue;
            }
        };
        let size = metadata.len();
        let modified = metadata.modified().ok();
        let accessed = metadata.accessed().ok();
        let created = metadata.created().ok();
        let (age_time, basis) =
            classify_age(policy.last_access_reliable_for_files, accessed, modified);
        match basis {
            age_basis::LAST_ACCESS => {}
            age_basis::LAST_WRITE_FALLBACK => fallback += 1,
            _ => unknown += 1,
        }
        let is_old = age_time
            .and_then(|v| v.elapsed().ok())
            .map(|v| v.as_secs() >= threshold)
            .unwrap_or(false);
        let extension = canonical
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let item = StorageFileItem {
            path: canonical.to_string_lossy().to_string(),
            size_bytes: size,
            modified_at: modified
                .map(DateTime::<Utc>::from)
                .unwrap_or_else(Utc::now)
                .to_rfc3339(),
            accessed_at: accessed.map(DateTime::<Utc>::from).map(|v| v.to_rfc3339()),
            created_at: created.map(DateTime::<Utc>::from).map(|v| v.to_rfc3339()),
            age_basis: basis.into(),
            is_old,
            extension: extension.clone(),
            category: category(&extension).into(),
        };
        total_files += 1;
        total_bytes = total_bytes.saturating_add(size);
        push_file(&mut largest, item.clone(), limit);
        add_folders(&root, &canonical, size, &mut folders);
        let type_value = types
            .entry((item.category.clone(), extension))
            .or_insert((0, 0));
        type_value.0 = type_value.0.saturating_add(size);
        type_value.1 += 1;
        if is_old {
            old_count += 1;
            old_bytes = old_bytes.saturating_add(size);
            push_file(&mut old, item, limit);
        }
        if total_files.is_multiple_of(256) {
            let _ = app.emit(
                "m04://progress",
                StorageProgress {
                    operation_id: op_id.into(),
                    phase: "scanning_access_times".into(),
                    files_processed: total_files,
                    directories_processed: total_dirs,
                    bytes_processed: total_bytes,
                    current_path: Some(canonical.to_string_lossy().to_string()),
                },
            );
        }
    }
    let mut largest_folders = folders
        .into_iter()
        .map(|(path, (size_bytes, file_count))| StorageFolderItem {
            path: path.to_string_lossy().to_string(),
            size_bytes,
            file_count,
        })
        .collect::<Vec<_>>();
    largest_folders.sort_by(|a, b| {
        b.size_bytes
            .cmp(&a.size_bytes)
            .then_with(|| a.path.cmp(&b.path))
    });
    largest_folders.truncate(limit);
    let mut type_distribution = types
        .into_iter()
        .map(
            |((category, extension), (size_bytes, file_count))| StorageTypeItem {
                category,
                extension,
                size_bytes,
                file_count,
            },
        )
        .collect::<Vec<_>>();
    type_distribution.sort_by(|a, b| {
        b.size_bytes
            .cmp(&a.size_bytes)
            .then_with(|| a.category.cmp(&b.category))
    });
    let mut excluded_paths: Vec<String> = excluded_hits.into_iter().collect();
    excluded_paths.sort();
    if unknown > 0 {
        warnings.push(format!(
            "unknown_age_basis_files:{unknown} rows with no readable timestamp make no age claim"
        ));
    }
    let cancelled = token.load(Ordering::Relaxed);
    Ok(StorageAnalysisResult {
        scan_id: Uuid::new_v4().to_string(),
        root_path: root.to_string_lossy().to_string(),
        total_files,
        total_directories: total_dirs,
        total_bytes,
        inaccessible_items: inaccessible,
        truncated,
        cancelled,
        largest_files: largest,
        largest_folders,
        type_distribution,
        old_files: StorageOldFilesSummary {
            threshold_days: request.old_days,
            file_count: old_count,
            size_bytes: old_bytes,
            largest_files: old,
            access_time_supported: policy.last_access_reliable_for_files,
            fallback_file_count: fallback,
            unknown_count: unknown,
            age_policy: policy.clone(),
            read_only: true,
        },
        age_policy: policy,
        excluded_paths,
        scanned_at: Utc::now().to_rfc3339(),
        warnings,
    })
}

/// Chooses the timestamp a row's age is measured from, and never claims a signal the
/// machine is not actually keeping.
fn classify_age(
    last_access_reliable: bool,
    accessed: Option<std::time::SystemTime>,
    modified: Option<std::time::SystemTime>,
) -> (Option<std::time::SystemTime>, &'static str) {
    if last_access_reliable {
        if let Some(value) = accessed {
            return (Some(value), age_basis::LAST_ACCESS);
        }
    }
    match modified {
        Some(value) => (Some(value), age_basis::LAST_WRITE_FALLBACK),
        None => (None, age_basis::UNKNOWN),
    }
}

/// Persists a completed, non-cancelled scan so a later export can be regenerated from
/// the database instead of from process memory. A persistence failure is reported as a
/// warning rather than silently dropping the evidence.
fn save_snapshot(app: &AppHandle, result: &StorageAnalysisResult) -> Option<String> {
    if result.cancelled {
        return None;
    }
    match super::m04_reports::persist_snapshot(app, &result.excluded_paths, result) {
        Ok(()) => None,
        Err(error) => Some(format!("storage_snapshot_persist_failed:{error}")),
    }
}

async fn scan_command(
    app: AppHandle,
    op_id: String,
    request: StorageScanRequest,
    capability: &str,
    handler: &str,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    let started = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let token = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = CANCEL.lock() {
        map.insert(op_id.clone(), token.clone());
    }
    let a = app.clone();
    let id = op_id.clone();
    let execution = tauri::async_runtime::spawn_blocking(move || scan(&a, &id, request, token))
        .await
        .map_err(|e| format!("storage_worker_join_failed:{e}"))?;
    if let Ok(mut map) = CANCEL.lock() {
        map.remove(&op_id);
    }
    match execution {
        Ok(data) => {
            let persist_warning = save_snapshot(&app, &data);
            let mut warnings = data.warnings.clone();
            if let Some(message) = persist_warning {
                warnings.push(message);
            }
            let status = if data.cancelled {
                "cancelled"
            } else if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            };
            let policy = data.age_policy.clone();
            // The summary must not imply the files are unused. Whether access time is
            // trustworthy is stated outright, because it decides the only honest wording.
            let (en, ar) = if policy.last_access_reliable_for_files {
                (
                    format!(
                        "Measured {} files. Windows keeps last-access timestamps, so access \
                         time is used and these rows mean \"not accessed since\" the threshold.",
                        data.total_files
                    ),
                    format!(
                        "تم قياس {} ملف. تحدّث ويندوز وقت الوصول، لذلك يُستخدم وقت الوصول \
                         وتعني هذه الصفوف \"لم يتم الوصول إليها منذ\" الحد.",
                        data.total_files
                    ),
                )
            } else if policy.state == "unknown" {
                (
                    "Measured files, but the last-access policy could not be read, so no row \
                     is described as unused; modification time is used where available."
                        .into(),
                    "تم قياس الملفات، لكن تعذّرت قراءة سياسة وقت الوصول، لذلك لا يُوصف أي صف \
                     بأنه غير مستخدم؛ يُستخدم وقت التعديل عند توفره."
                        .into(),
                )
            } else {
                (
                    format!(
                        "Measured {} files. Windows reports disablelastaccess = {}, so access \
                         time is not a last-used signal; rows fall back to modification time and \
                         mean \"not modified since\" the threshold.",
                        data.total_files, policy.raw_value
                    ),
                    format!(
                        "تم قياس {} ملف. تُظهر ويندوز أن disablelastaccess = {}، لذلك وقت الوصول \
                         ليس دليلًا على آخر استخدام؛ تعتمد الصفوف على وقت Modification وتعني \
                         \"لم يتم تعديلها منذ\" الحد.",
                        data.total_files, policy.raw_value
                    ),
                )
            };
            Ok(op(
                op_id,
                capability,
                handler,
                started,
                timer,
                status,
                Some(data),
                en,
                ar,
                warnings,
                None,
            ))
        }
        Err(e) => Ok(op(
            op_id,
            capability,
            handler,
            started,
            timer,
            "failed",
            None,
            "Storage analysis failed.".into(),
            "فشل تحليل مساحة التخزين.".into(),
            Vec::new(),
            Some(e),
        )),
    }
}
#[tauri::command]
pub async fn m04_storage_scan_complete(
    app: AppHandle,
    op_id: String,
    request: StorageScanRequest,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    scan_command(app, op_id, request, "m04_s01", "m04.storage.scan").await
}
#[tauri::command]
pub async fn m04_old_files_complete(
    app: AppHandle,
    op_id: String,
    request: StorageScanRequest,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    scan_command(app, op_id, request, "m04_s05", "m04.files.old").await
}
fn preset(name: &str, suffix: &str) -> Result<String, String> {
    let base = env::var_os(name)
        .map(PathBuf::from)
        .ok_or_else(|| format!("missing_environment:{name}"))?;
    let path = if suffix.is_empty() {
        base
    } else {
        base.join(suffix)
    };
    if path.is_dir() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(format!("preset_missing:{}", path.display()))
    }
}
#[tauri::command]
pub async fn m04_downloads_complete(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    let root = preset("USERPROFILE", "Downloads")?;
    scan_command(
        app,
        op_id,
        StorageScanRequest::root(root),
        "m04_s06",
        "m04.downloads.analyze",
    )
    .await
}
#[tauri::command]
pub async fn m04_appdata_complete(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<StorageAnalysisResult>, String> {
    let root = preset("LOCALAPPDATA", "")?;
    scan_command(
        app,
        op_id,
        StorageScanRequest::root(root),
        "m04_s07",
        "m04.appdata.analyze",
    )
    .await
}

fn drive_inventory() -> StorageDriveInventory {
    #[cfg(target_os = "windows")]
    {
        let script = r#"$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.Encoding]::UTF8;$logical=@(Get-CimInstance Win32_LogicalDisk|ForEach-Object{[pscustomobject]@{rootPath=([string]$_.DeviceID+'\\');driveType=switch([int]$_.DriveType){2{'removable'}3{'fixed'}4{'remote'}5{'optical'}6{'ram_disk'}default{'unknown'}};totalBytes=if($_.Size){[uint64]$_.Size}else{0};freeBytes=if($_.FreeSpace){[uint64]$_.FreeSpace}else{0};availableBytes=if($_.FreeSpace){[uint64]$_.FreeSpace}else{0};usedBytes=if($_.Size){[uint64]$_.Size-[uint64]$_.FreeSpace}else{0};freePercent=if($_.Size){[math]::Round(([double]$_.FreeSpace*100/[double]$_.Size),4)}else{0};isExternal=([int]$_.DriveType-eq 2);isRemote=([int]$_.DriveType-eq 4);volumeLabel=[string]$_.VolumeName;fileSystem=[string]$_.FileSystem}});$physical=@(Get-PhysicalDisk -ErrorAction SilentlyContinue|ForEach-Object{[pscustomobject]@{friendlyName=[string]$_.FriendlyName;serialNumber=[string]$_.SerialNumber;mediaType=[string]$_.MediaType;busType=[string]$_.BusType;healthStatus=[string]$_.HealthStatus;sizeBytes=if($_.Size){[uint64]$_.Size}else{$null}}});[pscustomobject]@{drives=$logical;devices=$physical;measuredAt=[datetime]::UtcNow.ToString('o');warnings=@()}|ConvertTo-Json -Depth 6 -Compress"#;
        match Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
        {
            Ok(out) if out.status.success() => {
                serde_json::from_slice(&out.stdout).unwrap_or(StorageDriveInventory {
                    drives: Vec::new(),
                    devices: Vec::new(),
                    measured_at: Utc::now().to_rfc3339(),
                    warnings: vec!["drive_inventory_parse_failed".into()],
                })
            }
            Ok(out) => StorageDriveInventory {
                drives: Vec::new(),
                devices: Vec::new(),
                measured_at: Utc::now().to_rfc3339(),
                warnings: vec![format!(
                    "drive_inventory_failed:{}",
                    String::from_utf8_lossy(&out.stderr)
                )],
            },
            Err(e) => StorageDriveInventory {
                drives: Vec::new(),
                devices: Vec::new(),
                measured_at: Utc::now().to_rfc3339(),
                warnings: vec![format!("drive_inventory_launch_failed:{e}")],
            },
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        StorageDriveInventory {
            drives: Vec::new(),
            devices: Vec::new(),
            measured_at: Utc::now().to_rfc3339(),
            warnings: vec!["windows_only".into()],
        }
    }
}
#[tauri::command]
pub fn m04_external_drives_complete(
    op_id: String,
) -> Result<OperationResult<StorageDriveInventory>, String> {
    let started = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let data = drive_inventory();
    let warnings = data.warnings.clone();
    Ok(op(
        op_id,
        "m04_s08",
        "m04.drives.external",
        started,
        timer,
        if warnings.is_empty() {
            "completed"
        } else {
            "completed_with_warnings"
        },
        Some(data.clone()),
        format!(
            "Measured {} mounted volumes and {} physical storage devices.",
            data.drives.len(),
            data.devices.len()
        ),
        format!(
            "تم قياس {} وحدة تخزين متصلة و{} جهاز تخزين فعلي.",
            data.drives.len(),
            data.devices.len()
        ),
        warnings,
        None,
    ))
}

fn monitor_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_failed:{e}"))?
        .join("storage-monitor");
    fs::create_dir_all(&dir).map_err(|e| format!("monitor_dir_failed:{e}"))?;
    Ok(dir.join("config.json"))
}
fn toast(title: &str, message: &str) {
    #[cfg(target_os = "windows")]
    {
        let title = title.replace('\'', "''");
        let message = message.replace('\'', "''");
        let script = format!(
            r#"$xml=New-Object Windows.Data.Xml.Dom.XmlDocument;$xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text>{}</text><text>{}</text></binding></visual></toast>');[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('KNOUX ONE').Show([Windows.UI.Notifications.ToastNotification]::new($xml))"#,
            title, message
        );
        let _ = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output();
    }
}
fn alerts(threshold: f64) -> (Vec<StorageSpaceAlert>, Vec<String>) {
    let inventory = drive_inventory();
    let values = inventory
        .drives
        .iter()
        .map(|d| StorageSpaceAlert {
            root_path: d.root_path.clone(),
            free_percent: d.free_percent,
            free_bytes: d.free_bytes,
            threshold_percent: threshold,
            below_threshold: d.free_percent < threshold,
        })
        .collect();
    (values, inventory.warnings)
}
fn start_monitor(app: AppHandle, threshold: f64, interval: u64) {
    if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        loop {
            let (values, _) = alerts(threshold);
            for item in values.iter().filter(|v| v.below_threshold) {
                let _ = app.emit("m04://low-space-alert", item.clone());
                toast(
                    "KNOUX ONE - Low storage",
                    &format!(
                        "{} has {:.1}% free space.",
                        item.root_path, item.free_percent
                    ),
                );
            }
            tokio::time::sleep(std::time::Duration::from_secs(interval.clamp(1, 1440) * 60)).await;
        }
    });
}
pub fn start_persisted_monitor(app: &AppHandle) {
    if let Ok(path) = monitor_config_path(app) {
        if let Ok(bytes) = fs::read(path) {
            if let Ok(request) = serde_json::from_slice::<StorageSpaceCheckRequest>(&bytes) {
                start_monitor(
                    app.clone(),
                    request.threshold_percent.clamp(1.0, 50.0),
                    request.interval_minutes.clamp(1, 1440),
                );
            }
        }
    }
}
#[tauri::command]
pub fn m04_space_check_complete(
    app: AppHandle,
    op_id: String,
    request: Option<StorageSpaceCheckRequest>,
) -> Result<OperationResult<StorageSpaceCheckResult>, String> {
    let started = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let request = request.unwrap_or_default();
    let threshold = request.threshold_percent.clamp(1.0, 50.0);
    let interval = request.interval_minutes.clamp(1, 1440);
    let (values, warnings) = alerts(threshold);
    if let Ok(path) = monitor_config_path(&app) {
        let _ = fs::write(
            path,
            serde_json::to_vec_pretty(&StorageSpaceCheckRequest {
                threshold_percent: threshold,
                interval_minutes: interval,
            })
            .unwrap_or_default(),
        );
    }
    start_monitor(app, threshold, interval);
    let data = StorageSpaceCheckResult {
        alerts: values,
        checked_at: Utc::now().to_rfc3339(),
        background_monitoring_enabled: true,
        monitor_interval_minutes: interval,
        warnings: warnings.clone(),
    };
    Ok(op(op_id,"m04_s09","m04.space.check",started,timer,if warnings.is_empty(){"completed"}else{"completed_with_warnings"},Some(data),"Free space was checked and persistent in-process monitoring was enabled with Windows toast alerts.".into(),"تم فحص المساحة الحرة وتفعيل المراقبة الخلفية مع تنبيهات ويندوز.".into(),warnings,None))
}

fn safe_name(value: Option<String>, scan_id: &str, ext: &str) -> String {
    let base = value.unwrap_or_else(|| format!("storage-report-{scan_id}"));
    let clean = base
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
        .collect::<String>();
    format!(
        "{}.{}",
        if clean.is_empty() {
            format!("storage-report-{scan_id}")
        } else {
            clean
        },
        ext
    )
}

/// Resolves the requested formats to the concrete set to render. `all` expands to every
/// supported format. An unsupported request is an error, never a silent fallback.
fn resolve_formats(requested: Option<&str>) -> Result<Vec<String>, String> {
    let value = requested.unwrap_or("all");
    if value == "all" {
        return Ok(SUPPORTED_REPORT_FORMATS
            .iter()
            .map(|f| (*f).to_string())
            .collect());
    }
    let normalized = value.trim().to_ascii_lowercase();
    if !SUPPORTED_REPORT_FORMATS.contains(&normalized.as_str()) {
        return Err(format!("report_format_unsupported:{normalized}"));
    }
    Ok(vec![normalized])
}

#[tauri::command]
pub fn m04_report_export_complete(
    app: AppHandle,
    op_id: String,
    request: StorageReportExportRequest,
) -> Result<OperationResult<StorageReportExportResult>, String> {
    let started = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let formats = match resolve_formats(request.format.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            return Ok(op(
                op_id,
                "m04_s10",
                "m04.report.export",
                started,
                timer,
                "failed",
                None,
                "Requested report format is not supported.".into(),
                "صيغة التقرير المطلوبة غير مدعومة.".into(),
                Vec::new(),
                Some(error),
            ))
        }
    };
    let redaction = match super::m04_reports::RedactionProfile::parse(request.redaction.as_deref())
    {
        Ok(value) => value,
        Err(error) => {
            return Ok(op(
                op_id,
                "m04_s10",
                "m04.report.export",
                started,
                timer,
                "failed",
                None,
                "Requested redaction profile is not supported.".into(),
                "ملف إخفاء الهوية المطلوب غير مدعوم.".into(),
                Vec::new(),
                Some(error),
            ))
        }
    };

    // The snapshot comes from SQLite, so the export works after a restart instead of
    // depending on a process-lifetime in-memory map.
    let snapshot = match super::m04_reports::load_snapshot(&app, &request.scan_id) {
        Ok(value) => value,
        Err(error) => {
            return Ok(op(
                op_id,
                "m04_s10",
                "m04.report.export",
                started,
                timer,
                "failed",
                None,
                "No persisted analysis was found for that scan id. Run an analysis first; \
                 cancelled scans are never persisted."
                    .into(),
                "لم يُعثر على تحليل محفوظ لرقم الفحص. شغّل تحليلًا أولًا؛ الفحوص الملغاة لا تُحفظ.".into(),
                Vec::new(),
                Some(error),
            ))
        }
    };

    let directory = match app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_failed:{e}"))
    {
        Ok(base) => base.join("storage-reports"),
        Err(error) => {
            return Ok(op(
                op_id,
                "m04_s10",
                "m04.report.export",
                started,
                timer,
                "failed",
                None,
                "The report directory could not be resolved.".into(),
                "تعذّر تحديد مجلد التقارير.".into(),
                Vec::new(),
                Some(error),
            ))
        }
    };

    let generated_at = Utc::now().to_rfc3339();
    let mut artifacts = Vec::new();
    let mut warnings = Vec::new();
    for format in &formats {
        let rendered = match format.as_str() {
            "json" => super::m04_reports::render_json(&snapshot, redaction, generated_at.clone()),
            "csv" => super::m04_reports::render_csv(&snapshot, redaction, generated_at.clone()),
            "html" => super::m04_reports::render_html(&snapshot, redaction, generated_at.clone()),
            other => Err(format!("report_format_unsupported:{other}")),
        };
        let rendered = match rendered {
            Ok(value) => value,
            Err(error) => {
                warnings.push(format!("report_render_failed:{format}:{error}"));
                continue;
            }
        };
        let stem = safe_name(request.file_name.clone(), &snapshot.snapshot_id, "");
        let stem = stem.trim_end_matches('.').to_string();
        match super::m04_reports::write_artifact(&directory, &stem, format, &rendered.bytes) {
            Ok(artifact) => {
                if !artifact.signature_valid {
                    warnings.push(format!(
                        "artifact_signature_unverified:{} the written bytes do not match the \
                         declared {format} signature",
                        artifact.artifact_id
                    ));
                }
                artifacts.push(artifact);
            }
            Err(error) => warnings.push(format!("report_write_failed:{format}:{error}")),
        }
    }

    if artifacts.is_empty() {
        return Ok(op(
            op_id,
            "m04_s10",
            "m04.report.export",
            started,
            timer,
            "failed",
            None,
            "No report document could be written.".into(),
            "لم يُكتب أي مستند تقرير.".into(),
            warnings,
            Some("report_write_failed".into()),
        ));
    }

    // Record every artifact and its hash so a report can be verified later.
    match crate::storage::database::open(&app) {
        Ok(connection) => {
            for artifact in &artifacts {
                if let Err(error) = super::m04_reports::record_artifact(
                    &connection,
                    artifact,
                    Some(&op_id),
                    &snapshot.snapshot_id,
                    redaction,
                ) {
                    warnings.push(format!("artifact_record_failed:{}", artifact.artifact_id));
                    warnings.push(format!("artifact_record_error:{error}"));
                }
            }
        }
        Err(error) => warnings.push(format!("artifact_record_unavailable:{error}")),
    }

    let json_artifact = artifacts
        .iter()
        .find(|artifact| artifact.format == "json")
        .cloned();
    let primary = artifacts[0].clone();
    let data = StorageReportExportResult {
        scan_id: snapshot.snapshot_id.clone(),
        format: artifacts
            .iter()
            .map(|artifact| artifact.format.clone())
            .collect::<Vec<_>>()
            .join("+"),
        path: primary.path.clone(),
        byte_count: artifacts.iter().map(|artifact| artifact.byte_count).sum(),
        json_evidence_path: json_artifact
            .as_ref()
            .map(|artifact| artifact.path.clone())
            .unwrap_or_default(),
        redaction_profile: redaction.as_str().to_string(),
        source_operation_id: snapshot.operation_id.clone(),
        formats_supported: SUPPORTED_REPORT_FORMATS
            .iter()
            .map(|f| (*f).to_string())
            .collect(),
        formats_unsupported: unsupported_formats(),
        artifacts,
        warnings: warnings.clone(),
    };
    let status = if warnings.is_empty() {
        "completed"
    } else {
        "completed_with_warnings"
    };
    let written = data.artifacts.len();
    let source_scan = data.scan_id.clone();
    Ok(op(
        op_id,
        "m04_s10",
        "m04.report.export",
        started,
        timer,
        status,
        Some(data),
        format!(
            "Wrote {written} report document(s) from persisted scan {source_scan} and recorded a \
             SHA-256 and BLAKE3 hash for each."
        ),
        format!(
            "تمت كتابة {written} مستند تقرير من الفحص المحفوظ {source_scan} وتسجيل بصمة \
             SHA-256 وBLAKE3 لكل منها."
        ),
        warnings,
        None,
    ))
}

/// Lists persisted scans so a report can be exported again long after the analysis ran.
#[tauri::command]
pub fn m04_report_snapshots(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<Vec<super::m04_reports::SnapshotSummary>>, String> {
    let started = Utc::now().to_rfc3339();
    let timer = Instant::now();
    match super::m04_reports::list_snapshots(&app, 50) {
        Ok(values) => {
            let count = values.len();
            Ok(op(
                op_id,
                "m04_s10",
                "m04.report.history",
                started,
                timer,
                "completed",
                Some(values),
                format!("Loaded {count} persisted storage analyses available for export."),
                format!("تم تحميل {count} تحليل مساحة محفوظ متاح للتصدير."),
                Vec::new(),
                None,
            ))
        }
        Err(error) => Ok(op(
            op_id,
            "m04_s10",
            "m04.report.history",
            started,
            timer,
            "failed",
            None,
            "Persisted analyses could not be listed.".into(),
            "تعذّر عرض التحليلات المحفوظة.".into(),
            Vec::new(),
            Some(error),
        )),
    }
}

#[tauri::command]
pub fn m04_scan_cancel_complete(
    op_id: String,
    target_operation_id: String,
) -> Result<OperationResult<StorageCancelResult>, String> {
    let started = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let requested = CANCEL
        .lock()
        .ok()
        .and_then(|m| m.get(&target_operation_id).cloned())
        .map(|t| {
            t.store(true, Ordering::Relaxed);
            true
        })
        .unwrap_or(false);
    Ok(op(
        op_id,
        "m04_s01",
        "m04.scan.cancel",
        started,
        timer,
        "completed",
        Some(StorageCancelResult {
            target_operation_id,
            cancellation_requested: requested,
        }),
        "Cancellation request processed.".into(),
        "تمت معالجة طلب الإلغاء.".into(),
        Vec::new(),
        None,
    ))
}

#[cfg(test)]
mod tests {
    use super::{
        age_basis, classify_age, detect_age_policy, parse_fsutil_value, policy_state, push_file,
        resolve_formats, StorageFileItem, StorageReportExportRequest, SUPPORTED_REPORT_FORMATS,
    };
    use std::time::{Duration, SystemTime};

    fn item(path: &str, size: u64) -> StorageFileItem {
        StorageFileItem {
            path: path.into(),
            size_bytes: size,
            modified_at: "2024-01-02T00:00:00+00:00".into(),
            accessed_at: None,
            created_at: None,
            age_basis: age_basis::UNKNOWN.into(),
            is_old: false,
            extension: "bin".into(),
            category: "other".into(),
        }
    }

    // ---- last-access policy measurement -------------------------------------------------

    #[test]
    fn fsutil_output_is_parsed_to_the_reported_value() {
        // Real `fsutil behavior query disablelastaccess` shape.
        let output = "File system behavior settings\ndisablelastaccess = 0 (enabled)\n";
        assert_eq!(
            parse_fsutil_value(output, "disablelastaccess").as_deref(),
            Some("0")
        );
    }

    #[test]
    fn fsutil_parsing_is_case_and_spacing_tolerant() {
        let output = "  DisableLastAccess = 2 (system managed)  ";
        assert_eq!(
            parse_fsutil_value(output, "disablelastaccess").as_deref(),
            Some("2")
        );
    }

    #[test]
    fn unparseable_fsutil_output_yields_no_value_rather_than_a_guess() {
        assert_eq!(
            parse_fsutil_value("access cannot be determined", "disablelastaccess"),
            None
        );
        assert_eq!(
            parse_fsutil_value("disablelastaccess = (unknown)", "disablelastaccess"),
            None
        );
        assert_eq!(parse_fsutil_value("", "disablelastaccess"), None);
    }

    #[test]
    fn a_different_setting_is_not_mistaken_for_last_access() {
        let output = "disableletwritetime = 1 (enabled)\ndisablelastaccess = 0 (enabled)";
        assert_eq!(
            parse_fsutil_value(output, "disablelastaccess").as_deref(),
            Some("0")
        );
    }

    #[test]
    fn policy_states_map_to_the_documented_ntfs_meanings() {
        assert_eq!(policy_state("0"), "last_access_updates_enabled");
        assert_eq!(policy_state("1"), "last_access_updates_disabled");
        // Value 2 is system-managed: only NTFS directories update their own access time,
        // so it is not a usable file "last used" signal either.
        assert_eq!(policy_state("2"), "system_managed");
        assert_eq!(policy_state("7"), "unknown");
        assert_eq!(policy_state(""), "unknown");
    }

    #[test]
    fn measured_policy_never_claims_reliability_without_evidence() {
        let policy = detect_age_policy();
        if policy.last_access_reliable_for_files {
            // Reliability may only be asserted with a real measurement behind it.
            assert_eq!(policy.state, "last_access_updates_enabled");
            assert!(!matches!(policy.source.as_str(), "unknown" | ""));
            assert!(!policy.raw_value.is_empty());
        } else {
            // An unmeasured or disabled policy must say why, in both languages.
            assert!(!policy.note_en.is_empty());
            assert!(!policy.note_ar.is_empty());
        }
    }

    // ---- per-row age classification -----------------------------------------------------

    #[test]
    fn access_time_is_used_only_when_the_policy_was_measured_reliable() {
        let now = SystemTime::now();
        let (time, basis) = classify_age(true, Some(now), Some(now - Duration::from_secs(10)));
        assert_eq!(basis, age_basis::LAST_ACCESS);
        assert!(time.is_some());
    }

    #[test]
    fn an_unreliable_policy_falls_back_to_modification_time() {
        let modified = SystemTime::now() - Duration::from_secs(10);
        let accessed = SystemTime::now();
        let (_, basis) = classify_age(false, Some(accessed), Some(modified));
        // The readable-but-meaningless access time is deliberately not chosen.
        assert_eq!(basis, age_basis::LAST_WRITE_FALLBACK);
    }

    #[test]
    fn a_reliable_policy_without_a_readable_access_time_still_falls_back() {
        let modified = SystemTime::now();
        let (time, basis) = classify_age(true, None, Some(modified));
        assert_eq!(basis, age_basis::LAST_WRITE_FALLBACK);
        assert!(time.is_some());
    }

    #[test]
    fn no_readable_timestamp_makes_no_age_claim() {
        let (time, basis) = classify_age(true, None, None);
        assert_eq!(basis, age_basis::UNKNOWN);
        assert!(time.is_none());
        let (_, basis) = classify_age(false, None, None);
        assert_eq!(basis, age_basis::UNKNOWN);
    }

    // ---- deterministic ordering ---------------------------------------------------------

    #[test]
    fn largest_files_are_ordered_by_size_then_path() {
        let mut items = vec![
            item("C:\\b.bin", 10),
            item("C:\\a.bin", 10),
            item("C:\\c.bin", 20),
        ];
        push_file(&mut items, item("C:\\d.bin", 5), 10);
        let order: Vec<&str> = items.iter().map(|value| value.path.as_str()).collect();
        assert_eq!(
            order,
            vec!["C:\\c.bin", "C:\\a.bin", "C:\\b.bin", "C:\\d.bin"]
        );
    }

    #[test]
    fn ordering_is_stable_across_insertion_orders() {
        let mut first = vec![item("C:\\b.bin", 10), item("C:\\a.bin", 10)];
        push_file(&mut first, item("C:\\c.bin", 20), 10);
        let mut second = vec![item("C:\\c.bin", 20), item("C:\\a.bin", 10)];
        push_file(&mut second, item("C:\\b.bin", 10), 10);
        let left: Vec<&str> = first.iter().map(|value| value.path.as_str()).collect();
        let right: Vec<&str> = second.iter().map(|value| value.path.as_str()).collect();
        assert_eq!(left, right);
    }

    #[test]
    fn the_top_limit_truncates_rather_than_growing() {
        let mut items = Vec::new();
        for index in 0..50u64 {
            push_file(&mut items, item(&format!("C:\\{index}.bin"), index), 10);
        }
        assert_eq!(items.len(), 10);
        assert_eq!(items.first().map(|value| value.size_bytes), Some(49));
    }

    // ---- report format negotiation ------------------------------------------------------

    #[test]
    fn all_expands_to_exactly_the_supported_formats() {
        assert_eq!(
            resolve_formats(Some("all")).expect("all"),
            SUPPORTED_REPORT_FORMATS
                .iter()
                .map(|f| (*f).to_string())
                .collect::<Vec<_>>()
        );
        assert_eq!(
            resolve_formats(None).expect("default"),
            resolve_formats(Some("all")).unwrap()
        );
    }

    #[test]
    fn a_single_supported_format_is_accepted_and_normalized() {
        assert_eq!(
            resolve_formats(Some("HTML")).expect("html"),
            vec!["html".to_string()]
        );
        assert_eq!(
            resolve_formats(Some(" json ")).expect("json"),
            vec!["json".to_string()]
        );
    }

    #[test]
    fn an_unsupported_format_is_refused_rather_than_silently_replaced() {
        assert_eq!(
            resolve_formats(Some("pdf")).expect_err("pdf must be refused"),
            "report_format_unsupported:pdf"
        );
        assert!(resolve_formats(Some("xlsx")).is_err());
        assert!(resolve_formats(Some("")).is_err());
    }

    #[test]
    fn pdf_is_not_among_the_formats_this_build_writes() {
        assert!(!SUPPORTED_REPORT_FORMATS.contains(&"pdf"));
        assert!(SUPPORTED_REPORT_FORMATS.contains(&"html"));
        assert!(SUPPORTED_REPORT_FORMATS.contains(&"csv"));
        assert!(SUPPORTED_REPORT_FORMATS.contains(&"json"));
    }

    // ---- request deserialization --------------------------------------------------------

    #[test]
    fn an_export_request_from_an_older_client_still_deserializes() {
        // Only `scanId` existed before; the new fields must default rather than fail.
        let request: StorageReportExportRequest =
            serde_json::from_str(r#"{"scanId":"abc"}"#).expect("legacy request");
        assert_eq!(request.scan_id, "abc");
        assert!(request.format.is_none());
        assert!(request.redaction.is_none());
        assert!(request.file_name.is_none());
    }

    #[test]
    fn an_export_request_deserializes_every_new_field() {
        let request: StorageReportExportRequest = serde_json::from_str(
            r#"{"scanId":"abc","fileName":"r","format":"html","redaction":"user_profile"}"#,
        )
        .expect("full request");
        assert_eq!(request.format.as_deref(), Some("html"));
        assert_eq!(request.redaction.as_deref(), Some("user_profile"));
    }
}
