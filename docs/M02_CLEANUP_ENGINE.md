# Module 02 — Device Cleanup

## Purpose

Module 02 measures real files from allowlisted Windows cleanup locations. Browser preview is non-executable and never fabricates file counts, sizes, progress, or success.

## Verified service matrix

| # | User-facing service | State | Evidence source |
|---|---|---|---|
| 1 | Your temporary files | Implemented | Current user `%TEMP%` directory |
| 2 | Windows temporary files | Partial | `%WINDIR%\Temp`; deletion depends on the desktop process already having Windows administrator rights |
| 3 | Browser temporary files | Implemented | Cache-only directories for Chrome, Edge, Brave, and Firefox profiles |
| 4 | Image thumbnail files | Implemented | `thumbcache_*.db` and `iconcache_*.db` under the current Windows user profile |
| 5 | Program crash reports | Partial | User crash dumps and Windows Error Reporting directories; protected locations may require elevation |
| 6 | Windows update delivery files | Planned | No handler is exposed |
| 7 | Old application logs | Partial | Old `.log`, `.etl`, and `.tmp` files inside the current user temp directory only |
| 8 | Recycle Bin review | Planned | No handler is exposed |
| 9 | Old installers in Downloads | Partial | Read-only review of installers and archives older than 30 days; deletion is disabled |
| 10 | Automatic cleanup schedules | Planned | No handler is exposed |

## Native handlers

- `m02.cleanup.scan` → `m02_cleanup_scan`
- `m02.cleanup.execute` → `m02_cleanup_execute`
- `m02.cleanup.cancel` → `m02_cleanup_cancel`
- `m02.cleanup.history` → `m02_cleanup_history`
- `m02.scan.user_temp` → `m02_scan_user_temp`
- `m02.scan.windows_temp` → `m02_scan_windows_temp`
- `m02.scan.browser_cache` → `m02_scan_browser_cache`
- `m02.scan.thumbnail_cache` → `m02_scan_thumbnail_cache`
- `m02.scan.crash_dumps` → `m02_scan_crash_dumps`
- `m02.scan.application_logs` → `m02_scan_application_logs`
- `m02.scan.old_downloads` → `m02_scan_old_downloads`

## Safety invariants

1. The renderer cannot send arbitrary deletion paths.
2. Cleanup execution accepts only a scan identifier and selected category identifiers.
3. Deletion paths come from an in-memory native scan snapshot.
4. Each file is checked again for path containment, file type, size, and modification time immediately before deletion.
5. Symbolic links are not followed and are not deleted.
6. Files modified during or after scanning are skipped.
7. Files younger than the configured safety age are excluded.
8. Browser discovery targets cache directories only; history, cookies, login databases, and password stores are not scanned.
9. Old Downloads is intentionally scan-only.
10. Cleanup requires the exact typed confirmation `CLEAN`.
11. Cancellation uses a native atomic token; progress counters come from real filesystem work.
12. Operation history is stored in the Tauri application-data directory as `m02-cleanup-history.json`.

## Known limitations

- Automatic UAC elevation is not implemented in this phase. Windows-protected locations remain `partial` and can return permission failures.
- Scan snapshots are intentionally session-bound; restarting the application requires a new preview scan.
- Item evidence is bounded to 25,000 entries per category. The measured total remains reported, but cleanup only acts on evidence retained in the snapshot.
- Empty directory removal is not performed.
- Windows Update Delivery Optimization, Recycle Bin operations, and scheduled cleanup remain planned.
