/**
 * KNOUX ONE — Explicit allowlisted native command registry.
 * Never construct Tauri command names from user-controlled handler IDs.
 */
export const NATIVE_COMMANDS = {
  'm01.system.discover': 'm01_system_discover',
  'm01.winget.verify': 'm01_winget_verify',
  'm01.winget.install': 'm01_winget_install',
  'm02.cleanup.scan': 'm02_cleanup_scan',
  'm02.cleanup.execute': 'm02_cleanup_execute',
  'm02.cleanup.cancel': 'm02_cleanup_cancel',
  'm02.cleanup.history': 'm02_cleanup_history',
  'm02.scan.user_temp': 'm02_scan_user_temp',
  'm02.scan.windows_temp': 'm02_scan_windows_temp',
  'm02.scan.browser_cache': 'm02_scan_browser_cache',
  'm02.scan.thumbnail_cache': 'm02_scan_thumbnail_cache',
  'm02.scan.crash_dumps': 'm02_scan_crash_dumps',
  'm02.scan.application_logs': 'm02_scan_application_logs',
  'm02.scan.old_downloads': 'm02_scan_old_downloads',
  'm03.scan.exact': 'm03_scan_exact',
  'm03.scan.fast': 'm03_scan_fast',
  'm03.scan.images': 'm03_scan_images',
  'm03.scan.videos': 'm03_scan_videos',
  'm03.scan.audio': 'm03_scan_audio',
  'm03.scan.documents': 'm03_scan_documents',
  'm03.scan.archives': 'm03_scan_archives',
  'm03.scan.folders': 'm03_scan_folders',
  'm03.keeper.plan': 'm03_keeper_plan',
  'm03.quarantine.manage': 'm03_quarantine_manage',
  'm03.job.pause': 'm03_job_pause',
  'm03.job.resume': 'm03_job_resume',
  'm03.job.cancel': 'm03_job_cancel',
  'm03.job.list': 'm03_job_list',
  'm03.scan.history': 'm03_scan_history',
  'm03.scan.result': 'm03_scan_result',
  'm03.folder.pick': 'm03_pick_folder',
  'm15.environment.discover': 'm15_environment_discover',
  'm15.path.audit': 'm15_path_audit',
  'm15.runtime.inspect': 'm15_runtime_inspect',
  'm15.git.audit': 'm15_git_audit',
  'm15.repositories.scan': 'm15_repositories_scan',
  'm15.ports.manage': 'm15_ports_manage',
  'm15.projects.audit': 'm15_projects_audit',
  'm15.caches.manage': 'm15_caches_manage',
  'm15.http.execute': 'm15_http_execute',
  'm15.report.export': 'm15_report_export',
} as const;

export type NativeHandlerId = keyof typeof NATIVE_COMMANDS;
export function resolveNativeCommand(handlerId: string): string | null {
  return Object.prototype.hasOwnProperty.call(NATIVE_COMMANDS, handlerId)
    ? NATIVE_COMMANDS[handlerId as NativeHandlerId]
    : null;
}
