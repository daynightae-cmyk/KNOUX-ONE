# Partial Services Closure

These six services remain PARTIAL in repository truth. Close them before claiming complete module coverage.

## M03-S03 — Similar-image detection
**Current limitation:** Current code performs full pairwise O(n²) comparison using dHash 45%, aHash 25%, RGB histogram 20%, aspect ratio 10%, union-find clustering, and full BLAKE3 evidence. It does not normalize EXIF orientation in the inspected path, has no indexed candidate stage, and emitted progress marks can_pause=false/can_cancel=false in the completion path.
**Target:** Robust local similar-image discovery with orientation normalization, candidate indexing, explainable similarity signals, preview thumbnails, bounded memory, cancellation, and no destructive action until a keeper/quarantine plan is separately verified.
**Implementation:** Decode safely; normalize orientation before fingerprints; create coarse buckets by dimensions/aspect/pHash-family signature; compare candidates rather than all pairs; retain multi-signal score and individual signal breakdown. Persist fingerprint cache keyed by file identity + size + mtime; invalidate on metadata change. Consider pHash only after benchmark fixtures prove benefit over the current dHash/aHash/histogram mix.
**Tests:**
- rotated EXIF pairs
- resized/recompressed JPEG pairs
- cropped/non-duplicate near scenes
- PNG/JPEG cross-format
- 10k-image performance fixture
- cancel mid-scan
- file changed during scan
**Runtime proof:**
- fixture truth labels vs clusters
- precision/recall report at threshold presets
- evidence includes normalized dimensions + signal scores
- cancel leaves no actionable partial group

## M03-S04 — Duplicate-video detection
**Current limitation:** Current code resolves ffprobe/ffmpeg from PATH, probes metadata, decodes only the first 120 seconds at 1 frame/10s, 32x32 grayscale, then hashes the entire sampled stream. This is real evidence but prefix-limited and brittle to trims, offsets, frame-rate/transcode changes, or same-intro/different-content videos.
**Target:** Near-duplicate video detection resilient to common transcodes and modest trims, with metadata + multi-segment perceptual frame signatures, optional audio correlation, transparent confidence, and explicit dependency diagnostics.
**Implementation:** Sample across the timeline (e.g. normalized temporal positions) rather than only the prefix; build per-frame perceptual hashes and compare sequences with bounded alignment tolerance; combine duration ratio, dimensions, codec-independent frame signatures and optional audio fingerprint. Exact BLAKE3 remains a separate exact proof, not a similarity proof. Resolve/bundle FFmpeg only under a documented licensing strategy.
**Tests:**
- same video re-encoded H264/H265
- trimmed intro/outro
- letterboxed version
- same first 2 minutes but different remainder
- short videos
- variable frame rate
- missing/corrupt stream
- ffmpeg absent
**Runtime proof:**
- dependency version/path recorded
- sample positions recorded
- per-signal score returned
- known fixture confusion matrix
- no group actionable solely on fuzzy score

## M03-S05 — Duplicate-audio detection
**Current limitation:** Current code decodes up to the first 300 seconds to mono 8kHz PCM, calculates roughly one-second RMS-energy bins, normalizes and hashes the quantized energy vector. It is metadata-independent but too coarse for robust near-duplicate audio and is prefix-limited.
**Target:** Audio duplicate/near-duplicate discovery tolerant of tags, container/bitrate changes and modest leading/trailing silence, while keeping local processing and explainable evidence.
**Implementation:** Retain exact hash lane. For acoustic similarity, evaluate Chromaprint-style fingerprints or an equivalent permissive backend, record decoded duration, sample rate/channel normalization, and use offset-tolerant fingerprint comparison. Do not treat metadata equality as proof. If Chromaprint is adopted, compile with a dependency stack whose licensing is explicitly acceptable.
**Tests:**
- same audio different tags
- MP3/AAC/FLAC transcodes
- leading silence
- gain change
- same loudness envelope but different song
- corrupt audio
- ffmpeg absent
**Runtime proof:**
- fingerprint backend/version recorded
- match offset/confidence evidence
- false-positive fixture set
- offline-only path passes

## M03-S07 — Duplicate-archive detection
**Current limitation:** Current path compares archive manifests without extracting content; ZIP uses a Windows/.NET compression route and 7z/RAR depend on external 7-Zip listing. The external-tool dependency and format/parser coverage keep this partial.
**Target:** Archive comparison without unsafe extraction, with normalized manifest entries, nested limits, encrypted-archive reporting, anti-bomb metadata limits, and clear distinction between exact archive bytes vs equivalent contained manifests.
**Implementation:** Use native ZIP parser in Rust for ZIP where practical; normalize path separators/case policy carefully without losing original names; hash manifest tuple (normalized path, uncompressed size, CRC/hash if available). For 7z/RAR either require an explicitly detected 7-Zip binary with version/license evidence or adopt a vetted library per format. Never extract merely to compare.
**Tests:**
- same content different compression level
- path-order changes
- nested archives
- encrypted archives
- path traversal names
- zip bomb metadata
- Unicode/Arabic filenames
- RAR/7z dependency absent
**Runtime proof:**
- no extraction side effects
- manifest normalization evidence
- dependency provenance recorded
- malicious archive fixture bounded

## M04-S05 — Old files
**Current limitation:** Repository describes last-access time with a labeled modification-time fallback. NTFS last-access updates can be system-managed/disabled and are not universally reliable as a direct 'last used' signal, so 'old' cannot mean 'unused' without qualification.
**Target:** Truthful age analysis that tells the user which timestamp signal is being used and how reliable it is, supports age/size/path filters, and never labels a file 'unused' when only modification time is known.
**Implementation:** Read CreationTime/LastAccessTime/LastWriteTime through handle/file information. Detect/report the system LastAccess policy where possible. Model ageBasis = LAST_ACCESS | LAST_WRITE_FALLBACK | UNKNOWN. UI copy must say 'not accessed since' only for trustworthy LastAccess evidence; otherwise 'not modified since'. Add user-defined threshold and exclusions; read-only by default.
**Tests:**
- LastAccess enabled/disabled systems
- ReFS/network paths
- permission denied
- files touched during scan
- clock/timezone edge cases
- OneDrive placeholders
**Runtime proof:**
- every row includes ageBasis
- policy evidence stored
- no deletion action inside this service
- fixture timestamps round-trip

## M04-S10 — Exportable storage reports
**Current limitation:** Current repository export writes a measured in-memory storage snapshot as JSON under app data. PDF is explicitly not implemented, and snapshots are kept only in an in-memory map capped at 20, so export after process restart is not durable.
**Target:** Durable report export from persisted scan evidence with JSON + CSV/HTML, and PDF only through a proven renderer. Reports must expose source scan id/SHA/time, redaction policy, warnings, and data completeness.
**Implementation:** Persist normalized storage snapshot metadata + aggregates in SQLite and optionally a compressed JSON artifact for detailed trees. Export JSON deterministically, CSV for tables, HTML for human-readable reports. Add PDF only via a vetted renderer and license plan; do not fake PDF with renamed HTML. Hash exported artifacts and store path/hash/format/size.
**Tests:**
- export after app restart
- large scan
- Unicode/Arabic filenames
- redaction mode
- deterministic JSON
- artifact hash verification
- disk-full/write-denied
**Runtime proof:**
- export can be regenerated from persisted scan
- artifact SHA-256/BLAKE3 stored
- format signature validated
- source scan id and binary SHA included
