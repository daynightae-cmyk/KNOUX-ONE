#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod contracts;
mod system;
mod winget;
mod windows_repair;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            system::m01_system_discover,
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
            windows_repair::m07_store_repair
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
