# KNOUX ONE Gemini Integration Checklist

## Before merge

- [ ] Confirm the open project is the real KNOUX ONE repository.
- [ ] Create a reversible checkpoint of current work.
- [ ] Confirm the catalog currently contains 19 modules and 190 services.
- [ ] Inspect existing Module 03, Module 15, native command registry, `main.rs`, SQLite migrations and shared types.
- [ ] Read `GEMINI_BUILD_MASTER_PROMPT.md` completely.

## Apply the package

- [ ] Remove existing obsolete paths listed in `DELETE_MANIFEST.txt`.
- [ ] Copy all files under `overlay/` to identical repository-relative paths.
- [ ] Semantically merge shared integration files rather than deleting unrelated valid work.
- [ ] Preserve strict native command allowlisting.
- [ ] Preserve Arabic/English, RTL, dark/light and 19 × 10 catalog integrity.

## Verify Module 03

- [ ] Dedicated Duplicate Control Center route renders.
- [ ] Browser preview shows honest unavailable/empty states.
- [ ] Native exact scan, candidate scan, image review, folder comparison and keeper planning are wired.
- [ ] Quarantine, restore, verify and purge use the Rust engine and SQLite.
- [ ] No mock duplicate arrays or timer-based fake scans remain.

## Verify Module 15

- [ ] Dedicated Developer Studio route renders.
- [ ] Toolchains, PATH, runtimes, Git, repositories, ports, projects, cache, HTTP and reports use native evidence.
- [ ] Sensitive information is redacted.
- [ ] Process termination and cache cleanup require typed confirmations.
- [ ] Web preview never claims host access.

## Build Module 16

- [ ] Implement the ten stable `m16_s01`–`m16_s10` services from the master directive.
- [ ] Create typed Rust contracts and static Tauri commands.
- [ ] Add SQLite persistence and migrations.
- [ ] Add a dedicated Project Engineering workspace.
- [ ] Add path-containment and safe-command policies.
- [ ] Add cancellation, bounded logs and evidence reporting.
- [ ] Update catalog states only after handlers and tests exist.

## Validation gate

```bash
npm run typecheck
npm run test
npm run build

cd src-tauri
cargo fmt --check
cargo check --all-targets --all-features
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features
```

- [ ] All commands pass.
- [ ] No fake data or unconditional success stubs exist.
- [ ] Completion report includes exact files, handlers, migrations, test output and screenshots.
- [ ] Do not deploy or merge Production without explicit authorization.
