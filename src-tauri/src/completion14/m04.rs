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

static SNAPSHOTS: Lazy<Mutex<HashMap<String, StorageAnalysisResult>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
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
}
impl StorageScanRequest {
    fn root(path: String) -> Self {
        Self {
            root_path: path,
            top_limit: 100,
            old_days: 180,
            max_files: 1_000_000,
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
    pub age_basis: String,
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
    pub access_time_supported: bool,
    pub fallback_file_count: u64,
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
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageReportExportResult {
    pub scan_id: String,
    pub format: String,
    pub path: String,
    pub byte_count: u64,
    pub json_evidence_path: String,
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
    items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    items.truncate(limit)
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
    let mut access_supported = false;
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
        if accessed.is_some() {
            access_supported = true;
        }
        let (age_time, basis) = match accessed {
            Some(v) => (Some(v), "last_access"),
            None => {
                fallback += 1;
                (modified, "modified_fallback")
            }
        };
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
            age_basis: basis.into(),
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
    largest_folders.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
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
    type_distribution.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    if !access_supported {
        warnings.push("Last-access timestamps were unavailable; modification time was used and is labeled per file.".into());
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
            access_time_supported: access_supported,
            fallback_file_count: fallback,
        },
        scanned_at: Utc::now().to_rfc3339(),
        warnings,
    })
}
fn save_snapshot(value: &StorageAnalysisResult) {
    if !value.cancelled {
        if let Ok(mut map) = SNAPSHOTS.lock() {
            map.insert(value.scan_id.clone(), value.clone());
            while map.len() > 20 {
                if let Some(k) = map.keys().next().cloned() {
                    map.remove(&k);
                } else {
                    break;
                }
            }
        }
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
            save_snapshot(&data);
            let warnings = data.warnings.clone();
            Ok(op(
                op_id,
                capability,
                handler,
                started,
                timer,
                if data.cancelled {
                    "cancelled"
                } else if warnings.is_empty() {
                    "completed"
                } else {
                    "completed_with_warnings"
                },
                Some(data.clone()),
                format!(
                    "Measured {} files with explicit access-time evidence.",
                    data.total_files
                ),
                format!(
                    "تم قياس {} ملف مع توضيح دليل وقت الوصول لكل ملف.",
                    data.total_files
                ),
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

fn ascii(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_graphic() || c == ' ' {
                c
            } else {
                '?'
            }
        })
        .collect()
}
fn pdf_escape(value: &str) -> String {
    ascii(value)
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}
fn make_pdf(lines: &[String]) -> Vec<u8> {
    let content = lines
        .iter()
        .take(46)
        .enumerate()
        .map(|(i, line)| {
            format!(
                "BT /F1 10 Tf 50 {} Td ({}) Tj ET\n",
                790 - (i as i32 * 16),
                pdf_escape(line)
            )
        })
        .collect::<String>();
    let objects = ["<< /Type /Catalog /Pages 2 0 R >>".to_string(),"<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".to_string(),"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),format!("<< /Length {} >>\nstream\n{}endstream",content.len(),content)];
    let mut out = b"%PDF-1.4\n".to_vec();
    let mut offsets = Vec::new();
    for (i, obj) in objects.iter().enumerate() {
        offsets.push(out.len());
        out.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", i + 1, obj).as_bytes());
    }
    let xref = out.len();
    out.extend_from_slice(
        format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes(),
    );
    for offset in offsets {
        out.extend_from_slice(format!("{:010} 00000 n \n", offset).as_bytes());
    }
    out.extend_from_slice(
        format!(
            "trailer << /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            objects.len() + 1,
            xref
        )
        .as_bytes(),
    );
    out
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
#[tauri::command]
pub fn m04_report_export_complete(
    app: AppHandle,
    op_id: String,
    request: StorageReportExportRequest,
) -> Result<OperationResult<StorageReportExportResult>, String> {
    let started = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let snapshot = SNAPSHOTS
        .lock()
        .ok()
        .and_then(|m| m.get(&request.scan_id).cloned());
    let Some(snapshot) = snapshot else {
        return Ok(op(
            op_id,
            "m04_s10",
            "m04.report.export",
            started,
            timer,
            "failed",
            None,
            "Measured snapshot unavailable. Run a new analysis.".into(),
            "المعاينة المقاسة غير متاحة. شغّل تحليلًا جديدًا.".into(),
            Vec::new(),
            Some("storage_snapshot_missing".into()),
        ));
    };
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_failed:{e}"))?
        .join("storage-reports");
    fs::create_dir_all(&dir).map_err(|e| format!("report_dir_failed:{e}"))?;
    let json_path = dir.join(safe_name(
        request.file_name.clone(),
        &snapshot.scan_id,
        "json",
    ));
    let json =
        serde_json::to_vec_pretty(&snapshot).map_err(|e| format!("report_json_failed:{e}"))?;
    fs::write(&json_path, &json).map_err(|e| format!("report_json_write_failed:{e}"))?;
    let pdf_path = dir.join(safe_name(request.file_name, &snapshot.scan_id, "pdf"));
    let mut lines = vec![
        "KNOUX ONE - Verified Storage Report".into(),
        format!("Scan ID: {}", snapshot.scan_id),
        format!("Root: {}", snapshot.root_path),
        format!("Measured at: {}", snapshot.scanned_at),
        format!("Files: {}", snapshot.total_files),
        format!("Directories: {}", snapshot.total_directories),
        format!("Bytes: {}", snapshot.total_bytes),
        format!(
            "Old files: {} ({} bytes)",
            snapshot.old_files.file_count, snapshot.old_files.size_bytes
        ),
        format!(
            "Access-time supported: {}",
            snapshot.old_files.access_time_supported
        ),
        "Largest files:".into(),
    ];
    for item in snapshot.largest_files.iter().take(25) {
        lines.push(format!("{} bytes - {}", item.size_bytes, item.path));
    }
    let pdf = make_pdf(&lines);
    fs::write(&pdf_path, &pdf).map_err(|e| format!("report_pdf_write_failed:{e}"))?;
    let data = StorageReportExportResult {
        scan_id: snapshot.scan_id.clone(),
        format: "pdf+json".into(),
        path: pdf_path.to_string_lossy().to_string(),
        byte_count: pdf.len() as u64,
        json_evidence_path: json_path.to_string_lossy().to_string(),
    };
    Ok(op(
        op_id,
        "m04_s10",
        "m04.report.export",
        started,
        timer,
        "completed",
        Some(data),
        "Exported a valid PDF report with a JSON evidence sidecar.".into(),
        "تم تصدير تقرير PDF صالح مع ملف أدلة JSON مرافق.".into(),
        Vec::new(),
        None,
    ))
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
