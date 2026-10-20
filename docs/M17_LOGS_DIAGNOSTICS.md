# Module 17 — Logs & Diagnostics Intelligence Center

Module 17 is a local-first Windows evidence workspace. It uses explicit Tauri commands and PowerShell/CIM providers; the web preview exposes the interface but cannot fabricate host diagnostics.

## Implementation matrix

| Service | State | Evidence source |
|---|---|---|
| Windows Event Intelligence | Implemented | `Get-WinEvent` on allowlisted channels |
| Application Crash Correlation | Implemented | Application Error, WER, hang, and runtime events |
| Blue-Screen & Minidump Triage | Partial | BugCheck events and local minidump inventory; binary stacks need WinDbg/CDB |
| Reliability & Stability Timeline | Implemented | `Win32_ReliabilityRecords` |
| Windows Service Failure Diagnostics | Implemented | Service Control Manager and `Win32_Service` |
| Windows Update Failure Analysis | Implemented | WindowsUpdateClient events and `Get-HotFix` |
| Hardware, Driver & Kernel Warnings | Implemented | WHEA, Disk, Ntfs, Display, Kernel-PnP, storage providers |
| Network Incident Diagnostics | Implemented | adapter/IP configuration, validated target probe, network events |
| Redacted Diagnostic Support Bundle | Implemented | local ZIP with manifest, evidence, optional system summary, SHA-256 |
| Diagnostic Evidence & Incident Report | Implemented | local JSON, Markdown, or HTML report with redaction and SHA-256 |

All ten services are statically verified. None of them carries recorded Windows
runtime evidence yet, so the honest state of each is "the native command exists
and is wired", not "the path was driven on a real Windows host". The generated
`docs/services/service-reality-baseline.json` is the authority for that split.

## Safety invariants

- No arbitrary Event Log channel injection; queries use an allowlist.
- Network targets accept hostname/IP characters only.
- Diagnostic collection is read-only.
- Full secrets and user-profile paths are redacted from exports.
- Bundles and reports are written under Tauri application data and never uploaded automatically.
- Binary minidump analysis is not claimed without a Windows debugger.
- Native results are persisted in SQLite migrations under `005_projects_and_diagnostics.sql`.

## Native handlers

| Handler ID | Native command |
|---|---|
| `m17.events.query` | `m17_events_query` |
| `m17.crashes.correlate` | `m17_crashes_correlate` |
| `m17.bsod.triage` | `m17_bsod_triage` |
| `m17.reliability.timeline` | `m17_reliability_timeline` |
| `m17.services.diagnose` | `m17_services_diagnose` |
| `m17.updates.analyze` | `m17_updates_analyze` |
| `m17.hardware.warnings` | `m17_hardware_warnings` |
| `m17.network.diagnose` | `m17_network_diagnose` |
| `m17.bundle.export` | `m17_bundle_export` |
| `m17.report.export` | `m17_report_export` |

Every handler resolves through the static allowlist in
`src/services/nativeCommandRegistry.ts`, and every command is registered in
`src-tauri/src/main.rs`. The implementation lives in `src-tauri/src/diagnostics/`.
