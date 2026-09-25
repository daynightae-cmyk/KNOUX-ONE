# Unified Workspace Baseline

Recorded on 2026-09-25 before the shell migration.

## Authority

- Baseline SHA: `55b6d800f999af5a58c33101a9d65688dbc61dc9`
- Branch point: current `origin/main`; local `HEAD` and `origin/main` matched and the worktree was clean.
- Protected architecture: React 19 + TypeScript + Vite renderer, Tauri 2 bridge, explicit TypeScript command allowlist, typed native contracts, registered Rust handlers, confirmation/elevation boundaries, and measured local evidence.

## Service truth

The generated baseline (`bun run services:check`) is the detailed evidence authority:

| Metric | Count |
|---|---:|
| Modules | 19 |
| Services | 190 |
| Statically verified | 74 |
| Partial, native path with documented limits | 6 |
| Planned, non-executable | 110 |
| Windows runtime verified in repository evidence | 0 |

The catalog has 80 native-linked services. Six of those are deliberately classified `PARTIAL` by the generated reality baseline: M03-S03, M03-S04, M03-S05, M03-S07, M04-S05, and M04-S10. “Native-linked” must not be reported as Windows runtime verification.

Currently native-linked modules: M01 (3), M02 (7), M03 (10), M04 (10), M05 (10), M06 (10), M07 (10), M08 (10), and M15 (10). M09–M14 and M16–M19 remain planned.

## Validation commands

```bash
bun install --frozen-lockfile
bun run services:check
bun run release:verify-version
bun run typecheck
bun run test
bun run build
cd src-tauri
cargo fmt --check
cargo check --locked --all-targets --all-features
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked --all-features
```

## Known release blockers

- The generated service baseline records no Windows runtime-verified services; static traceability is not runtime proof.
- Windows packaging, installer behavior, and Authenticode/updater signing require owner-managed Windows infrastructure and signing material.
- The repository build emits a large single-chunk warning; this shell mission records the before/after size and does not replace the established renderer architecture.

## Expected UI change surface

- `src/App.tsx`
- `src/components/layout/{Sidebar,Header,CommandPalette,InspectorPanel,OperationDrawer}.tsx`
- `src/components/common/UniversalServiceWorkspace.tsx`
- `src/context/KnouxContext.tsx`
- `src/shell/workspaceRegistry.ts`
- `src/services/{servicePresentation,operationService}.ts`
- `src/workspace.css`
- shell integrity tests and workspace documentation

The dedicated M01–M08 and M15 feature workspaces and all Rust engines are protected from presentation-only rewrites.
