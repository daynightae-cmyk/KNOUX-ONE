# KNOUX ONE Production Service Acquisition Pack

Research date: 2026-09-25  
Repository: `daynightae-cmyk/KNOUX-ONE`  
Authority SHA inspected: `9ac54af896d248d1d948f83d52920bf890cf9866`

## Reality verdict

- 19 modules, 190 catalog services.
- 74 `STATIC_VERIFIED`, 6 `PARTIAL`, 110 `PLANNED`.
- The repository baseline still records `RUNTIME_VERIFIED = 0`.
- The baseline's historical global runtime gate says `BLOCKED`, but current GitHub checks on `9ac54af896d248d1d948f83d52920bf890cf9866` show **Web quality = success**, **Windows native quality = success**, and **Dependency integrity and secret scan = success**.
- This proves current CI/build quality for the checked paths. It does **not** prove per-service Windows runtime behavior.
- Existing architecture correctly uses an explicit native command allowlist and refuses planned execution. Preserve that boundary.

## Highest-priority closure

1. M03-S03 Similar-image detection
2. M03-S04 Duplicate-video detection
3. M03-S05 Duplicate-audio detection
4. M03-S07 Duplicate-archive detection
5. M04-S05 Old files
6. M04-S10 Exportable storage reports

See `implementation/PARTIAL_SERVICES_CLOSURE.md`.

## Product contract

Every service is treated as a small professional product:
- simple safe mode;
- advanced typed controls;
- explicit preflight and privilege state;
- preview/review before mutation;
- structured result and evidence;
- terminal-like evidence only for the exact allowlisted operation;
- cancellation only when technically safe;
- undo/restore only when real;
- durable history where it helps;
- no arbitrary shell;
- no fake progress;
- no fake health score;
- no cloud dependency for core local Windows capabilities.

## Pack map

- `01_REPOSITORY_REALITY.md`: inspected repository reality and CI gate.
- `02_SERVICE_PRIORITY_MATRIX.md`: all modules and phase order.
- `03_WINDOWS_SOURCE_MAP.md`: Windows source hierarchy.
- `04_API_AND_OS_INTERFACE_CATALOG.md`: recommended platform interfaces.
- `05_OPEN_SOURCE_REFERENCE_CATALOG.md`: external implementation references.
- `06_LICENSE_MATRIX.md`: licensing constraints.
- `07_SECURITY_MODEL.md`: native/Tauri safety boundary.
- `08_DATABASE_ARCHITECTURE.md` + `database/`: SQLite model.
- `09_UI_CONTROL_MODEL.md`: simple/advanced service surfaces.
- `10_TERMINAL_EVIDENCE_MODEL.md`: controlled technical evidence.
- `11_OPERATION_LIFECYCLE.md`: operation state machine.
- `12_RUNTIME_VERIFICATION_PLAN.md`: exact evidence needed for runtime promotion.
- `contracts/services.json`: machine-readable records for all 190 services.
- `modules/`: 19 module documents.
- `services/`: 190 service documents.
- `implementation/`: technical execution sequence and closure maps.
