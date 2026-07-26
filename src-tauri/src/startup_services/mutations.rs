use crate::startup_services::{
    contracts::{
        StartupChangeHistory, StartupChangeRecord, StartupItem, StartupRestoreResult,
        StartupToggleResult,
    },
    powershell,
};
use chrono::Utc;
use std::{collections::HashMap, fs, path::PathBuf};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const DISABLE_REGISTRY_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$path = $env:KNOUX_REG_PATH
$name = $env:KNOUX_REG_NAME
if ([string]::IsNullOrWhiteSpace($path) -or [string]::IsNullOrWhiteSpace($name)) { throw 'missing_registry_identity' }
if (-not (Test-Path -LiteralPath $path)) { throw 'registry_path_missing' }
$current = Get-ItemPropertyValue -LiteralPath $path -Name $name
Remove-ItemProperty -LiteralPath $path -Name $name
[pscustomobject]@{ Removed = $true; Value = [string]$current } | ConvertTo-Json -Compress
"#;

const RESTORE_REGISTRY_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$path = $env:KNOUX_REG_PATH
$name = $env:KNOUX_REG_NAME
$value = $env:KNOUX_REG_VALUE
if ([string]::IsNullOrWhiteSpace($path) -or [string]::IsNullOrWhiteSpace($name)) { throw 'missing_registry_identity' }
if (-not (Test-Path -LiteralPath $path)) { New-Item -Path $path -Force | Out-Null }
New-ItemProperty -LiteralPath $path -Name $name -Value $value -PropertyType String -Force | Out-Null
'RESTORED'
"#;

fn change_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("startup_app_data_unavailable:{error}"))?
        .join("startup-services");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("startup_change_directory_failed:{error}"))?;
    Ok(directory)
}

fn history_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(change_directory(app)?.join("startup-change-history.json"))
}

fn load_records(app: &AppHandle) -> Result<Vec<StartupChangeRecord>, String> {
    let path = history_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)
        .map_err(|error| format!("startup_change_history_read_failed:{error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("startup_change_history_parse_failed:{error}"))
}

fn save_records(app: &AppHandle, records: &[StartupChangeRecord]) -> Result<(), String> {
    let path = history_path(app)?;
    let temporary = path.with_extension("json.tmp");
    let payload = serde_json::to_vec_pretty(records)
        .map_err(|error| format!("startup_change_history_serialize_failed:{error}"))?;
    fs::write(&temporary, payload)
        .map_err(|error| format!("startup_change_history_write_failed:{error}"))?;
    fs::rename(&temporary, &path)
        .map_err(|error| format!("startup_change_history_commit_failed:{error}"))
}

fn safe_file_name(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    if cleaned.is_empty() {
        "startup-item".into()
    } else {
        cleaned
    }
}

fn disable_registry(item: &StartupItem) -> Result<String, String> {
    let mut environment = HashMap::new();
    environment.insert("KNOUX_REG_PATH".into(), item.source_path.clone());
    environment.insert("KNOUX_REG_NAME".into(), item.name.clone());
    powershell::run_text(DISABLE_REGISTRY_SCRIPT, environment)?;
    Ok(item.command.clone())
}

fn restore_registry(record: &StartupChangeRecord) -> Result<(), String> {
    let mut environment = HashMap::new();
    environment.insert("KNOUX_REG_PATH".into(), record.source_path.clone());
    environment.insert("KNOUX_REG_NAME".into(), record.item_name.clone());
    environment.insert("KNOUX_REG_VALUE".into(), record.command.clone());
    powershell::run_text(RESTORE_REGISTRY_SCRIPT, environment)?;
    Ok(())
}

fn disable_startup_file(
    app: &AppHandle,
    item: &StartupItem,
    change_id: &str,
) -> Result<String, String> {
    let source = PathBuf::from(&item.source_path);
    if !source.is_file() {
        return Err(format!("startup_folder_item_missing:{}", source.display()));
    }
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .map(safe_file_name)
        .unwrap_or_else(|| "startup-item".into());
    let disabled_directory = change_directory(app)?.join("disabled-startup-files");
    fs::create_dir_all(&disabled_directory)
        .map_err(|error| format!("startup_disabled_directory_failed:{error}"))?;
    let destination = disabled_directory.join(format!("{change_id}--{file_name}"));
    if destination.exists() {
        return Err("startup_backup_destination_exists".into());
    }
    fs::rename(&source, &destination)
        .map_err(|error| format!("startup_file_disable_failed:{error}"))?;
    Ok(destination.to_string_lossy().to_string())
}

fn restore_startup_file(record: &StartupChangeRecord) -> Result<(), String> {
    let source = PathBuf::from(&record.backup_path);
    let destination = PathBuf::from(&record.source_path);
    if !source.is_file() {
        return Err(format!("startup_backup_file_missing:{}", source.display()));
    }
    if destination.exists() {
        return Err(format!(
            "startup_restore_destination_exists:{}",
            destination.display()
        ));
    }
    let parent = destination
        .parent()
        .ok_or_else(|| "startup_restore_parent_missing".to_string())?;
    if !parent.is_dir() {
        return Err(format!("startup_restore_parent_unavailable:{}", parent.display()));
    }
    fs::rename(source, destination)
        .map_err(|error| format!("startup_file_restore_failed:{error}"))
}

pub fn disable_item(
    app: &AppHandle,
    item: &StartupItem,
    confirmation: &str,
) -> Result<StartupToggleResult, String> {
    if !item.enabled {
        return Err("startup_item_already_disabled".into());
    }
    if item.protected {
        return Err("startup_item_protected".into());
    }
    let expected = format!("DISABLE {}", item.name);
    if confirmation != expected {
        return Err(format!("startup_confirmation_required:{expected}"));
    }

    let change_id = Uuid::new_v4().to_string();
    let backup_path = match item.source_kind.as_str() {
        "registry" => {
            disable_registry(item)?;
            format!("registry://{}/{}", item.source_path, item.name)
        }
        "startup_folder" => disable_startup_file(app, item, &change_id)?,
        _ => return Err("startup_source_not_mutable".into()),
    };

    let mut records = load_records(app)?;
    let record = StartupChangeRecord {
        change_id: change_id.clone(),
        item_id: item.id.clone(),
        item_name: item.name.clone(),
        source_kind: item.source_kind.clone(),
        source_scope: item.source_scope.clone(),
        source_path: item.source_path.clone(),
        command: item.command.clone(),
        previous_enabled: true,
        enabled: false,
        backup_path: backup_path.clone(),
        created_at: Utc::now().to_rfc3339(),
        restored_at: None,
    };
    records.insert(0, record);
    records.truncate(500);
    if let Err(error) = save_records(app, &records) {
        let rollback = match item.source_kind.as_str() {
            "registry" => restore_registry(&StartupChangeRecord {
                change_id: change_id.clone(),
                item_id: item.id.clone(),
                item_name: item.name.clone(),
                source_kind: item.source_kind.clone(),
                source_scope: item.source_scope.clone(),
                source_path: item.source_path.clone(),
                command: item.command.clone(),
                previous_enabled: true,
                enabled: false,
                backup_path: backup_path.clone(),
                created_at: Utc::now().to_rfc3339(),
                restored_at: None,
            }),
            "startup_folder" => restore_startup_file(&StartupChangeRecord {
                change_id: change_id.clone(),
                item_id: item.id.clone(),
                item_name: item.name.clone(),
                source_kind: item.source_kind.clone(),
                source_scope: item.source_scope.clone(),
                source_path: item.source_path.clone(),
                command: item.command.clone(),
                previous_enabled: true,
                enabled: false,
                backup_path: backup_path.clone(),
                created_at: Utc::now().to_rfc3339(),
                restored_at: None,
            }),
            _ => Ok(()),
        };
        return Err(format!(
            "startup_history_failed:{error}:rollback={}",
            rollback.err().unwrap_or_else(|| "completed".into())
        ));
    }

    Ok(StartupToggleResult {
        item_id: item.id.clone(),
        change_id,
        previous_enabled: true,
        enabled: false,
        backup_path,
        requires_restart: false,
    })
}

pub fn restore_change(
    app: &AppHandle,
    change_id: &str,
    confirmation: &str,
) -> Result<StartupRestoreResult, String> {
    if confirmation != "RESTORE" {
        return Err("startup_restore_confirmation_required:RESTORE".into());
    }
    let mut records = load_records(app)?;
    let index = records
        .iter()
        .position(|record| record.change_id == change_id)
        .ok_or_else(|| "startup_change_not_found".to_string())?;
    if records[index].restored_at.is_some() {
        return Err("startup_change_already_restored".into());
    }
    let record = records[index].clone();
    match record.source_kind.as_str() {
        "registry" => restore_registry(&record)?,
        "startup_folder" => restore_startup_file(&record)?,
        _ => return Err("startup_restore_source_not_supported".into()),
    }
    let restored_at = Utc::now().to_rfc3339();
    records[index].restored_at = Some(restored_at.clone());
    records[index].enabled = true;
    save_records(app, &records)?;
    Ok(StartupRestoreResult {
        change_id: record.change_id,
        item_id: record.item_id,
        restored_enabled: true,
        restored_at,
    })
}

pub fn change_history(app: &AppHandle) -> Result<StartupChangeHistory, String> {
    Ok(StartupChangeHistory {
        entries: load_records(app)?,
    })
}
