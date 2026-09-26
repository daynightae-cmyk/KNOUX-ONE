# Windows Source Hierarchy

1. Microsoft Learn / Win32 / Windows Runtime / documented COM interfaces.
2. First-party Windows tooling such as WinGet, PnPUtil, DISM, SFC, PowerShell modules.
3. Mature open source only as an implementation/parser/algorithm reference.
4. External SaaS only when local Windows data cannot reasonably provide the capability.

## Rules

- Prefer direct APIs over shell parsing when the API is documented and materially improves reliability.
- Use commands only through typed argument builders and fixed executable identities.
- Registry is authoritative only where Microsoft documents the key/contract or where the repository already has a verified compatibility reason.
- A web article or Stack Overflow answer never establishes a production contract.
- An unsupported or version-specific source must be surfaced as such in the UI/result.
