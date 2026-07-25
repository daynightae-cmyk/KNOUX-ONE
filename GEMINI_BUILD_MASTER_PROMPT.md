# KNOUX ONE — AUTHORITATIVE OVERLAY INTEGRATION + MODULE 16 PROJECT ENGINEERING

**Directive ID:** `KNOUX-ONE-GEMINI-INTEGRATION-M03-M15-M16-v1.0`

## 0. EXECUTION MODE

You are working inside the already-open KNOUX ONE project. The uploaded ZIP is an authoritative source-code overlay exported from the real GitHub implementation. This is not a design reference, a mockup, a sample project, or a request to create a replacement application.

Perform the work directly in the currently open project.

Do not:

- create a new unrelated project;
- replace the application with a generic dashboard;
- reduce the existing 19-module / 190-service catalog;
- remove working routes, localization, theme support, Tauri integration, or verified native handlers;
- fabricate device information, duplicate files, repositories, ports, processes, toolchains, scan progress, success messages, or execution results;
- use `setTimeout`, `Math.random`, static sample arrays, browser-only simulations, or always-success native commands to imitate real operations;
- rename capability IDs or native handler IDs casually;
- publish, deploy, merge, or overwrite production until all validation gates pass.

The implementation must remain local-first, Windows-focused, evidence-driven, bilingual Arabic/English, RTL-safe, and honest about every implementation state.

---

## 1. PACKAGE STRUCTURE

The uploaded ZIP contains:

- `overlay/` — complete final source files with repository-relative paths;
- `DELETE_MANIFEST.txt` — obsolete stubs that must be removed if they still exist;
- `FILE_MANIFEST.txt` — authoritative list of bundled overlay files;
- `GEMINI_BUILD_MASTER_PROMPT.md` — this directive;
- `INTEGRATION_CHECKLIST.md` — required verification sequence;
- `SOURCE_METADATA.txt` — source repository and branch information.

Treat paths under `overlay/` as relative to the root of the currently open KNOUX ONE repository.

Example:

```text
overlay/src/features/duplicates/DuplicateControlCenter.tsx
```

must be merged into:

```text
src/features/duplicates/DuplicateControlCenter.tsx
```

---

## 2. MANDATORY INTEGRATION PROCEDURE

### Step 2.1 — Audit before writing

Inspect the current repository and record:

- current branch and commit if available;
- package manager and scripts;
- React/Vite/Tauri versions;
- current 19-module / 190-service catalog counts;
- current Module 03 route and view;
- current Module 15 route and view;
- current native command registry;
- current `src-tauri/src/main.rs` command registration;
- current SQLite migrations;
- files listed by `DELETE_MANIFEST.txt` that still exist;
- any local changes that must be preserved.

Do not begin by generating another UI.

### Step 2.2 — Create a safety checkpoint

Before integration, create a local checkpoint/commit or an equivalent reversible snapshot. Do not discard uncommitted user work.

### Step 2.3 — Apply deletion manifest

Delete every obsolete file listed in `DELETE_MANIFEST.txt` only when it exists. These are replaced stubs or unsafe duplicate entry points. Do not delete similarly named directories that contain the real implementation.

### Step 2.4 — Merge the overlay

Copy every file from `overlay/` to the matching repository-relative path.

For normal feature files, use the overlay version as authoritative.

For the following integration-sensitive files, perform a semantic merge instead of blindly erasing unrelated newer work:

- `README.md`
- `src-tauri/Cargo.toml`
- `src-tauri/src/main.rs`
- `src-tauri/tauri.conf.json`
- `src/context/KnouxContext.tsx`
- `src/data/capabilitiesCatalog.ts`
- `src/services/nativeClient.ts`
- `src/services/nativeCommandRegistry.ts`
- `src/services/operationService.ts`
- `src/types/index.ts`
- shared tests and workflows

The semantic merge must preserve:

1. all verified Module 03 functionality from the overlay;
2. all verified Module 15 functionality from the overlay;
3. any unrelated valid work already present in the open project;
4. exactly 19 modules and exactly 190 catalog services;
5. strict handler allowlisting;
6. honest implementation states;
7. all Arabic/English labels and RTL behavior;
8. dark/light design tokens;
9. official KNOUX identity.

### Step 2.5 — Official KNOUX assets

Use the official circular assets:

- Night logo: `https://i.postimg.cc/V6LqNG8m/Knoux-Chat-GPT-01.jpg`
- Day logo: `https://i.postimg.cc/fLTcb2NT/Knoux-Chat-GPT-20.jpg`

Download and embed stable local copies for production UI where appropriate. Do not use corrupted placeholder bytes or obsolete square logos. Preserve accessible alt text and correct day/night selection.

---

## 3. MODULE 03 — DUPLICATE CONTROL CENTER ACCEPTANCE REQUIREMENTS

After integration, Module 03 must expose the real Duplicate Control Center, not generic service cards.

Required native-backed services:

1. `m03_s01` — Exact Duplicate Scan / `m03.scan.exact`
2. `m03_s02` — Fast Candidate Scan / `m03.scan.fast`
3. `m03_s03` — Similar Image Review / `m03.scan.images`
4. `m03_s04` — Video Duplicate Review / `m03.scan.videos`
5. `m03_s05` — Audio Duplicate Review / `m03.scan.audio`
6. `m03_s06` — Document Duplicate Review / `m03.scan.documents`
7. `m03_s07` — Archive Duplicate Review / `m03.scan.archives`
8. `m03_s08` — Folder Comparison / `m03.scan.folders`
9. `m03_s09` — Keeper Rule Planning / `m03.keeper.plan`
10. `m03_s10` — Verified Quarantine & Restore / `m03.quarantine.manage`

Required safety behavior:

- size grouping, partial BLAKE3 and full streaming BLAKE3;
- changed-file verification after hashing;
- hard-link identity awareness;
- system-path protection;
- no following unsafe symlinks/junctions;
- candidates are non-actionable until full verification;
- similar-image groups require manual review;
- every actionable group has exactly one keeper;
- cross-volume quarantine performs copy, flush, checksum verification, then source removal;
- persistent SQLite history and quarantine manifest;
- restore conflict modes: fail, rename, replace with rollback backup, or chosen destination;
- typed `PURGE` confirmation for permanent deletion;
- no false SSD secure-erasure claim;
- real pause, resume, cancel, progress events, and history reopening;
- honest empty states in browser preview.

Do not downgrade these features.

---

## 4. MODULE 15 — KNOUX DEVELOPER STUDIO ACCEPTANCE REQUIREMENTS

After integration, Module 15 must open a professional full-page developer workspace, not ten generic cards.

Required native-backed areas:

1. workstation toolchain discovery with real executable paths and versions;
2. User PATH and Machine PATH audit;
3. runtime/version manager inspection;
4. secure Git configuration audit with secret redaction;
5. repository discovery, current branch, dirty state, upstream and ahead/behind evidence;
6. TCP/UDP listener and process inspection;
7. protected-process-aware termination requiring `STOP <PID>`;
8. project health detection for Node, Rust, Python, Go, Java and .NET;
9. allowlisted developer-cache measurement and cleanup requiring `CLEAN`;
10. local HTTP/HTTPS laboratory with bounded response preview and timeout;
11. JSON/Markdown evidence report export.

Required workspace sections:

- Command Center
- Toolchain Matrix
- PATH Lab
- Runtime Managers
- Git Audit
- Repository Intelligence
- Ports & Processes
- Project Health
- Cache Control
- HTTP/API Lab
- Evidence Reports

Security boundaries:

- never collect tokens, passwords, cookies or private keys;
- redact credentials and sensitive remote URL components;
- no arbitrary raw-shell endpoint;
- static native command allowlist only;
- protected Windows processes cannot be terminated;
- destructive actions require typed confirmations;
- browser preview never claims access to host tools, processes or repositories.

---

# 5. NEXT PHASE — BUILD MODULE 16 PROJECT ENGINEERING

After Modules 03 and 15 are integrated and validated, implement Module 16 as a complete production-grade **Project Engineering Center**.

## 5.1 Product objective

Module 16 must become the daily project operations workspace that a professional developer uses to understand, validate, build, test, package and prepare real local projects safely.

It must complement Module 15 rather than duplicate it:

- Module 15 = developer workstation, toolchains, PATH, Git environment, ports, APIs and global development health.
- Module 16 = selected project/repository structure, dependencies, scripts, quality gates, tests, builds, artifacts and release readiness.

## 5.2 Stable service IDs and handler IDs

Implement exactly these ten services while preserving IDs:

### `m16_s01` — Project Discovery & Registration

Handler: `m16.projects.discover`

- choose one or more project roots through a native folder picker;
- detect Node, Rust, Python, Go, Java, .NET and mixed projects;
- detect monorepos and nested projects;
- record canonical path, project type, manifests, workspace roots, size, file counts and last modification;
- exclude `.git`, `node_modules`, `target`, `dist`, `build`, virtual environments and user-configured exclusions from expensive enumeration;
- persist registered projects in SQLite;
- never invent repositories or projects.

### `m16_s02` — Workspace & Monorepo Intelligence

Handler: `m16.workspaces.analyze`

- detect npm/pnpm/yarn workspaces, Cargo workspaces, solution files and common monorepo layouts;
- build a local package/project graph;
- show roots, packages, internal dependencies and orphan packages;
- detect duplicate package names and invalid workspace references;
- provide evidence paths for every finding.

### `m16_s03` — Dependency Inventory & Risk Audit

Handler: `m16.dependencies.audit`

- parse manifests and lockfiles locally;
- inventory direct and transitive dependencies where the ecosystem allows it;
- detect missing lockfiles, multiple conflicting lockfiles, unpinned dependencies and obvious manifest inconsistencies;
- optionally invoke ecosystem-native audit commands only through explicit allowlisted command templates;
- never automatically update dependencies;
- never claim a vulnerability without tool evidence;
- separate `verified`, `warning`, `requires_configuration` and `unavailable` states.

### `m16_s04` — Environment & Configuration Validator

Handler: `m16.environment.validate`

- detect expected environment variable names from safe templates such as `.env.example`;
- compare names only, not secret values;
- detect missing required variables, duplicate keys, malformed lines and committed secret-risk file names;
- redact all values;
- inspect common config files and report parse errors with line/column when possible;
- never upload environment files.

### `m16_s05` — Script & Task Inspector

Handler: `m16.tasks.inspect`

- enumerate package scripts, Cargo aliases/tasks, Make targets and supported project commands;
- classify commands as read-only, build, test, development server, migration or potentially destructive;
- show the exact command before execution;
- prohibit arbitrary user-generated shell strings;
- execute only commands originating from verified project manifests or a reviewed allowlist;
- allow cancel and stream stdout/stderr;
- require confirmation for migrations, publish, deploy, database reset or destructive tasks.

### `m16_s06` — Quality Gate Orchestrator

Handler: `m16.quality.run`

- detect and run supported typecheck, lint and formatting-check commands;
- run checks without silently modifying files by default;
- parse exit codes, durations and bounded logs;
- present each gate separately;
- allow cancellation;
- persist operation evidence in SQLite;
- never render green when a command was skipped or unavailable.

### `m16_s07` — Test Intelligence

Handler: `m16.tests.run`

- detect supported test frameworks from manifests/configuration;
- run project-defined test commands through the safe command runner;
- parse total, passed, failed and skipped counts when reliable;
- preserve raw bounded logs as evidence;
- provide failed test names/paths where available;
- distinguish unit, integration and end-to-end commands;
- no fabricated percentages or fake coverage.

### `m16_s08` — Build & Artifact Center

Handler: `m16.build.run`

- detect project-defined production build commands;
- execute cancellable builds;
- capture duration, exit code and bounded logs;
- discover resulting artifacts only after a successful build;
- calculate artifact file size and SHA-256/BLAKE3 checksums;
- display output paths;
- never claim a build succeeded based only on the presence of an old `dist` folder;
- compare artifact timestamps against operation start time.

### `m16_s09` — Safe Cache & Artifact Manager

Handler: `m16.artifacts.manage`

- measure project-local caches and generated outputs;
- support only reviewed paths such as `node_modules/.cache`, `.vite`, `.turbo`, `.next/cache`, `target/debug/incremental`, `dist`, `build`, `coverage` and ecosystem equivalents;
- show exact paths and sizes before cleanup;
- distinguish rebuildable cache from valuable build artifacts;
- require typed confirmation `CLEAN PROJECT`;
- block paths outside the registered project root;
- never delete source, manifests, lockfiles, `.git`, user documents or environment files.

### `m16_s10` — Release Readiness & Evidence Report

Handler: `m16.release.readiness`

- aggregate Git state, dependency state, environment checks, quality gates, tests, build result and artifacts;
- calculate readiness from verified evidence only;
- classify blockers, warnings and passed gates;
- export JSON and Markdown reports to Tauri app data;
- include timestamps, project path, commit hash when available, commands, exit codes and checksums;
- do not publish, deploy, tag or push automatically;
- release actions remain a separate explicitly confirmed future feature.

## 5.3 Native architecture for Module 16

Create a dedicated Rust module, for example:

```text
src-tauri/src/projects/
  mod.rs
  contracts.rs
  discovery.rs
  workspace.rs
  dependencies.rs
  environment.rs
  tasks.rs
  quality.rs
  tests.rs
  build.rs
  artifacts.rs
  readiness.rs
  persistence.rs
  errors.rs
  jobs.rs
```

Use:

- typed Serde request/response contracts;
- explicit Tauri commands;
- static TypeScript command registry entries;
- cancellable background jobs;
- bounded stdout/stderr collection;
- canonical path verification;
- project-root containment checks;
- SQLite migrations for projects, operations, gates, artifacts and reports;
- structured error codes;
- no dynamic conversion of handler IDs to command names;
- no arbitrary shell command command endpoint.

## 5.4 Module 16 UI requirements

Create a dedicated premium workspace, not a centered generic modal and not ten identical cards.

Required layout:

- project switcher and register-project control;
- project identity header with ecosystem badges and canonical path;
- release readiness summary;
- left or top workspace navigation;
- Overview dashboard;
- Workspace Graph;
- Dependencies;
- Environment;
- Scripts & Tasks;
- Quality Gates;
- Tests;
- Builds & Artifacts;
- Cache Manager;
- Release Report;
- persistent job/progress tray;
- evidence drawer for logs, commands, paths and exit codes.

Visual direction:

- professional IDE/workspace density;
- strong information hierarchy;
- large readable typography;
- varied card structures based on content;
- no repetitive primitive two-button cards;
- real empty, loading, unavailable, warning and failure states;
- responsive desktop/tablet behavior;
- full Arabic/English support and correct RTL mirroring;
- dark and light themes with real contrast;
- official circular KNOUX logo treatment;
- subtle glass layers, not washed-out purple panels.

## 5.5 Capability catalog truthfulness

Update Module 16 services only after their native handlers exist.

Rules:

- `implemented` requires working handler + typed contract + verification + tests;
- `partial` must state exactly what is connected and what is missing;
- `requires_configuration` must explain the external requirement;
- `planned` must expose no executable handler;
- every handler must resolve through `nativeCommandRegistry.ts`;
- exactly 19 modules and 190 services must remain.

---

## 6. TESTING REQUIREMENTS

### Frontend

Run and pass:

```bash
npm run typecheck
npm run test
npm run build
```

Add or update tests for:

- 19 modules and 190 services;
- all implemented handler IDs are allowlisted;
- planned services have no handler;
- web preview returns unavailable instead of simulated success;
- Module 03 and Module 15 routes render dedicated workspaces;
- Module 16 catalog matrix matches actual handlers;
- no sample projects, dependencies, tests, ports or build artifacts;
- no timer-based fake progress;
- no dynamic handler-name construction.

### Rust / Windows native

Run and pass:

```bash
cd src-tauri
cargo fmt --check
cargo check --all-targets --all-features
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features
```

Add tests using temporary directories and small fixture projects for:

- project type detection;
- monorepo detection;
- path containment;
- environment-value redaction;
- command allowlisting;
- cancellation;
- log truncation;
- cache cleanup boundaries;
- artifact timestamp verification;
- checksum creation;
- release readiness blockers;
- SQLite persistence and migrations.

Do not use the developer’s real home directory in automated tests.

---

## 7. ANTI-CHEATING GATE

Search production code and fail the task if any new feature depends on:

- sample/mock project arrays;
- hardcoded host paths presented as real;
- `setTimeout` for operation progress;
- `Math.random` for system results;
- unconditional `Ok(true)`, `Ok(vec![])`, or completed states for unimplemented commands;
- browser localStorage as the authoritative native evidence store;
- raw shell execution controlled by UI text;
- environment secret values returned to React;
- stale artifact folders treated as proof of a new successful build;
- green result badges for skipped/unavailable checks.

---

## 8. REQUIRED COMPLETION REPORT

At completion, provide a precise report containing:

1. files copied unchanged from the overlay;
2. integration-sensitive files merged manually;
3. obsolete files deleted;
4. Module 03 verification results;
5. Module 15 verification results;
6. all Module 16 files created/changed;
7. exact Module 16 implementation matrix;
8. registered frontend handler IDs and Rust commands;
9. SQLite migrations added;
10. tests added and exact command results;
11. build output;
12. known limitations and `requires_configuration` features;
13. screenshots of Module 03, Module 15 and Module 16 in dark and light modes;
14. confirmation that no deployment or production merge occurred unless explicitly authorized.

Do not respond with a theoretical plan. Perform the integration and implementation inside the open project, validate it, and report code evidence.
