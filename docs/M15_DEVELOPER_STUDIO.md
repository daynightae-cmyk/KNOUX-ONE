# Module 15 — KNOUX Developer Studio

KNOUX Developer Studio is a local-first Windows engineering workspace. Device facts are read through explicit Tauri commands; browser preview never invents toolchains, repositories, ports, projects, or cache sizes.

## Native service matrix

| # | Service | Evidence source | Safety boundary |
|---|---|---|---|
| 1 | Workstation Toolchain Discovery | `where.exe` plus each tool's real version command | Read-only; missing tools remain missing |
| 2 | PATH Diagnostics Laboratory | User and machine environment providers | Read-only; no registry edits |
| 3 | Runtime & Version Manager Inspector | Executable discovery and developer-home variables | Read-only |
| 4 | Secure Git Configuration Audit | Selected non-secret global Git keys | Never reads tokens, passwords, or credential payloads |
| 5 | Repository Intelligence Scanner | Local `.git` directories and Git commands | Remote URLs are redacted; repository files are not modified |
| 6 | Ports & Process Control | Windows TCP/UDP and process providers | Protected processes blocked; termination requires `STOP <PID>` |
| 7 | Multi-Ecosystem Project Health | Local project manifests and lockfiles | Read-only discovery for Node, Rust, Python, Go, Java, and .NET |
| 8 | Developer Cache Control | Allowlisted package-manager and build-cache paths | Cleaning requires `CLEAN`; arbitrary directories are rejected |
| 9 | Local HTTP & API Laboratory | Explicit HTTP/HTTPS request supplied by the user | Only HTTP/HTTPS, timeout capped, response preview capped at 512 KB |
| 10 | Developer Evidence Report | Currently loaded studio evidence | JSON/Markdown exported inside protected application data |

## Workspace surfaces

- Command Center and host identity
- Toolchain matrix
- PATH laboratory
- Runtime manager inspection
- Git audit
- Repository intelligence
- Listening ports and process control
- Multi-ecosystem project health
- Developer cache measurement and cleanup
- HTTP/API request laboratory
- Evidence-report export

## Execution model

- Every service has a fixed `m15.*` handler ID.
- The TypeScript bridge resolves handlers through a static allowlist.
- Native execution is disabled in web preview with `desktop_runtime_unavailable`.
- Destructive actions require explicit typed confirmation.
- No generic arbitrary-shell command is exposed to the renderer.

## Known boundaries

- Developer Studio discovers and audits tools; it does not silently install or upgrade them.
- Repository scanning is bounded by configured depth and result limits.
- HTTP testing is not a credential vault; secrets should not be stored in reports.
- Cache cleanup targets recognized cache directories only.
- Module 16 remains a separate planned Project Engineering phase.
