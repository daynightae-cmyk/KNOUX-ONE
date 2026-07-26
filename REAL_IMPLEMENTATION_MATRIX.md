# KNOUX ONE — Real Implementation Matrix

This file records implementation evidence. A service is not marked `implemented` unless it has a user-facing flow, an explicit TypeScript handler, an allowlisted native command, a registered Rust function, real data or operating-system behavior, safety controls, and tests.

## Current catalog totals on this branch

| Metric | Count |
|---|---:|
| Modules | 19 |
| Services | 190 |
| Implemented services | 50 |
| Partial services | 0 |
| Planned services | 140 |

The 140 planned services remain non-executable and do not carry fabricated handlers.

## Module matrix

| Module | User-facing name | Implemented | Partial | Planned | Evidence |
|---|---|---:|---:|---:|---|
| M01 | تجهيز الجهاز بعد تثبيت Windows | 3 | 0 | 7 | Windows CIM/firmware/security evidence and persistent resumable Winget queue |
| M02 | تنظيف الملفات غير الضرورية | 7 | 0 | 3 | Verified scan snapshots, signed UAC manifest, bounded log discovery, reversible Downloads quarantine |
| M03 | البحث عن الملفات المكررة | 10 | 0 | 0 | Exact BLAKE3, multi-signal images, decoded video/audio fingerprints, safe archive manifests, quarantine |
| M04 | معرفة ما يستهلك مساحة الجهاز | 10 | 0 | 0 | Access-time evidence, logical/physical drives, persisted background monitor, PDF + JSON report |
| M05 | التحكم في برامج بدء التشغيل والخدمات | 10 | 0 | 0 | Registry and Startup-folder evidence, scheduled tasks, signed services, reversible user mutations, delays, profiles and Event 100 history |
| M06–M14 | Remaining user modules | 0 | 0 | 90 | Planned; no executable handlers |
| M15 | أدوات المطور | 10 | 0 | 0 | Explicit local developer commands and evidence reports |
| M16–M19 | Remaining modules | 0 | 0 | 40 | Planned; no executable handlers |

## Module 05 completed services

| Service | Handler | Rust command | Real behavior / safety boundary |
|---|---|---|---|
| M05-S01 Registry startup entries | `m05.registry.inspect` | `m05_registry_entries` | Reads HKCU/HKLM Run and RunOnce; Authenticode evidence; only user non-Microsoft entries are mutable |
| M05-S02 Startup folders | `m05.folders.inspect` | `m05_startup_folders` | Reads user/common Startup folders, resolves `.lnk`, and moves user entries to AppData backup for reversible disable |
| M05-S03 Scheduled startup tasks | `m05.tasks.inspect` | `m05_scheduled_tasks` | Reads boot/logon Task Scheduler entries and labels Microsoft task paths as protected |
| M05-S04 Windows services | `m05.services.inspect` | `m05_windows_services` | Read-only Win32_Service inventory with executable signature evidence and critical-service protection |
| M05-S05 Startup impact | `m05.impact.assess` | `m05_impact_assess` | Transparent heuristic based on signature/scope/command plus measured Diagnostics-Performance Event 100 history |
| M05-S06 Safe recommendations | `m05.recommendations.generate` | `m05_recommendations` | Recommendations only for mutable non-Microsoft user entries; no automatic change |
| M05-S07 Delayed startup | `m05.delay.manage` | `m05_delay_manage` | Creates a 30/60/90-second ONLOGON task, disables the original verified user entry, and supports one-step restoration |
| M05-S08 Startup profiles | `m05.profiles.manage` | `m05_profiles_manage` | Persists named AppData profiles and applies only mutable user-entry states |
| M05-S09 Restoration | `m05.restore.manage` | `m05_restore_manage` | AppData change journal restores registry values or moved Startup files after typed confirmation |
| M05-S10 Boot history | `m05.boot.history` | `m05_boot_history` | Reads measured BootTime, MainPathBootTime and BootPostBootTime from Windows Event 100 |

## User-facing workflows

- M01 has a dedicated device-evidence and Winget queue workspace with package selection, queue state and resume.
- M02 exposes scan, cleanup, UAC behavior, history, installer quarantine listing and restoration.
- M03 uses the dedicated duplicate control center with real media and archive evidence.
- M04 exposes measured storage analysis and an in-app persistent low-space alert panel.
- M05 has a dedicated startup workspace for startup entries, tasks, services, impact, recommendations, delayed startup, profiles, restoration and boot history.

## Non-negotiable rules

- Never create `mXX.service.N` handlers.
- Never add a handler before the Rust command exists.
- Never use timers, random values, fixed sizes or sample host facts as operation results.
- Never expose planned services as executable.
- Never describe this branch as validated until TypeScript, Vitest, Vite, Cargo fmt/check/clippy/test have all passed.
