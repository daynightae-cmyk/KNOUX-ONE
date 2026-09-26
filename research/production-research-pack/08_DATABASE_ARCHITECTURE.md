# Database Architecture

The repository already includes `rusqlite` with bundled SQLite. Extend one coherent local database rather than create a second datastore.

## Data classes

- **Ephemeral**: progress buffers, current process samples, temporary candidate sets. Memory/temp files only.
- **Persisted history**: operation summaries, scan metadata, aggregate measurements, report metadata.
- **Audit/journal**: mutation before/after state, evidence hashes, restore instructions.
- **User configuration**: profiles, exclusions, schedules, UI/service settings.
- **Secrets**: never stored in SQLite plaintext.

## Retention defaults

- operation/evidence logs: 90 days configurable;
- high-frequency performance samples: keep detailed 24h, aggregate/downsample older windows;
- temporary scan candidates: discard after completion unless the user saves the scan;
- quarantine metadata: retain until restore/permanent purge plus an audit tombstone;
- reports/artifacts: user-controlled retention, with DB metadata and content hash.

See `database/knoux-production-schema.sql`.
