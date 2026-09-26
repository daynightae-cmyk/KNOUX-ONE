# Operation Lifecycle

States:
`CREATED -> PREFLIGHT -> READY -> RUNNING -> VERIFYING -> COMPLETED|COMPLETED_WITH_WARNINGS|FAILED|CANCELLED`

Optional mutation branch:
`READY -> PREVIEWED -> AWAITING_CONFIRMATION -> RUNNING`

Optional restore branch:
`COMPLETED -> RESTORE_REQUESTED -> RESTORING -> RESTORED|RESTORE_FAILED`

## Progress

- `DETERMINATE`: bytes/items/steps known.
- `INDETERMINATE`: opaque Windows operation where supported progress cannot be measured.
- `MULTI_PHASE`: phase weights come from measurable work only.
- Never emit timer-driven fake percentages.

## Cancellation

A service advertises Cancel only if the active phase has a safe cancellation boundary. Killing a child process is not automatically safe; commands like DISM/VSS need operation-specific semantics.

## Verification

Exit code is one signal, not proof. Mutations must re-read the target state or validate the generated artifact.
