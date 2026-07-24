# KNOUX ONE — Windows Intelligence & Developer Suite
> **Build • Protect • Optimize**  
> *A Knoux Product — Crafted by Eng. Sadek Elgazar (Knoux)*

KNOUX ONE is a high-performance native Windows desktop application and system suite engineered in **Tauri v2, Rust, React 19, and TypeScript**.

---

## 1. Implemented Modules (Phase 03)

- **Module 01: First Run & Post-Format Setup** (`m01_s01` through `m01_s10`)
  - **m01_s01**: Windows & Hardware Native Discovery (`m01.system.discover`)
  - **m01_s02**: Winget Availability Verification (`m01.winget.verify`)
  - **m01_s03**: Winget Repair & Source Diagnostics (`m01.winget.diagnose`)
  - **m01_s04**: Essential Software Catalog (`m01.software.catalog`)
  - **m01_s05**: Bulk Essential Software Installation Queue (`m01.software.install_queue`)
  - **m01_s06**: Import Package List & Winget JSON (`m01.software.import_list`)
  - **m01_s07**: Export Installed Application Inventory (`m01.software.export_inventory`)
  - **m01_s08**: Create & Manage Post-Format Setup Profiles (`m01.profile.manage`)
  - **m01_s09**: Resumable Local Installation Queue (`m01.queue.manage`)
  - **m01_s10**: System Restore Point Creation (`m01.restore_point.create`)

*Modules 02–19 are currently in `planned` state and will be implemented sequentially in subsequent phases.*

---

## 2. Requirements & Environment Setup

### System Requirements
- **Operating System**: Windows 10/11 (64-bit)
- **Runtime**: WebView2 Runtime (pre-installed on Windows 11)
- **Build Tools**: Visual Studio Build Tools 2022 (C++ Workload)
- **Node.js**: v18.0.0 or higher
- **Rust Toolchain**: `stable-x86_64-pc-windows-msvc`

---

## 3. Local Development Commands

### Install Dependencies
```bash
npm install
```

### Run Web Development Server
```bash
npm run dev
```

### Run Type Checking
```bash
npm run typecheck
```

### Run Vitest Test Suite
```bash
npm test
```

### Run Tauri Desktop Application (Dev Mode)
```bash
npm run desktop:dev
```

### Build Native Desktop Distribution (EXE/MSI)
```bash
npm run desktop:build
```

---

## 4. Operational Safety & Security Boundaries

1. **Non-Destructive Execution**: No silent file deletion or aggressive registry tweaks.
2. **Explicit Administrator UAC Scope**: The UI provides a UAC confirmation flow which will be integrated with native OS elevation APIs.
3. **Rust Command Integration**: IPC invocations use explicit, allowlisted Rust commands. No generic `run_command` endpoints exist.
4. **Local Data Persistence**: Operations use a local web preview adapter during web development. Full SQLite persistence will be available in the native desktop bundle.
