# Module 04 — Storage Usage

## Purpose

Module 04 measures a real Windows path without deleting or changing files. It produces bounded evidence for largest files, recursive folder totals, file-type distribution, old files by modification time, Downloads, Local AppData, connected-drive capacity, a one-time low-space check, and JSON report export.

Browser preview is non-executable and never creates sample drives, paths, sizes, files, folders, progress, or success states.

## Verified service matrix

| # | User-facing service | State | Native evidence |
|---|---|---|---|
| 1 | Storage map | Implemented | Recursive `WalkDir` scan of a user-selected real directory |
| 2 | Largest files | Implemented | Bounded ranking from real file metadata |
| 3 | Largest folders | Implemented | Recursive ancestor totals derived from measured files |
| 4 | File types | Implemented | Category and extension totals from real metadata |
| 5 | Old files | Partial | Uses modification time; reliable last-access tracking is not guaranteed on Windows |
| 6 | Downloads folder | Implemented | Current Windows user `%USERPROFILE%\Downloads` |
| 7 | Program data folders | Implemented | Current Windows user `%LOCALAPPDATA%`, read-only |
| 8 | Connected drives | Partial | Windows logical-drive inventory and capacity; disconnected media and exhaustive network-share discovery are outside this phase |
| 9 | Low-space check | Partial | One-time threshold check; no background notification service |
| 10 | Export storage report | Partial | JSON evidence report only; PDF is not implemented |

## Native handlers

- `m04.storage.scan` → `m04_storage_scan`
- `m04.files.largest` → `m04_largest_files`
- `m04.folders.largest` → `m04_largest_folders`
- `m04.types.distribution` → `m04_type_distribution`
- `m04.files.old` → `m04_old_files`
- `m04.downloads.analyze` → `m04_downloads_analyze`
- `m04.appdata.analyze` → `m04_appdata_analyze`
- `m04.drives.external` → `m04_external_drives`
- `m04.space.check` → `m04_space_check`
- `m04.report.export` → `m04_report_export`
- `m04.scan.cancel` → `m04_scan_cancel`

## Safety and correctness invariants

1. Module 04 is read-only. It exposes no delete, move, rename, quarantine, or shell-command action.
2. The selected path must exist and be a directory.
3. The root is canonicalized before scanning.
4. Symbolic links are not followed.
5. Canonical files that leave the selected root are ignored.
6. Duplicate canonical paths are counted once.
7. File scanning is bounded between 1,000 and 10,000,000 files.
8. Tracked directory totals are capped at 100,000 directories.
9. Top result lists are capped between 10 and 500 entries.
10. Access failures are counted and reported without aborting all measured evidence.
11. Native progress is emitted from real processed file, folder, and byte counters.
12. Cancellation uses a native atomic token.
13. Report export accepts only a native in-memory scan identifier; arbitrary report data is not accepted from the renderer.
14. Report file names are sanitized and written under the Tauri application-data directory.
15. Drive capacity uses Windows `GetLogicalDriveStringsW`, `GetDriveTypeW`, and `GetDiskFreeSpaceExW`.

## Known limitations

- “Old files” means old by modification time, not guaranteed last-open time.
- Directory totals are based on files reached by the scan; inaccessible descendants are excluded and counted separately.
- The visual storage bars are proportional summaries, not a fake treemap generated before scanning.
- External-drive inventory is limited to logical drives currently reported by Windows.
- Low-space checks run only when requested by the user.
- Export format is JSON only in this phase.
