# Repository Reality

## Authority

- Repository: `daynightae-cmyk/KNOUX-ONE`
- Branch: `main`
- SHA verified during research: `9ac54af896d248d1d948f83d52920bf890cf9866`
- Commit: merge of PR #15, `feat: unify KNOUX ONE workspace shell`
- Source-of-truth baseline declares: `src/data/capabilitiesCatalog.ts + src/services/nativeCommandRegistry.ts`.

## Catalog state

| State | Count |
|---|---:|
| STATIC_VERIFIED | 74 |
| PARTIAL | 6 |
| PLANNED | 110 |
| RUNTIME_VERIFIED | 0 |
| Total | 190 |

The repository itself explicitly forbids treating `STATIC_VERIFIED` as runtime proof.

## Native architecture observed

- `src/services/nativeCommandRegistry.ts` is an explicit allowlist.
- `src/services/operationService.ts` returns `planned` when a capability lacks an approved handler.
- Web preview returns `desktop_runtime_unavailable` rather than pretending native execution succeeded.
- `src-tauri/src/main.rs` registers concrete commands with `tauri::generate_handler!`.
- `src-tauri/Cargo.toml` already includes `rusqlite` with bundled SQLite, so the proposed persistence model should extend the existing local database approach, not invent a second datastore.

## Current CI evidence on the authority SHA

GitHub check-runs for `9ac54af896d248d1d948f83d52920bf890cf9866`:
- `Web quality`: SUCCESS
- `Windows native quality`: SUCCESS
- `Dependency integrity and secret scan`: SUCCESS

The Windows job includes Rust format, locked `cargo check`, Clippy with warnings denied, native tests, and an unsigned debug NSIS Tauri smoke build.

### Important reconciliation

`docs/services/service-reality-baseline.json` still contains an older generated `globalRuntimeGate.state = BLOCKED` message saying a clean Windows Tauri check had not yet passed. Current check-run evidence shows that build gate has since passed **on the same current main SHA**. Treat the baseline message as stale gate commentary, but keep `RUNTIME_VERIFIED = 0` until service-specific Windows runtime evidence exists.

## Release path observed

`src-tauri/tauri.conf.json`:
- builds NSIS + MSI;
- creates updater artifacts;
- updater endpoint points to GitHub Releases `latest.json`;
- updater public key is configured.

`release.yml` requires:
- immutable version tag matching package version;
- Tauri updater signing key;
- exactly one Authenticode mode: PFX or Azure Trusted Signing;
- pre-sign quality checks;
- signed installer + updater signatures;
- SHA-256 sums;
- SPDX SBOM;
- provenance/SBOM attestation;
- publish manifest last.

This is strong release plumbing, but release readiness still requires real product/runtime verification.
