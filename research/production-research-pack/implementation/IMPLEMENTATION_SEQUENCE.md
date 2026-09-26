# Recommended Implementation Sequence

## Phase A — shared production substrate
1. SQLite migrations + operation/evidence/artifact repositories.
2. Typed operation state machine.
3. Evidence/redaction model.
4. Safe path + file identity/revalidation utilities.
5. Fixed subprocess runner with executable identity, timeout, cancellation and stdout/stderr bounds.
6. Privilege/elevation broker.
7. Task Scheduler bridge.
8. Report/export engine.
9. Runtime evidence capture harness.

## Phase B — close six PARTIAL services
M03-S03, S04, S05, S07; M04-S05, S10.

## Phase C — finish local Windows planned services
M01/M02 planned gaps, then M09-M14, M16-M18 grouped by shared engines rather than module vanity.

## Phase D — runtime evidence pass for current STATIC_VERIFIED services
M01/M02/M03/M04/M05/M06/M07/M08/M15. Do not rewrite working code just to fit a new abstraction.

## Phase E — cloud/support
M19 only after concrete backend/auth/license/support contracts exist. Release Center can proceed earlier because the signed Tauri/GitHub release path already exists.

## Phase F — release readiness
Windows-host runtime matrix -> installer install/update/uninstall -> signed release candidate -> rollback/update evidence -> final service matrix refresh.
