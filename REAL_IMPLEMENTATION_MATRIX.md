# KNOUX ONE — Real Implementation Matrix

This file records implementation evidence. A service is not marked `implemented` unless it has a user-facing flow, an explicit TypeScript handler, an allowlisted native command, a registered Rust function, real data or operating-system behavior, safety controls, and tests.

## Current catalog totals on this branch

| Metric | Count |
|---|---:|
| Modules | 19 |
| Services | 190 |
| Implemented services | 60 |
| Partial services | 0 |
| Planned services | 130 |

The 130 planned services remain non-executable and do not carry fabricated handlers.

## Module matrix

| Module | User-facing name | Implemented | Partial | Planned | Evidence |
|---|---|---:|---:|---:|---|
| M01 | تجهيز الجهاز بعد تثبيت Windows | 3 | 0 | 7 | Windows CIM/firmware/security evidence and persistent resumable Winget queue |
| M02 | تنظيف الملفات غير الضرورية | 7 | 0 | 3 | Verified scan snapshots, signed UAC manifest, bounded log discovery, reversible Downloads quarantine |
| M03 | البحث عن الملفات المكررة | 10 | 0 | 0 | Exact BLAKE3, multi-signal images, decoded video/audio fingerprints, safe archive manifests, quarantine |
| M04 | معرفة ما يستهلك مساحة الجهاز | 10 | 0 | 0 | Access-time evidence, logical/physical drives, persisted background monitor, PDF + JSON report |
| M05 | التحكم في برامج بدء التشغيل والخدمات | 10 | 0 | 0 | Registry and Startup-folder evidence, scheduled tasks, signed services, reversible user mutations, delays, profiles and Event 100 history |
| M06 | تسريع الجهاز وتحسين الأداء | 10 | 0 | 0 | Windows CPU/RAM/disk/network/process evidence, reversible priority and power-plan changes, transparent profiles and bounded benchmark |
| M07–M14 | Remaining user modules | 0 | 0 | 80 | Planned; no executable handlers |
| M15 | أدوات المطور | 10 | 0 | 0 | Explicit local developer commands and evidence reports |
| M16–M19 | Remaining modules | 0 | 0 | 40 | Planned; no executable handlers |

## Module 06 completed services

| Service | Handler | Rust command | Real behavior / safety boundary |
|---|---|---|---|
| M06-S01 CPU monitoring | `m06.cpu.monitor` | `m06_cpu_monitor` | Reads total/per-core utilization and measured clocks from Windows performance data |
| M06-S02 RAM monitoring | `m06.memory.monitor` | `m06_memory_monitor` | Reads physical, available, committed, cached and commit-limit memory evidence |
| M06-S03 Disk activity | `m06.disk.activity` | `m06_disk_activity` | Reads physical disk throughput, active time, transfers and queue length |
| M06-S04 Network activity | `m06.network.activity` | `m06_network_activity` | Reads adapter throughput and established TCP connection counts by owning process; does not fabricate per-process bandwidth |
| M06-S05 Process explorer | `m06.process.explorer` | `m06_process_explorer` | Reads parent PID, command, path, memory, CPU time, threads, handles and protected-process evidence |
| M06-S06 Heavy processes | `m06.process.heavy` | `m06_heavy_processes` | Uses a bounded two-sample CPU delta and real memory; explicitly avoids declaring a memory leak from one sample |
| M06-S07 Priority control | `m06.priority.manage` | `m06_priority_manage` | Blocks protected processes and Realtime priority; requires `PRIORITY <PID>` and journals previous priority for restoration |
| M06-S08 Power plans | `m06.power.manage` | `m06_power_plans_manage` | Reads installed powercfg schemes; typed-confirmed changes are journaled and restorable |
| M06-S09 Performance profiles | `m06.profiles.manage` | `m06_profiles_manage` | Persists an installed power scheme plus transparent CPU/RAM attention thresholds; no hidden registry tuning |
| M06-S10 Benchmark report | `m06.benchmark.report` | `m06_benchmark_report` | Runs a bounded SHA-256 CPU sample and 8 MB temporary disk write/read, removes the temporary file and stores JSON evidence |

## User-facing workflows

- M01 has a dedicated device-evidence and Winget queue workspace with package selection, queue state and resume.
- M02 exposes scan, cleanup, UAC behavior, history, installer quarantine listing and restoration.
- M03 uses the dedicated duplicate control center with real media and archive evidence.
- M04 exposes measured storage analysis and an in-app persistent low-space alert panel.
- M05 has a dedicated startup workspace for startup entries, tasks, services, impact, recommendations, delayed startup, profiles, restoration and boot history.
- M06 has a dedicated performance workspace for live native measurements, process evidence, reversible controls, power plans, profiles and benchmark reports.

## Non-negotiable rules

- Never create `mXX.service.N` handlers.
- Never add a handler before the Rust command exists.
- Never use timers, random values, fixed sizes or sample host facts as operation results.
- A polling timer may only request fresh native measurements; it must never manufacture progress or values.
- Never expose planned services as executable.
- Never describe this branch as validated until TypeScript, Vitest, Vite, Cargo fmt/check/clippy/test have all passed.
