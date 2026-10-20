# Runtime verification cycle 1 — plan

Cycle start: 2026-10-20
Target commit: `75b8a95` (`main` after the module documentation merge)
Local host: `DESKTOP-VQKU9P8`, Windows 10 Pro 10.0.19045, WebView2 155.0.4283.62

## Scope

This cycle moves catalog services from `STATIC_VERIFIED` to `RUNTIME_VERIFIED`
only when a real run on a Windows host satisfies all four stages recorded by
`docs/evidence/windows-runtime-evidence.json`:

1. the UI control is clicked,
2. the typed client crosses the Tauri IPC boundary,
3. the native Rust command executes,
4. the measured result is rendered back into the interface.

The 29 existing runtime records were captured on `DESKTOP-FCJJB5O`. They stay
valid for the services they name; this cycle adds records for the 86 services
that currently carry static evidence only.

A failed run is recorded as a defect. It is never converted into a pass, and no
service state is promoted by inference.

## Batch order

The 86 static services split into 54 read-only services and 32 that either need
elevation or change system state. Read-only services run first. Sensitive
services are separated so a failure cannot be confused with a destructive
action, and every sensitive action needs its documented typed confirmation.

### Batch A1 — read-only, no target selection (25)

M05-S01, M05-S02, M05-S03, M05-S05, M05-S06, M05-S10,
M06-S01, M06-S02, M06-S03, M06-S04, M06-S05, M06-S06, M06-S10,
M10-S06,
M15-S02, M15-S04, M15-S08,
M17-S01, M17-S02, M17-S03, M17-S04, M17-S05, M17-S06, M17-S07, M17-S08.

### Batch A2 — read-only with a selected project or folder (18)

M02-S07,
M03-S01, M03-S02, M03-S03, M03-S04, M03-S05, M03-S06, M03-S07, M03-S08, M03-S09,
M04-S01, M04-S07,
M15-S10,
M16-S05, M16-S06, M16-S08,
M17-S09, M17-S10.

### Batch A3 — read-only network probes (7)

M08-S01, M08-S02, M08-S03, M08-S04, M08-S05, M08-S09, M08-S10.

### Batch A4 — read-only privacy and restore inventory (4)

M09-S02, M09-S03, M09-S04, M11-S09.

### Batch B1 — read-only but elevated or flagged sensitive (7)

M02-S02, M02-S05,
M05-S04,
M07-S02, M07-S03,
M10-S01, M10-S05.

### Batch B2 — reversible state changes (13)

M01-S08,
M03-S10,
M05-S07, M05-S08, M05-S09,
M06-S07, M06-S08, M06-S09,
M08-S06,
M09-S06,
M11-S07,
M15-S09,
M16-S07.

### Batch B3 — repairs, installs, and resets (12)

M01-S05,
M02-S09,
M07-S01, M07-S04, M07-S05, M07-S06, M07-S07, M07-S08, M07-S09, M07-S10,
M08-S07, M08-S08.

## Recording rules

- One evidence record per service, keyed by catalog service id.
- The record names the handler, the native command, the timestamp, the host,
  and the rendered text that proves stage 4.
- Exported artifacts (bundles, reports, backups) are recorded with their path,
  size, and SHA-256 prefix.
- A service that renders an explicit unavailable or refused state is not a pass
  unless the service contract says that state is the correct measurement.
- Batch results are merged as one change per batch, after typecheck, tests,
  `services:check`, and the runtime evidence regeneration pass.

## Infrastructure

The binary for this cycle is produced by `.github/workflows/verification-build.yml`
from the cycle commit. It is an unsigned debug build, uploaded as a
short-lived artifact, and it is not a release. Local MSVC and Windows SDK
components are absent on the cycle host, so the build runs on a Windows runner
instead of pretending a local link succeeded.
