use crate::storage_analyzer::contracts::{StorageDriveInfo, StorageDriveInventory};
use chrono::Utc;

#[cfg(target_os = "windows")]
use std::{iter::once, ptr};

#[cfg(target_os = "windows")]
use windows_sys::Win32::Storage::FileSystem::{
    GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDriveStringsW, DRIVE_CDROM, DRIVE_FIXED,
    DRIVE_NO_ROOT_DIR, DRIVE_RAMDISK, DRIVE_REMOTE, DRIVE_REMOVABLE, DRIVE_UNKNOWN,
};

#[cfg(target_os = "windows")]
fn drive_type_name(value: u32) -> &'static str {
    match value {
        DRIVE_REMOVABLE => "removable",
        DRIVE_FIXED => "fixed",
        DRIVE_REMOTE => "remote",
        DRIVE_CDROM => "optical",
        DRIVE_RAMDISK => "ram_disk",
        DRIVE_NO_ROOT_DIR => "missing_root",
        DRIVE_UNKNOWN => "unknown",
        _ => "unknown",
    }
}

#[cfg(target_os = "windows")]
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(once(0)).collect()
}

#[cfg(target_os = "windows")]
pub fn inventory() -> StorageDriveInventory {
    let mut warnings = Vec::new();
    let required = unsafe { GetLogicalDriveStringsW(0, ptr::null_mut()) };
    if required == 0 {
        return StorageDriveInventory {
            drives: Vec::new(),
            measured_at: Utc::now().to_rfc3339(),
            warnings: vec!["logical_drive_enumeration_failed".into()],
        };
    }

    let mut buffer = vec![0_u16; required as usize + 1];
    let written = unsafe { GetLogicalDriveStringsW(buffer.len() as u32, buffer.as_mut_ptr()) };
    if written == 0 {
        return StorageDriveInventory {
            drives: Vec::new(),
            measured_at: Utc::now().to_rfc3339(),
            warnings: vec!["logical_drive_read_failed".into()],
        };
    }

    let mut drives = Vec::new();
    let mut start = 0_usize;
    while start < written as usize {
        let Some(relative_end) = buffer[start..].iter().position(|value| *value == 0) else {
            break;
        };
        if relative_end == 0 {
            break;
        }
        let end = start + relative_end;
        let root_path = String::from_utf16_lossy(&buffer[start..end]);
        let wide = wide_null(&root_path);
        let drive_type = unsafe { GetDriveTypeW(wide.as_ptr()) };

        let mut available = 0_u64;
        let mut total = 0_u64;
        let mut free = 0_u64;
        let succeeded =
            unsafe { GetDiskFreeSpaceExW(wide.as_ptr(), &mut available, &mut total, &mut free) }
                != 0;

        if succeeded {
            let used = total.saturating_sub(free);
            let free_percent = if total == 0 {
                0.0
            } else {
                free as f64 * 100.0 / total as f64
            };
            drives.push(StorageDriveInfo {
                root_path,
                drive_type: drive_type_name(drive_type).into(),
                total_bytes: total,
                free_bytes: free,
                available_bytes: available,
                used_bytes: used,
                free_percent,
                is_external: drive_type == DRIVE_REMOVABLE,
                is_remote: drive_type == DRIVE_REMOTE,
            });
        } else {
            warnings.push(format!("drive_capacity_unavailable:{root_path}"));
        }

        start = end + 1;
    }

    drives.sort_by(|left, right| left.root_path.cmp(&right.root_path));
    StorageDriveInventory {
        drives,
        measured_at: Utc::now().to_rfc3339(),
        warnings,
    }
}

#[cfg(not(target_os = "windows"))]
pub fn inventory() -> StorageDriveInventory {
    StorageDriveInventory {
        drives: Vec::new(),
        measured_at: Utc::now().to_rfc3339(),
        warnings: vec!["drive_inventory_supported_on_windows_only".into()],
    }
}
