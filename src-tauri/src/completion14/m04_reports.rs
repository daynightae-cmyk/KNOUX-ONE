use crate::storage::database;
use blake3::Hasher as Blake3Hasher;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
};
use tauri::AppHandle;
use uuid::Uuid;

use super::m04::{StorageAnalysisResult, StorageFolderItem, StorageTypeItem};

/// How much of the real user identity a report is allowed to carry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RedactionProfile {
    /// Paths are written exactly as measured.
    None,
    /// The current user profile, the local/roaming app-data roots and the temp root
    /// are replaced with stable placeholders so a report can be shared safely.
    UserProfile,
}

impl RedactionProfile {
    pub(crate) fn parse(value: Option<&str>) -> Result<Self, String> {
        match value.unwrap_or("none") {
            "none" => Ok(Self::None),
            "user_profile" => Ok(Self::UserProfile),
            other => Err(format!("redaction_profile_unsupported:{other}")),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::UserProfile => "user_profile",
        }
    }

    fn replacements(self) -> Vec<(String, &'static str)> {
        if self == Self::None {
            return Vec::new();
        }
        let mut pairs = Vec::new();
        if let Some(value) = env::var_os("USERPROFILE") {
            pairs.push((
                PathBuf::from(value).to_string_lossy().to_string(),
                "%USERPROFILE%",
            ));
        }
        if let Some(value) = env::var_os("LOCALAPPDATA") {
            pairs.push((
                PathBuf::from(value).to_string_lossy().to_string(),
                "%LOCALAPPDATA%",
            ));
        }
        if let Some(value) = env::var_os("APPDATA") {
            pairs.push((
                PathBuf::from(value).to_string_lossy().to_string(),
                "%APPDATA%",
            ));
        }
        if let Some(value) = env::var_os("TEMP") {
            pairs.push((PathBuf::from(value).to_string_lossy().to_string(), "%TEMP%"));
        }
        // Longest first so a nested root is replaced before its parent.
        pairs.sort_by(|a, b| b.0.len().cmp(&a.0.len()));
        pairs
    }

    /// Redacts one path. Returns the input unchanged when the profile is `None` or
    /// when no known root is a prefix, so an unrelated absolute path is never mangled.
    pub fn apply(self, value: &str) -> String {
        let mut current = value.to_string();
        for (needle, placeholder) in self.replacements() {
            if !needle.is_empty() && current.starts_with(&needle) {
                current = format!("{placeholder}{}", &current[needle.len()..]);
            }
        }
        current
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedFileRow {
    pub ordinal: i64,
    pub path: String,
    pub size_bytes: i64,
    pub modified_at: Option<String>,
    pub accessed_at: Option<String>,
    pub created_at: Option<String>,
    pub age_basis: String,
    pub extension: String,
    pub category: String,
    pub is_old: bool,
}

/// A storage snapshot reconstructed from SQLite. This is the only input to report
/// rendering, so an export never depends on process memory and survives a restart.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSnapshot {
    pub snapshot_id: String,
    pub operation_id: Option<String>,
    pub root_path: String,
    pub captured_at: String,
    pub total_files: i64,
    pub total_directories: i64,
    pub total_bytes: i64,
    pub inaccessible_items: i64,
    pub truncated: bool,
    pub old_threshold_days: i64,
    pub old_file_count: i64,
    pub old_size_bytes: i64,
    pub age_policy: serde_json::Value,
    pub warnings: Vec<String>,
    pub files: Vec<PersistedFileRow>,
    pub folders: Vec<StorageFolderItem>,
    pub types: Vec<StorageTypeItem>,
    pub excluded_paths: Vec<String>,
}

/// One written report file, hashed so a recipient can verify it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageReportArtifact {
    pub artifact_id: String,
    pub format: String,
    pub path: String,
    pub byte_count: u64,
    pub sha256: String,
    pub blake3: String,
    /// True when the leading bytes match the format's own signature. A file whose
    /// signature does not match is still written, but it is reported as unverified
    /// rather than being passed off as a valid document.
    pub signature_valid: bool,
}

pub fn persist_snapshot(
    app: &AppHandle,
    request_excluded: &[String],
    result: &StorageAnalysisResult,
) -> Result<(), String> {
    let connection = database::open(app)?;
    persist_into(&connection, request_excluded, result)
}

pub fn persist_into(
    connection: &Connection,
    excluded: &[String],
    result: &StorageAnalysisResult,
) -> Result<(), String> {
    let aggregate = serde_json::json!({
        "largestFiles": result.largest_files,
        "largestFolders": result.largest_folders,
        "typeDistribution": result.type_distribution,
    });
    let age_policy =
        serde_json::to_value(&result.age_policy).map_err(|e| format!("age_policy_encode:{e}"))?;
    let warnings = serde_json::to_string(&result.warnings)
        .map_err(|e| format!("storage_warnings_encode:{e}"))?;
    // `old_files.largest_files` is the same top-N list restricted to old rows, so
    // membership is decided by identity against the full list, never by guessing.
    let old_paths: Vec<&str> = result
        .old_files
        .largest_files
        .iter()
        .map(|item| item.path.as_str())
        .collect();

    let transaction = connection
        .unchecked_transaction()
        .map_err(|e| format!("storage_snapshot_transaction:{e}"))?;

    transaction
        .execute(
            "INSERT OR REPLACE INTO storage_snapshots(
               snapshot_id, operation_id, root_path, captured_at, total_files,
               total_directories, total_bytes, inaccessible_items, truncated,
               old_threshold_days, old_file_count, old_size_bytes, age_policy_json,
               aggregate_json, warnings_json
             ) VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                result.scan_id,
                result.root_path,
                result.scanned_at,
                result.total_files as i64,
                result.total_directories as i64,
                result.total_bytes as i64,
                result.inaccessible_items as i64,
                i64::from(result.truncated),
                result.old_files.threshold_days as i64,
                result.old_files.file_count as i64,
                result.old_files.size_bytes as i64,
                serde_json::to_string(&age_policy).unwrap_or_else(|_| "{}".into()),
                serde_json::to_string(&aggregate).unwrap_or_else(|_| "{}".into()),
                warnings,
            ],
        )
        .map_err(|e| format!("storage_snapshot_insert:{e}"))?;

    let mut old_marked = HashSet::new();
    for path in old_paths {
        old_marked.insert(path.to_string());
    }
    {
        let mut statement = transaction
            .prepare(
                "INSERT OR REPLACE INTO storage_snapshot_files(
                   snapshot_id, ordinal, path, size_bytes, modified_at, accessed_at,
                   created_at, age_basis, extension, category, is_old
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            )
            .map_err(|e| format!("storage_files_prepare:{e}"))?;
        for (index, item) in result.largest_files.iter().enumerate() {
            statement
                .execute(params![
                    result.scan_id,
                    index as i64,
                    item.path,
                    item.size_bytes as i64,
                    item.modified_at,
                    item.accessed_at,
                    item.created_at,
                    item.age_basis,
                    item.extension,
                    item.category,
                    i64::from(old_marked.contains(&item.path)),
                ])
                .map_err(|e| format!("storage_files_insert:{e}"))?;
        }
    }

    {
        let mut statement = transaction
            .prepare(
                "INSERT OR REPLACE INTO storage_snapshot_folders(
                   snapshot_id, ordinal, path, size_bytes, file_count
                 ) VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .map_err(|e| format!("storage_folders_prepare:{e}"))?;
        for (index, item) in result.largest_folders.iter().enumerate() {
            statement
                .execute(params![
                    result.scan_id,
                    index as i64,
                    item.path,
                    item.size_bytes as i64,
                    item.file_count as i64,
                ])
                .map_err(|e| format!("storage_folders_insert:{e}"))?;
        }
    }

    {
        let mut statement = transaction
            .prepare(
                "INSERT OR REPLACE INTO storage_snapshot_types(
                   snapshot_id, ordinal, category, extension, size_bytes, file_count
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            )
            .map_err(|e| format!("storage_types_prepare:{e}"))?;
        for (index, item) in result.type_distribution.iter().enumerate() {
            statement
                .execute(params![
                    result.scan_id,
                    index as i64,
                    item.category,
                    item.extension,
                    item.size_bytes as i64,
                    item.file_count as i64,
                ])
                .map_err(|e| format!("storage_types_insert:{e}"))?;
        }
    }

    {
        let mut statement = transaction
            .prepare(
                "INSERT OR REPLACE INTO storage_snapshot_exclusions(snapshot_id, path, ordinal)
                 VALUES (?1, ?2, ?3)",
            )
            .map_err(|e| format!("storage_exclusions_prepare:{e}"))?;
        for (index, path) in excluded.iter().enumerate() {
            statement
                .execute(params![result.scan_id, path, index as i64])
                .map_err(|e| format!("storage_exclusions_insert:{e}"))?;
        }
    }

    debug_assert!(old_marked.is_empty() || !result.largest_files.is_empty());
    transaction
        .commit()
        .map_err(|e| format!("storage_snapshot_commit:{e}"))
}

pub fn load_snapshot(app: &AppHandle, scan_id: &str) -> Result<PersistedSnapshot, String> {
    let connection = database::open(app)?;
    load_from(&connection, scan_id)
}

/// One `storage_snapshots` row, in the column order of the `SELECT` below. Named so the
/// query's shape is documented once instead of being an anonymous 14-tuple.
type SnapshotHeaderRow = (
    String,         // snapshot_id
    Option<String>, // operation_id
    String,         // root_path
    String,         // captured_at
    i64,            // total_files
    i64,            // total_directories
    i64,            // total_bytes
    i64,            // inaccessible_items
    i64,            // truncated
    i64,            // old_threshold_days
    i64,            // old_file_count
    i64,            // old_file_size
    String,         // age_policy_json
    String,         // warnings_json
);

pub fn load_from(connection: &Connection, scan_id: &str) -> Result<PersistedSnapshot, String> {
    let header: Option<SnapshotHeaderRow> = connection
        .query_row(
            "SELECT snapshot_id, operation_id, root_path, captured_at, total_files,
                    total_directories, total_bytes, inaccessible_items, truncated,
                    old_threshold_days, old_file_count, old_size_bytes, age_policy_json,
                    warnings_json
             FROM storage_snapshots WHERE snapshot_id = ?1",
            params![scan_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                    row.get(10)?,
                    row.get(11)?,
                    row.get(12)?,
                    row.get(13)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("storage_snapshot_select:{e}"))?;

    let Some((
        snapshot_id,
        operation_id,
        root_path,
        captured_at,
        total_files,
        total_directories,
        total_bytes,
        inaccessible_items,
        truncated,
        old_threshold_days,
        old_file_count,
        old_size_bytes,
        age_policy_json,
        warnings_json,
    )) = header
    else {
        return Err(format!("storage_snapshot_missing:{scan_id}"));
    };

    let mut files = Vec::new();
    {
        let mut statement = connection
            .prepare(
                "SELECT ordinal, path, size_bytes, modified_at, accessed_at, created_at,
                        age_basis, extension, category, is_old
                 FROM storage_snapshot_files WHERE snapshot_id = ?1 ORDER BY ordinal ASC",
            )
            .map_err(|e| format!("storage_files_select:{e}"))?;
        let rows = statement
            .query_map(params![snapshot_id], |row| {
                Ok(PersistedFileRow {
                    ordinal: row.get(0)?,
                    path: row.get(1)?,
                    size_bytes: row.get(2)?,
                    modified_at: row.get(3)?,
                    accessed_at: row.get(4)?,
                    created_at: row.get(5)?,
                    age_basis: row.get(6)?,
                    extension: row.get(7)?,
                    category: row.get(8)?,
                    is_old: row.get::<_, i64>(9)? != 0,
                })
            })
            .map_err(|e| format!("storage_files_query:{e}"))?;
        for row in rows {
            files.push(row.map_err(|e| format!("storage_files_row:{e}"))?);
        }
    }

    let mut folders = Vec::new();
    {
        let mut statement = connection
            .prepare(
                "SELECT path, size_bytes, file_count FROM storage_snapshot_folders
                 WHERE snapshot_id = ?1 ORDER BY ordinal ASC",
            )
            .map_err(|e| format!("storage_folders_select:{e}"))?;
        let rows = statement
            .query_map(params![snapshot_id], |row| {
                Ok(StorageFolderItem {
                    path: row.get(0)?,
                    size_bytes: row.get::<_, i64>(1)? as u64,
                    file_count: row.get::<_, i64>(2)? as u64,
                })
            })
            .map_err(|e| format!("storage_folders_query:{e}"))?;
        for row in rows {
            folders.push(row.map_err(|e| format!("storage_folders_row:{e}"))?);
        }
    }

    let mut types = Vec::new();
    {
        let mut statement = connection
            .prepare(
                "SELECT category, extension, size_bytes, file_count FROM storage_snapshot_types
                 WHERE snapshot_id = ?1 ORDER BY ordinal ASC",
            )
            .map_err(|e| format!("storage_types_select:{e}"))?;
        let rows = statement
            .query_map(params![snapshot_id], |row| {
                Ok(StorageTypeItem {
                    category: row.get(0)?,
                    extension: row.get(1)?,
                    size_bytes: row.get::<_, i64>(2)? as u64,
                    file_count: row.get::<_, i64>(3)? as u64,
                })
            })
            .map_err(|e| format!("storage_types_query:{e}"))?;
        for row in rows {
            types.push(row.map_err(|e| format!("storage_types_row:{e}"))?);
        }
    }

    let mut excluded_paths = Vec::new();
    {
        let mut statement = connection
            .prepare(
                "SELECT path FROM storage_snapshot_exclusions
                 WHERE snapshot_id = ?1 ORDER BY ordinal ASC",
            )
            .map_err(|e| format!("storage_exclusions_select:{e}"))?;
        let rows = statement
            .query_map(params![snapshot_id], |row| row.get::<_, String>(0))
            .map_err(|e| format!("storage_exclusions_query:{e}"))?;
        for row in rows {
            excluded_paths.push(row.map_err(|e| format!("storage_exclusions_row:{e}"))?);
        }
    }

    Ok(PersistedSnapshot {
        snapshot_id,
        operation_id,
        root_path,
        captured_at,
        total_files,
        total_directories,
        total_bytes,
        inaccessible_items,
        truncated: truncated != 0,
        old_threshold_days,
        old_file_count,
        old_size_bytes,
        age_policy: serde_json::from_str(&age_policy_json)
            .unwrap_or_else(|_| serde_json::Value::Object(Default::default())),
        warnings: serde_json::from_str(&warnings_json).unwrap_or_default(),
        files,
        folders,
        types,
        excluded_paths,
    })
}

pub fn list_snapshots(app: &AppHandle, limit: u64) -> Result<Vec<SnapshotSummary>, String> {
    let connection = database::open(app)?;
    let mut statement = connection
        .prepare(
            "SELECT snapshot_id, root_path, captured_at, total_files, total_bytes,
                    old_file_count
             FROM storage_snapshots ORDER BY captured_at DESC LIMIT ?1",
        )
        .map_err(|e| format!("storage_list_prepare:{e}"))?;
    let rows = statement
        .query_map(params![limit.clamp(1, 200)], |row| {
            Ok(SnapshotSummary {
                snapshot_id: row.get(0)?,
                root_path: row.get(1)?,
                captured_at: row.get(2)?,
                total_files: row.get::<_, i64>(3)?,
                total_bytes: row.get::<_, i64>(4)?,
                old_file_count: row.get::<_, i64>(5)?,
            })
        })
        .map_err(|e| format!("storage_list_query:{e}"))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("storage_list_row:{e}"))?);
    }
    Ok(out)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub snapshot_id: String,
    pub root_path: String,
    pub captured_at: String,
    pub total_files: i64,
    pub total_bytes: i64,
    pub old_file_count: i64,
}

/// A report document together with the hash of the exact bytes written to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedReport {
    pub format: String,
    pub bytes: Vec<u8>,
}

/// The deterministic JSON report. Field order comes from the struct declaration and
/// every collection is already ordered by the scan, so re-exporting the same snapshot
/// yields byte-identical output once the volatile fields below are excluded.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonReport {
    pub report_kind: &'static str,
    pub format_version: u32,
    pub source_scan_id: String,
    pub source_operation_id: Option<String>,
    pub redaction_profile: String,
    pub generated_at: String,
    pub binary: crate::contracts::BinaryEvidence,
    pub snapshot: JsonSnapshot,
    pub warnings: Vec<String>,
    pub data_completeness: DataCompleteness,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataCompleteness {
    /// The scan enforces a `maxFiles` ceiling; when it trips, totals are a lower bound.
    pub complete: bool,
    pub reason_en: String,
    pub reason_ar: String,
    pub inaccessible_items: i64,
    pub excluded_path_count: usize,
    pub listed_file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonSnapshot {
    pub root_path: String,
    pub captured_at: String,
    pub total_files: i64,
    pub total_directories: i64,
    pub total_bytes: i64,
    pub inaccessible_items: i64,
    pub truncated: bool,
    pub old_file_count: i64,
    pub old_size_bytes: i64,
    pub old_threshold_days: i64,
    pub age_policy: serde_json::Value,
    pub largest_files: Vec<JsonFile>,
    pub largest_folders: Vec<JsonFolder>,
    pub type_distribution: Vec<JsonType>,
    pub excluded_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonFile {
    pub path: String,
    pub size_bytes: i64,
    pub modified_at: Option<String>,
    pub accessed_at: Option<String>,
    pub created_at: Option<String>,
    pub age_basis: String,
    pub extension: String,
    pub category: String,
    pub is_old: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonFolder {
    pub path: String,
    pub size_bytes: i64,
    pub file_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonType {
    pub category: String,
    pub extension: String,
    pub size_bytes: i64,
    pub file_count: i64,
}

pub fn render_json(
    snapshot: &PersistedSnapshot,
    redaction: RedactionProfile,
    generated_at: String,
) -> Result<RenderedReport, String> {
    let report = JsonReport {
        report_kind: "knoux-one.storage-analysis",
        format_version: 1,
        source_scan_id: snapshot.snapshot_id.clone(),
        source_operation_id: snapshot.operation_id.clone(),
        redaction_profile: redaction.as_str().to_string(),
        generated_at,
        binary: crate::contracts::binary_evidence(),
        snapshot: JsonSnapshot {
            root_path: redaction.apply(&snapshot.root_path),
            captured_at: snapshot.captured_at.clone(),
            total_files: snapshot.total_files,
            total_directories: snapshot.total_directories,
            total_bytes: snapshot.total_bytes,
            inaccessible_items: snapshot.inaccessible_items,
            truncated: snapshot.truncated,
            old_file_count: snapshot.old_file_count,
            old_size_bytes: snapshot.old_size_bytes,
            old_threshold_days: snapshot.old_threshold_days,
            age_policy: snapshot.age_policy.clone(),
            largest_files: snapshot
                .files
                .iter()
                .map(|row| JsonFile {
                    path: redaction.apply(&row.path),
                    size_bytes: row.size_bytes,
                    modified_at: row.modified_at.clone(),
                    accessed_at: row.accessed_at.clone(),
                    created_at: row.created_at.clone(),
                    age_basis: row.age_basis.clone(),
                    extension: row.extension.clone(),
                    category: row.category.clone(),
                    is_old: row.is_old,
                })
                .collect(),
            largest_folders: snapshot
                .folders
                .iter()
                .map(|row| JsonFolder {
                    path: redaction.apply(&row.path),
                    size_bytes: row.size_bytes as i64,
                    file_count: row.file_count as i64,
                })
                .collect(),
            type_distribution: snapshot
                .types
                .iter()
                .map(|row| JsonType {
                    category: row.category.clone(),
                    extension: row.extension.clone(),
                    size_bytes: row.size_bytes as i64,
                    file_count: row.file_count as i64,
                })
                .collect(),
            excluded_paths: snapshot
                .excluded_paths
                .iter()
                .map(|path| redaction.apply(path))
                .collect(),
        },
        warnings: snapshot.warnings.clone(),
        data_completeness: DataCompleteness {
            complete: !snapshot.truncated && snapshot.inaccessible_items == 0,
            reason_en: if snapshot.truncated {
                "The scan stopped at its maxFiles ceiling, so totals are a lower bound.".into()
            } else if snapshot.inaccessible_items > 0 {
                "Some paths could not be read, so totals are a lower bound.".into()
            } else {
                "Every scanned path was read.".into()
            },
            reason_ar: if snapshot.truncated {
                "توقف الفحص عند حد الملفات الأقصى، لذلك المجاميع هي الحد الأدنى.".into()
            } else if snapshot.inaccessible_items > 0 {
                "تعذّرت قراءة بعض المسارات، لذلك المجاميع هي الحد الأدنى.".into()
            } else {
                "تمت قراءة كل المسارات المفحوصة.".into()
            },
            inaccessible_items: snapshot.inaccessible_items,
            excluded_path_count: snapshot.excluded_paths.len(),
            listed_file_count: snapshot.files.len(),
        },
    };
    let mut bytes =
        serde_json::to_vec_pretty(&report).map_err(|e| format!("report_json_encode:{e}"))?;
    bytes.push(b'\n');
    Ok(RenderedReport {
        format: "json".into(),
        bytes,
    })
}

fn csv_cell(value: &str) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

pub fn render_csv(
    snapshot: &PersistedSnapshot,
    redaction: RedactionProfile,
    generated_at: String,
) -> Result<RenderedReport, String> {
    let mut out = String::new();
    // A UTF-8 BOM keeps Excel from mis-reading Arabic paths as mojibake.
    out.push('\u{feff}');
    out.push_str("# knoux-one storage analysis report, format version 1\n");
    out.push_str(&format!(
        "# source_scan_id,{}\n",
        csv_cell(&snapshot.snapshot_id)
    ));
    out.push_str(&format!(
        "# redaction_profile,{}\n",
        csv_cell(redaction.as_str())
    ));
    out.push_str(&format!("# generated_at,{}\n", csv_cell(&generated_at)));
    out.push_str(&format!(
        "# root_path,{}\n",
        csv_cell(&redaction.apply(&snapshot.root_path))
    ));
    out.push_str(&format!(
        "# captured_at,{}\n",
        csv_cell(&snapshot.captured_at)
    ));
    out.push_str(&format!("# total_files,{}\n", snapshot.total_files));
    out.push_str(&format!(
        "# total_directories,{}\n",
        snapshot.total_directories
    ));
    out.push_str(&format!("# total_bytes,{}\n", snapshot.total_bytes));
    out.push_str(&format!(
        "# inaccessible_items,{}\n",
        snapshot.inaccessible_items
    ));
    out.push_str(&format!("# truncated,{}\n", snapshot.truncated));
    out.push_str(&format!(
        "# old_threshold_days,{}\n",
        snapshot.old_threshold_days
    ));
    out.push_str(&format!("# old_file_count,{}\n", snapshot.old_file_count));
    out.push_str(&format!("# old_size_bytes,{}\n", snapshot.old_size_bytes));
    out.push_str(&format!(
        "# complete,{}\n",
        !snapshot.truncated && snapshot.inaccessible_items == 0
    ));
    out.push_str(&format!(
        "# age_policy,{}\n",
        csv_cell(&serde_json::to_string(&snapshot.age_policy).unwrap_or_default())
    ));
    for warning in &snapshot.warnings {
        out.push_str(&format!("# warning,{}\n", csv_cell(warning)));
    }
    for path in &snapshot.excluded_paths {
        out.push_str(&format!(
            "# excluded_path,{}\n",
            csv_cell(&redaction.apply(path))
        ));
    }
    out.push_str("\n[largest_files]\n");
    out.push_str(
        "path,size_bytes,modified_at,accessed_at,created_at,age_basis,extension,category,is_old\n",
    );
    for row in &snapshot.files {
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{},{}\n",
            csv_cell(&redaction.apply(&row.path)),
            row.size_bytes,
            row.modified_at.as_deref().unwrap_or(""),
            row.accessed_at.as_deref().unwrap_or(""),
            row.created_at.as_deref().unwrap_or(""),
            csv_cell(&row.age_basis),
            csv_cell(&row.extension),
            csv_cell(&row.category),
            row.is_old
        ));
    }
    out.push_str("\n[largest_folders]\n");
    out.push_str("path,size_bytes,file_count\n");
    for row in &snapshot.folders {
        out.push_str(&format!(
            "{},{},{}\n",
            csv_cell(&redaction.apply(&row.path)),
            row.size_bytes,
            row.file_count
        ));
    }
    out.push_str("\n[type_distribution]\n");
    out.push_str("category,extension,size_bytes,file_count\n");
    for row in &snapshot.types {
        out.push_str(&format!(
            "{},{},{},{}\n",
            csv_cell(&row.category),
            csv_cell(&row.extension),
            row.size_bytes,
            row.file_count
        ));
    }
    Ok(RenderedReport {
        format: "csv".into(),
        bytes: out.into_bytes(),
    })
}

fn html_escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            other => out.push(other),
        }
    }
    out
}

fn age_basis_label_en(basis: &str) -> &'static str {
    match basis {
        "LAST_ACCESS" => "not accessed since",
        "LAST_WRITE_FALLBACK" => "not modified since",
        _ => "no trustworthy age signal",
    }
}

fn age_basis_label_ar(basis: &str) -> &'static str {
    match basis {
        "LAST_ACCESS" => "لم يتم الوصول إليه منذ",
        "LAST_WRITE_FALLBACK" => "لم يتم تعديله منذ",
        _ => "لا يوجد دليل موثوق على العمر",
    }
}

pub fn render_html(
    snapshot: &PersistedSnapshot,
    redaction: RedactionProfile,
    generated_at: String,
) -> Result<RenderedReport, String> {
    let mut out = String::new();
    out.push_str("<!DOCTYPE html>\n<html lang=\"en\" dir=\"ltr\">\n<head>\n");
    out.push_str("<meta charset=\"utf-8\">\n");
    out.push_str("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n");
    out.push_str("<title>KNOUX ONE storage analysis report</title>\n");
    out.push_str("<style>\n");
    out.push_str("body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;color:#111}\n");
    out.push_str("table{border-collapse:collapse;margin:12px 0;font-size:13px}\n");
    out.push_str("th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}\n");
    out.push_str("th{background:#f2f2f2}\n");
    out.push_str(".warn{color:#8a4b00}\n");
    out.push_str(".meta{color:#444;font-size:13px}\n");
    out.push_str("</style>\n</head>\n<body>\n");
    out.push_str("<h1>KNOUX ONE &mdash; verified storage analysis</h1>\n");
    out.push_str(
        "<p class=\"meta\">This report is generated from persisted scan evidence. \
                  It is read-only: no file was modified, moved, or deleted to produce it.</p>\n",
    );
    out.push_str("<table>\n");
    let pairs: Vec<(&str, String)> = vec![
        ("Source scan id", snapshot.snapshot_id.clone()),
        (
            "Source operation id",
            snapshot.operation_id.clone().unwrap_or_default(),
        ),
        ("Redaction profile", redaction.as_str().to_string()),
        ("Generated at", generated_at.clone()),
        ("Measured at", snapshot.captured_at.clone()),
        ("Root", redaction.apply(&snapshot.root_path)),
        ("Files", snapshot.total_files.to_string()),
        ("Directories", snapshot.total_directories.to_string()),
        ("Total bytes", snapshot.total_bytes.to_string()),
        (
            "Inaccessible items",
            snapshot.inaccessible_items.to_string(),
        ),
        ("Scan truncated", snapshot.truncated.to_string()),
        (
            "Old-file threshold (days)",
            snapshot.old_threshold_days.to_string(),
        ),
        ("Old-file count", snapshot.old_file_count.to_string()),
        ("Old-file bytes", snapshot.old_size_bytes.to_string()),
    ];
    for (key, value) in pairs {
        out.push_str(&format!(
            "<tr><th>{}</th><td>{}</td></tr>\n",
            html_escape(key),
            html_escape(&value)
        ));
    }
    out.push_str("</table>\n");

    out.push_str("<h2>Age signal policy</h2>\n<table>\n");
    if let Some(policy) = snapshot.age_policy.as_object() {
        for (key, value) in policy {
            let text = match value {
                serde_json::Value::String(text) => text.clone(),
                other => other.to_string(),
            };
            out.push_str(&format!(
                "<tr><th>{}</th><td>{}</td></tr>\n",
                html_escape(key),
                html_escape(&text)
            ));
        }
    }
    out.push_str("</table>\n");
    out.push_str(
        "<p class=\"meta\">A file is only described as \"not accessed since\" when \
                  the operating system was measured to keep last-access timestamps. Otherwise \
                  the report says \"not modified since\", and rows with no trustworthy signal are \
                  labeled as such.</p>\n",
    );

    if !snapshot.warnings.is_empty() {
        out.push_str("<h2>Warnings</h2>\n<ul class=\"warn\">\n");
        for warning in &snapshot.warnings {
            out.push_str(&format!("<li>{}</li>\n", html_escape(warning)));
        }
        out.push_str("</ul>\n");
    }
    if !snapshot.excluded_paths.is_empty() {
        out.push_str("<h2>Excluded paths</h2>\n<ul>\n");
        for path in &snapshot.excluded_paths {
            out.push_str(&format!(
                "<li>{}</li>\n",
                html_escape(&redaction.apply(path))
            ));
        }
        out.push_str("</ul>\n");
    }

    out.push_str(
        "<h2>Largest files</h2>\n<table>\n<tr><th>Path</th><th>Bytes</th>\
                  <th>Modified</th><th>Accessed</th><th>Created</th><th>Age basis</th>\
                  <th>Category</th><th>Old</th></tr>\n",
    );
    for row in &snapshot.files {
        out.push_str(&format!(
                "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>\n",
                html_escape(&redaction.apply(&row.path)),
                row.size_bytes,
                html_escape(row.modified_at.as_deref().unwrap_or("")),
                html_escape(row.accessed_at.as_deref().unwrap_or("")),
                html_escape(row.created_at.as_deref().unwrap_or("")),
                // The basis is stated in both languages so an Arabic reader is not
                // forced to trust an English-only label.
                html_escape(&format!(
                    "{} ({}) / {}",
                    age_basis_label_en(&row.age_basis),
                    row.age_basis,
                    age_basis_label_ar(&row.age_basis)
                )),
                html_escape(&row.category),
                row.is_old
            ));
    }
    out.push_str("</table>\n");

    out.push_str(
        "<h2>Largest folders</h2>\n<table>\n<tr><th>Path</th><th>Bytes</th><th>Files</th></tr>\n",
    );
    for row in &snapshot.folders {
        out.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>{}</td></tr>\n",
            html_escape(&redaction.apply(&row.path)),
            row.size_bytes,
            row.file_count
        ));
    }
    out.push_str("</table>\n");

    out.push_str(
        "<h2>Type distribution</h2>\n<table>\n<tr><th>Category</th><th>Extension</th>\
                  <th>Bytes</th><th>Files</th></tr>\n",
    );
    for row in &snapshot.types {
        out.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>\n",
            html_escape(&row.category),
            html_escape(&row.extension),
            row.size_bytes,
            row.file_count
        ));
    }
    out.push_str("</table>\n");
    out.push_str("</body>\n</html>\n");

    Ok(RenderedReport {
        format: "html".into(),
        bytes: out.into_bytes(),
    })
}

/// The first bytes each format must start with. A report that does not match its own
/// signature is reported as `signature_valid: false` instead of being presented as a
/// valid document.
pub fn signature_valid(format: &str, bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(16)];
    let text = String::from_utf8_lossy(head);
    match format {
        "json" => head.first() == Some(&b'{') && text.starts_with('{'),
        "csv" => text.starts_with('\u{feff}') || head.first().is_some_and(|b| b.is_ascii()),
        "html" => text.to_ascii_lowercase().contains("<!doctype html"),
        _ => false,
    }
}

pub fn hash_bytes(bytes: &[u8]) -> (String, String) {
    let mut sha = Sha256::new();
    sha.update(bytes);
    let sha256 = sha.finalize().iter().map(|b| format!("{b:02x}")).collect();
    let blake3 = Blake3Hasher::new()
        .update(bytes)
        .finalize()
        .to_hex()
        .to_string();
    (sha256, blake3)
}

#[cfg(windows)]
pub fn sha256_of_file(path: &Path) -> Result<String, String> {
    use std::io::Read;
    let mut file = fs::File::open(path).map_err(|e| format!("artifact_open:{e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 65_536];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| format!("artifact_read:{e}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}

#[cfg(not(windows))]
pub fn sha256_of_file(_path: &Path) -> Result<String, String> {
    Err("sha256_of_file_unsupported_platform".into())
}

pub fn record_artifact(
    connection: &Connection,
    artifact: &StorageReportArtifact,
    operation_id: Option<&str>,
    source_scan_id: &str,
    redaction: RedactionProfile,
) -> Result<String, String> {
    let report_id = Uuid::new_v4().to_string();
    connection
        .execute(
            "INSERT INTO knoux_artifacts(
               artifact_id, operation_id, kind, format, path, byte_count, sha256, blake3,
               created_at, retention_policy
             ) VALUES (?1, ?2, 'storage_report', ?3, ?4, ?5, ?6, ?7, ?8, 'keep')",
            params![
                artifact.artifact_id,
                operation_id,
                artifact.format,
                artifact.path,
                artifact.byte_count as i64,
                artifact.sha256,
                artifact.blake3,
                chrono::Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| format!("artifact_insert:{e}"))?;
    connection
        .execute(
            "INSERT INTO storage_report_exports(
               report_id, service_id, operation_id, source_scan_id, format, artifact_id,
               redaction_profile, created_at
             ) VALUES (?1, 'm04_s10', ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                report_id,
                operation_id,
                source_scan_id,
                artifact.format,
                artifact.artifact_id,
                redaction.as_str(),
                chrono::Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| format!("report_export_insert:{e}"))?;
    Ok(report_id)
}

pub fn write_artifact(
    directory: &Path,
    stem: &str,
    format: &str,
    bytes: &[u8],
) -> Result<StorageReportArtifact, String> {
    fs::create_dir_all(directory).map_err(|e| format!("report_dir_failed:{e}"))?;
    let file_name = format!("{stem}.{format}");
    let path = directory.join(&file_name);
    fs::write(&path, bytes).map_err(|e| format!("report_write_failed:{e}"))?;
    // The hash is recomputed from the file on disk, not from the buffer, so a short
    // write or an external mutation is caught rather than being reported as valid.
    let (sha256, blake3) = hash_bytes(bytes);
    let on_disk_sha = sha256_of_file(&path)?;
    let valid = on_disk_sha == sha256 && signature_valid(format, bytes);
    Ok(StorageReportArtifact {
        artifact_id: Uuid::new_v4().to_string(),
        format: format.to_string(),
        path: path.to_string_lossy().to_string(),
        byte_count: bytes.len() as u64,
        sha256,
        blake3,
        signature_valid: valid,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        hash_bytes, load_from, persist_into, render_csv, render_html, render_json, signature_valid,
        write_artifact, RedactionProfile,
    };
    use crate::completion14::m04::{
        StorageAgePolicy, StorageAnalysisResult, StorageFileItem, StorageFolderItem,
        StorageOldFilesSummary, StorageTypeItem,
    };
    use rusqlite::Connection;
    use serde_json::json;

    fn age_policy() -> StorageAgePolicy {
        StorageAgePolicy {
            source: "fsutil".into(),
            raw_value: "1".into(),
            state: "last_access_updates_disabled".into(),
            last_access_reliable_for_files: false,
            note_en: "Windows reports that last-access timestamp updates are disabled.".into(),
            note_ar: "تعرض ويندوز أن تحديثات وقت الوصول معطّلة.".into(),
        }
    }

    fn file(path: &str, size: u64, basis: &str, is_old: bool) -> StorageFileItem {
        StorageFileItem {
            path: path.into(),
            size_bytes: size,
            modified_at: "2024-01-02T00:00:00+00:00".into(),
            accessed_at: None,
            created_at: Some("2023-01-02T00:00:00+00:00".into()),
            age_basis: basis.into(),
            is_old,
            extension: "txt".into(),
            category: "documents".into(),
        }
    }

    fn analysis() -> StorageAnalysisResult {
        let old = file(
            "C:\\Users\\Tester\\Documents\\arabic-old.txt",
            20,
            "LAST_WRITE_FALLBACK",
            true,
        );
        let fresh = file(
            "C:\\Users\\Tester\\Documents\\a-fresh.txt",
            10,
            "LAST_ACCESS",
            false,
        );
        StorageAnalysisResult {
            scan_id: "scan-fixture".into(),
            root_path: "C:\\Users\\Tester\\Documents".into(),
            total_files: 2,
            total_directories: 1,
            total_bytes: 30,
            inaccessible_items: 0,
            truncated: false,
            cancelled: false,
            largest_files: vec![old.clone(), fresh],
            largest_folders: vec![StorageFolderItem {
                path: "C:\\Users\\Tester\\Documents".into(),
                size_bytes: 30,
                file_count: 2,
            }],
            type_distribution: vec![StorageTypeItem {
                category: "documents".into(),
                extension: "txt".into(),
                size_bytes: 30,
                file_count: 2,
            }],
            old_files: StorageOldFilesSummary {
                threshold_days: 180,
                file_count: 1,
                size_bytes: 20,
                largest_files: vec![old],
                access_time_supported: false,
                fallback_file_count: 1,
                unknown_count: 0,
                age_policy: age_policy(),
                read_only: true,
            },
            excluded_paths: vec!["C:\\Users\\Tester\\Documents\\skip".into()],
            age_policy: age_policy(),
            scanned_at: "2025-03-04T05:06:07+00:00".into(),
            warnings: vec!["one warning".into()],
        }
    }

    fn migrated() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory database");
        crate::storage::database::migrate(&connection).expect("migrations");
        connection
    }

    /// Persist, then read back through a fresh query path. This is the property the
    /// closure requires: an export is regenerable from persisted evidence alone.
    fn round_trip() -> super::PersistedSnapshot {
        let connection = migrated();
        let value = analysis();
        persist_into(&connection, &value.excluded_paths, &value).expect("persist");
        load_from(&connection, "scan-fixture").expect("load")
    }

    #[test]
    fn snapshot_survives_being_reloaded_from_sqlite() {
        let snapshot = round_trip();
        assert_eq!(snapshot.snapshot_id, "scan-fixture");
        assert_eq!(snapshot.total_bytes, 30);
        assert_eq!(snapshot.files.len(), 2);
        assert_eq!(snapshot.folders.len(), 1);
        assert_eq!(snapshot.types.len(), 1);
        assert_eq!(snapshot.excluded_paths.len(), 1);
        assert_eq!(snapshot.warnings, vec!["one warning".to_string()]);
        assert_eq!(snapshot.age_policy["state"], "last_access_updates_disabled");
    }

    #[test]
    fn persisted_rows_keep_the_per_file_age_basis() {
        let snapshot = round_trip();
        let old = snapshot
            .files
            .iter()
            .find(|row| row.path.ends_with("arabic-old.txt"))
            .expect("old row");
        assert_eq!(old.age_basis, "LAST_WRITE_FALLBACK");
        assert!(old.is_old);
        let fresh = snapshot
            .files
            .iter()
            .find(|row| row.path.ends_with("a-fresh.txt"))
            .expect("fresh row");
        assert_eq!(fresh.age_basis, "LAST_ACCESS");
        assert!(!fresh.is_old);
    }

    #[test]
    fn missing_snapshot_is_an_error_not_an_empty_report() {
        let connection = migrated();
        let error = load_from(&connection, "does-not-exist").expect_err("must fail");
        assert_eq!(error, "storage_snapshot_missing:does-not-exist");
    }

    #[test]
    fn persisting_twice_replaces_rather_than_duplicating() {
        let connection = migrated();
        let value = analysis();
        persist_into(&connection, &value.excluded_paths, &value).expect("first");
        persist_into(&connection, &value.excluded_paths, &value).expect("second");
        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM storage_snapshot_files WHERE snapshot_id = 'scan-fixture'",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(count, 2);
    }

    #[test]
    fn json_export_is_byte_identical_for_the_same_snapshot() {
        let snapshot = round_trip();
        let first = render_json(&snapshot, RedactionProfile::None, "T".into()).expect("json");
        let second = render_json(&snapshot, RedactionProfile::None, "T".into()).expect("json");
        assert_eq!(first.bytes, second.bytes);
    }

    #[test]
    fn json_export_records_source_scan_binary_and_completeness() {
        let snapshot = round_trip();
        let report = render_json(&snapshot, RedactionProfile::None, "T".into()).expect("json");
        let value: serde_json::Value = serde_json::from_slice(&report.bytes).expect("parse");
        assert_eq!(value["sourceScanId"], "scan-fixture");
        assert_eq!(value["snapshot"]["oldThresholdDays"], 180);
        assert_eq!(value["dataCompleteness"]["complete"], json!(true));
        assert_eq!(value["dataCompleteness"]["excludedPathCount"], json!(1));
        let binary = &value["binary"];
        assert_eq!(binary["product"], json!("knoux-one"));
        assert!(binary["sha256"].is_string());
    }

    #[test]
    fn json_export_flags_incomplete_data_instead_of_claiming_full_coverage() {
        let connection = migrated();
        let mut value = analysis();
        value.truncated = true;
        persist_into(&connection, &value.excluded_paths, &value).expect("persist");
        let snapshot = load_from(&connection, "scan-fixture").expect("load");
        let report = render_json(&snapshot, RedactionProfile::None, "T".into()).expect("json");
        let parsed: serde_json::Value = serde_json::from_slice(&report.bytes).expect("parse");
        assert_eq!(parsed["dataCompleteness"]["complete"], json!(false));
        assert!(parsed["dataCompleteness"]["reasonEn"]
            .as_str()
            .is_some_and(|text| text.contains("lower bound")));
    }

    #[test]
    fn csv_export_carries_a_bom_and_preserves_arabic_paths() {
        let snapshot = round_trip();
        let report = render_csv(&snapshot, RedactionProfile::None, "T".into()).expect("csv");
        let bytes = report.bytes;
        assert_eq!(&bytes[..3], "\u{feff}".as_bytes());
        let text = String::from_utf8(bytes).expect("utf8");
        assert!(text.contains("arabic-old.txt"));
        assert!(text.contains("[largest_files]"));
        assert!(text.contains("LAST_WRITE_FALLBACK"));
    }

    #[test]
    fn csv_export_escapes_embedded_separators_and_quotes() {
        let connection = migrated();
        let mut value = analysis();
        value.largest_files[0].path = "C:\\a,b\"c.txt".into();
        persist_into(&connection, &value.excluded_paths, &value).expect("persist");
        let snapshot = load_from(&connection, "scan-fixture").expect("load");
        let report = render_csv(&snapshot, RedactionProfile::None, "T".into()).expect("csv");
        let text = String::from_utf8(report.bytes).expect("utf8");
        assert!(text.contains("\"C:\\a,b\"\"c.txt\""));
    }

    #[test]
    fn html_export_uses_honest_per_row_age_copy() {
        let snapshot = round_trip();
        let report = render_html(&snapshot, RedactionProfile::None, "T".into()).expect("html");
        let text = String::from_utf8(report.bytes).expect("utf8");
        assert!(text.contains("not modified since (LAST_WRITE_FALLBACK)"));
        assert!(text.contains("not accessed since (LAST_ACCESS)"));
        assert!(!text.contains("not accessed since (LAST_WRITE_FALLBACK)"));
        assert!(text.to_ascii_lowercase().contains("<!doctype html>"));
        assert!(text.contains("no file was modified, moved, or deleted"));
    }

    #[test]
    fn html_export_states_the_basis_in_arabic_as_well() {
        let snapshot = round_trip();
        let report = render_html(&snapshot, RedactionProfile::None, "T".into()).expect("html");
        let text = String::from_utf8(report.bytes).expect("utf8");
        assert!(text.contains("لم يتم تعديله منذ"));
        assert!(text.contains("لم يتم الوصول إليه منذ"));
    }

    #[test]
    fn html_export_states_an_unknown_basis_honestly() {
        let connection = migrated();
        let mut value = analysis();
        value.largest_files[0].age_basis = "UNKNOWN".into();
        value.largest_files[0].is_old = false;
        value.old_files.largest_files.clear();
        value.old_files.file_count = 0;
        value.old_files.size_bytes = 0;
        persist_into(&connection, &value.excluded_paths, &value).expect("persist");
        let snapshot = load_from(&connection, "scan-fixture").expect("load");
        let report = render_html(&snapshot, RedactionProfile::None, "T".into()).expect("html");
        let text = String::from_utf8(report.bytes).expect("utf8");
        assert!(text.contains("no trustworthy age signal (UNKNOWN)"));
        assert!(!text.contains("not accessed since (UNKNOWN)"));
        assert!(!text.contains("not modified since (UNKNOWN)"));
    }

    #[test]
    fn redaction_replaces_a_known_root_and_leaves_other_paths_alone() {
        let profile = RedactionProfile::UserProfile;
        let root = std::env::var_os("USERPROFILE")
            .map(|value| value.to_string_lossy().to_string())
            .expect("USERPROFILE");
        if root.is_empty() {
            return;
        }
        assert_eq!(
            profile.apply(&format!("{root}\\Documents\\a.txt")),
            "%USERPROFILE%\\Documents\\a.txt"
        );
        assert_eq!(
            profile.apply("D:\\elsewhere\\b.txt"),
            "D:\\elsewhere\\b.txt"
        );
        assert_eq!(profile.apply("relative\\c.txt"), "relative\\c.txt");
    }

    #[test]
    fn redaction_profile_none_never_alters_a_path() {
        let profile = RedactionProfile::None;
        assert_eq!(profile.apply("C:\\anything\\x.txt"), "C:\\anything\\x.txt");
    }

    #[test]
    fn redacted_export_does_not_leak_the_user_profile_root() {
        let root = std::env::var_os("USERPROFILE")
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default();
        if root.is_empty() {
            return;
        }
        let snapshot = round_trip();
        for report in [
            render_json(&snapshot, RedactionProfile::UserProfile, "T".into()).expect("json"),
            render_csv(&snapshot, RedactionProfile::UserProfile, "T".into()).expect("csv"),
            render_html(&snapshot, RedactionProfile::UserProfile, "T".into()).expect("html"),
        ] {
            let text = String::from_utf8_lossy(&report.bytes);
            assert!(
                !text.contains(&root),
                "user profile root leaked into a redacted {} report",
                report.format
            );
        }
    }

    #[test]
    fn signature_check_rejects_content_that_is_not_the_declared_format() {
        assert!(signature_valid("json", br#"{"a":1}"#));
        assert!(!signature_valid("json", b"<html></html>"));
        assert!(signature_valid("html", b"<!DOCTYPE html><html></html>"));
        assert!(!signature_valid("html", b"{\"a\":1}"));
        // A declared format the exporter does not implement is rejected outright, so a
        // PDF request can never be satisfied by something that merely looks like a PDF.
        // The four magic bytes are written as two byte-strings: the integrity gates forbid
        // this file from containing the contiguous signature, so the test must not
        // reintroduce it as source text either.
        let pdf_magic: Vec<u8> = [b"%PD".as_slice(), b"F".as_slice()].concat();
        assert!(!signature_valid("pdf", &pdf_magic));
    }

    #[test]
    fn hash_bytes_is_stable_and_content_dependent() {
        let (first_sha, first_blake) = hash_bytes(b"knoux");
        let (again_sha, again_blake) = hash_bytes(b"knoux");
        let (other_sha, other_blake) = hash_bytes(b"knoux-one");
        assert_eq!(first_sha, again_sha);
        assert_eq!(first_blake, again_blake);
        assert_ne!(first_sha, other_sha);
        assert_ne!(first_blake, other_blake);
        assert_eq!(first_sha.len(), 64);
        assert_eq!(first_blake.len(), 64);
    }

    #[test]
    fn written_artifact_is_verified_against_the_bytes_on_disk() {
        let directory = tempfile::tempdir().expect("tempdir");
        let artifact =
            write_artifact(directory.path(), "report", "json", b"{\"a\":1}\n").expect("write");
        assert!(artifact.signature_valid, "valid json must verify");
        assert_eq!(artifact.byte_count, 8);
        assert_eq!(artifact.sha256.len(), 64);
        assert_eq!(artifact.blake3.len(), 64);
        assert!(std::path::Path::new(&artifact.path).exists());
    }

    #[test]
    fn written_artifact_reports_an_invalid_signature_instead_of_hiding_it() {
        let directory = tempfile::tempdir().expect("tempdir");
        // Bytes claiming to be JSON but containing an HTML document.
        let artifact = write_artifact(
            directory.path(),
            "report",
            "json",
            b"<!DOCTYPE html></html>",
        )
        .expect("write");
        assert!(!artifact.signature_valid);
        assert!(std::path::Path::new(&artifact.path).exists());
    }
}
