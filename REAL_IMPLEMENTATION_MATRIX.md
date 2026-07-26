# KNOUX ONE — Real Implementation Matrix

This file records verified implementation states. A service is not marked `implemented` unless it has a user-facing flow, an explicit TypeScript handler, an allowlisted native command, a registered Rust function, real data or operating-system behavior, and tests.

## Current catalog totals

| Metric | Count |
|---|---:|
| Modules | 19 |
| Services | 190 |
| Implemented services | 20 |
| Partial services | 10 |
| Planned services | 160 |
| Catalog services with handler IDs | 30 |
| Explicit native handler mappings | 41 |

The 41 native mappings include operational helper commands such as cancellation, history, folder selection, job control, and result retrieval that are not separate catalog services.

## Module matrix

| Module | User-facing name | Implemented | Partial | Planned | Evidence |
|---|---|---:|---:|---:|---|
| M01 | تجهيز الجهاز بعد تثبيت Windows | 1 | 2 | 7 | Windows discovery and allowlisted Winget commands |
| M02 | تنظيف الملفات غير الضرورية | 3 | 4 | 3 | Real allowlisted filesystem scan, verified deletion, cancellation, progress, and AppData history |
| M03 | البحث عن الملفات المكررة | 6 | 4 | 0 | BLAKE3 verification, keeper planning, quarantine, restore, SQLite evidence |
| M04 | معرفة ما يستهلك مساحة الجهاز | 0 | 0 | 10 | Planned; no native handlers |
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

## Non-negotiable rules

- Never create `mXX.service.N` handlers.
- Never change tests to accept a missing implementation.
- Never use timers or random values to create operation results.
- Never expose a planned service with an executable handler.
- Never describe Rust or Tauri as validated unless the native commands were compiled and tested.
- Update this matrix only after the implementation chain and tests are present.
