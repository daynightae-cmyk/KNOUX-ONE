# KNOUX ONE — Real Implementation Matrix

This file records implementation evidence. A service is not marked `implemented` unless it has a user-facing flow, an explicit TypeScript handler, an allowlisted native command, a registered Rust function, real data or operating-system behavior, safety controls, and tests.

## Current catalog totals on this branch

| Metric | Count |
|---|---:|
| Modules | 19 |
| Services | 190 |
| Implemented services | 40 |
| Partial services | 0 |
| Planned services | 150 |

The 150 planned services remain non-executable and do not carry fabricated handlers.

## Module matrix

| Module | User-facing name | Implemented | Partial | Planned | Evidence |
|---|---|---:|---:|---:|---|
| M01 | تجهيز الجهاز بعد تثبيت Windows | 3 | 0 | 7 | Windows CIM/firmware/security evidence and persistent resumable Winget queue |
| M02 | تنظيف الملفات غير الضرورية | 7 | 0 | 3 | Verified scan snapshots, signed UAC manifest, bounded log discovery, reversible Downloads quarantine |
| M03 | البحث عن الملفات المكررة | 10 | 0 | 0 | Exact BLAKE3, multi-signal images, decoded video/audio fingerprints, safe archive manifests, quarantine |
| M04 | معرفة ما يستهلك مساحة الجهاز | 10 | 0 | 0 | Access-time evidence, logical/physical drives, persisted background monitor, PDF + JSON report |
| M05–M14 | Remaining user modules | 0 | 0 | 100 | Planned; no executable handlers |
| M15 | أدوات المطور | 10 | 0 | 0 | Explicit local developer commands and evidence reports |
| M16–M19 | Remaining modules | 0 | 0 | 40 | Planned; no executable handlers |

## Fourteen completed services

| Service | Handler | Completed Rust command | Real behavior / data source |
|---|---|---|---|
| M01-S01 Device evidence | `m01.system.discover` | `m01_system_discover_complete` | CIM OS/computer/CPU, BIOS, baseboard, disks, GPUs, battery, Secure Boot and TPM |
| M01-S05 Curated installation | `m01.winget.install` | `m01_winget_install_queued` | Allowlisted Winget execution, post-verification, AppData queue, retry and resume |
| M02-S02 Windows Temp | `m02.scan.windows_temp` | `m02_scan_windows_temp_complete` | Signed SHA-256 manifest and UAC helper with root, reparse-point, size and timestamp checks |
| M02-S05 Crash reports | `m02.scan.crash_dumps` | `m02_scan_crash_dumps_complete` | User and protected WER/CrashDumps evidence, elevated verified deletion where required |
| M02-S07 Old logs | `m02.scan.application_logs` | `m02_scan_application_logs_complete` | Bounded LocalAppData log/report/WER/crash discovery without Event Log mutation |
| M02-S09 Old installers | `m02.scan.old_downloads` | `m02_scan_old_downloads_complete` | Verified Downloads selection, BLAKE3 AppData quarantine and restore UI |
| M03-S03 Similar images | `m03.scan.images` | `m03_scan_images_complete` | dHash, aHash, RGB histogram, dimensions and aspect-ratio clustering |
| M03-S04 Video comparison | `m03.scan.videos` | `m03_scan_videos_complete` | ffprobe stream evidence and bounded decoded grayscale-frame fingerprint |
| M03-S05 Audio comparison | `m03.scan.audio` | `m03_scan_audio_complete` | ffprobe evidence and normalized decoded PCM energy fingerprint |
| M03-S07 Archive comparison | `m03.scan.archives` | `m03_scan_archives_complete` | ZIP compression API and 7-Zip listing manifests without extraction |
| M04-S05 Old files | `m04.files.old` | `m04_old_files_complete` | Last-access timestamp when available; explicit per-file modification fallback |
| M04-S08 Connected storage | `m04.drives.external` | `m04_external_drives_complete` | Win32 logical volumes plus Get-PhysicalDisk media, bus, health, serial and capacity |
| M04-S09 Low-space monitor | `m04.space.check` | `m04_space_check_complete` | Persisted threshold/interval, in-process monitoring, Tauri events and Windows Toast |
| M04-S10 Storage report | `m04.report.export` | `m04_report_export_complete` | Valid PDF 1.4 report with JSON evidence sidecar from a native measured snapshot |

## User-facing workflows

- M01 has a dedicated device-evidence and Winget queue workspace with package selection, queue state and resume.
- M02 exposes scan, cleanup, UAC behavior, history, installer quarantine listing and restoration.
- M03 uses the existing dedicated duplicate control center; the four media handlers now route to completed engines.
- M04 exposes measured storage analysis and an in-app persistent low-space alert panel.

## Non-negotiable rules

- Never create `mXX.service.N` handlers.
- Never add a handler before the Rust command exists.
- Never use timers, random values, fixed sizes or sample host facts as operation results.
- Never expose planned services as executable.
- Never describe this branch as validated until TypeScript, Vitest, Vite, Cargo fmt/check/clippy/test have all passed.
