#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod contracts;
mod system;
mod winget;
mod windows_repair;
mod duplicates;
mod developer;
mod projects;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            system::m01_system_discover,
            system::m01_winget_diagnose,
            system::m01_software_install_queue,
            system::m01_software_catalog,
            system::m01_software_import_list,
            system::m01_software_export_inventory,
            system::m01_profile_manage,
            system::m01_queue_manage,
            system::m01_restore_point_create,
            winget::m01_winget_verify,
            winget::m01_winget_install,
            windows_repair::m07_sfc_scannow,
            windows_repair::m07_dism_checkhealth,
            windows_repair::m07_dism_scanhealth,
            windows_repair::m07_dism_restorehealth,
            windows_repair::m07_wua_reset,
            windows_repair::m07_icon_repair,
            windows_repair::m07_wmi_repair,
            windows_repair::m07_msi_repair,
            windows_repair::m07_vss_repair,
            windows_repair::m07_store_repair,
            duplicates::m03_scan_exact,
            duplicates::m03_quarantine_manage,
            developer::m15_environment_discover,
            developer::m15_process_control,
            projects::m16_repository_manage,
            projects::m16_build_cleanup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
