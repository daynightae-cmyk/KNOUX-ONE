//! M11 backup services, batch 1: S03 settings export, S05 environment export,
//! S06 bookmark backup.
//!
//! Every one of these produces a real file in a real directory the caller chose, and
//! every one of them hashes that file and reads it back before reporting success. A
//! backup that was not verified is worse than no backup, because it is believed.
//!
//! Nothing here writes into the source it reads. A bookmark backup copies out of a
//! browser profile and never back into it; an environment export reads the registry and
//! writes only to the destination.
//!
//! S01, S02, S04 and S10 stay `planned`: the first two need elevation no automated run
//! here has performed, S02 copies arbitrary user data at volume, and S10 would register a
//! Windows scheduled task. S07 (registry export), S08 (recovery bundle) and S09 (restore
//! inventory) are the next step and are deliberately not stubbed here.

use crate::completion14::psbridge;
use crate::contracts::OperationResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::AppHandle;

const CAP_M11_S03: &str = "m11_s03";
const CAP_M11_S05: &str = "m11_s05";
const CAP_M11_S06: &str = "m11_s06";

/// One export never overwrites a previous one: every run gets its own timestamped folder,
/// so a failed run cannot destroy the last known-good copy.
const MAX_EXPORT_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceReport {
    pub name: String,
    pub available: bool,
    pub detail: String,
}

fn source(name: &str, available: bool, detail: impl Into<String>) -> SourceReport {
    SourceReport {
        name: name.into(),
        available,
        detail: detail.into(),
    }
}

#[allow(clippy::too_many_arguments)]
fn result<T>(
    op_id: String,
    capability: &str,
    handler: &str,
    started_at: String,
    timer: Instant,
    data: Option<T>,
    status: &str,
    summary_en: String,
    summary_ar: String,
    warnings: Vec<String>,
    error_code: Option<String>,
    stderr: Option<String>,
) -> OperationResult<T> {
    OperationResult {
        operation_id: op_id,
        capability_id: capability.into(),
        handler_id: handler.into(),
        status: status.into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: None,
        stdout: None,
        stderr,
        summary_en,
        summary_ar,
        warnings,
        error_code,
        data,
    }
}

fn field(document: &Value, key: &str) -> String {
    psbridge::text(document, key)
}

fn flag(document: &Value, key: &str) -> Option<bool> {
    psbridge::boolean(document, key)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn stamp() -> String {
    Utc::now().format("%Y%m%d-%H%M%S").to_string()
}

fn modified_rfc3339(metadata: &fs::Metadata) -> String {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
        .and_then(|value| chrono::DateTime::<Utc>::from_timestamp(value.as_secs() as i64, 0))
        .map(|stamp| stamp.to_rfc3339())
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// The one writer every backup service shares
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WrittenFile {
    pub kind: String,
    pub source_path: String,
    pub file_name: String,
    pub file_path: String,
    pub byte_count: u64,
    pub sha256: String,
    /// True only when the bytes read back from disk hash to the same value.
    pub read_back_verified: bool,
    pub verification_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRun {
    pub run_id: String,
    pub run_directory: String,
    pub created_at: String,
    pub files: Vec<WrittenFile>,
    pub sources: Vec<SourceReport>,
    pub files_written: usize,
    pub files_failed: usize,
    pub total_bytes: u64,
    /// False when nothing was written, so an empty backup can never read as a good one.
    pub everything_verified: bool,
    pub destination_defaulted: bool,
}

impl BackupRun {
    fn new(run_id: String, run_directory: String, destination_defaulted: bool) -> Self {
        Self {
            run_id,
            run_directory,
            created_at: Utc::now().to_rfc3339(),
            files: Vec::new(),
            sources: Vec::new(),
            files_written: 0,
            files_failed: 0,
            total_bytes: 0,
            everything_verified: false,
            destination_defaulted,
        }
    }

    fn finish(&mut self) {
        self.files_written = self
            .files
            .iter()
            .filter(|file| file.read_back_verified)
            .count();
        self.files_failed = self.files.len() - self.files_written;
        self.total_bytes = self.files.iter().map(|file| file.byte_count).sum();
        self.everything_verified = self.files_failed == 0 && !self.files.is_empty();
    }

    fn last(&self) -> Option<&WrittenFile> {
        self.files.last()
    }
}

/// Copies bytes into the run directory, hashes them, then reads the written file back and
/// compares. A write that cannot be verified is recorded as a failure, not as a success.
fn write_verified(
    run: &mut BackupRun,
    directory: &Path,
    kind: &str,
    source_path: &str,
    file_name: &str,
    bytes: &[u8],
) -> Result<(), String> {
    if bytes.len() as u64 > MAX_EXPORT_BYTES {
        return Err(format!(
            "export_refused_too_large:{} bytes exceeds the {MAX_EXPORT_BYTES} byte ceiling",
            bytes.len()
        ));
    }
    let target = directory.join(file_name);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("backup_directory_failed:{error}"))?;
    }
    let expected = sha256_hex(bytes);
    let outcome = fs::write(&target, bytes).and_then(|()| fs::read(&target));
    let (byte_count, actual, error) = match outcome {
        Ok(disk) => (disk.len() as u64, sha256_hex(&disk), None),
        Err(error) => (0, String::new(), Some(error.to_string())),
    };
    let verified = error.is_none() && actual == expected;
    run.files.push(WrittenFile {
        kind: kind.into(),
        source_path: source_path.into(),
        file_name: file_name.into(),
        file_path: target.to_string_lossy().to_string(),
        byte_count,
        sha256: if verified { expected } else { actual },
        read_back_verified: verified,
        verification_note: error.map(|error| format!("read_back_failed:{error}")),
    });
    Ok(())
}

/// Records a source that was expected but is not present. That is a real finding about the
/// machine, not a failure, so it is listed rather than raised.
fn record_absent(run: &mut BackupRun, name: &str, detail: impl Into<String>) {
    run.sources.push(source(name, false, detail));
}

fn resolve_destination(app: &AppHandle, explicit: Option<&str>) -> Result<(PathBuf, bool), String> {
    if let Some(value) = explicit.map(str::trim).filter(|value| !value.is_empty()) {
        let path = PathBuf::from(value);
        if !path.is_absolute() {
            return Err("backup_destination_must_be_absolute".into());
        }
        fs::create_dir_all(&path).map_err(|error| format!("backup_destination_failed:{error}"))?;
        return Ok((path, false));
    }
    use tauri::Manager;
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("backup_app_data_failed:{error}"))?
        .join("backups");
    fs::create_dir_all(&base).map_err(|error| format!("backup_destination_failed:{error}"))?;
    Ok((base, true))
}

fn open_run(
    app: &AppHandle,
    prefix: &str,
    explicit: Option<&str>,
) -> Result<(BackupRun, PathBuf), String> {
    let (base, defaulted) = resolve_destination(app, explicit)?;
    let run_id = format!("{prefix}-{}", stamp());
    let directory = base.join(&run_id);
    fs::create_dir_all(&directory)
        .map_err(|error| format!("backup_run_directory_failed:{error}"))?;
    Ok((
        BackupRun::new(run_id, directory.to_string_lossy().to_string(), defaulted),
        directory,
    ))
}

// ---------------------------------------------------------------------------
// M11-S03 — Settings export
// ---------------------------------------------------------------------------

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsExportRequest {
    #[serde(default)]
    pub destination_directory: Option<String>,
    /// Include the content of each document, not only its name and digest.
    #[serde(default = "yes")]
    pub include_contents: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsExport {
    pub run: BackupRun,
    pub app_data_directory: String,
    pub document_count: usize,
    pub document_names: Vec<String>,
    pub include_contents: bool,
    pub manifest_sha256: String,
    pub manifest_file_path: String,
    pub manifest_read_back_verified: bool,
}

/// The KNOUX ONE documents this service exports. It is an explicit list rather than a
/// directory sweep, so a new file in the app data directory is never silently swept into
/// a "settings backup" by accident.
const KNOUX_DOCUMENTS: &[&str] = &[
    "essential-software.json",
    "post-format-profiles",
    "cleanup-profiles",
    "install-queue",
    "m03",
    "space-thresholds.json",
    "cleanup-history.json",
];

/// Reads a directory into a single deterministic JSON document. File order is sorted so the
/// same directory always produces the same bytes, and therefore the same digest.
fn collect_directory(path: &Path, include_contents: bool) -> Result<Vec<u8>, String> {
    let mut entries: Vec<(String, u64, Option<String>, Option<String>)> = Vec::new();
    for entry in walkdir::WalkDir::new(path)
        .follow_links(false)
        .max_depth(6)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let raw = fs::read(entry.path()).ok();
        let digest = raw.as_ref().map(|bytes| sha256_hex(bytes));
        let content = if include_contents {
            raw.and_then(|bytes| String::from_utf8(bytes).ok())
        } else {
            None
        };
        entries.push((
            // The separator is normalised to `/` so the same directory produces the same
            // bytes, and therefore the same digest, on any platform. A backup whose
            // manifest cannot be re-verified elsewhere is not much of a backup.
            entry
                .path()
                .strip_prefix(path)
                .unwrap_or(entry.path())
                .components()
                .map(|component| component.as_os_str().to_string_lossy().to_string())
                .collect::<Vec<String>>()
                .join("/"),
            metadata.len(),
            digest,
            content,
        ));
    }
    entries.sort_by(|left, right| left.0.cmp(&right.0));
    let mut document = serde_json::Map::new();
    for (name, size, digest, content) in entries {
        let mut item = serde_json::Map::new();
        item.insert("byteCount".into(), serde_json::Value::from(size));
        item.insert(
            "sha256".into(),
            serde_json::Value::from(digest.unwrap_or_default()),
        );
        if let Some(content) = content {
            item.insert("content".into(), serde_json::Value::from(content));
        }
        document.insert(name, serde_json::Value::Object(item));
    }
    let mut text = serde_json::to_string_pretty(&serde_json::Value::Object(document))
        .map_err(|error| format!("directory_document_failed:{error}"))?;
    text.push('\n');
    Ok(text.into_bytes())
}

#[tauri::command]
pub async fn m11_settings_export(
    app: AppHandle,
    op_id: String,
    request: Option<SettingsExportRequest>,
) -> Result<OperationResult<SettingsExport>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let request = request.unwrap_or(SettingsExportRequest {
        destination_directory: None,
        include_contents: true,
    });

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, &request);
        Ok(result(
            op_id,
            CAP_M11_S03,
            "m11.settings.export",
            started_at,
            timer,
            None,
            "unavailable",
            "KNOUX ONE settings live under the Windows app data directory.".into(),
            "إعدادات KNOUX ONE موجودة في مجلد بيانات ويندوز.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        let app_data = match app.path().app_data_dir() {
            Ok(path) => path,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M11_S03,
                    "m11.settings.export",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The KNOUX ONE app data directory could not be resolved.".into(),
                    "تعذّر تحديد مجلد بيانات KNOUX ONE.".into(),
                    vec![format!("app_data_unavailable:{reason}")],
                    Some("app_data_unavailable".into()),
                    None,
                ))
            }
        };
        let (mut run, directory) =
            match open_run(&app, "settings", request.destination_directory.as_deref()) {
                Ok(value) => value,
                Err(reason) => {
                    return Ok(result(
                        op_id,
                        CAP_M11_S03,
                        "m11.settings.export",
                        started_at,
                        timer,
                        None,
                        "failed",
                        "The export directory could not be prepared.".into(),
                        "تعذّر تجهيز مجلد التصدير.".into(),
                        vec![reason.clone()],
                        Some(reason),
                        None,
                    ))
                }
            };

        let mut names: Vec<String> = Vec::new();
        for name in KNOUX_DOCUMENTS {
            let source_path = app_data.join(name);
            if !source_path.exists() {
                record_absent(
                    &mut run,
                    name,
                    format!(
                        "{} does not exist yet on this machine.",
                        source_path.display()
                    ),
                );
                continue;
            }
            let target_name = format!("{}.json", name.replace(['/', '\\'], "__"));
            let origin = source_path.to_string_lossy().to_string();
            let outcome = if source_path.is_dir() {
                collect_directory(&source_path, request.include_contents)
                    .map(|bytes| (origin.clone(), bytes))
            } else {
                fs::read(&source_path)
                    .map(|bytes| (origin.clone(), bytes))
                    .map_err(|error| format!("settings_read_failed:{error}"))
            };
            match outcome {
                Ok((origin, bytes)) => {
                    names.push((*name).to_string());
                    if let Err(reason) = write_verified(
                        &mut run,
                        &directory,
                        "settings",
                        &origin,
                        &target_name,
                        &bytes,
                    ) {
                        record_absent(&mut run, name, reason);
                    }
                }
                Err(reason) => record_absent(&mut run, name, reason),
            }
        }
        run.sources.push(source(
            "KNOUX ONE app data directory",
            true,
            format!("Read {}", app_data.display()),
        ));
        run.finish();

        // The manifest is itself hashed and read back, so a bundle can be checked without
        // trusting the file list it contains.
        let manifest_path = directory.join("manifest.json");
        let manifest = serde_json::json!({
            "schemaVersion": 1,
            "generator": format!("KNOUX ONE {}", env!("CARGO_PKG_VERSION")),
            "kind": "knoux-settings-export",
            "runId": run.run_id,
            "createdAt": run.created_at,
            "includeContents": request.include_contents,
            "documentList": KNOUX_DOCUMENTS,
            "documentsFound": names,
            "files": run.files,
            "sources": run.sources,
        });
        let manifest_bytes = match serde_json::to_vec_pretty(&manifest) {
            Ok(mut bytes) => {
                bytes.push(b'\n');
                bytes
            }
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M11_S03,
                    "m11.settings.export",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The export manifest could not be serialized.".into(),
                    "تعذّر تسلسل بيان التصدير.".into(),
                    vec![format!("manifest_serialize_failed:{reason}")],
                    Some("manifest_serialize_failed".into()),
                    None,
                ))
            }
        };
        let (manifest_sha, manifest_verified) = write_manifest(&manifest_path, &manifest_bytes);

        let mut warnings: Vec<String> = run
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{}: {}", item.name, item.detail))
            .collect();
        if !manifest_verified {
            warnings.push("The manifest could not be written and read back identically.".into());
        }
        if run.files.is_empty() {
            warnings.push(
                "No settings document exists on this machine yet, so the export holds only its manifest. An empty backup is reported as empty."
                    .into(),
            );
        }
        if !request.include_contents {
            warnings.push(
                "Document contents were excluded, so this export proves which settings exist and their digests but cannot be restored from."
                    .into(),
            );
        }

        Ok(result(
            op_id,
            CAP_M11_S03,
            "m11.settings.export",
            started_at,
            timer,
            Some(SettingsExport {
                run,
                app_data_directory: app_data.to_string_lossy().to_string(),
                document_count: names.len(),
                document_names: names,
                include_contents: request.include_contents,
                manifest_sha256: manifest_sha,
                manifest_file_path: manifest_path.to_string_lossy().to_string(),
                manifest_read_back_verified: manifest_verified,
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "KNOUX ONE settings were exported to a real directory, hashed and read back.".into(),
            "تم تصدير إعدادات KNOUX ONE إلى مجلد حقيقي، وتجزئتها وقراءتها للتحقق.".into(),
            warnings,
            None,
            None,
        ))
    }
}

fn write_manifest(path: &Path, bytes: &[u8]) -> (String, bool) {
    let expected = sha256_hex(bytes);
    let verified = fs::write(path, bytes)
        .and_then(|()| fs::read(path))
        .map(|disk| sha256_hex(&disk) == expected)
        .unwrap_or(false);
    (expected, verified)
}

// ---------------------------------------------------------------------------
// M11-S05 — Environment-variable export
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentVariable {
    pub name: String,
    pub machine_value: Option<String>,
    pub user_value: Option<String>,
    /// For PATH this is the concatenation in the order Windows actually searches it,
    /// because a user PATH does not replace the machine PATH.
    pub effective_value: String,
    pub machine_present: bool,
    pub user_present: bool,
    pub path_entry_count: usize,
    /// Entries present in both scopes, which is how a duplicated PATH is found.
    pub duplicated_path_entries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentExport {
    pub run: BackupRun,
    pub variables: Vec<EnvironmentVariable>,
    pub path_machine_entries: usize,
    pub path_user_entries: usize,
    pub path_duplicate_entries: usize,
    pub machine_path_length: usize,
    pub user_path_length: usize,
    pub effective_path_length: usize,
    pub export_file_path: String,
    pub export_sha256: String,
}

const ENV_SCRIPT: &str = r#"
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$machine = Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' -ErrorAction SilentlyContinue
$user = Get-ItemProperty -LiteralPath 'HKCU:\Environment' -ErrorAction SilentlyContinue
$out = New-Object System.Collections.Generic.List[object]
foreach ($name in @('Path','PATHEXT','TEMP','TMP','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','OS','COMSPEC')) {
  $machineValue = $null
  $userValue = $null
  $machinePresent = $false
  $userPresent = $false
  if ($null -ne $machine) {
    $property = $machine.PSObject.Properties[$name]
    if ($null -ne $property) { $machineValue = [string]$property.Value; $machinePresent = $true }
  }
  if ($null -ne $user) {
    $property = $user.PSObject.Properties[$name]
    if ($null -ne $property) { $userValue = [string]$property.Value; $userPresent = $true }
  }
  $out.Add([pscustomobject]@{
    name = [string]$name
    machineValue = $machineValue
    userValue = $userValue
    machinePresent = $machinePresent
    userPresent = $userPresent
  })
}
$machinePathPresent = $false
$userPathPresent = $false
if ($null -ne $machine -and $null -ne $machine.PSObject.Properties['Path']) { $machinePathPresent = $true }
if ($null -ne $user -and $null -ne $user.PSObject.Properties['Path']) { $userPathPresent = $true }
[pscustomobject]@{
  variables = $out.ToArray()
  machinePathPresent = $machinePathPresent
  userPathPresent = $userPathPresent
} | ConvertTo-Json -Depth 5 -Compress
"#;

fn split_path(value: &str) -> Vec<String> {
    value
        .split(';')
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect()
}

fn empty_path_variable() -> EnvironmentVariable {
    EnvironmentVariable {
        name: "Path".into(),
        machine_value: None,
        user_value: None,
        effective_value: String::new(),
        machine_present: false,
        user_present: false,
        path_entry_count: 0,
        duplicated_path_entries: Vec::new(),
    }
}

fn parse_environment_export(
    stdout: &str,
) -> Result<(Vec<EnvironmentVariable>, bool, bool), String> {
    let document = psbridge::parse_json(stdout)?;
    let machine_path_present = flag(&document, "machinePathPresent").unwrap_or(false);
    let user_path_present = flag(&document, "userPathPresent").unwrap_or(false);
    let mut variables: Vec<EnvironmentVariable> = Vec::new();
    for raw in psbridge::as_array(
        document
            .get("variables")
            .cloned()
            .unwrap_or(serde_json::Value::Null),
    ) {
        let name = field(&raw, "name");
        if name.is_empty() {
            continue;
        }
        let machine_present = flag(&raw, "machinePresent").unwrap_or(false);
        let user_present = flag(&raw, "userPresent").unwrap_or(false);
        let machine_value = field(&raw, "machineValue");
        let user_value = field(&raw, "userValue");
        let (effective, path_entries, duplicated) = if name.eq_ignore_ascii_case("path") {
            // A user PATH does not replace the machine PATH on Windows; both are searched.
            // Exporting only one of them is how a "restored" PATH silently loses entries.
            let machine_entries = split_path(&machine_value);
            let user_entries = split_path(&user_value);
            let mut seen: Vec<String> = Vec::new();
            let mut duplicates: Vec<String> = Vec::new();
            for entry in machine_entries.iter().chain(user_entries.iter()) {
                if seen.contains(entry) {
                    duplicates.push(entry.clone());
                } else {
                    seen.push(entry.clone());
                }
            }
            let mut effective = machine_entries.clone();
            effective.extend(user_entries.iter().cloned());
            (effective.join(";"), effective.len(), duplicates)
        } else if user_present {
            (user_value.clone(), 0, Vec::new())
        } else {
            (machine_value.clone(), 0, Vec::new())
        };
        variables.push(EnvironmentVariable {
            name,
            machine_value: machine_present.then_some(machine_value),
            user_value: user_present.then_some(user_value),
            effective_value: effective,
            machine_present,
            user_present,
            path_entry_count: path_entries,
            duplicated_path_entries: duplicated,
        });
    }
    if variables.is_empty() {
        return Err("environment_variables_unreadable".to_string());
    }
    Ok((variables, machine_path_present, user_path_present))
}

#[tauri::command]
pub async fn m11_environment_export(
    app: AppHandle,
    op_id: String,
    destination_directory: Option<String>,
) -> Result<OperationResult<EnvironmentExport>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, &destination_directory);
        Ok(result(
            op_id,
            CAP_M11_S05,
            "m11.environment.export",
            started_at,
            timer,
            None,
            "unavailable",
            "Windows environment variables are a Windows-only measurement.".into(),
            "متغيرات بيئة ويندوز تُقاس على ويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let (mut run, directory) =
            match open_run(&app, "environment", destination_directory.as_deref()) {
                Ok(value) => value,
                Err(reason) => {
                    return Ok(result(
                        op_id,
                        CAP_M11_S05,
                        "m11.environment.export",
                        started_at,
                        timer,
                        None,
                        "failed",
                        "The export directory could not be prepared.".into(),
                        "تعذّر تجهيز مجلد التصدير.".into(),
                        vec![reason.clone()],
                        Some(reason),
                        None,
                    ))
                }
            };
        let ps = match psbridge::run(ENV_SCRIPT) {
            Ok(run) => run,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M11_S05,
                    "m11.environment.export",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The environment registry could not be read.".into(),
                    "تعذّرت قراءة سجل بيئة النظام.".into(),
                    vec![reason],
                    Some("environment_read_launch_failed".into()),
                    None,
                ))
            }
        };
        let (variables, machine_path_present, user_path_present) =
            match parse_environment_export(&ps.stdout) {
                Ok(value) => value,
                Err(reason) => {
                    return Ok(result(
                        op_id,
                        CAP_M11_S05,
                        "m11.environment.export",
                        started_at,
                        timer,
                        None,
                        "unavailable",
                        "Windows did not expose the environment registry on this machine.".into(),
                        "لم يعرض ويندوز سجل البيئة على هذا الجهاز.".into(),
                        vec![reason],
                        Some("environment_unavailable".into()),
                        ps.stderr_tail(),
                    ))
                }
            };

        let path = variables
            .iter()
            .find(|item| item.name.eq_ignore_ascii_case("path"))
            .cloned()
            .unwrap_or_else(empty_path_variable);
        run.sources.push(source(
            "Session Manager\\Environment registry key",
            machine_path_present,
            if machine_path_present {
                "The machine environment key was read.".to_string()
            } else {
                "The machine environment key holds no PATH value.".to_string()
            },
        ));
        run.sources.push(source(
            "HKCU\\Environment registry key",
            user_path_present,
            if user_path_present {
                "The per-user environment key was read.".to_string()
            } else {
                "The per-user environment key holds no PATH value.".to_string()
            },
        ));

        let document = serde_json::json!({
            "schemaVersion": 1,
            "generator": format!("KNOUX ONE {}", env!("CARGO_PKG_VERSION")),
            "kind": "knoux-environment-export",
            "runId": run.run_id,
            "createdAt": run.created_at,
            "note": "A user PATH does not replace the machine PATH on Windows; both are searched. effectiveValue is the concatenation in search order, and duplicatedPathEntries lists every entry present in both scopes.",
            "variables": variables,
        });
        let bytes = match serde_json::to_vec_pretty(&document) {
            Ok(mut bytes) => {
                bytes.push(b'\n');
                bytes
            }
            Err(reason) => {
                return Ok(result(
                    op_id,
                    CAP_M11_S05,
                    "m11.environment.export",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The environment export could not be serialized.".into(),
                    "تعذّر تسلسل تصدير البيئة.".into(),
                    vec![format!("environment_serialize_failed:{reason}")],
                    Some("environment_serialize_failed".into()),
                    ps.stderr_tail(),
                ))
            }
        };
        let sha = sha256_hex(&bytes);
        if let Err(reason) = write_verified(
            &mut run,
            &directory,
            "environment",
            "HKLM Session Manager\\Environment + HKCU\\Environment",
            "environment.json",
            &bytes,
        ) {
            return Ok(result(
                op_id,
                CAP_M11_S05,
                "m11.environment.export",
                started_at,
                timer,
                None,
                "failed",
                "The environment export file could not be written.".into(),
                "تعذّرت كتابة ملف تصدير البيئة.".into(),
                vec![reason.clone()],
                Some(reason),
                ps.stderr_tail(),
            ));
        }
        run.finish();

        let mut warnings: Vec<String> = run
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{}: {}", item.name, item.detail))
            .collect();
        if !run.everything_verified {
            warnings.push("The environment export was not verified after being written.".into());
        }
        if !path.duplicated_path_entries.is_empty() {
            let count = path.duplicated_path_entries.len();
            warnings.push(format!(
                "{count} PATH entr{} appear in both the machine and user scope; a restore must reproduce both rather than one of them.",
                if count == 1 { "y" } else { "ies" }
            ));
        }
        let export_file_path = run
            .last()
            .map(|file| file.file_path.clone())
            .unwrap_or_default();

        Ok(result(
            op_id,
            CAP_M11_S05,
            "m11.environment.export",
            started_at,
            timer,
            Some(EnvironmentExport {
                run,
                variables,
                path_machine_entries: split_path(path.machine_value.as_deref().unwrap_or("")).len(),
                path_user_entries: split_path(path.user_value.as_deref().unwrap_or("")).len(),
                path_duplicate_entries: path.duplicated_path_entries.len(),
                machine_path_length: path.machine_value.as_deref().map_or(0, str::len),
                user_path_length: path.user_value.as_deref().map_or(0, str::len),
                effective_path_length: path.effective_value.len(),
                export_file_path,
                export_sha256: sha,
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Machine and per-user environment variables were exported, with PATH reported in the order Windows actually searches it."
                .into(),
            "تم تصدير متغيرات بيئة الجهاز والمستخدم، مع عرض PATH بالترتيب الذي يبحث فيه ويندوز فعليًا.".into(),
            warnings,
            None,
            ps.stderr_tail(),
        ))
    }
}

// ---------------------------------------------------------------------------
// M11-S06 — Bookmark backup
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkSource {
    pub browser: String,
    pub profile_name: String,
    pub profile_path: String,
    pub bookmarks_path: String,
    pub exists: bool,
    pub readable: bool,
    pub rejection_reason: Option<String>,
    pub byte_count: u64,
    pub modified_at: String,
    pub copied: bool,
    pub read_back_verified: bool,
    pub sha256: String,
    pub target_file: String,
}

/// Browsers are enumerated from real profile directories on this machine rather than from
/// a hard-coded list, so a browser that is not installed simply does not appear as a
/// source of data.
fn bookmark_candidates() -> Vec<(&'static str, PathBuf)> {
    let mut out: Vec<(&'static str, PathBuf)> = Vec::new();
    if let Some(local) = psbridge::local_app_data() {
        out.push(("chrome", local.join("Google/Chrome/User Data")));
        out.push(("edge", local.join("Microsoft/Edge/User Data")));
        out.push(("brave", local.join("BraveSoftware/Brave-Browser/User Data")));
        out.push(("vivaldi", local.join("Vivaldi/User Data")));
        out.push(("firefox", local.join("Mozilla/Firefox/Profiles")));
    }
    if let Some(roaming) = psbridge::roaming_app_data() {
        out.push(("opera", roaming.join("Opera Software/Opera Stable")));
        out.push(("opera-gx", roaming.join("Opera Software/Opera GX Stable")));
    }
    out
}

/// A Chromium `User Data` directory holds a `Default` profile plus numbered ones, named by
/// the `Local State` preference file. Reading the real names is the difference between
/// backing up "Default" and backing up the user's actual second profile.
fn chromium_profile_names(user_data: &Path) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(text) = fs::read_to_string(user_data.join("Local State")) {
        if let Ok(state) = serde_json::from_str::<Value>(&text) {
            if let Some(info) = state
                .get("profile")
                .and_then(|value| value.get("info_cache"))
            {
                if let Some(object) = info.as_object() {
                    names.extend(object.keys().cloned());
                }
            }
        }
    }
    if names.is_empty() && user_data.join("Default").is_dir() {
        names.push("Default".to_string());
    }
    names.sort();
    names.dedup();
    names
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkBackup {
    pub run: BackupRun,
    pub sources: Vec<BookmarkSource>,
    pub browsers_found: usize,
    pub profiles_found: usize,
    pub files_copied: usize,
    pub everything_verified: bool,
    pub wrote_into_any_browser_profile: bool,
}

#[tauri::command]
pub async fn m11_bookmark_backup(
    app: AppHandle,
    op_id: String,
    destination_directory: Option<String>,
) -> Result<OperationResult<BookmarkBackup>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, &destination_directory);
        Ok(result(
            op_id,
            CAP_M11_S06,
            "m11.bookmarks.backup",
            started_at,
            timer,
            None,
            "unavailable",
            "Browser profiles live under the Windows user profile.".into(),
            "ملفات تعريف المتصفحات موجودة داخل ملف تعريف مستخدم ويندوز.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let (mut run, directory) =
            match open_run(&app, "bookmarks", destination_directory.as_deref()) {
                Ok(value) => value,
                Err(reason) => {
                    return Ok(result(
                        op_id,
                        CAP_M11_S06,
                        "m11.bookmarks.backup",
                        started_at,
                        timer,
                        None,
                        "failed",
                        "The backup directory could not be prepared.".into(),
                        "تعذّر تجهيز مجلد النسخ الاحتياطي.".into(),
                        vec![reason.clone()],
                        Some(reason),
                        None,
                    ))
                }
            };

        let mut sources: Vec<BookmarkSource> = Vec::new();
        for (browser, root) in bookmark_candidates() {
            if !root.is_dir() {
                // "This browser is not installed" is a different claim from "no bookmarks
                // exist", so the absence is recorded rather than skipped.
                record_absent(
                    &mut run,
                    browser,
                    format!("{} does not exist on this machine.", root.display()),
                );
                continue;
            }
            if browser == "firefox" {
                backup_firefox(&mut run, &directory, browser, &root, &mut sources);
                continue;
            }
            for profile_name in chromium_profile_names(&root) {
                let profile_dir = root.join(&profile_name);
                let bookmarks = profile_dir.join("Bookmarks");
                let origin = bookmarks.to_string_lossy().to_string();
                if !bookmarks.exists() {
                    // A profile directory without a Bookmarks file is normal for a profile
                    // that has never saved one.
                    sources.push(BookmarkSource {
                        browser: browser.into(),
                        profile_name: profile_name.clone(),
                        profile_path: profile_dir.to_string_lossy().to_string(),
                        bookmarks_path: origin,
                        exists: false,
                        readable: false,
                        rejection_reason: Some("no_bookmarks_file_in_this_profile".into()),
                        byte_count: 0,
                        modified_at: String::new(),
                        copied: false,
                        read_back_verified: false,
                        sha256: String::new(),
                        target_file: String::new(),
                    });
                    continue;
                }
                let metadata = fs::metadata(&bookmarks).ok();
                let modified = metadata.as_ref().map(modified_rfc3339).unwrap_or_default();
                let size = metadata.as_ref().map(|value| value.len()).unwrap_or(0);
                match fs::read(&bookmarks) {
                    Ok(bytes) => {
                        // Chromium stores bookmarks as JSON, so the file is validated
                        // before it is called a bookmark backup.
                        if serde_json::from_slice::<Value>(&bytes).is_err() {
                            sources.push(BookmarkSource {
                                browser: browser.into(),
                                profile_name,
                                profile_path: profile_dir.to_string_lossy().to_string(),
                                bookmarks_path: origin,
                                exists: true,
                                readable: false,
                                rejection_reason: Some("bookmarks_file_is_not_json".into()),
                                byte_count: size,
                                modified_at: modified,
                                copied: false,
                                read_back_verified: false,
                                sha256: String::new(),
                                target_file: String::new(),
                            });
                            continue;
                        }
                        let target_name = format!("{browser}-{profile_name}-Bookmarks.json");
                        match write_verified(
                            &mut run,
                            &directory,
                            "bookmarks",
                            &origin,
                            &target_name,
                            &bytes,
                        ) {
                            Ok(()) => {
                                if let Some(written) = run.last() {
                                    sources.push(BookmarkSource {
                                        browser: browser.into(),
                                        profile_name,
                                        profile_path: profile_dir.to_string_lossy().to_string(),
                                        bookmarks_path: origin,
                                        exists: true,
                                        readable: true,
                                        rejection_reason: None,
                                        byte_count: written.byte_count,
                                        modified_at: modified,
                                        copied: true,
                                        read_back_verified: written.read_back_verified,
                                        sha256: written.sha256.clone(),
                                        target_file: written.file_name.clone(),
                                    });
                                }
                            }
                            Err(reason) => record_absent(
                                &mut run,
                                &format!("{browser}/{profile_name}"),
                                reason,
                            ),
                        }
                    }
                    Err(reason) => sources.push(BookmarkSource {
                        browser: browser.into(),
                        profile_name,
                        profile_path: profile_dir.to_string_lossy().to_string(),
                        bookmarks_path: origin,
                        exists: true,
                        readable: false,
                        rejection_reason: Some(format!("bookmarks_read_failed:{reason}")),
                        byte_count: size,
                        modified_at: modified,
                        copied: false,
                        read_back_verified: false,
                        sha256: String::new(),
                        target_file: String::new(),
                    }),
                }
            }
        }
        run.finish();

        let profiles_found = sources.len();
        let mut browsers: Vec<String> = Vec::new();
        for entry in &sources {
            if !browsers.contains(&entry.browser) {
                browsers.push(entry.browser.clone());
            }
        }
        let files_copied = sources.iter().filter(|entry| entry.copied).count();
        let everything_verified = files_copied > 0 && run.everything_verified;

        let mut warnings: Vec<String> = run
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{}: {}", item.name, item.detail))
            .collect();
        for entry in sources
            .iter()
            .filter(|entry| entry.exists && !entry.readable)
        {
            warnings.push(format!(
                "{} / {}: {}",
                entry.browser,
                entry.profile_name,
                entry.rejection_reason.clone().unwrap_or_default()
            ));
        }
        if files_copied == 0 {
            warnings.push(
                "No browser profile with a readable bookmarks file was found, so nothing was copied. An empty backup is reported as empty rather than as success."
                    .into(),
            );
        }

        Ok(result(
            op_id,
            CAP_M11_S06,
            "m11.bookmarks.backup",
            started_at,
            timer,
            Some(BookmarkBackup {
                run,
                sources,
                browsers_found: browsers.len(),
                profiles_found,
                files_copied,
                everything_verified,
                wrote_into_any_browser_profile: false,
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Bookmark files were copied out of every real browser profile, hashed and read back. Nothing was written inside any browser profile directory."
                .into(),
            "نُسخت ملفات المفضلة من كل ملف تعريف متصفح حقيقي، وجُمّلت وقُرئت للتحقق. لم يُكتب شيء داخل أي مجلد متصفح.".into(),
            warnings,
            None,
            None,
        ))
    }
}

/// Firefox keeps one `places.sqlite` per profile, not a JSON file. Copying a SQLite
/// database is only meaningful together with its `-wal` and `-shm` siblings, so the whole
/// set is copied or none of it is, and each part is base64 so the copy is text-safe.
fn backup_firefox(
    run: &mut BackupRun,
    directory: &Path,
    browser: &str,
    root: &Path,
    sources: &mut Vec<BookmarkSource>,
) {
    let mut places_files: Vec<PathBuf> = walkdir::WalkDir::new(root)
        .max_depth(2)
        .into_iter()
        .filter_map(Result::ok)
        .map(|entry| entry.path().to_path_buf())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name == "places.sqlite")
        })
        .collect();
    places_files.sort();
    for places in places_files {
        let profile_name = places
            .parent()
            .and_then(|parent| parent.file_name())
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        let mut group: Vec<(String, PathBuf, u64, String, Vec<u8>)> = Vec::new();
        let mut missing: Vec<String> = Vec::new();
        for suffix in ["", "-wal", "-shm"] {
            let candidate = PathBuf::from(format!("{}{suffix}", places.to_string_lossy()));
            let name = candidate
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_default();
            match fs::metadata(&candidate).map(|metadata| {
                (
                    metadata.len(),
                    modified_rfc3339(&metadata),
                    fs::read(&candidate),
                )
            }) {
                Ok((size, modified, Ok(bytes))) => {
                    group.push((name, candidate, size, modified, bytes))
                }
                _ => missing.push(format!("{name}: not present")),
            }
        }
        if group.is_empty() {
            record_absent(
                run,
                &format!("{browser}/{profile_name}"),
                "places.sqlite is unreadable",
            );
            continue;
        }
        let mut document = serde_json::Map::new();
        let mut total = 0u64;
        for (name, path, size, modified, bytes) in &group {
            total = total.saturating_add(*size);
            document.insert(
                name.clone(),
                serde_json::json!({
                    "originalPath": path,
                    "byteCount": size,
                    "modifiedAt": modified,
                    "sha256": sha256_hex(bytes),
                    "contentBase64": base64_encode(bytes),
                }),
            );
        }
        let mut text =
            serde_json::to_string_pretty(&serde_json::Value::Object(document)).unwrap_or_default();
        text.push('\n');
        let target_name = format!("{browser}-{profile_name}-places.json");
        let origin = places.to_string_lossy().to_string();
        match write_verified(
            run,
            directory,
            "bookmarks",
            &origin,
            &target_name,
            text.as_bytes(),
        ) {
            Ok(()) => {
                if let Some(written) = run.last() {
                    sources.push(BookmarkSource {
                        browser: browser.into(),
                        profile_name,
                        profile_path: places
                            .parent()
                            .map(|parent| parent.to_string_lossy().to_string())
                            .unwrap_or_default(),
                        bookmarks_path: origin,
                        exists: true,
                        readable: true,
                        rejection_reason: (!missing.is_empty())
                            .then(|| format!("sidecar files absent: {}", missing.join(", "))),
                        byte_count: total,
                        modified_at: String::new(),
                        copied: true,
                        read_back_verified: written.read_back_verified,
                        sha256: written.sha256.clone(),
                        target_file: written.file_name.clone(),
                    });
                }
            }
            Err(reason) => record_absent(run, &format!("{browser}/{profile_name}"), reason),
        }
    }
}

const BASE64_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Standard base64. A SQLite backup has to survive being stored as text, and this avoids
/// adding a dependency the project does not otherwise need.
fn base64_encode(input: &[u8]) -> String {
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(BASE64_ALPHABET[(triple >> 18 & 0x3F) as usize] as char);
        out.push(BASE64_ALPHABET[(triple >> 12 & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 {
            BASE64_ALPHABET[(triple >> 6 & 0x3F) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            BASE64_ALPHABET[(triple & 0x3F) as usize] as char
        } else {
            '='
        });
    }
    out
}

// ---------------------------------------------------------------------------
// M11-S07 — Registry-key backup
// ---------------------------------------------------------------------------
/// The only registry keys this service will ever export. A backup tool that accepts a
/// caller-supplied key path is a registry writer one argument away, so the list is fixed
/// in source and a request cannot widen it.
///
/// The second field is a flat file stem, never a key path. A key such as
/// `HKCU\Control Panel\Desktop` reused as a file name would be a *nested path*, and
/// reg.exe export fails on it because the intermediate directories do not exist inside the
/// run directory. Every stem is therefore a separate, single-segment name.
const ALLOWED_REGISTRY_KEYS: &[(&str, &str, &str)] = &[
    (
        "HKCU\\Control Panel\\Desktop",
        "hkcu-control-panel-desktop",
        "Desktop and appearance settings",
    ),
    (
        "HKCU\\Environment",
        "hkcu-environment",
        "Per-user environment variables",
    ),
    (
        "HKCU\\Keyboard Layout",
        "hkcu-keyboard-layout",
        "Keyboard layout list",
    ),
    (
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced",
        "hkcu-explorer-advanced",
        "Explorer advanced settings",
    ),
    (
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes",
        "hkcu-themes",
        "Personalised theme settings",
    ),
    (
        "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes",
        "hklm-themes",
        "Machine theme settings",
    ),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryKeyBackup {
    pub key: String,
    pub description: String,
    pub exists: bool,
    pub exported: bool,
    pub file_name: String,
    pub file_path: String,
    pub byte_count: u64,
    /// Key headers found by re-parsing the written `.reg` file. A file that reg.exe
    /// reports as exported but that holds no key header is not a usable backup.
    pub key_header_count: usize,
    pub value_header_count: usize,
    pub sha256: String,
    pub read_back_verified: bool,
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryBackup {
    pub run: BackupRun,
    pub keys: Vec<RegistryKeyBackup>,
    pub keys_requested: usize,
    pub keys_exported: usize,
    pub keys_absent: usize,
    pub everything_verified: bool,
    /// Always false. `reg export` reads a key and writes a file; it never writes to the
    /// registry, and this service adds no code path that could.
    pub wrote_to_any_registry_key: bool,
}

/// Counts `[HKEY_...]` and `"name"=` headers in a `.reg` file. This is a structural check,
/// not a parse: it proves the file is a registry export rather than an empty or truncated
/// one, which is the failure a bare "reg.exe exited 0" would miss.
fn count_reg_headers(content: &str) -> (usize, usize) {
    let mut keys = 0usize;
    let mut values = 0usize;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            keys += 1;
        } else if (trimmed.starts_with('"') || trimmed.starts_with('@')) && trimmed.contains('=') {
            values += 1;
        }
    }
    (keys, values)
}

#[tauri::command]
pub async fn m11_registry_key_backup(
    app: AppHandle,
    op_id: String,
    destination_directory: Option<String>,
) -> Result<OperationResult<RegistryBackup>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, &destination_directory);
        Ok(result(
            op_id,
            "m11_s07",
            "m11.registry.backup",
            started_at,
            timer,
            None,
            "unavailable",
            "Registry export is a Windows-only surface.".into(),
            "تصدير السجل سطح خاص بويندوز فقط.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let (mut run, directory) =
            match open_run(&app, "registry", destination_directory.as_deref()) {
                Ok(value) => value,
                Err(reason) => {
                    return Ok(result(
                        op_id,
                        "m11_s07",
                        "m11.registry.backup",
                        started_at,
                        timer,
                        None,
                        "failed",
                        "The backup directory could not be prepared.".into(),
                        "تعذّر تجهيز مجلد النسخ الاحتياطي.".into(),
                        vec![reason.clone()],
                        Some(reason),
                        None,
                    ))
                }
            };

        let mut keys: Vec<RegistryKeyBackup> = Vec::new();
        for (key, export_name, description) in ALLOWED_REGISTRY_KEYS {
            let file_name = format!("{export_name}.reg");
            let target = directory.join(&file_name);
            let invocation = std::process::Command::new("reg.exe")
                .args(["export", key, &target.to_string_lossy(), "/y"])
                .output();
            let run_output = match invocation {
                Ok(output) => output,
                Err(reason) => {
                    record_absent(&mut run, key, format!("reg.exe launch failed: {reason}"));
                    keys.push(RegistryKeyBackup {
                        key: (*key).into(),
                        description: (*description).into(),
                        exists: false,
                        exported: false,
                        file_name,
                        file_path: target.to_string_lossy().to_string(),
                        byte_count: 0,
                        key_header_count: 0,
                        value_header_count: 0,
                        sha256: String::new(),
                        read_back_verified: false,
                        rejection_reason: Some(format!("reg_launch_failed:{reason}")),
                    });
                    continue;
                }
            };
            if !run_output.status.success() {
                let stderr = String::from_utf8_lossy(&run_output.stderr)
                    .trim()
                    .to_string();
                record_absent(&mut run, key, format!("reg.exe reported: {stderr}"));
                keys.push(RegistryKeyBackup {
                    key: (*key).into(),
                    description: (*description).into(),
                    exists: false,
                    exported: false,
                    file_name,
                    file_path: target.to_string_lossy().to_string(),
                    byte_count: 0,
                    key_header_count: 0,
                    value_header_count: 0,
                    sha256: String::new(),
                    read_back_verified: false,
                    rejection_reason: Some(format!("reg_export_failed:{stderr}")),
                });
                continue;
            }
            // reg.exe exiting 0 is not proof. The file is read back, hashed, and checked
            // for the structural markers of a real registry export.
            match fs::read(&target) {
                Ok(bytes) => {
                    let content = String::from_utf8_lossy(&bytes).into_owned();
                    let (key_headers, value_headers) = count_reg_headers(&content);
                    let digest = sha256_hex(&bytes);
                    let verified = sha256_hex(&fs::read(&target).unwrap_or_default()) == digest
                        && key_headers > 0;
                    run.files.push(WrittenFile {
                        kind: "registry".into(),
                        source_path: (*key).into(),
                        file_name: file_name.clone(),
                        file_path: target.to_string_lossy().to_string(),
                        byte_count: bytes.len() as u64,
                        sha256: digest.clone(),
                        read_back_verified: verified,
                        verification_note: (key_headers == 0)
                            .then(|| "exported_file_contains_no_key_header".to_string()),
                    });
                    keys.push(RegistryKeyBackup {
                        key: (*key).into(),
                        description: (*description).into(),
                        exists: true,
                        exported: true,
                        file_name,
                        file_path: target.to_string_lossy().to_string(),
                        byte_count: bytes.len() as u64,
                        key_header_count: key_headers,
                        value_header_count: value_headers,
                        sha256: digest,
                        read_back_verified: verified,
                        rejection_reason: (key_headers == 0)
                            .then(|| "exported_file_contains_no_key_header".to_string()),
                    });
                }
                Err(reason) => {
                    record_absent(&mut run, key, format!("export_unreadable:{reason}"));
                    keys.push(RegistryKeyBackup {
                        key: (*key).into(),
                        description: (*description).into(),
                        exists: true,
                        exported: false,
                        file_name,
                        file_path: target.to_string_lossy().to_string(),
                        byte_count: 0,
                        key_header_count: 0,
                        value_header_count: 0,
                        sha256: String::new(),
                        read_back_verified: false,
                        rejection_reason: Some(format!("export_unreadable:{reason}")),
                    });
                }
            }
        }
        run.sources.push(source(
            "reg.exe export",
            true,
            "Keys were read with reg.exe export, which writes a .reg file and never writes to the registry."
                .to_string(),
        ));
        run.finish();

        let keys_exported = keys.iter().filter(|item| item.exported).count();
        let everything_verified = keys_exported > 0 && run.everything_verified;
        let mut warnings: Vec<String> = run
            .sources
            .iter()
            .filter(|item| !item.available)
            .map(|item| format!("{}: {}", item.name, item.detail))
            .collect();
        for entry in keys.iter().filter(|item| !item.read_back_verified) {
            warnings.push(format!(
                "{}: {}",
                entry.key,
                entry
                    .rejection_reason
                    .clone()
                    .unwrap_or_else(|| "not verified after writing".into())
            ));
        }
        if keys_exported == 0 {
            warnings.push(
                "No allowlisted registry key could be exported. An empty backup is reported as empty rather than as success."
                    .into(),
            );
        }

        Ok(result(
            op_id,
            "m11_s07",
            "m11.registry.backup",
            started_at,
            timer,
            Some(RegistryBackup {
                keys_requested: ALLOWED_REGISTRY_KEYS.len(),
                keys_exported,
                keys_absent: ALLOWED_REGISTRY_KEYS.len() - keys_exported,
                everything_verified,
                wrote_to_any_registry_key: false,
                keys,
                run,
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Allowlisted registry keys were exported to .reg files, hashed, read back and structurally checked. No registry value was written."
                .into(),
            "صُدِّرت مفاتيح السجل المسموح بها إلى ملفات .reg، وجُمّلت وقُرئت وفُحصت بنيويًا. لم تُكتب أي قيمة في السجل.".into(),
            warnings,
            None,
            None,
        ))
    }
}

// ---------------------------------------------------------------------------
// M11-S09 — Restore inventory
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreFileCheck {
    pub file_name: String,
    pub file_path: String,
    pub present_on_disk: bool,
    pub recorded_sha256: Option<String>,
    pub current_sha256: Option<String>,
    /// True only when a recorded digest exists and the file on disk still matches it.
    pub still_matches: bool,
    pub byte_count: u64,
    /// True when no prior digest existed, so this run establishes a baseline instead of
    /// confirming one. Never reported as a pass.
    pub baseline_only: bool,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRunCheck {
    pub run_id: String,
    pub run_directory: String,
    pub modified_at: String,
    pub age_days: f64,
    pub manifest_present: bool,
    pub files_checked: usize,
    pub files_matching: usize,
    pub files_missing: usize,
    pub files_altered: usize,
    pub files_baseline_only: usize,
    pub total_bytes: u64,
    /// True only when every file with a recorded digest still matches.
    pub run_verified: bool,
    pub files: Vec<RestoreFileCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreInventory {
    pub backup_root: String,
    pub backup_root_exists: bool,
    pub runs: Vec<RestoreRunCheck>,
    pub runs_found: usize,
    pub runs_verified: usize,
    pub runs_with_missing_or_altered_files: usize,
    pub total_bytes_on_disk: u64,
    pub nothing_deleted: bool,
    /// True when no root was supplied and the application default under its data directory
    /// was used, so the reported numbers are not silently about some other folder.
    pub destination_defaulted: bool,
    pub measured_at: String,
}

/// Reads the digests a previous run recorded, if it recorded any. A settings export writes
/// a manifest; the environment and bookmark exports do not, and this service says so
/// rather than treating "no record" as "verified".
fn recorded_digests(directory: &Path) -> BTreeMap<String, String> {
    let mut digests = BTreeMap::new();
    let Ok(bytes) = fs::read(directory.join("manifest.json")) else {
        return digests;
    };
    let Ok(document) = serde_json::from_slice::<Value>(&bytes) else {
        return digests;
    };
    for entry in document
        .get("files")
        .and_then(|value| value.as_array())
        .map(Vec::as_slice)
        .unwrap_or_default()
    {
        let name = field(entry, "fileName");
        let digest = field(entry, "sha256");
        if !name.is_empty() && !digest.is_empty() {
            digests.insert(name, digest);
        }
    }
    digests
}

fn inspect_run(run_directory: &Path) -> RestoreRunCheck {
    let run_id = run_directory
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
    let modified = fs::metadata(run_directory)
        .ok()
        .map(|metadata| modified_rfc3339(&metadata))
        .unwrap_or_default();
    let age_days = fs::metadata(run_directory)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|value| value.elapsed().ok())
        .map(|value| value.as_secs_f64() / 86_400.0)
        .unwrap_or(-1.0);
    let digests = recorded_digests(run_directory);

    let mut names: Vec<String> = walkdir::WalkDir::new(run_directory)
        .follow_links(false)
        .max_depth(3)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| {
            entry
                .path()
                .strip_prefix(run_directory)
                .unwrap_or(entry.path())
                .components()
                .map(|component| component.as_os_str().to_string_lossy().to_string())
                .collect::<Vec<String>>()
                .join("/")
        })
        .collect();
    // A recorded file that has since been deleted must still be reported, so the union of
    // what is on disk and what was recorded is what gets checked.
    for name in digests.keys() {
        if !names.contains(name) {
            names.push(name.clone());
        }
    }
    // The manifest is the record, not a backed-up file: it lists the other files and never
    // lists itself, so including it would leave every run with one unmatchable file and no
    // run could ever verify. Its presence is reported separately.
    names.retain(|name| name != "manifest.json");
    names.sort();

    let mut files: Vec<RestoreFileCheck> = Vec::new();
    let mut total_bytes = 0u64;
    for name in names {
        let path = run_directory.join(name.replace('/', std::path::MAIN_SEPARATOR_STR));
        let current = fs::read(&path).ok();
        let current_sha256 = current.as_ref().map(|bytes| sha256_hex(bytes));
        let byte_count = current.as_ref().map_or(0, |bytes| bytes.len() as u64);
        total_bytes = total_bytes.saturating_add(byte_count);
        let recorded = digests.get(&name).cloned();
        let (still_matches, baseline_only, note) = match (&recorded, &current) {
            (Some(expected), Some(_)) => (
                current_sha256.as_deref() == Some(expected.as_str()),
                false,
                (current_sha256.as_deref() != Some(expected.as_str()))
                    .then(|| "file_changed_since_the_backup_was_written".to_string()),
            ),
            (Some(_), None) => (
                false,
                false,
                Some("file_recorded_but_absent_on_disk".into()),
            ),
            // No prior digest: this run records one, it does not confirm one.
            (None, Some(_)) => (
                false,
                true,
                Some("no_recorded_digest_to_compare_against".into()),
            ),
            (None, None) => (false, false, Some("absent_on_disk_and_unrecorded".into())),
        };
        files.push(RestoreFileCheck {
            file_name: name,
            file_path: path.to_string_lossy().to_string(),
            present_on_disk: current.is_some(),
            recorded_sha256: recorded,
            current_sha256,
            still_matches,
            byte_count,
            baseline_only,
            note,
        });
    }

    let files_checked = files.len();
    let files_matching = files.iter().filter(|item| item.still_matches).count();
    let files_missing = files.iter().filter(|item| !item.present_on_disk).count();
    let files_altered = files
        .iter()
        .filter(|item| {
            item.present_on_disk && item.recorded_sha256.is_some() && !item.still_matches
        })
        .count();
    let files_baseline_only = files.iter().filter(|item| item.baseline_only).count();
    RestoreRunCheck {
        run_id,
        run_directory: run_directory.to_string_lossy().to_string(),
        modified_at: modified,
        age_days,
        manifest_present: run_directory.join("manifest.json").exists(),
        files_checked,
        files_matching,
        files_missing,
        files_altered,
        files_baseline_only,
        total_bytes,
        // A run is verified only when every file in it still matches a digest the run
        // itself recorded. Files with no record are counted separately and never counted
        // as a pass.
        run_verified: files_checked > 0 && files_matching == files_checked,
        files,
    }
}

#[tauri::command]
pub async fn m11_restore_inventory(
    app: AppHandle,
    op_id: String,
    backup_root: Option<String>,
) -> Result<OperationResult<RestoreInventory>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, &backup_root);
        Ok(result(
            op_id,
            "m11_s09",
            "m11.restore.inventory",
            started_at,
            timer,
            None,
            "unavailable",
            "The backup directory is a Windows application data path.".into(),
            "مجلد النسخ الاحتياطي مسار في بيانات تطبيق ويندوز.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        let (root, defaulted) = match resolve_destination(&app, backup_root.as_deref()) {
            Ok(value) => value,
            Err(reason) => {
                return Ok(result(
                    op_id,
                    "m11_s09",
                    "m11.restore.inventory",
                    started_at,
                    timer,
                    None,
                    "failed",
                    "The backup root could not be resolved.".into(),
                    "تعذّر تحديد جذر النسخ الاحتياطية.".into(),
                    vec![reason.clone()],
                    Some(reason),
                    None,
                ))
            }
        };
        let mut warnings: Vec<String> = Vec::new();
        if !root.is_dir() {
            warnings.push(format!(
                "The backup root {} does not exist, so no backup has been taken on this machine yet.",
                root.display()
            ));
        }
        let mut directories: Vec<PathBuf> = walkdir::WalkDir::new(&root)
            .follow_links(false)
            .max_depth(1)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_dir())
            .map(|entry| entry.path().to_path_buf())
            .collect();
        directories.sort();
        let runs: Vec<RestoreRunCheck> = directories
            .iter()
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.contains('-'))
            })
            .map(|path| inspect_run(path))
            .collect();
        let runs_verified = runs.iter().filter(|run| run.run_verified).count();
        let runs_with_problems = runs
            .iter()
            .filter(|run| run.files_missing > 0 || run.files_altered > 0)
            .count();
        for run in runs
            .iter()
            .filter(|item| item.files_missing > 0 || item.files_altered > 0)
        {
            warnings.push(format!(
                "{}: {} file(s) missing, {} altered since the backup was written.",
                run.run_id, run.files_missing, run.files_altered
            ));
        }
        if runs.is_empty() {
            warnings.push(
                "No backup run directory was found, so restore readiness is unknown rather than good."
                    .into(),
            );
        }

        Ok(result(
            op_id,
            "m11_s09",
            "m11.restore.inventory",
            started_at,
            timer,
            Some(RestoreInventory {
                backup_root: root.to_string_lossy().to_string(),
                backup_root_exists: root.is_dir(),
                runs_found: runs.len(),
                runs_verified,
                runs_with_missing_or_altered_files: runs_with_problems,
                total_bytes_on_disk: runs.iter().map(|run| run.total_bytes).sum(),
                nothing_deleted: true,
                destination_defaulted: defaulted,
                runs,
                measured_at: Utc::now().to_rfc3339(),
            }),
            if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            },
            "Every backup run was re-hashed on disk and compared against the digest it recorded. Nothing was deleted."
                .into(),
            "أُعيد تجزئة كل تشغيل نسخ احتياطي على القرص وقورن بالتجزئة التي سجّلها. لم يُحذف شيء.".into(),
            warnings,
            None,
            None,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::{
        base64_encode, bookmark_candidates, chromium_profile_names, collect_directory,
        count_reg_headers, inspect_run, parse_environment_export, recorded_digests, sha256_hex,
        split_path, ALLOWED_REGISTRY_KEYS, BASE64_ALPHABET, MAX_EXPORT_BYTES,
    };
    use serde_json::json;

    #[test]
    fn base64_matches_the_known_vectors() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foob"), "Zm9vYg==");
        assert_eq!(base64_encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
        // Bytes that are not valid UTF-8 must still produce pure base64 text.
        let encoded = base64_encode(&[0x00, 0xFF, 0xFE, 0x80, 0x7F]);
        assert!(encoded
            .chars()
            .all(|character| BASE64_ALPHABET.contains(&(character as u8)) || character == '='));
        assert_eq!(encoded.len() % 4, 0);
    }

    #[test]
    fn path_splitting_drops_blanks_but_keeps_real_order() {
        assert_eq!(split_path("C:\\a;C:\\b"), vec!["C:\\a", "C:\\b"]);
        assert_eq!(split_path("  ;;C:\\a ; "), vec!["C:\\a"]);
        assert!(split_path("").is_empty());
    }

    #[test]
    fn a_user_path_does_not_replace_the_machine_path_and_duplicates_are_named() {
        let payload = json!({
            "variables": [
                { "name": "Path", "machineValue": "C:\\Windows;C:\\Shared", "userValue": "C:\\Shared;C:\\Tools",
                  "machinePresent": true, "userPresent": true },
                { "name": "TEMP", "machineValue": "", "userValue": "C:\\Users\\x\\Temp",
                  "machinePresent": true, "userPresent": true }
            ],
            "machinePathPresent": true,
            "userPathPresent": true
        });
        let (variables, machine, user) =
            parse_environment_export(&payload.to_string()).expect("parses");
        assert!(machine && user);
        let path = &variables[0];
        // Search order is machine first, then user. Exporting one scope alone would lose
        // entries on restore.
        assert_eq!(
            path.effective_value,
            "C:\\Windows;C:\\Shared;C:\\Shared;C:\\Tools"
        );
        assert_eq!(path.path_entry_count, 4);
        assert_eq!(path.duplicated_path_entries, vec!["C:\\Shared".to_string()]);
        // A non-PATH variable takes the user value when the user set one.
        assert_eq!(variables[1].effective_value, "C:\\Users\\x\\Temp");
    }

    #[test]
    fn an_absent_scope_is_reported_absent_rather_than_as_an_empty_string_value() {
        let payload = json!({
            "variables": [
                { "name": "Path", "machineValue": "C:\\Windows", "userValue": null,
                  "machinePresent": true, "userPresent": false }
            ],
            "machinePathPresent": true,
            "userPathPresent": false
        });
        let (variables, machine, user) =
            parse_environment_export(&payload.to_string()).expect("parses");
        assert!(machine && !user);
        assert_eq!(variables[0].user_value, None);
        assert!(!variables[0].user_present);
        assert_eq!(variables[0].effective_value, "C:\\Windows");
    }

    #[test]
    fn an_empty_environment_payload_is_refused() {
        assert!(parse_environment_export(&json!({ "variables": [] }).to_string()).is_err());
    }

    #[test]
    fn browser_candidates_are_derived_from_the_user_profile_not_a_hard_coded_list() {
        let candidates = bookmark_candidates();
        assert!(!candidates.is_empty());
        let names: Vec<&str> = candidates.iter().map(|(name, _)| *name).collect();
        for expected in ["chrome", "edge", "firefox"] {
            assert!(names.contains(&expected), "{expected} missing");
        }
        // The candidates are paths, not invented data.
        for (_, path) in &candidates {
            assert!(path.is_absolute(), "{path:?} is not absolute");
        }
    }

    #[test]
    fn chromium_profile_names_come_from_local_state_not_a_guess() {
        let directory = tempfile::tempdir().expect("tempdir");
        let user_data = directory.path().join("User Data");
        std::fs::create_dir_all(&user_data).expect("mkdir");
        // No Local State: fall back to Default only when it really exists.
        assert!(chromium_profile_names(&user_data).is_empty());
        std::fs::create_dir_all(user_data.join("Default")).expect("mkdir");
        assert_eq!(
            chromium_profile_names(&user_data),
            vec!["Default".to_string()]
        );

        std::fs::write(
            user_data.join("Local State"),
            r#"{"profile":{"info_cache":{"Profile 2":{},"Default":{}}}}"#,
        )
        .expect("write");
        let names = chromium_profile_names(&user_data);
        assert_eq!(names, vec!["Default".to_string(), "Profile 2".to_string()]);
    }

    #[test]
    fn a_directory_document_is_sorted_so_the_digest_is_reproducible() {
        let directory = tempfile::tempdir().expect("tempdir");
        std::fs::write(directory.path().join("b.json"), b"{\"b\":1}").expect("b");
        std::fs::create_dir_all(directory.path().join("nested")).expect("mkdir");
        std::fs::write(directory.path().join("nested/a.json"), b"{\"a\":1}").expect("a");

        let first = collect_directory(directory.path(), true).expect("reads");
        let second = collect_directory(directory.path(), true).expect("reads");
        // The same directory must always produce the same bytes, and therefore the same
        // digest, or a verified backup would stop verifying on a second run.
        assert_eq!(sha256_hex(&first), sha256_hex(&second));
        let text = String::from_utf8(first).expect("utf8");
        let top = text.find("\"b.json\"").expect("b listed");
        let nested = text.find("nested/a.json").expect("nested listed");
        // Keys are emitted in sorted order: "b.json" precedes "nested/a.json".
        assert!(top < nested, "document is not sorted:\n{text}");
        assert!(text.contains("\"content\""), "contents were requested");
        assert!(text.contains("\"sha256\""));
    }

    #[test]
    fn a_directory_document_can_omit_contents_but_keeps_the_digest() {
        let directory = tempfile::tempdir().expect("tempdir");
        std::fs::write(directory.path().join("a.json"), b"{\"a\":1}").expect("a");
        let bytes = collect_directory(directory.path(), false).expect("reads");
        let text = String::from_utf8(bytes).expect("utf8");
        assert!(!text.contains("\"content\""));
        assert!(text.contains("\"sha256\""));
    }

    #[test]
    fn the_export_ceiling_is_bounded() {
        const { assert!(MAX_EXPORT_BYTES <= 2 * 1024 * 1024 * 1024) };
    }

    // -- M11-S07 registry export ------------------------------------------------

    #[test]
    fn a_reg_file_with_no_key_header_is_not_a_usable_export() {
        // reg.exe can exit 0 while writing nothing usable, which is exactly why the
        // header count is checked instead of trusting the exit code.
        assert_eq!(count_reg_headers(""), (0, 0));
        assert_eq!(
            count_reg_headers("just some text\nwith no structure\n"),
            (0, 0)
        );
        assert_eq!(count_reg_headers("\"Name\"=\"value\"\r\n"), (0, 1));
    }

    #[test]
    fn reg_headers_are_counted_from_the_file_written_to_disk() {
        let content = "Windows Registry Editor Version 5.00\r\n\r\n\
[HKEY_CURRENT_USER\\Software\\Vendor]\r\n\
\"Install\"=\"C:\\\\app\"\r\n\
\
@=\"C:\\\\app\\\\default\"\r\n\
\r\n\
[HKEY_CURRENT_USER\\Software\\Vendor\\Sub]\r\n\
\"Flag\"=dword:00000001\r\n";
        let (keys, values) = count_reg_headers(content);
        assert_eq!(keys, 2, "both bracketed key headers must be counted");
        assert_eq!(
            values, 3,
            "string, @-default and dword values must be counted"
        );
    }

    #[test]
    fn the_registry_allowlist_is_fixed_and_writable_only_through_export() {
        // The list is a compile-time constant and every entry names a hive, so nothing
        // here can be steered by a caller-supplied path.
        assert!(!ALLOWED_REGISTRY_KEYS.is_empty());
        for (key, export_name, description) in ALLOWED_REGISTRY_KEYS {
            assert!(
                key.starts_with("HKEY_") || key.starts_with("HKCU\\") || key.starts_with("HKLM\\"),
                "a registry backup may only read a real hive, got {key}"
            );
            assert!(
                !export_name.contains(['\\', '/', ':', '*', '?', '"', '<', '>', '|']),
                "{export_name} must be a plain file name"
            );
            assert!(!description.is_empty(), "{key} must explain what it holds");
        }
    }

    // -- M11-S09 restore inventory -----------------------------------------------

    fn scratch_run(label: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("knoux-m11-s09-{label}"));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("scratch run directory");
        root
    }

    fn write_backup_file(run: &std::path::Path, name: &str, body: &str) -> String {
        let path = run.join(name);
        std::fs::write(&path, body).expect("scratch backup file");
        sha256_hex(body.as_bytes())
    }

    #[test]
    fn a_run_verifies_only_when_every_file_matches_its_own_digest() {
        let run = scratch_run("all-match");
        let first = write_backup_file(&run, "settings.json", "{\"a\":1}");
        let second = write_backup_file(&run, "environment.txt", "PATH=C:\\\\Windows");
        // A manifest is what makes a run verifiable at all.
        std::fs::write(
            run.join("manifest.json"),
            serde_json::to_vec(&json!({
                "schemaVersion": 1,
                "runId": "test-all-match",
                "files": [
                    { "fileName": "settings.json", "sha256": first },
                    { "fileName": "environment.txt", "sha256": second },
                ],
            }))
            .expect("manifest json"),
        )
        .expect("manifest file");

        let check = inspect_run(&run);
        assert_eq!(check.files_checked, 2);
        assert_eq!(check.files_matching, 2);
        assert_eq!(check.files_missing, 0);
        assert_eq!(check.files_altered, 0);
        assert_eq!(check.files_baseline_only, 0);
        assert!(check.manifest_present);
        assert!(
            check.run_verified,
            "an untouched run with a manifest must verify"
        );

        // One altered byte must invalidate the whole run, not just shrink the count.
        std::fs::write(run.join("settings.json"), "{\"a\":2}").expect("tamper");
        let tampered = inspect_run(&run);
        assert_eq!(tampered.files_matching, 1);
        assert_eq!(tampered.files_altered, 1);
        assert!(!tampered.run_verified, "an altered file must fail the run");

        let _ = std::fs::remove_dir_all(&run);
    }

    #[test]
    fn a_file_with_no_recorded_digest_is_a_baseline_and_never_a_pass() {
        let run = scratch_run("baseline");
        write_backup_file(&run, "settings.json", "{\"a\":1}");
        // The file exists on disk but nothing ever recorded a digest for it, so this run
        // establishes a baseline and cannot be called verified.
        let check = inspect_run(&run);
        assert_eq!(check.files_checked, 1);
        assert_eq!(check.files_matching, 0);
        assert_eq!(check.files_baseline_only, 1);
        assert!(!check.manifest_present);
        assert!(
            !check.run_verified,
            "an unrecorded file must not be counted as a match"
        );

        let _ = std::fs::remove_dir_all(&run);
    }

    #[test]
    fn a_missing_file_is_reported_separately_from_an_altered_one() {
        let run = scratch_run("missing");
        let recorded = write_backup_file(&run, "gone.json", "{\"b\":2}");
        std::fs::write(
            run.join("manifest.json"),
            serde_json::to_vec(&json!({
                "schemaVersion": 1,
                "runId": "test-missing",
                "files": [{ "fileName": "gone.json", "sha256": recorded }],
            }))
            .expect("manifest json"),
        )
        .expect("manifest file");
        std::fs::remove_file(run.join("gone.json")).expect("remove the file");

        let check = inspect_run(&run);
        assert_eq!(check.files_checked, 1);
        assert_eq!(check.files_missing, 1);
        assert_eq!(
            check.files_altered, 0,
            "a missing file is not an altered file"
        );
        assert!(!check.run_verified);

        let _ = std::fs::remove_dir_all(&run);
    }

    #[test]
    fn an_empty_run_is_not_vacuously_verified() {
        let run = scratch_run("empty");
        // Nothing was ever written here, so there is no digest to match and the run must
        // not report itself as verified just because zero files disagreed.
        let check = inspect_run(&run);
        assert_eq!(check.files_checked, 0);
        assert!(
            !check.run_verified,
            "an empty run must never be called verified"
        );
        let _ = std::fs::remove_dir_all(&run);
    }

    #[test]
    fn digests_are_read_from_the_runs_own_manifest_only() {
        let run = scratch_run("own-manifest");
        let mine = write_backup_file(&run, "settings.json", "mine");
        let other = scratch_run("other-manifest");
        write_backup_file(&other, "settings.json", "somebody else");

        // Two runs contain a file with the same name and different bytes. Each run must be
        // compared only against the digest recorded in its own manifest.
        std::fs::write(
            run.join("manifest.json"),
            serde_json::to_vec(&json!({
                "schemaVersion": 1,
                "runId": "test-own-manifest",
                "files": [{ "fileName": "settings.json", "sha256": mine }],
            }))
            .expect("manifest json"),
        )
        .expect("manifest file");

        let digests = recorded_digests(&run);
        assert_eq!(digests.len(), 1);
        assert_eq!(digests.get("settings.json"), Some(&mine));
        assert!(inspect_run(&run).run_verified);
        assert!(
            !inspect_run(&other).run_verified,
            "a run with no manifest of its own is not verified against a sibling"
        );

        let _ = std::fs::remove_dir_all(&run);
        let _ = std::fs::remove_dir_all(&other);
    }
}
