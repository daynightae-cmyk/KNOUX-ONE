# Data Model

Core chain:
`service -> operation -> operation_step -> evidence -> artifact`

Domain records reference the operation that produced them. Large detailed trees/media fingerprints should be stored in compact artifacts or normalized domain tables only when future queries justify it.

Secrets are referenced by opaque credential-store IDs only. Never place secret material in `provider_metadata.config_json`.
