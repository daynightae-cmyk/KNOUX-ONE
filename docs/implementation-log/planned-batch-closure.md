---
title: "Planned-batch closure: M01-S03/S04/S07/S08 and M02-S06/S08/S10"
kind: spec
comments: none
---

# Planned-batch closure — seven services moved from `planned` to `implemented`

## What changed and why

`src/services/nativeCommandRegistry.ts` declared five handler IDs — `m01.winget.repair`,
`m01.catalog.essential`, `m02.cache.delivery`, `m02.recycle.review`, `m02.cleanup.schedule` —
that mapped to Tauri command names **no Rust code defined**. `src/services/servicePresentation.ts`
derives `executable` from `resolveNativeCommand(handlerId)`, so the catalog was advertising a
capability the binary could not dispatch. That was the real blocker behind "implement the
original commands for the added contracts".

The batch-1..4 contract files (`planned_batch1..4.rs`, `src/types/plannedBatch1.ts`) also could
not have been implemented as written:

- `EssentialCatalogResponse { items, filter_applied }` had no way to distinguish a *measurement*
from a *curated list*. Filling `items` would have been fabricated data presented as a scan.
- `WingetRepairResponse` had no evidence field, so a repair claim would have had nothing behind it.
- `DeliveryCacheResponse.measurement_source` was a free-text field the engine was expected to fill.
- `CleanupProfileRequest` carried `dry_run` but no confirmation, so `dry_run: false` would have
meant "delete now" with no second gate.

They were replaced rather than implemented.

## The seven services

| Service | Handler → command | What is actually measured |
| --- | --- | --- |
| M01-S03 Winget repair guidance | `m01.winget.repair` → `m01_winget_repair_guide` | `Get-Command winget.exe`, `winget --version`, verbatim `winget source list`, newest files under the real `DiagOutputDir` |
| M01-S04 Essential software catalog | `m01.catalog.essential` → `m01_essential_catalog` | Uninstall registry across HKLM64 / HKLM32 / HKCU, resolved against a bundled policy file |
| M01-S07 Installed application inventory | `m01.apps.inventory.export` → `m01_installed_app_inventory_export` | The same registry read, rendered to JSON/CSV/HTML, hashed and read back |
| M01-S08 Post-format profiles | `m01.profiles.postformat.create` / `.list` → `m01_post_format_profile_create` / `m01_post_format_profiles` | Atomic write, read-back parse, SHA-256 of the committed bytes |
| M02-S06 Delivery Optimization cache | `m02.cache.delivery` → `m02_delivery_cache` | Cache directories via the file API + `Get-DeliveryOptimizationStatus` / `…PerfSnap` when present |
| M02-S08 Recycle Bin review | `m02.recycle.review` → `m02_recycle_bin_review` | `Shell.Application` Recycle Bin namespace detail columns |
| M02-S10 Scheduled cleanup profiles | `m02.cleanup.schedule` → `m02_cleanup_schedule` | Delegates measurement to `m02_cleanup_scan_complete` and deletion to `m02_cleanup_execute_complete` |

## The honesty decisions that shaped the design

**M01-S03 repairs nothing.** The service is named *guidance*, so it emits text and
`mutating_actions_performed: 0` / `executed_any_command: false`. Each step carries an `evidence`
string naming the measurement that produced it; a step with no evidence is never emitted. A
local-scope request drops elevation-requiring steps and reports `stepsOmittedForScope`, rather
than showing a command the user cannot run.

**M01-S04 separates policy from measurement.** `resources/essential-software.json` is a stated
recommendation policy, embedded with `include_str!` so a missing file is a compile error. The
response reports the digest of the exact bytes used, and honours a documented on-disk override at
`%APPDATA%\KNOUX ONE\essential-software.json` — reporting that an override was used, so an edited
policy can never pass as the shipped one. `packageIdVerifiedOnThisMachine` is `false` unless an
explicitly requested `winget show` check (capped at 12 network lookups) actually succeeded.

**M01-S07 exclusions are counted, not silent.** System components and update/hotfix entries are
excluded by a rule written in the script, and the response reports the per-hive counts that rule
removed. A report is only called "exported" after the written bytes are read back and re-hashed.
CSV carries a UTF-8 BOM so Excel does not mangle non-Latin paths.

**M01-S08 cannot become a command line.** `ALLOWED_PROFILE_STEPS` maps a handler to the *exact*
command that handler is registered to, plus the parameter keys that command accepts. Anything else
is refused and the refusal is listed in `rejectedSteps`. `osSchedulerRegistration` states plainly
that no Windows scheduled task was created.

**M02-S06 and M02-S08 are read-only in code.** The payloads carry `deletedAnything: false` and
`emptiedAnything: false` as fields, and the Recycle Bin report separates `sizedItems` from
`unsizedItems` so the byte total never claims more coverage than it has. Walks are bounded by
depth (8), file count (2,000,000) and listing count, and hitting a ceiling sets `truncated` rather
than quietly returning less.

**M02-S10 has one deletion path.** Rather than reimplementing deletion, it resolves targets through
the existing `completion14::m02::targets` allowlist (widened to `pub(crate)`) and delegates to
`m02_cleanup_execute_complete`. Applying requires the literal token `APPLY`, and a dry run is the
default in the client. `old_downloads` is reported as quarantined rather than deleted.

## Two real bugs found and fixed while building this

1. **O(n²) inventory dedupe.** `parse_inventory` compared every entry against every kept entry.
A registry with 20,000 entries took over 60 seconds — the truncation test itself hit the 60s
harness warning. Replaced with a `HashSet` key set; the full Rust suite now runs in ~8s instead
of ~66s. `a_full_inventory_parses_in_bounded_time` guards the regression.
2. **`scan_truncated` counted excluded categories.** `summarize_scan` reported truncation from any
category in the scan, including ones the profile does not cover, so a profile could be told its
measurement was incomplete because of work it never asked for.

Also corrected: `sanitize_file_stem` produced a file literally named `___` for a whitespace-only
name, and a leading-dot name survived into the export directory.

## Gates

| Gate | Result |
| --- | --- |
| `bun run services:check` | pass |
| `bun run typecheck` | pass |
| `bun run test` | 19 files, 84 tests pass |
| `bun run build` | pass |
| `cargo fmt --check` | pass |
| `cargo check --locked --all-targets --all-features` | pass, no warning |
| `cargo clippy --locked --all-targets --all-features -- -D warnings` | pass |
| `cargo test --locked --all-features` | 240 pass, 0 fail |
| `cargo build --release --locked` | **pass** — `Finished release profile in 7m 21s` |

Release binary: `src-tauri/target/release/knoux-one.exe`, 24,712,704 bytes, `MZ` header,
product `KNOUX ONE 1.0.0`,
SHA-256 `816b03200144a18f684392a9995cdbc5c676637c848d09a3e52bf402f28932a3`.

Catalog truth moved from `80 implemented / 0 partial / 110 planned` to
`87 implemented / 0 partial / 103 planned`. Six test files that hard-coded the old totals were
updated rather than weakened.

## Real Windows evidence gathered while building this

The measurement scripts were extracted from the Rust source and run directly against this
machine, because a script that has never been executed by Windows PowerShell 5.1 is not a
measurement. Doing so found a real bug and produced real data.

**Bug found and fixed.** `[pscustomobject]@{ hives = @($hiveReport); ... }` throws
`Argument types do not match` on Windows PowerShell 5.1 when `@()` wraps a
`System.Collections.Generic.List[object]` inside a hashtable literal. The inventory command
would have returned *zero applications with a typed error* on every Windows 10/11 machine.
Changed to `$hiveReport.ToArray()`.

Measured on this machine after the fix:

| Script | Result |
| --- | --- |
| Inventory | exit 0 — HKLM64 74 keys read / 18 kept / 37 system components / 1 update excluded; HKLM32 141 / 30 / 82 / 1; HKCU 9 / 9 / 0 / 0; 57 applications, real versions and sizes (`Git 2.55.0.3`, 352,379,904 bytes) |
| Winget diagnosis | exit 0 — `wingetPath` empty, `sourceListSucceeded: false`, build 19045, `Microsoft Windows 10 Pro`, diagnostic directory present with 10 log files. winget is genuinely not installed here, which is exactly the case the guidance path exists for |
| Recycle Bin | exit 0 — `count: 0`. The Recycle Bin is empty on this machine, reported as zero rather than padded |
| Delivery Optimization | exit 0 — both cmdlets resolve but the backing class is not registered on this build (`Invalid class`). This is why `statusCmdletAvailable` and `statusQuerySucceeded` are now **separate fields**: presenting the first as the second would have read as "measured, and the answer is zero" |

A new Rust test (`the_cache_walk_measures_real_files_and_reports_a_missing_root`) exercises
`measure_delivery_root` against a real temp directory: 3 files / 400 bytes across nested
levels, a listing budget that sets `truncated` while still reporting the true `file_count`,
and a missing root reported as `root_does_not_exist` rather than as an empty cache.

## Not claimed

`RUNTIME_VERIFIED` is **not** set for any of the seven, and `globalRuntimeGate` stays **BLOCKED**.

The evidence above is real, but it is *script-level* evidence: the PowerShell bodies were run
directly. The full Tauri command path — argument deserialization, `spawn_blocking`, the
`OperationResult` envelope, the IPC round trip and the UI panels — has not been exercised,
because that needs a human to launch `knoux-one.exe` and click each service. A build that links
is not a run.

Remaining planned services: **103**.

# Batch 2 — M10 security status (S01, S05, S06, S07, S08)

## Why these five and not the rest of M10

M10 is Defender, firewall, UAC, SmartScreen, Secure Boot and TPM. Five of its ten services
are pure read-only status inspections; the other five are Defender quick scan, full scan,
custom scan, a suspicious-startup review, and a hash-reputation lookup that the build map
already marks `BLOCKED_BY_EXTERNAL_DEPENDENCY`.

A scan has a real runtime cost and a real side effect on the machine, and no scan has ever
been run by this application. Shipping a "Start full scan" button now would mean shipping a
capability nobody has verified. S02/S03/S04 therefore stay `planned`, and
`plannedServicesIntegrity.test.ts` asserts they have **no** `handlerId` so they cannot drift
into looking runnable.

## The five

| Service | Handler → command | Providers read |
| --- | --- | --- |
| M10-S01 Defender status | `m10.defender.status` → `m10_defender_status` | `Get-MpComputerStatus`, `Get-MpPreference`, `Get-Service WinDefend`, `SignatureUpdates` registry key |
| M10-S05 Firewall status | `m10.firewall.status` → `m10_firewall_status` | `Get-NetFirewallProfile`, `Get-NetFirewallRule -PolicyStore ActiveStore` |
| M10-S06 UAC status | `m10.uac.status` → `m10_uac_status` | HKLM machine policy key, HKCU user policy key |
| M10-S07 SmartScreen status | `m10.smartscreen.status` → `m10_smartscreen_status` | Six registry locations across HKCU/HKLM Explorer, System policy, Defender SmartScreen and Edge policy |
| M10-S08 Secure Boot & TPM | `m10.secureboot.tpm` → `m10_secureboot_tpm_status` | `Confirm-SecureBootUEFI`, `SecureBoot\State` registry key, `Get-Tpm`, `Win32_Tpm` |

## The honesty decisions

**`SourceReport` everywhere.** Every payload carries the list of providers it asked and
whether each one answered, with the reason. A provider that stayed silent is visible instead
of being read as a healthy result. This is not decoration: on this machine the firewall
cmdlets resolve but return `Invalid class`, and without the per-provider report the service
would have had no honest way to say so.

**SmartScreen says `unknown`.** Six locations are probed because Windows reads SmartScreen
from different places on different builds. Zero readable means
`effective_enforcement: "unknown: no SmartScreen policy value was readable at any probed location, so this service cannot say whether SmartScreen is on"` — not "enabled".

**A missing TPM is unmeasured, not absent.** When no TPM provider answers, `tpm` is empty and
the warning says unmeasured. "This machine has no TPM" and "this service could not reach a TPM"
are different claims.

**Secure Boot off is a value, not an error path.** `Confirm-SecureBootUEFI` throws on a legacy
boot, which is a real reading. The state is `on` / `off` / `unavailable` and the response
carries the cmdlet's own message rather than claiming a cause.

**A policy key without `EnableLUA` is unmeasured.** Windows defaults `EnableLUA` to 1 when the
key is absent, and inheriting that default would be a guess. The verdict stays `None` and the
response warns that it is unmeasured. The other policy values in the same key are still
reported, because they are real.

**No numeric value is presented without its meaning.** `ConsentPromptBehaviorAdmin = 5` is not
an answer on its own, so every UAC value is paired with a plain-language reading in both
languages.

**Each payload says it changed nothing, in a field.** `changedAnySetting`, `changedAnyRule`,
`changedAnyValue`, `elevationPerformed` and `scanStarted` are all `false` in the payload, not
only in the summary prose. The gate forbids every `Set-`/`New-`/`Remove-`/`Add-`/`Start-`/
`Stop-`/`Enable-`/`Disable-` cmdlet by shape, which is stronger than listing names someone
might forget.

## Real Windows evidence for batch 2

Each script was extracted and run directly on this machine:

| Script | Measured result |
| --- | --- |
| Defender | exit 0. Antivirus and real-time protection on, signature `1.459.398.0` updated 2026-09-25 09:30:42, quick scan 1 day ago, full scan 14 days ago, 1 configured path exclusion, `WinDefend` Running |
| Firewall | exit 0. Both cmdlets resolve; both calls return `Invalid class`, so the service reports `firewall_profiles_unavailable` with that reason rather than inventing three profiles |
| UAC | exit 0. `EnableLUA=1`, `ConsentPromptBehaviorAdmin=5`, `ConsentPromptBehaviorUser=3`, `PromptOnSecureDesktop=1`, `FilterAdministratorToken=0`, `EnableInstallerDetection=1`; the HKCU key exists but sets no `EnableLUA`, so `perUserOverridePresent` is false |
| SmartScreen | exit 0. 0 of 6 locations readable → `unknown`, which is exactly the branch this design exists for |
| Secure Boot / TPM | exit 0. Secure Boot `off` with the verbatim reason `Unable to set proper privileges. Access was denied.`, firmware flag `0`, `Get-Tpm` answers `present=False`, `Win32_Tpm` returns `Access denied` |

The firewall and TPM readings are the interesting ones: they are the cases where a
straightforward implementation would have printed a confident `Secure Boot: off`,
`TPM: absent`, `Firewall: 3 profiles` and been wrong. This machine has no accessible firewall
profile set and no reachable TPM, and the service says so in those words.

## Gates after batch 2

| Gate | Result |
| --- | --- |
| `bun run services:check` | pass |
| `bun run typecheck` | pass |
| `bun run test` | 19 files, **90** tests pass |
| `bun run build` | pass |
| `cargo fmt --check` | pass |
| `cargo clippy --locked --all-targets --all-features -- -D warnings` | pass |
| `cargo test --locked --all-features` | **251** pass, 0 fail |

Catalog truth: **92 implemented / 0 partial / 98 planned** (from 87 / 0 / 103).

## Not claimed

`RUNTIME_VERIFIED` is not set for any of the five, and `globalRuntimeGate` stays **BLOCKED**.
The evidence above is script-level. The Tauri command path, the IPC round trip and the
`SecurityStatusPanels` UI still need a human to run the built application.

Remaining planned services: **98**.

# Batch 3 — M09 privacy (S01, S02, S03, S04, S05, S06, S09)

## The find that mattered most in this whole effort

Windows PowerShell 5.1 makes `@()` a **fixed-size array**. Calling `.Add()` on it throws
`MethodInvocationException: Collection was of a fixed size` — and because
`$ErrorActionPreference = 'Continue'`, **the script still exits 0** and emits a valid,
empty JSON document.

A command written that way does not fail. It reports "measured, and the answer is nothing."
That is the exact failure mode this repository exists to prevent, and no unit test, no
typecheck and no clippy pass would ever have caught it.

Four scripts had it:

| Script | Consequence on a real machine |
| --- | --- |
| `m01_planned.rs` `PACKAGE_CHECK_SCRIPT` | every package check reported unverified, forever |
| `m02_planned.rs` `RECYCLE_BIN_SCRIPT` | every non-empty Recycle Bin reported as empty |
| `m09_planned.rs` `PERMISSION_SCRIPT` | every permission list reported as empty |
| `m10_planned.rs` `SMARTSCREEN_SCRIPT` | SmartScreen reported as having no policy at all |

The sibling bug is `@($someList)` inside a hashtable literal, which throws
`Argument types do not match` — that one is in `m01_planned.rs` `INVENTORY_SCRIPT`, found
earlier in this work, and the fix is `.ToArray()`.

All eight sites now use `New-Object System.Collections.Generic.List[object]` and
`.ToArray()`. `the_permission_script_does_not_use_a_fixed_size_collection` guards the M09
scripts against the pattern returning.

**The Recycle Bin one is the most dangerous in hindsight.** This machine's Recycle Bin is
empty, so the bug was invisible here — it would have shipped as "Recycle Bin review works"
and silently reported zero items on every user's machine.

## A second, quieter bug: "never asked" was a false claim

The first permission parse counted any entry with no `Value` as "never asked". On this
machine every entry has an empty `Value` **and a real `LastUsedTimeStart`** — Windows logs
use while recording no decision at that key. So Chrome and Edge, which actively used the
camera and microphone, would have been reported as never having asked.

`AppPermission.state` now names six distinct cases, and `undecidedButUsedCount` is its own
counter so it inflates neither the allowed nor the denied nor the unused figure:

| `state` | Meaning |
| --- | --- |
| `allowed` / `denied` | Windows recorded `Allow` / `Deny` |
| `prompt_recorded_and_used` | `Prompt` plus a real use stamp |
| `prompt_pending` | `Prompt` with no use yet |
| `used_no_decision_recorded` | real use, no decision at this key |
| `no_decision_and_never_used` | neither decision nor use |

The UI label follows `state` rather than re-deriving it from the raw `value`, so the two
cannot drift.

## The seven services

| Service | Handler → command | Surface read |
| --- | --- | --- |
| M09-S01 Permission dashboard | `m09.permission.dashboard` → `m09_permission_dashboard` | `CapabilityAccessManager\ConsentStore` |
| M09-S02 Camera | `m09.permission.camera` → `m09_camera_permission` | same store, projected |
| M09-S03 Microphone | `m09.permission.microphone` → `m09_microphone_permission` | same store, projected |
| M09-S04 Location | `m09.permission.location` → `m09_location_permission` | same store, projected |
| M09-S05 Advertising ID | `m09.advertising.id` → `m09_advertising_id` | `AdvertisingInfo`, `AdvertisingInfo\Id`, `Privacy` |
| M09-S06 Clipboard privacy | `m09.clipboard.privacy` → `m09_clipboard_privacy` | `Clipboard` registry key, `Get-Clipboard` |
| M09-S09 Hosts file | `m09.hosts.inspect` → `m09_hosts_file` | `%WINDIR%\System32\drivers\etc\hosts` as bytes |

**One store, four commands.** S02–S04 call the same `permission_command` and project the
same parse. Four independent parsers would be four chances to contradict the dashboard.

**Reading the clipboard is itself a privacy act**, so the content is not even described
unless the request sets `inspectCurrentClipboard`, which the client defaults to `false`.
The preview is capped at 60 characters and never stored. Clearing requires the literal
token `CLEAR`, and the response states that clipboard *history* is not cleared.

**A FILETIME of zero is "never", not 1601.** `filetime_to_rfc3339` returns `None` for zero
and for pre-epoch values, so no app is ever listed with a last-used date in 1601.

**An unreadable hosts file is not an empty hosts file.** A read failure and a non-UTF-8
file each produce their own typed result; neither is reported as "no entries".

**S07, S08 and S10 stayed `planned`.** Recent-file cleanup, browser privacy cleanup and
reversible privacy profiles all delete or rewrite user data, and none has been run by a
human yet. The gate asserts they have no `handlerId`.

## Real Windows evidence for batch 3

| Script | Measured result |
| --- | --- |
| Permissions | exit 0. `webcam` present with 2 entries, `microphone` present with **23**, `location` present with 3 (including this project's own `DAY NIGHT.exe`), `locationExtended` **absent** with 0. Real paths: `C:#Program Files (x86)#Microsoft#Edge#Application#msedge.exe`, `C:#Program Files#Google#Chrome#Application#chrome.exe` |
| Advertising ID | exit 0. Key present, `Enabled = false`, **no stored identifier**, `AdvertisingIdDisabledByUser` absent — so "limit ad tracking" is reported unmeasured, not as off |
| Clipboard | exit 0. The per-user clipboard settings key does not exist on this account; the clipboard is empty. Both reported as measurements, neither as a clean bill of health |
| Recycle Bin (re-run) | exit 0, no exception. `count = 0` — genuinely empty here, and now that is a real reading rather than a swallowed exception |

## Gates after batch 3

| Gate | Result |
| --- | --- |
| `bun run services:check` | pass |
| `bun run typecheck` | pass |
| `bun run test` | 19 files, **97** tests pass |
| `bun run build` | pass |
| `cargo fmt --check` | pass |
| `cargo clippy --locked --all-targets --all-features -- -D warnings` | pass |
| `cargo test --locked --all-features` | **266** pass, 0 fail |

Catalog truth: **99 implemented / 0 partial / 91 planned**.

## Not claimed

`RUNTIME_VERIFIED` is not set for any of the seven; `globalRuntimeGate` stays **BLOCKED**.
Evidence here is script-level. The Tauri command path and the `PrivacyStatusPanels` UI still
need a human to run the built application.

Remaining planned services: **91**.

# Batch 4 — M11 verified backup (S03, S05, S06)

## The rule this batch is built around

A backup that was not verified is worse than no backup, because it is believed. So
`write_verified` is the only writer in the module: it hashes the source bytes, writes
them, reads the file back from disk, hashes that, and compares. The comparison result —
not the write succeeding — is what `read_back_verified` reports.

Two consequences that matter more than they look:

- **An empty run is not a good run.** `everything_verified` is
`files_failed == 0 && !files.is_empty()`, so a service that found nothing to copy
reports `everythingVerified: false` rather than "0 files, 0 errors, success".
- **No run can destroy the last good copy.** Every run writes into its own timestamped
subfolder, so a failed run leaves the previous one untouched.

## The three services

| Service | Handler → command | What is exported |
| --- | --- | --- |
| M11-S03 Settings export | `m11.settings.export` → `m11_settings_export` | An explicit document list from the KNOUX ONE app data directory, plus a manifest |
| M11-S05 Environment export | `m11.environment.export` → `m11_environment_export` | Machine and per-user environment variables, with PATH in search order |
| M11-S06 Bookmark backup | `m11.bookmarks.backup` → `m11_bookmark_backup` | Chromium `Bookmarks` JSON and Firefox `places.sqlite` sets |

## The honesty decisions

**An explicit document list, not a directory sweep.** `KNOUX_DOCUMENTS` names the seven
documents a settings export covers. A new file appearing in the app data directory is
therefore never swept into a "settings backup" by accident.

**A user PATH does not replace the machine PATH.** Windows searches both. Exporting one
scope and calling it "your PATH" is how a restore silently loses entries.
`effectiveValue` is the concatenation in search order, `machinePresent` / `userPresent`
report each scope separately, and every entry present in *both* is named in
`duplicatedPathEntries`.

**Browsers are discovered, not assumed.** `bookmark_candidates()` derives paths from
`%LOCALAPPDATA%` / `%APPDATA%`; a browser that is not installed is recorded as absent, which
is a different claim from "no bookmarks exist". Chromium profile names come from the real
`Local State` `info_cache`, so a user's second profile is backed up instead of only
`Default`.

**A Bookmarks file must validate as JSON** before it is called a backup.

**Firefox is copied as a complete set.** `places.sqlite` is copied together with its `-wal`
and `-shm` sidecars and base64-encoded into one text document. Copying the lone database
would produce a backup that silently loses recent bookmarks.

**A portable manifest.** Directory walks are emitted with `/` separators and sorted keys,
so the same directory produces the same bytes and therefore the same digest on any
platform. A backup whose manifest cannot be re-verified elsewhere is not much of a backup.

**Nothing is written into a source.** The payload carries
`wroteIntoAnyBrowserProfile: false` as a field, and the gate asserts no `fs::write` targets
a browser profile path, no `remove_file` / `remove_dir_all` exists, and no registry write
cmdlet appears.

## S01, S02, S04, S07, S08, S09 and S10 stayed `planned`

S01 (restore point) and S04 (driver export) need elevation that no automated run here has
performed. S02 copies arbitrary user data at volume. S10 would register a Windows scheduled
task. S07/S08/S09 are the natural next step and are deliberately **not stubbed** — the
module doc says so rather than leaving empty handlers behind.

## Real Windows evidence for batch 4

| Measurement | Result |
| --- | --- |
| Environment script | exit 0. 8 variables. `Path` machine 446 chars / user 125 chars; `PATHEXT`, `NUMBER_OF_PROCESSORS`, `PROCESSOR_ARCHITECTURE`, `OS`, `COMSPEC` machine-only; `TEMP`/`TMP` present in both scopes. `machinePathPresent` and `userPathPresent` both true |
| Browser discovery | Chrome, Edge and Firefox profile roots **exist**; Brave does not. So the backup will find three real browsers and record Brave as absent |

## Gates after batch 4

| Gate | Result |
| --- | --- |
| `bun run services:check` | pass |
| `bun run typecheck` | pass |
| `bun run test` | 19 files, **105** tests pass |
| `bun run build` | pass |
| `cargo fmt --check` | pass |
| `cargo clippy --locked --all-targets --all-features -- -D warnings` | pass |
| `cargo test --locked --all-features` | **276** pass, 0 fail |

Catalog truth: **102 implemented / 0 partial / 88 planned** (from 80 / 0 / 110 at the start).

## A process note

While trimming this module I ran a PowerShell string-replacement script that computed a
`-1` index and wrote the result unconditionally, truncating `m11_planned.rs` to **0 bytes**.
The file was recovered by rewriting it. The lesson is recorded here because the failure
mode is the same one this whole effort is about: a script that "succeeds" while producing
nothing. Guards and read-back checks exist for a reason.

## Not claimed

`RUNTIME_VERIFIED` is not set for any of the three; `globalRuntimeGate` stays **BLOCKED**.
Evidence is script-level. The Tauri command path and the `BackupPanels` UI still need a
human to run the built application.

Remaining planned services: **88**.

# Batch 5 - M11 registry export (S07) and restore readiness (S09)

## The two

| Service | Handler -> command | What it actually does |
| --- | --- | --- |
| M11-S07 Registry-key backup | `m11.registry.backup` -> `m11_registry_key_backup` | `reg.exe export` over a six-key allowlist fixed in source. Each `.reg` file is read back, hashed, and re-parsed for key and value headers. Writes files, never writes the registry. |
| M11-S09 Restore readiness | `m11.restore.inventory` -> `m11_restore_inventory` | Re-hashes every backup run on disk and compares it against the digest that run recorded in its own manifest. Read-only: no delete, no copy, no import. |

## Why S07 cannot be pointed at an arbitrary key

A backup tool that accepts a caller-supplied key path is a registry **writer** one argument
away. So the command signature takes no key at all, the allowlist is a `const` in the Rust
source, and the result carries `wrote_to_any_registry_key: false` as a hard-coded field
rather than a computed one. The frontend test asserts the function signature contains no key
parameter, and separately that the strings `reg import` / `reg add` / `reg delete` appear
nowhere in the module.

## Why a reg.exe exit code of zero is not a verified backup

`reg.exe` can exit 0 and still write nothing usable. The pass condition is therefore
`read_back_verified = digest_stable && key_headers > 0`, where the header count comes from
re-parsing the file that was written. A missing or refused key is recorded via
`record_absent` with a `reg_launch_failed:` or `reg_export_failed:` reason and counted in
`keys_absent`, so one absent key neither fails the run nor inflates it.

## Three real bugs the tests caught, not the compiler

1. **The registry export could never have worked.** The second allowlist field doubled as the
 output file name, and it held a *key path* like `HKCU\Control Panel\Desktop`. Appending
 `.reg` produced the nested path `HKCU\Control Panel\Desktop.reg` inside the run directory,
 where the intermediate directories do not exist, so `reg.exe export` would have failed for
 all six keys. Fixed by splitting the field into a flat, single-segment file stem
 (`hkcu-control-panel-desktop`, ...). Confirmed against the real `reg.exe` afterwards:
 6 of 6 keys now export, with 1-6 key headers and 4-100 value headers each.
2. **No run could ever report itself verified.** `inspect_run` walked the run directory and
 included `manifest.json` in the checked file set. The manifest never lists itself, so it
 always landed in `files_baseline_only` and `files_matching != files_checked` held forever.
 The manifest is the record, not a backed-up file; it is now excluded from the compared set
 and its presence is still reported as `manifest_present`.
3. **A defaulted backup root was silently discarded.** `resolve_destination` returns whether
 it fell back to the application default, and that flag was dropped, so an inventory could
 report numbers about the default folder without saying so. It is now surfaced as
 `destination_defaulted` and shown in the UI.

## The honesty decisions

- A file with **no recorded digest** is `baseline_only` and never a pass. `run_verified`
requires `files_checked > 0 && files_matching == files_checked`, so an empty run is not
vacuously verified and a run that merely establishes a baseline is not a restore point.
- Each run is compared only against **its own** manifest. A sibling run holding a same-named
file with different bytes cannot make a run verify.
- `files_missing` and `files_altered` are counted separately, so a deleted file cannot hide
inside a "some files still match" number.
- The inventory command body contains no `fs::write`, `fs::copy`, `fs::rename`,
`fs::remove_*`, `fs::create_dir_all`, `reg import` or `Command::new`. The frontend gate
scopes that check to the inventory function alone, because the same module legitimately
contains the export services' write path.

## Real Windows evidence for batch 5

`reg.exe export` run directly against all six allowlisted keys into a scratch directory:

| Key | Exit | Key headers | Value headers | Bytes |
| --- | --- | --- | --- | --- |
| `HKCU\Control Panel\Desktop` | 0 | 6 | 100 | 15,252 |
| `HKCU\Environment` | 0 | 1 | 23 | 3,890 |
| `HKCU\Keyboard Layout` | 0 | 5 | 4 | 702 |
| `HKCU\...\Explorer\Advanced` | 0 | 1 | 16 | 1,432 |
| `HKCU\...\Themes` | 0 | 5 | 18 | 3,174 |
| `HKLM\...\Themes` | 0 | 6 | 38 | 26,496 |

`HKLM\SOFTWARE\...\Themes` is readable without elevation. The scratch directory was deleted
afterwards.

## Gates after batch 5

| Gate | Result |
| --- | --- |
| `bun run services:check` | pass (baseline regenerated) |
| `bun run typecheck` | pass |
| `bun run test` | 19 files, **109** tests pass |
| `bun run build` | pass |
| `cargo fmt --check` | pass |
| `cargo clippy --locked --all-targets --all-features -- -D warnings` | pass |
| `cargo test --locked --all-features` | **284** pass, 0 fail (8 new M11 tests) |
| `cargo build --locked --release --all-features` | exit 0, 17m59s |

`src-tauri/target/release/knoux-one.exe` - 25,870,336 bytes,
SHA-256 `c7acdff15c1750bfb57f423d385d83a158b558603de7ba174531fd6d47cac0be`.

Catalog truth: **104 implemented / 0 partial / 86 planned**.

## Not claimed

`RUNTIME_VERIFIED` is not set for either service; `globalRuntimeGate` stays **BLOCKED**. The
`reg.exe` evidence above is mechanism-level: it proves the export command, the flat file
names and the header check behave correctly on this machine, not that the Tauri command path
and `BackupPanels` UI were driven by a human. That is still outstanding.

Remaining planned services: **86**.
