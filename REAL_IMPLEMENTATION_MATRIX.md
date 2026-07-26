# KNOUX ONE — Real Implementation Matrix

This file records verified implementation states. A service is not marked `implemented` unless it has a user-facing flow, an explicit TypeScript handler, an allowlisted native command, a registered Rust function, real data or operating-system behavior, and tests.

## Current catalog totals

| Metric | Count |
|---|---:|
| Modules | 19 |
| Services | 190 |
| Implemented services | 26 |
| Partial services | 14 |
| Planned services | 150 |
| Catalog services with handler IDs | 40 |
| Explicit native handler mappings | 52 |

The 52 native mappings include operational helper commands such as cancellation, history, folder selection, job control, result retrieval, and scan execution that are not separate catalog services.

## Module matrix

| Module | User-facing name | Implemented | Partial | Planned | Evidence |
|---|---|---:|---:|---:|---|
| M01 | تجهيز الجهاز بعد تثبيت Windows | 1 | 2 | 7 | Windows discovery and allowlisted Winget commands |
| M02 | تنظيف الملفات غير الضرورية | 3 | 4 | 3 | Real allowlisted filesystem scan, verified deletion, cancellation, progress, and AppData history |
| M03 | البحث عن الملفات المكررة | 6 | 4 | 0 | BLAKE3 verification, keeper planning, quarantine, restore, SQLite evidence |
| M04 | معرفة ما يستهلك مساحة الجهاز | 6 | 4 | 0 | Real read-only path scanning, largest items, type totals, Windows drive capacity, cancellation, threshold check, and JSON evidence export |
| M05 | التحكم في برامج بدء التشغيل | 0 | 0 | 10 | Planned; no native handlers |
| M06 | تسريع الجهاز وتحسين الأداء | 0 | 0 | 10 | Planned; no native handlers |
| M07 | إصلاح مشاكل Windows | 0 | 0 | 10 | Planned; no native handlers |
| M08 | إصلاح وتحسين الإنترنت | 0 | 0 | 10 | Planned; no native handlers |
| M09 | حماية الخصوصية | 0 | 0 | 10 | Planned; no native handlers |
| M10 | فحص أمان الجهاز | 0 | 0 | 10 | Planned; no native handlers |
| M11 | النسخ الاحتياطي واستعادة الملفات | 0 | 0 | 10 | Planned; no native handlers |
| M12 | تثبيت وإزالة البرامج | 0 | 0 | 10 | Planned; no native handlers |
| M13 | أدوات الملفات والمجلدات | 0 | 0 | 10 | Planned; no native handlers |
| M14 | المهام التلقائية | 0 | 0 | 10 | Planned; no native handlers |
| M15 | أدوات المطور | 10 | 0 | 0 | Real toolchains, PATH, Git, repositories, ports, project health, cache, HTTP, and report commands |
| M16 | إدارة المشاريع البرمجية | 0 | 0 | 10 | Planned on `main`; no native handlers |
| M17 | فحص الأخطاء والسجلات | 0 | 0 | 10 | Planned; no native handlers |
| M18 | فحص مكونات الجهاز | 0 | 0 | 10 | Planned; no native handlers |
| M19 | الدعم والخدمات السحابية | 0 | 0 | 10 | Planned; no native handlers |

## Module 02 service evidence

| Service | State | Handler | Rust command | Data source / behavior |
|---|---|---|---|---|
| M02-S01 Your temporary files | Implemented | `m02.scan.user_temp` | `m02_scan_user_temp` | Current user temp filesystem |
| M02-S02 Windows temporary files | Partial | `m02.scan.windows_temp` | `m02_scan_windows_temp` | `%WINDIR%\Temp`; deletion depends on existing permissions |
| M02-S03 Browser temporary files | Implemented | `m02.scan.browser_cache` | `m02_scan_browser_cache` | Cache-only directories for supported browser profiles |
| M02-S04 Image thumbnail files | Implemented | `m02.scan.thumbnail_cache` | `m02_scan_thumbnail_cache` | Windows thumbnail/icon cache databases |
| M02-S05 Program crash reports | Partial | `m02.scan.crash_dumps` | `m02_scan_crash_dumps` | CrashDumps, WER report folders, and Minidump |
| M02-S06 Windows update delivery files | Planned | — | — | No service coordination or rollback implementation yet |
| M02-S07 Old application logs | Partial | `m02.scan.application_logs` | `m02_scan_application_logs` | Old log-like files under current user temp only |
| M02-S08 Recycle Bin review | Planned | — | — | Selective restore and purge not implemented |
| M02-S09 Old installers in Downloads | Partial | `m02.scan.old_downloads` | `m02_scan_old_downloads` | Read-only installer/archive review older than 30 days |
| M02-S10 Automatic cleanup schedules | Planned | — | — | Task Scheduler integration not implemented |

## Module 04 service evidence

| Service | State | Handler | Rust command | Data source / behavior |
|---|---|---|---|---|
| M04-S01 Storage map | Implemented | `m04.storage.scan` | `m04_storage_scan` | User-selected canonical directory, recursive read-only scan |
| M04-S02 Largest files | Implemented | `m04.files.largest` | `m04_largest_files` | Bounded ranking from measured file metadata |
| M04-S03 Largest folders | Implemented | `m04.folders.largest` | `m04_largest_folders` | Recursive ancestor totals derived from reached files |
| M04-S04 File types | Implemented | `m04.types.distribution` | `m04_type_distribution` | Real extension/category byte and file totals |
| M04-S05 Old files | Partial | `m04.files.old` | `m04_old_files` | Uses modification time; last-access time is not promised |
| M04-S06 Downloads folder | Implemented | `m04.downloads.analyze` | `m04_downloads_analyze` | `%USERPROFILE%\Downloads` |
| M04-S07 Program data folders | Implemented | `m04.appdata.analyze` | `m04_appdata_analyze` | `%LOCALAPPDATA%`, read-only |
| M04-S08 Connected drives | Partial | `m04.drives.external` | `m04_external_drives` | Windows logical drives and capacity through Win32 APIs |
| M04-S09 Low-space check | Partial | `m04.space.check` | `m04_space_check` | One-time free-space threshold comparison; no background monitor |
| M04-S10 Export storage report | Partial | `m04.report.export` | `m04_report_export` | JSON export from a native measured scan snapshot; no PDF |

## Non-negotiable rules

- Never create `mXX.service.N` handlers.
- Never change tests to accept a missing implementation.
- Never use timers or random values to create operation results.
- Never expose a planned service with an executable handler.
- Never describe Rust or Tauri as validated unless the native commands were compiled and tested.
- Update this matrix only after the implementation chain and tests are present.
