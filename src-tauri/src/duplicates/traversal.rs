use crate::duplicates::{contracts::DuplicateScanRequest, errors::DuplicateError, jobs::JobControl};
use chrono::{DateTime, Utc};
use std::{collections::HashSet, fs, path::{Path, PathBuf}, time::SystemTime};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct FileCandidate {
    pub path: PathBuf,
    pub canonical_path: PathBuf,
    pub name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub modified_time: String,
    pub created_time: String,
    pub mime_type: String,
    pub file_identity: String,
    pub hard_link_count: u64,
    pub protected_path: bool,
}

#[derive(Debug, Default)]
pub struct TraversalResult { pub files: Vec<FileCandidate>, pub errors: Vec<String>, pub scanned_bytes: u64 }

fn time_to_rfc3339(value: Result<SystemTime, std::io::Error>) -> String {
    value.ok().map(DateTime::<Utc>::from).unwrap_or_else(Utc::now).to_rfc3339()
}

#[cfg(target_os = "windows")]
fn identity(_metadata: &fs::Metadata, canonical: &Path) -> (String, u64) {
    use std::{os::windows::ffi::OsStrExt, ptr::null_mut};
    use windows_sys::Win32::{Foundation::{CloseHandle, INVALID_HANDLE_VALUE}, Storage::FileSystem::{CreateFileW, GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_FLAG_BACKUP_SEMANTICS, FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING}};
    let wide: Vec<u16> = canonical.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let handle = unsafe { CreateFileW(wide.as_ptr(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, null_mut(), OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, 0) };
    if handle == INVALID_HANDLE_VALUE { return (format!("path:{}", canonical.display()), 1); }
    let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    let success = unsafe { GetFileInformationByHandle(handle, &mut info) };
    unsafe { CloseHandle(handle) };
    if success == 0 { return (format!("path:{}", canonical.display()), 1); }
    let index = ((info.nFileIndexHigh as u64) << 32) | info.nFileIndexLow as u64;
    (format!("win:{}:{}", info.dwVolumeSerialNumber, index), u64::from(info.nNumberOfLinks.max(1)))
}

#[cfg(unix)]
fn identity(metadata: &fs::Metadata, _canonical: &Path) -> (String, u64) {
    use std::os::unix::fs::MetadataExt;
    (format!("unix:{}:{}", metadata.dev(), metadata.ino()), metadata.nlink())
}

#[cfg(not(any(target_os = "windows", unix)))]
fn identity(_metadata: &fs::Metadata, canonical: &Path) -> (String, u64) { (format!("path:{}", canonical.display()), 1) }

pub fn normalize_path(path: &Path) -> String { path.to_string_lossy().replace('/', "\\").to_lowercase() }

pub fn is_protected_path(path: &Path) -> bool {
    let normalized = normalize_path(path);
    let mut protected_roots = Vec::new();
    for variable in ["WINDIR", "ProgramFiles", "ProgramFiles(x86)", "ProgramData"] {
        if let Ok(value) = std::env::var(variable) { protected_roots.push(normalize_path(Path::new(&value))); }
    }
    if protected_roots.is_empty() { protected_roots.extend(["c:\\windows".into(), "c:\\program files".into(), "c:\\program files (x86)".into(), "c:\\programdata".into()]); }
    protected_roots.iter().any(|root| normalized == *root || normalized.starts_with(&format!("{root}\\")))
        || normalized.contains(":\\system volume information")
        || normalized.contains(":\\$recycle.bin")
        || normalized.contains("\\windowsapps")
        || normalized.ends_with(":\\boot")
}

fn extension_allowed(path: &Path, request: &DuplicateScanRequest) -> bool {
    if request.extensions.is_empty() { return true; }
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or_default().to_lowercase();
    request.extensions.iter().any(|allowed| allowed.trim_start_matches('.').eq_ignore_ascii_case(&extension))
}

pub fn collect_files(request: &DuplicateScanRequest, control: &JobControl) -> Result<TraversalResult, DuplicateError> {
    if request.paths.is_empty() { return Err(DuplicateError::InvalidScanSource("At least one scan source is required.".into())); }
    let canonical_exclusions = request.excluded_paths.iter().filter_map(|path| dunce::canonicalize(path).ok()).collect::<Vec<_>>();
    let mut visited_roots = HashSet::new();
    let mut result = TraversalResult::default();

    for source in &request.paths {
        control.checkpoint()?;
        let source_path = PathBuf::from(source);
        if !source_path.exists() { result.errors.push(format!("source_not_found: {}", source_path.display())); continue; }
        let canonical_source = dunce::canonicalize(&source_path).map_err(|error| DuplicateError::InvalidScanSource(format!("{source}: {error}")))?;
        if is_protected_path(&canonical_source) { return Err(DuplicateError::ProtectedPathSelected(canonical_source.display().to_string())); }
        if !visited_roots.insert(canonical_source.clone()) { continue; }
        let walker = if canonical_source.is_file() { WalkDir::new(&canonical_source).max_depth(0) } else if request.include_subfolders { WalkDir::new(&canonical_source) } else { WalkDir::new(&canonical_source).max_depth(1) };
        for entry_result in walker.follow_links(false) {
            control.checkpoint()?;
            let entry = match entry_result { Ok(value) => value, Err(error) => { result.errors.push(format!("walk_error: {error}")); continue; } };
            if !entry.file_type().is_file() { continue; }
            let canonical = match dunce::canonicalize(entry.path()) { Ok(value) => value, Err(error) => { result.errors.push(format!("canonicalize_failed: {}: {error}", entry.path().display())); continue; } };
            if canonical_exclusions.iter().any(|excluded| canonical.starts_with(excluded)) || !extension_allowed(&canonical, request) { continue; }
            let metadata = match fs::metadata(&canonical) { Ok(value) => value, Err(error) => { result.errors.push(format!("metadata_failed: {}: {error}", canonical.display())); continue; } };
            let size = metadata.len();
            if size < request.min_size_bytes || request.max_size_bytes.is_some_and(|max| size > max) { continue; }
            let (file_identity, hard_link_count) = identity(&metadata, &canonical);
            let name = canonical.file_name().and_then(|value| value.to_str()).unwrap_or_default().to_string();
            let extension = canonical.extension().and_then(|value| value.to_str()).unwrap_or_default().to_lowercase();
            let mime_type = mime_guess::from_path(&canonical).first_or_octet_stream().essence_str().to_string();
            result.scanned_bytes = result.scanned_bytes.saturating_add(size);
            result.files.push(FileCandidate { path: entry.path().to_path_buf(), canonical_path: canonical.clone(), name, extension, size_bytes: size, modified_time: time_to_rfc3339(metadata.modified()), created_time: time_to_rfc3339(metadata.created()), mime_type, file_identity, hard_link_count, protected_path: is_protected_path(&canonical) });
        }
    }
    if result.files.is_empty() && result.errors.len() == request.paths.len() { return Err(DuplicateError::SourceAccessDenied(result.errors.join("; "))); }
    Ok(result)
}
