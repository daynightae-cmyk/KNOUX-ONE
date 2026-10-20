# KNOUX ONE — Historical Records

Documents in this folder are preserved specifications of work that has already
been completed and merged into `main`. They are kept so the reasoning behind the
implementation stays reviewable. They are **not** live instructions.

| File | What it is | Status |
|---|---|---|
| `M16_PROJECT_ENGINEERING_DIRECTIVE.md` | The Module 16 "Project Engineering Center" directive, written before the module was built. It also carried the Module 03 and Module 15 acceptance requirements. | Executed. The Module 16 engine now lives in `src-tauri/src/projects/`, and M03/M15 are merged. |
| `M03_M15_M16_INTEGRATION_CHECKLIST.md` | The verification sequence required before merging the Module 03 / 15 / 16 integration. | Satisfied. All listed handlers, migrations and tests are in `main`. |
| `M03_M15_M16_DELETE_MANIFEST.txt` | The obsolete stub files the integration replaced. | Fully applied. Every listed path is absent from `main` (verified 2026-10-20). |

## Current plan of record

These files are not the current plan. The live documents are:

- `docs/audit/KNOUX_ONE_DEVELOPER_PROMPT_2026-10-20.ar.md` — the 11-phase plan.
- `docs/audit/KNOUX_ONE_FULL_AUDIT_2026-10-20.ar.md` — the audited baseline.
- `docs/audit/backlog.md` — work that is deliberately deferred.
- `docs/services/service-reality-baseline.json` — the generated evidence authority
  for every service state.

## Note on a directive that no longer applies

The directive tells an integrator to copy an uploaded overlay into the open
project. That procedure described a one-time external handoff and has no
meaning inside this repository, where the code is authored and merged directly.
The acceptance requirements it defines are still the authoritative description of
what Modules 03, 15 and 16 were built to do.
