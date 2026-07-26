#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#![allow(clippy::unnecessary_sort_by, clippy::too_many_arguments)]

mod cleanup;
mod contracts;
mod developer;
mod duplicates;
mod storage;
mod storage_analyzer;
mod system;
mod winget;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            system::m01_system_discover,
            winget::m01_winget_verify,
            winget::m01_winget_install,
            cleanup::commands::m02_cleanup_scan,
            cleanup::commands::m02_cleanup_execute,
            cleanup::commands::m02_cleanup_cancel,
            cleanup::commands::m02_cleanup_history,
            cleanup::commands::m02_scan_user_temp,
            cleanup::commands::m02_scan_windows_temp,
            cleanup::commands::m02_scan_browser_cache,
            cleanup::commands::m02_scan_thumbnail_cache,
            cleanup::commands::m02_scan_crash_dumps,
            cleanup::commands::m02_scan_application_logs,
            cleanup::commands::m02_scan_old_downloads,
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
            storage_analyzer::commands::m04_storage_scan,
            storage_analyzer::commands::m04_largest_files,
            storage_analyzer::commands::m04_largest_folders,
            storage_analyzer::commands::m04_type_distribution,
            storage_analyzer::commands::m04_old_files,
            storage_analyzer::commands::m04_downloads_analyze,
            storage_analyzer::commands::m04_appdata_analyze,
            storage_analyzer::commands::m04_external_drives,
            storage_analyzer::commands::m04_space_check,
            storage_analyzer::commands::m04_report_export,
            storage_analyzer::commands::m04_scan_cancel,
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
