# KNOUX ONE — restore guide and handover state

Written immediately before a Windows reinstall. Everything below is either already in
`origin/main` or listed here as **not** in Git, so nothing valuable should be lost.

## Where the work lives

| | |
| --- | --- |
| Canonical remote | `https://github.com/daynightae-cmyk/KNOUX-ONE.git` |
| Branch | `main` |
| `main` at time of writing | `80334ff8ec327346ab491c67354a63600015f2ad` |
| Previous local root | `D:\Knoux Projects\Knoux_Project_Center\01_Ready\KNOUX-ONE` |

The local repository was clean and identical to `origin/main`. Clone fresh after the reinstall:

```powershell
git clone https://github.com/daynightae-cmyk/KNOUX-ONE.git "D:\Knoux Projects\Knoux_Project_Center\01_Ready\KNOUX-ONE"
```

Branches that also exist on the remote, if you need the pre-merge commits:

- `chore/consolidate-local-knoux-one-20260926` (`30cf512`) — the three consolidation commits
  that were squash-merged as `83dc4d7`
- `fix/services-check-eol-normalization` (`6ae6ff1`) — squash-merged as `80334ff`

## What was implemented

Catalog moved from **80 implemented / 110 planned** to **104 implemented / 0 partial / 86 planned**.

| Module | Services | What it does |
| --- | --- | --- |
| M01 / M02 | essential-software inventory, cleanup planning | bounded PowerShell bridge, SHA-256 read-back |
| M03 | archives, audio, exif, images, media, video | duplicate-media analysis, split into six engines |
| M04 | storage reporting | new engine + migration `004_storage_reports.sql` |
| M09 | capability permissions, advertising id, clipboard, hosts file | privacy inspection |
| M10 | Defender, firewall, UAC, SmartScreen, Secure Boot/TPM | security status, read-only |
| M11 | settings, environment, bookmark backup, registry export, restore readiness | file-writing backup with verification |

## Runtime verification status — read this before claiming anything

**No service is `RUNTIME_VERIFIED`. The global runtime gate is `BLOCKED`.**

- Build PASS is not runtime proof. Every gate result below is a compile, test or script result.
- No human has launched the Tauri application and driven commands through the real IPC
  boundary, so the command layer and the React panels are unexercised at runtime.
- The M11 registry evidence is mechanism-level: `reg.exe export` was run directly against all
  six allowlisted keys and produced valid `.reg` files, which proves the export command, the
  flat file names and the header check — not the Tauri path.
- Deliberately still `planned`, not stubbed: M10-S02/S03/S04 (Defender scans), M09-S07/S08/S10
  (delete or rewrite user data), M11-S01/S04 (need elevation), M11-S02 (bulk user data),
  M11-S10 (scheduled task).

## Toolchain to reinstall

| Tool | Version | Why |
| --- | --- | --- |
| Bun | **1.3.14** exactly | `bun.lock` is the canonical lockfile; CI pins this version |
| Rust | stable with `rustfmt` + `clippy` | CI uses `dtolnay/rust-toolchain@stable` |
| MSVC build tools | required | `cargo build` needs the MSVC linker |

`bun.lock` is the one canonical frontend lockfile. Do not create `package-lock.json`,
`pnpm-lock.yaml` or `yarn.lock` — CI fails the build if any of them appear.

## First commands after cloning

```powershell
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

Expect: 109 frontend tests, 284 Rust tests, all green.

A full `cargo build --locked --release --all-features` takes roughly 18 minutes and needs
about 9 GB of free disk for `src-tauri/target`. The previously built binary was:

- `knoux-one.exe`, 25,870,336 bytes
- SHA-256 `c7acdff15c1750bfb57f423d385d83a158b558603de7ba174531fd6d47cac0be`

It was a build artifact and was **not** committed. Rebuild it rather than trusting a copy.

## Where the build caches went

`src-tauri/target` (9.19 GB) and `dist` were deleted after the release build and after CI
passed, because they are reproducible from source. Expect the first build after the reinstall
to be slow. `node_modules` was kept on purpose so a reinstall is not needed twice.

## Implementation log

`docs/implementation-log/` holds the reasoning that is not recoverable from the code:

| File | Contents |
| --- | --- |
| `reality-refresh-and-execution-plan.md` | starting state of the repository and the plan |
| `progressive-batches-1-3.md` | batches 1-3 (M01, M02, M10, M09) |
| `planned-batch-closure.md` | batch 4 (M11) and batch 5 (S07/S09), including the three real bugs the tests caught |
| `execution-log.md` | command-by-command execution record |

## Not in Git — check these before wiping the disk

A Windows reinstall may or may not format `D:`. If it does, the following are gone. None of
it belongs to KNOUX ONE, so it was deliberately left untouched rather than committed to this
repository.

| Path | Size | Why it is still there |
| --- | --- | --- |
| `D:\KNOUX-PRESERVATION-20260926-0905` | 817 MB | Safety snapshot made by a separate audit. Contains **KForge**, **YaRasoolAllah** and **KNOUX Repair** work that is *not* merged anywhere, plus git bundles. That audit's own `CLASSIFICATION.md` says its cleanup gate is not met. |
| `D:\Compressed\KNOUX-ONE-v1.1.0-LATEST-SOURCE` | 1 MB | 42 files that are in no branch, including `BUILD_AND_VALIDATION.md` and `docs/M16_PROJECT_ENGINEERING.md` |
| `D:\Compressed\KNOUX-ONE-Gemini-Integration-M03-M15-Next-M16-FINAL` | 1 MB | 7 unique files: build prompts, checklists, a nested `.rar` |
| `C:\Users\day night\.traycer\worktrees\daynightae-cmyk__knoux-one` | 56 MB | 7 old snapshots. Verified hash-by-hash to have **zero** content missing from `origin/main`, so loss is acceptable, but they are the only on-disk copy. |

KForge, YaRasoolAllah and the other products under `D:\Knoux Projects\Knoux_Project_Center\01_Ready`
each have their own unmerged work. Push those repositories before reinstalling if they matter.
