# Module 16 — Code & Project Tools

Module 16 is a local-first project engineering workspace. It operates only on user-selected project roots and never uploads source code, environment values, Git data, or reports.

## Catalog exposure

Module 16 names ten catalog services, and they are **not** a one-to-one mirror of the native commands. The catalog deliberately publishes only the commands whose measurement matches the service name:

| Service | State | Handler | Native command |
|---|---|---|---|
| S05 Dependency audit | Implemented | `m16.dependencies.audit` | `m16_dependencies_audit` |
| S06 Environment-variable validator | Implemented | `m16.environment.audit` | `m16_environment_audit` |
| S07 Build-artifact cleanup | Implemented | `m16.cache.manage` | `m16_cache_manage` |
| S08 Project-size analyzer | Implemented | `m16.source.analyze` | `m16_source_analyze` |
| S01 Clone a Git repository | Planned | — | — |
| S02 Approved project templates | Planned | — | — |
| S03 Initialize a Git repository | Planned | — | — |
| S04 GitHub publishing wizard | Planned | — | — |
| S09 JSON & YAML tools | Planned | — | — |
| S10 API testing workspace | Planned | — | — |

S01–S04 and S09–S10 stay planned because no native command measures what those
service names describe. The workspace still exposes project discovery, task
listing, Git status, runtime inspection and report export as workspace tools;
those commands run and report results, and they honestly state that no catalog
service owns them instead of borrowing another service's identity.

The four implemented services are statically verified. None carries recorded
Windows runtime evidence yet, so the honest state is "the native command exists
and is wired", not "the path was driven on a real Windows host".
`docs/services/service-reality-baseline.json` is the authority for that split.

## Native commands

The `src-tauri/src/projects/` engine registers ten commands. Six of them are
workspace tools that no catalog service names:

| Native command | Catalog service | Role |
|---|---|---|
| `m16_projects_discover` | — | Project discovery and indexing (workspace tool) |
| `m16_projects_health` | — | Project health audit (workspace tool) |
| `m16_commands_execute` | — | Manifest-derived task execution (workspace tool) |
| `m16_git_workspace` | — | Git workspace intelligence (workspace tool) |
| `m16_runtime_orchestrate` | — | Process and port inspection (workspace tool) |
| `m16_reports_export` | — | Evidence report export (workspace tool) |

All ten resolve through the static allowlist in
`src/services/nativeCommandRegistry.ts` and are registered in
`src-tauri/src/main.rs`.

## Safety invariants

- User-selected roots only.
- Canonical path validation.
- Protected Windows roots rejected.
- Symlinks and junctions are not followed by scanners.
- Environment values are never returned; only key names are compared.
- Secret-like evidence is redacted.
- Arbitrary shell input is not exposed; commands are rediscovered from manifests or reviewed ecosystem tasks.
- Sensitive tasks require the literal `RUN <task_id>` confirmation.
- Cache cleanup is restricted to allowlisted generated directories and requires `CLEAN`.
- Process termination requires `STOP <PID>` and rejects protected processes.
- Reports remain local and can redact absolute user paths.
- Browser preview returns an unavailable state rather than fabricated host data.

## Persistence

SQLite is stored in the Tauri application-data directory. The project index,
exported project reports, diagnostic sessions and exported diagnostic artifacts
are persisted by migration `005_projects_and_diagnostics.sql`, so the interface
shows what was actually inspected on this machine instead of reconstructing it
from memory.

## Known limitations

- Full semantic code analysis is not implemented.
- Online vulnerability or outdated-dependency commands are not silently executed.
- Project commands do not stream output or support cancellation.
- Git write actions are intentionally unavailable.
- Runtime restart workflows are not implemented.
- Windows packaging must be validated on a Windows CI runner.
