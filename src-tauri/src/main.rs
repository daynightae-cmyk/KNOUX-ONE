#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#![allow(clippy::unnecessary_sort_by)]

mod contracts;
mod duplicates;
mod storage;
mod system;
mod winget;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            system::m01_system_discover,
            winget::m01_winget_verify,
            winget::m01_winget_install,
            duplicates::m03_scan_exact,
            duplicates::m03_scan_fast,
            duplicates::m03_scan_images,
            duplicates::m03_scan_videos,
            duplicates::m03_scan_audio,
            duplicates::m03_scan_documents,
            duplicates::m03_scan_archives,
            duplicates::m03_scan_folders,
            duplicates::m03_keeper_plan,
            duplicates::m03_quarantine_manage,
            duplicates::m03_pick_folder,
            duplicates::m03_job_pause,
            duplicates::m03_job_resume,
            duplicates::m03_job_cancel,
            duplicates::m03_job_list,
            duplicates::m03_scan_history,
            duplicates::m03_scan_result
        ])
        .run(tauri::generate_context!())
        .expect("error while running KNOUX ONE");
}
