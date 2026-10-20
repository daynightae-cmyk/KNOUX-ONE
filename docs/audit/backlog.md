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
- All eight historical branches were reviewed on 2026-10-20 and their unique
  content was either already present in `main` or preserved under
  `docs/history/`. The branches were then deleted. The M03/M15/M16 engineering
  directive and integration checklist that were the only genuinely unique files
  anywhere are now in `docs/history/`, with headers stating they are already
  executed.

## Accepted dependency advisory
- `glib 0.18.5` — GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429 — unsound
  `Iterator`/`DoubleEndedIterator` impls for `glib::VariantStrIter`.
  - The crate reaches the dependency graph only through `gtk`, which `tao`
    depends on under `cfg(any(target_os = "linux", target_os = "dragonfly",
    target_os = "freebsd", target_os = "openbsd"))`. KNOUX ONE ships Windows-only
    `nsis`/`msi` bundles, so `glib` is never compiled into the shipped binary.
  - The fix landed in `glib` 0.20.0. No published `tao` release requires a `gtk`
    new enough to pull that in (`gtk` 0.19 requires `glib` 0.22 but every
    published `tao` still requires `gtk ^0.18`), so the lockfile cannot be moved
    to a non-vulnerable `glib` from this repository.
  - This is enforced rather than asserted: `bun run verify:windows-deps` resolves
    the dependency graph for `x86_64-pc-windows-msvc` and fails if `glib` ever
    becomes reachable. The gate runs in the Windows native CI job.
  - Revisit when an upstream `tao`/`gtk` release makes `glib >= 0.20` reachable.

