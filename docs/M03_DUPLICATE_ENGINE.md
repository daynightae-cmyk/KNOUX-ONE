# Module 03 — Duplicate Control Center

## Status

Module 03 is backed by explicit Tauri commands and an on-device Rust engine. Web preview remains non-executable and displays empty/unavailable states.

| Service | State | Native behavior |
|---|---|---|
| Exact duplicate scan | Implemented | Size grouping, partial BLAKE3, full streaming BLAKE3, changed-file verification, hard-link identity |
| Fast candidate scan | Implemented | Partial-hash candidates; never actionable before full verification |
| Similar image review | Partial | Local decoding and dHash similarity; manual review only |
| Video duplicate review | Partial | Exact file verification; advanced stream comparison requires ffprobe |
| Audio duplicate review | Partial | Exact file verification; acoustic fingerprinting requires an optional reviewed engine |
| Document duplicate review | Implemented | Exact local hashing of documents, configuration, and source files |
| Archive duplicate review | Partial | Exact archive verification; no unsafe automatic extraction |
| Folder comparison | Implemented | Deterministic folder digest and item-level overlap classification |
| Keeper planning | Implemented | Explainable keeper selection and protected-path rules |
| Quarantine and restore | Implemented | Checksum-verified move/copy, SQLite manifest, restore conflicts, typed-confirmation purge |

## Safety invariants

- System-critical paths are blocked.
- Symbolic links and directory junctions are not followed by the scanner.
- Same physical-file hard links are not counted as reclaimable storage.
- Candidate scans cannot be quarantined.
- Every actionable group requires a verified keeper.
- Files are revalidated before quarantine.
- Cross-volume moves use copy, flush, BLAKE3 verification, then source deletion.
- Restore supports stop, rename, choose destination, or replace with rollback backup.
- Permanent purge requires the exact typed confirmation `PURGE`.
- SSD secure erasure is not claimed.

## Local persistence

SQLite is stored in the Tauri application-data directory. Migrations create scan sessions, sources, exclusions, file evidence, groups, members, keeper plans, action history, and quarantine manifests.

## Known limitations

- Advanced video stream similarity is not bundled; it requires explicit ffprobe configuration.
- Acoustic fingerprinting is not bundled.
- Archive internal-manifest similarity remains planned.
- Similar-image clustering uses local dHash and is review-only.
- Completed scan history persists. Full recovery of an interrupted in-progress scan remains a future hardening task.

## Dependency purpose and licenses

The native engine uses reviewed crates for BLAKE3/SHA-256 hashing, directory traversal, SQLite, image decoding, timestamps, UUIDs, Windows file identity, and file-time restoration. Exact versions and transitive licenses are resolved by Cargo and must be reviewed before release packaging.
