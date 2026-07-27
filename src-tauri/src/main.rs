#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#![allow(clippy::unnecessary_sort_by, clippy::too_many_arguments)]

mod cleanup;
mod completion14;
mod contracts;
mod developer;
mod duplicates;
mod performance_center;
mod startup_services;
mod storage;
mod storage_analyzer;
mod system;
mod windows_repair;
mod winget;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            completion14::m04::start_persisted_monitor(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            system::m01_system_discover,
            winget::m01_winget_verify,
            winget::m01_winget_install,
            completion14::m01::m01_system_discover_complete,
            completion14::m01::m01_winget_install_queued,
            completion14::m01::m01_winget_queue_list,
            completion14::m01::m01_winget_queue_resume,
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
            completion14::m02::m02_cleanup_scan_complete,
            completion14::m02::m02_cleanup_execute_complete,
            completion14::m02::m02_cleanup_cancel_complete,
            completion14::m02::m02_cleanup_history_complete,
            completion14::m02::m02_scan_windows_temp_complete,
            completion14::m02::m02_scan_crash_dumps_complete,
            completion14::m02::m02_scan_application_logs_complete,
            completion14::m02::m02_scan_old_downloads_complete,
            completion14::m02::m02_download_quarantine_list,
            completion14::m02::m02_download_quarantine_restore,
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
            completion14::m03::m03_scan_images_complete,
            completion14::m03::m03_scan_videos_complete,
            completion14::m03::m03_scan_audio_complete,
            completion14::m03::m03_scan_archives_complete,
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
            completion14::m04::m04_storage_scan_complete,
            completion14::m04::m04_old_files_complete,
            completion14::m04::m04_downloads_complete,
            completion14::m04::m04_appdata_complete,
            completion14::m04::m04_external_drives_complete,
            completion14::m04::m04_space_check_complete,
            completion14::m04::m04_report_export_complete,
            completion14::m04::m04_scan_cancel_complete,
            startup_services::m05_registry_entries,
            startup_services::m05_startup_folders,
            startup_services::m05_scheduled_tasks,
            startup_services::m05_windows_services,
            startup_services::m05_impact_assess,
            startup_services::m05_recommendations,
            startup_services::m05_startup_change,
            startup_services::m05_delay_manage,
            startup_services::m05_profiles_manage,
            startup_services::m05_restore_manage,
            startup_services::m05_boot_history,
            performance_center::m06_cpu_monitor,
            performance_center::m06_memory_monitor,
            performance_center::m06_disk_activity,
            performance_center::m06_network_activity,
            performance_center::m06_process_explorer,
            performance_center::m06_heavy_processes,
            performance_center::m06_priority_manage,
            performance_center::m06_power_plans_manage,
            performance_center::m06_profiles_manage,
            performance_center::m06_benchmark_report,
            windows_repair::m07_sfc_manage,
            windows_repair::m07_dism_check_health,
            windows_repair::m07_dism_scan_health,
            windows_repair::m07_dism_restore_health,
            windows_repair::m07_windows_update_manage,
            windows_repair::m07_cache_manage,
            windows_repair::m07_wmi_manage,
            windows_repair::m07_installer_manage,
            windows_repair::m07_vss_manage,
            windows_repair::m07_store_manage,
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
