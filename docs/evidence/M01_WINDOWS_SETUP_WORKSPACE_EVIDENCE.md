# M01 Windows Setup Workspace — Evidence

## Scope

This delivery replaces the generic M01 **Post-Format Setup** route with the dedicated `WindowsSetupWorkspace`. The prior generic workspace could execute a catalog capability without supplying the selected application package ID required by the native Winget install contract. The dedicated workspace retains the real, constrained M01 chain and prevents installation controls from becoming available before a successful local Winget verification.

## Implemented execution chains

| User action | UI and TypeScript contract | Registered native capability | Real Windows effect / evidence | Honest result handling |
|---|---|---|---|---|
| Inspect device | `PostFormatView` → `WindowsSetupWorkspace` → `setupClient.discover()` | `m01.system.discover` | Rust queries Windows CIM and security providers; it returns measured hardware and security data | The UI renders only returned evidence; no discovery data is fabricated. |
| Verify Winget | `WindowsSetupWorkspace` → `setupClient.verifyWinget()` | `m01.winget.verify` | Rust resolves the local `winget.exe` and reads its real version | The returned executable path/version is shown only when supplied by the native result. |
| Install selected package | `WindowsSetupWorkspace` → `setupClient.install(packageId)` | `m01.winget.install` | Rust validates the requested ID against its allowlist, queues it, invokes Winget, and performs its native post-install verification | The button is disabled until Winget verification succeeds. Activity is marked completed only for `completed` or `completed_with_warnings`; the queue is reloaded from native persistence. |
| Resume queue | `WindowsSetupWorkspace` → `setupClient.resumeQueue()` | `m01.winget.queue.resume` | Rust resumes recorded queued/interrupted work under the same constrained handler | Queue statuses are read from the native queue, not simulated in the UI. |

## Contract alignment

`SystemDiscoveryData` now consumes `totalRamGB` and `availableRamGB`, matching the JSON naming emitted by Rust. It also describes the logical-volume and security-evidence fields emitted by the discovery contract. The UI reads `totalRamGB`; it does not rely on the obsolete `totalRamGb` spelling.

## Safety controls

> No installation was initiated during validation. The only live operational check was the read-only Winget version command.

The selected package is passed as `{ packageId }` to the registered `m01.winget.install` capability; no arbitrary executable or argument surface is exposed by the interface. Failed verification leaves `wingetStatus` empty and the install control disabled. A native result is never replaced by a client-side success state.

## Validation performed on the connected Windows workstation

| Validation | Result |
|---|---|
| Actual local Winget availability | `C:\Users\day night\AppData\Local\Microsoft\WindowsApps\winget.exe` reported `v1.29.280` |
| `bun run typecheck` | Passed |
| `bun run test` | Passed: 17 files, 63 tests |
| `bun run build` | Passed |
| `cargo fmt --check` | Passed |
| `cargo check --locked --all-targets --all-features` | Passed |
| `cargo clippy --locked --all-targets --all-features -- -D warnings` | Passed |
| `cargo test --locked --all-features` | Passed: 11 tests, including measured Windows discovery runtime evidence |
| Debug NSIS bundle | Passed: `src-tauri\target\debug\bundle\nsis\KNOUX ONE_1.0.0_x64-setup.exe` |

## Automated regression coverage

`src/tests/windowsSetupWorkspace.test.ts` verifies that the Post-Format route uses `WindowsSetupWorkspace` rather than `UniversalServiceWorkspace`, that install controls require prior Winget verification, that the native installer is passed `{ packageId }`, and that the TypeScript contract uses the Rust-compatible RAM field names.

## Explicit limits

This delivery does not promote new services, alter the catalog, install any application, create a release tag, or bypass the existing Authenticode blocker. `BLOCKED-001` remains unchanged: a real Authenticode signing material is required before public release artifacts may be produced.
