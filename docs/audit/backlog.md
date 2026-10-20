# KNOUX ONE — Deferred Backlog

Items intentionally deferred from the 2026-10-20 closure plan. Nothing here is
silently promoted to implemented or verified.

## Runtime verification debt
- 86 of 115 implemented services still have no captured Windows runtime run.
  Modules M03, M05, M06, M07, M08, M10, M11, M12, M13, M14, M16, M17, M18 and
  M19 are affected. The baseline remains 29 runtime-verified services until each
  run is captured on a real Windows host.
- Local `cargo check` is blocked by the missing MSVC `link.exe`; the CI Windows
  job is the authority for native compilation.

## Product decisions requiring the owner
- M13 Recovery Engine: escalation policy, restore-point scope and destructive
  action approvals.
- M14 Delete Request and Mutation Engine: mutation allow-list, dry-run rules and
  the exact approval surface.
- Operations history: retention window, export format and whether it is a
  separate workspace or part of the service studio.
- License selection. No license has been chosen.
- Support portal: whether the m19 support surface is a first-party help center
  or an external link.

## Release hardening not in the current phases
- Authenticode code signing and installer signing.
- Real captured screenshots for the README and release page.
- E2E, accessibility and visual regression suites beyond the current unit
  tests.
- Automatic update channel and rollback policy.

## Historical branches
- The eight unmerged historical branches listed in the audit remain untouched
  until their unique commits are reviewed or archived.
