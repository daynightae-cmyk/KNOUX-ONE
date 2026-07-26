# KNOUX ONE — Windows Intelligence & Developer Suite

> **Build • Protect • Optimize**  
> *A Knoux Product — Crafted by Eng. Sadek Elgazar (Knoux)*

KNOUX ONE is a Windows desktop workspace built with **Tauri 2, Rust, React 19, and TypeScript**. The project follows an evidence-first rule: a service is marked implemented only when an allowlisted native handler, typed contract, verification path, and tests exist.

## Current verified implementation matrix

### Module 01 — First Run & Post-Format Setup

| Service | State | Notes |
|---|---|---|
| Windows and hardware discovery | Partial | Reads real Windows CIM information; unavailable fields remain optional |
| Winget availability verification | Implemented | Resolves the real executable and version |
| Verified package installation | Partial | Allowlisted Winget install with post-install verification; full persistent queue is not complete |
| Remaining Module 01 services | Planned | No executable handler is exposed |

### Module 03 — Duplicate Control Center

| Service | State |
|---|---|
| Exact duplicate scan | Implemented |
| Fast candidate scan | Implemented |
| Similar image review | Partial |
| Video duplicate review | Partial |
| Audio duplicate review | Partial |
| Document duplicate review | Implemented |
| Archive duplicate review | Partial |
| Folder comparison | Implemented |
| Keeper rule planning | Implemented |
| Verified quarantine and restore | Implemented |

Module 03 uses real local BLAKE3 verification, changed-file checks, hard-link awareness, SQLite scan history, explainable keeper planning, and checksum-verified quarantine/restore. Web preview never fabricates duplicate files or successful desktop operations.

See [`docs/M03_DUPLICATE_ENGINE.md`](docs/M03_DUPLICATE_ENGINE.md) for safety invariants and exact limitations.

### Module 15 — KNOUX Developer Studio

| Service | State |
|---|---|
| Workstation toolchain discovery | Implemented |
| PATH diagnostics laboratory | Implemented |
| Runtime and version-manager inspection | Implemented |
| Secure Git configuration audit | Implemented |
| Repository intelligence scanner | Implemented |
| Ports and process control | Implemented |
| Multi-ecosystem project health | Implemented |
| Developer cache control | Implemented |
| Local HTTP and API laboratory | Implemented |
| Developer evidence report | Implemented |

Developer Studio reads real Windows toolchains, PATH scopes, Git settings, repositories, listening endpoints, project manifests, and recognized caches through explicit allowlisted commands. Process termination requires `STOP <PID>`, cache cleanup requires `CLEAN`, protected processes and arbitrary cleanup paths are blocked, and browser preview remains non-executable.

See [`docs/M15_DEVELOPER_STUDIO.md`](docs/M15_DEVELOPER_STUDIO.md) for the service matrix, safety controls, and operational boundaries.

### Modules 02, 04–14, and 17–19

Planned. They remain visible as product roadmap workspaces but expose no executable native handlers.

### Module 16 — Project Engineering

Planned as a separate independently verified phase. It exposes no executable native handlers.

## Safety boundaries

1. Native command names are resolved through an explicit TypeScript allowlist; no arbitrary shell endpoint exists.
2. Browser preview returns `desktop_runtime_unavailable` for desktop operations.
3. Candidate duplicate groups are non-actionable until full verification.
4. System-critical paths are protected.
5. Every actionable duplicate group requires one verified keeper.
6. Cross-volume quarantine copies, flushes, verifies BLAKE3, and only then removes the source.
7. Permanent purge requires typed confirmation and does not claim guaranteed SSD secure erasure.
8. Developer Studio does not collect Git tokens, passwords, or credential payloads.
9. Process termination blocks protected processes and requires exact typed confirmation.
10. Developer cache cleanup is restricted to recognized allowlisted cache paths.
11. SQLite data is stored under the Tauri application-data directory, not browser localStorage.

## Development requirements

- Windows 10/11 x64 for desktop execution and packaging
- WebView2 Runtime
- Visual Studio Build Tools 2022 with the C++ workload
- Node.js 18 or newer
- Rust stable MSVC toolchain

## Validation commands

```bash
npm install
npm run typecheck
npm run test
npm run build

cd src-tauri
cargo fmt --check
cargo check --all-targets --all-features
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features
```

Windows desktop package:

```bash
npm run desktop:build
```

The repository workflow `.github/workflows/m03-native-validation.yml` runs Rust formatting, compilation, Clippy, and native tests on `windows-latest`.
