# KNOUX ONE — Windows Intelligence & Developer Suite

> **Build • Protect • Optimize**  
> *A Knoux Product — Crafted by Eng. Sadek Elgazar (Knoux)*

KNOUX ONE is a Windows desktop workspace built with **Tauri 2, Rust, React 19, and TypeScript**. The project follows an evidence-first rule: a service is marked implemented only when an allowlisted native handler, typed contract, verification path, and tests exist.

The desktop application is the product. `knoux-one.vercel.app` serves the renderer only, with every native operation disabled, and it is not evidence that any service works on Windows — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Current verified implementation matrix

The generated service-reality baseline is the detailed evidence authority. Run `bun run services:check` to verify it has not drifted.

<!-- service-reality:begin -->
| Evidence state | Count |
|---|---:|
| Modules | 19 |
| Services | 190 |
| Statically verified native paths | 72 |
| Partial native paths with documented limits | 0 |
| Planned, non-executable | 89 |
| Runtime verified on Windows in repository evidence | 29 |
<!-- service-reality:end -->

**This table is generated.** `scripts/generate-service-reality.ts` rewrites the block above from the same counts that produce the baseline, and `services:check` fails when the two disagree, so the README cannot drift away from the evidence it summarises.

The active catalog contains **101 implemented services** — 29 runtime verified on Windows and 72 statically verified. Those are different claims and the distinction matters: a statically verified service has an allowlisted native command, a typed contract and passing tests, but nobody has yet driven its full path on Windows. **The global runtime gate is BLOCKED at 29 of 101 (28.71%)**, and the 72 services still missing runtime evidence are listed by service id in the generated baseline rather than summarised as "mostly verified". No count in this repository is a production-readiness claim; verification so far covers one machine on one day.

M09–M14 and M16–M19 remain planned and expose no handler. Browser preview never fabricates host readings or successful desktop operations. See [`REAL_IMPLEMENTATION_MATRIX.md`](REAL_IMPLEMENTATION_MATRIX.md) and the generated [`docs/services/service-reality-baseline.md`](docs/services/service-reality-baseline.md) for exact service evidence and limitations.

## Unified workspace shell

The renderer uses one registry-driven desktop shell for all 19 modules: canonical grouped navigation, global Arabic/English search, a safe navigation-only command palette, a contextual service inspector, and a session operation drawer. Dedicated native workspaces for setup, cleanup, duplicates, storage, startup, performance, repair, network, and Developer Studio remain intact inside the shell.

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
