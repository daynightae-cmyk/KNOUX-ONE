#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#![allow(clippy::unnecessary_sort_by)]

mod contracts;
mod developer;
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
            duplicates::m03_scan_result,
            developer::m15_environment_discover,
            developer::m15_path_audit,
            developer::m15_runtime_inspect,
            developer::m15_git_audit,
            developer::m15_repositories_scan,
            developer::m15_ports_manage,
            developer::m15_projects_audit,
            developer::m15_caches_manage,
            developer::m15_http_execute,
            developer::m15_report_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running KNOUX ONE");
}
