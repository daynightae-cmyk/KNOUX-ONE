# Module 15 — KNOUX Developer Studio

KNOUX Developer Studio is a local-first Windows engineering workspace. Device facts are read through explicit Tauri commands; browser preview never invents toolchains, repositories, ports, projects, or cache sizes.

## Native service matrix

Every row is one catalog service, and every service owns exactly one native command. The gate `bun run verify:service-exclusivity` enforces that no two services share a command and that no implemented command is left without an owner.

| # | Service | Handler | Evidence source | Safety boundary |
|---|---|---|---|---|
| 1 | Development-environment detection | `m15.environment.discover` | `where.exe` plus each tool's real version command | Read-only; missing tools remain missing |
| 2 | PATH editor | `m15.path.audit` | User and machine environment providers | Read-only; no registry edits |
| 3 | Git configuration audit | `m15.git.audit` | Selected non-secret global Git keys | Never reads tokens, passwords, or credential payloads |
| 4 | Runtime & version manager inspector | `m15.runtime.inspect` | Executable discovery and developer-home variables | Read-only |
| 5 | Repository intelligence scanner | `m15.repositories.scan` | Local `.git` directories and Git commands | Remote URLs are redacted; repository files are not modified |
| 6 | Multi-ecosystem project health | `m15.projects.audit` | Local project manifests and lockfiles | Read-only discovery for Node, Rust, Python, Go, Java, and .NET |
| 7 | Developer cache control | `m15.caches.manage` | Allowlisted package-manager and build-cache paths | Cleaning requires `CLEAN`; arbitrary directories are rejected |
| 8 | Local HTTP & API laboratory | `m15.http.execute` | Explicit HTTP/HTTPS request supplied by the user | Only HTTP/HTTPS, timeout capped, response preview capped at 512 KB |
| 9 | Ports & process control | `m15.ports.manage` | Windows TCP/UDP and process providers | Protected processes blocked; termination requires `STOP <PID>` |
| 10 | Developer health report | `m15.report.export` | Currently loaded studio evidence | JSON/Markdown exported inside protected application data |

## Workspace surfaces

- Command Center and host identity
- Toolchain matrix
- PATH laboratory
- Git audit
- Runtime manager inspection
- Repository intelligence
- Multi-ecosystem project health
- Developer cache measurement and cleanup
- HTTP/API request laboratory
- Listening ports and process control
- Evidence-report export

## Execution model

- Every service has a fixed `m15.*` handler ID.
- The TypeScript bridge resolves handlers through a static allowlist.
- Native execution is disabled in web preview with `desktop_runtime_unavailable`.
- Destructive actions require explicit typed confirmation.
- No generic arbitrary-shell command is exposed to the renderer.

## Numbering

The catalog, the Rust engine and the frontend store use one numbering. Each result
envelope names the catalog service it actually measured, so an evidence record
can never be attributed to a different service.

## Known boundaries

- Developer Studio discovers and audits tools; it does not silently install or upgrade them.
- Repository scanning is bounded by configured depth and result limits.
- HTTP testing is not a credential vault; secrets should not be stored in reports.
- Cache cleanup targets recognized cache directories only.
- Module 16 is a separate Code & Project Tools phase; its project surface is exposed as workspace tools rather than catalog services.
