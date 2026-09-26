# Security Model

## Non-negotiable boundaries

1. Renderer never receives unrestricted system authority.
2. Every native call maps `serviceId -> allowlisted handler -> typed request`.
3. No generic `execute_command(String)`.
4. No user-controlled executable name or raw PowerShell/cmd fragment.
5. Canonicalize and validate file targets, then re-check identity/metadata immediately before mutation.
6. Never follow junctions/symlinks into protected scopes by default.
7. Protect Windows, Program Files, ProgramData, System Volume Information and other machine-critical roots.
8. Admin elevation is per-operation, not “run the whole app as admin”.
9. Secrets go to an OS credential store or provider SDK secure storage, never SQLite plaintext or logs.
10. External HTTP capabilities block secret leakage and SSRF classes by default.

## Mutation gate

`discover -> preflight -> preview -> select -> confirm -> execute -> verify -> journal -> optional restore`

No destructive action is allowed to jump directly from discovery to execution.

## Typed confirmation

Use typed confirmation only for operations with irreversible/high-impact scope, such as secure deletion, broad network reset, or destructive purge. Normal safe reversible actions should not be punished with theatrical dialogs.

## Evidence redaction

Evidence objects carry a sensitivity class: `PUBLIC`, `LOCAL_MACHINE`, `PERSONAL`, `SENSITIVE`, `SECRET`. Exporters must apply field-level redaction rules. `SECRET` values are never persisted in evidence payloads.
