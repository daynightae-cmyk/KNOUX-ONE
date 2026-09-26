# Partial Services Closure

These six services were PARTIAL in repository truth. **M04-S05 and M04-S10 are closed**
(M04-S05, M04-S10). The four Module 03 services below have had their closure *implemented and
statically verified*, and each now says so — but none of them is marked runtime verified,
because no Windows runtime run has been performed. A service leaves this list only when its
target is actually met, not when a typecheck, a lint or a unit test passes.

## Closed

### M04-S05 — Old files ✅ CLOSED

The specific lie this service used to tell was that "old" silently became "unused" on a machine
that had stopped recording last-access times.

- The NTFS last-access policy is now **measured**, not assumed. `fsutil behavior query
  disablelastaccess` is the primary surface, with the `NtfsDisableLastAccessUpdate` registry
  value as a fallback. The `source` used (`fsutil` / `registry` / `unknown`) and the raw value
  Windows reported are both carried into the result and the report.
- Every row carries `ageBasis ∈ {LAST_ACCESS, LAST_WRITE_FALLBACK, UNKNOWN}`. `LAST_ACCESS` is
  only chosen when the policy was measured reliable, so a readable-but-meaningless access time
  is never selected.
- `CreationTime`, `LastAccessTime` and `LastWriteTime` are all read and returned.
- UI copy follows the measured basis: "not accessed since" only for trustworthy `LAST_ACCESS`,
  "not modified since" for the fallback, and an explicit "no trustworthy age signal" for
  `UNKNOWN`. The read-only promise is shown to the user, not just asserted in Rust.
- Threshold and path exclusions are user-defined; exclusions are canonicalized before comparison
  and reported back so a smaller result is explainable. An exclusion equal to the root is refused.
- Read-only: no delete, move or quarantine path exists in the service. `readOnly: true` is
  persisted with the snapshot.
- Evidence: snapshot and rows persisted in SQLite (`004_storage_reports.sql`); tests cover
  `fsutil` parsing, policy-state mapping, all four `classify_age` branches, deterministic
  ordering, and format negotiation.

**Not yet claimed:** Windows runtime proof. Static verification only until the built app is run.

### M04-S10 — Exportable storage reports ✅ CLOSED

- The measured snapshot is **persisted in SQLite**, so an export works after a process restart.
  The old in-memory map capped at 20 entries is gone.
- Deterministic **JSON** (stable field order and a total sort by size then path), **CSV** (UTF-8
  BOM, RFC-4180 quoting) and **HTML** (full UTF-8, so Arabic paths render exactly).
- Every written document is hashed with **SHA-256 and BLAKE3**, and the hash is recomputed from
  the bytes on disk. Each artifact is checked against its own format signature and reported as
  `signatureValid: false` rather than passed off as valid.
- Reports carry the source scan id, source operation id, the running binary's SHA-256, the
  redaction profile, warnings, and an explicit data-completeness verdict.
- Redaction profiles (`none`, `user_profile`) replace known roots and leave unrelated paths alone.
- **PDF was removed, not faked.** A hand-assembled document silently replaced every non-ASCII
  path with `?` and truncated at 46 lines. PDF now appears in `formatsUnsupported` with its
  reason, and the HTML report is offered as the full-fidelity alternative. `resolve_formats`
  returns an error for `pdf` rather than a silent substitution.
- Evidence: tests cover the SQLite round trip, byte-identical re-export, redaction not leaking the
  user profile root, signature rejection, disk-verified hashing, and missing-snapshot failure.

**Not yet claimed:** Windows runtime proof. Static verification only until the built app is run.

## Still open

## M03-S03 — Similar-image detection
**Current limitation:** Current code performs full pairwise O(n²) comparison using dHash 45%, aHash 25%, RGB histogram 20%, aspect ratio 10%, union-find clustering, and full BLAKE3 evidence. It does not normalize EXIF orientation in the inspected path, has no indexed candidate stage, and emitted progress marks can_pause=false/can_cancel=false in the completion path.
**Closure status:** CLOSED IN CODE, NOT RUNTIME VERIFIED. Implemented in `src-tauri/src/completion14/m03.rs` (orchestration) and `m03_exif.rs`, `m03_images.rs`, `m03_media.rs`.
- **EXIF orientation is now normalized before any fingerprint.** `m03_exif.rs` reads IFD0 tag `0x0112` from the JPEG `APP1` segment by walking the marker segments and the TIFF header itself, because `image` 0.25.10 exposes no orientation at all (verified against the crate source). All eight values are applied, including the mirrored transposes 5 and 7 — folding those into a rotation would leave a mirrored image mirrored, which is a worse failure than not normalizing, because it looks like it worked. A tag that is absent, unreadable or out of range yields a named source (`jpeg_app1_exif_tag` / `jpeg_without_orientation_tag` / `not_a_jpeg` / `not_found_within_head_window`) rather than a guess.
- **Candidate indexing replaces the all-pairs pass.** Files are bucketed by aspect band (8 bands per octave) plus the top 16 of 64 dHash bits, compared within ±1 aspect band. Byte-identical files are collapsed to one representative per exact-hash class *before* the fuzzy stage, because a whole-file BLAKE3 match is already proof. The result reports `comparedPairs` and `allPairsIfComputed` so the saving is checkable. A synthetic 10 000-image fixture (2 000 scenes × 5 copies) collapses 8 000 files and compares far fewer than the 49 995 000 a full sweep would cost.
- **The multi-signal score is retained and broken out.** Weights stay 45/25/20/10, and every group carries `signals[]` — dHash, aHash, histogram, aspect — each with its own score, weight, availability flag and bilingual explanation, so the composite can be reconstructed rather than trusted.
- **Fingerprints are cached on disk**, keyed by file identity (Windows volume serial + file index, so hard links share one entry) plus size plus modification time; any change invalidates the entry. A file whose size or mtime changes *during* the scan is dropped from the result rather than clustered on a fingerprint that no longer describes it.
- **Progress and cancellation are real.** Each command registers a `JobControl` under its own operation id — the same registry the already-registered `m03_job_pause` / `m03_job_resume` / `m03_job_cancel` commands use, so the interface can already pause and cancel these scans with no new command. `canPause` / `canCancel` are computed from whether a worker is still running, and a cancelled scan returns **no groups at all**.
- **Nothing destructive.** No media module contains `fs::remove_file`, `fs::remove_dir_all` or `fs::rename`; a test re-checks this against the source at test time.
**Not yet claimed:** No Windows runtime run. A real photo folder has not been measured, so the precision/recall report against truth labels, the threshold-preset sweep, and the confirmation that a cancel mid-scan leaves no actionable partial group in the shipped app are all still human steps. pHash was deliberately **not** adopted: no benchmark fixture in this repository proves it beats the retained mix, and the evidence says so rather than implying a decision was made.
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
**Closure status:** CLOSED IN CODE, NOT RUNTIME VERIFIED. Implemented in `src-tauri/src/completion14/m03.rs` (orchestration) and `m03_video.rs`, `m03_media.rs`.
**Current limitation:** Current code resolves ffprobe/ffmpeg from PATH, probes metadata, decodes only the first 120 seconds at 1 frame/10s, 32x32 grayscale, then hashes the entire sampled byte stream. This is real evidence but prefix-limited and brittle to trims, offsets, frame-rate/transcode changes, or same-intro/different-content videos.
- **Sampling moved off the prefix.** Frames are read at normalized timeline positions — the centre of each of N equal slices — and every position used is returned, both in seconds and as a fraction of the duration, so the rule is reproducible. A short video is sampled at fewer positions rather than repeating a position, and the count actually used is reported instead of the count requested.
- **Per-frame perceptual signatures and bounded alignment.** Each sampled frame becomes a 64-bit difference hash on a 9×8 luma grid. Two sequences are compared over a published shift window (a quarter of the shorter sequence) and the best shift is reported. Two corrections are deliberate and documented in the evidence: the 50% chance baseline is subtracted from mean frame agreement so unrelated footage lands near zero instead of at a 0.5 floor, and the agreement is multiplied by how much of the longer sequence the shift covers, so a video sharing only its opening does not match.
- **Signals are combined and reported separately** — frame sequence 60%, duration ratio 25%, dimensions 15% — with each one's own score, weight, availability flag and explanation on every group. The dimension signal compares aspect ratio primarily and resolution only lightly, because a re-encode at a lower resolution keeps the shape and must not be penalized like a letterbox.
- **A group is never actionable on a fuzzy score.** Only a full-file BLAKE3 match sets `actionable`; fuzzy groups carry `proofStatus: "fuzzy_frame_similarity"`, `actionable: false` and a warning saying so on the group itself. The exact lane is a separate proof, not part of the score.
- **Dependency diagnostics are explicit.** `ffprobe` and `ffmpeg` are resolved once per process and their resolved absolute path, the version line each printed about itself and the licence line each printed are recorded verbatim. When one is missing the service returns a typed reason in both languages with a failed status and no groups — never an empty but successful scan.
- **Errors are errors.** A file the decoder cannot open, or one with no video stream, is counted and reported (`ffprobe_exit_failed`, `video_stream_absent`, `ffmpeg_frame_failed`); a position the decoder cannot reach is skipped and the shortfall is recorded as `short_read` rather than being filled in.
**Not yet claimed:** No Windows runtime run, and no ffmpeg was invoked during testing. The re-encode, trim, letterbox, shared-intro, short-clip, variable-frame-rate and corrupt-stream cases are covered by unit tests over the sampling, alignment and probe-parsing logic with synthetic frame signatures — not by decoding real video files. A real H264/H265 fixture set, the recorded dependency version, the confusion matrix and the end-to-end cancel behaviour are still human steps.
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
**Closure status:** CLOSED IN CODE, NOT RUNTIME VERIFIED. Implemented in `src-tauri/src/completion14/m03.rs` (orchestration) and `m03_audio.rs`, `m03_media.rs`.
**Current limitation:** Current code decodes up to the first 300 seconds to mono 8kHz PCM, calculates roughly one-second RMS-energy bins, normalizes and hashes the quantized energy vector. It is metadata-independent but too coarse for robust near-duplicate audio and is prefix-limited.
- **Chromaprint was not adopted, and the reason is recorded in the output.** It is a C library behind a native binding, and this repository cannot verify its licensing offline, so the acoustic backend is implemented in-process instead: `in_process_spectral_band_fingerprint_v1`. Every result names the backend, and the English and Arabic limitation text states plainly that it is not Chromaprint, that it does not identify a recording, and that it has no shingling or error correction.
- **The fingerprint is a band-energy one.** Each 128 ms frame is reduced to 24 logarithmically spaced band levels, expressed as a deviation from that frame's own mean and quantized to one nibble. Storing a *deviation* is what makes it gain-invariant: a constant gain moves the whole spectrum by the same number of decibels, so it cancels. The guarantee is stated as it actually holds — invariant to within one quantization step, verified by score, not asserted as bit-identical.
- **Comparison is offset-tolerant.** The best match is searched over a bounded frame-offset window (a quarter of the shorter fingerprint, ≈19 s at either end for a five-minute recording) and discounted by how much of the longer signal that offset covers. Leading and trailing silence is trimmed first with a short probe, so added silence does not become a mismatch. A deliberately inserted intro is reported *as an offset* rather than silently absorbed.
- **The exact lane is kept and kept separate.** A whole-file BLAKE3 match is the only proof and the only actionable path; a fuzzy acoustic group carries `actionable: false` and says so.
- **Metadata equality is never proof.** `metadataUsedAsProof` is a hard-coded `false` in the evidence, tags are never read at all, and every exact group carries a bilingual note saying so. Equal tags on completely different audio cannot be reported as a match.
- **Decoded facts are recorded per file** — decoded duration, sample rate, channel normalization, frame count, measured peak dBFS, and the leading/trailing silence that was trimmed. Decoding stops after 900 s and such a file is reported as `decoded_prefix_truncated` rather than being compared silently on its prefix.
- **Failures are typed.** A missing `ffmpeg` or `ffprobe` produces a bilingual reason and a failed status with no groups. A file that decodes to nothing is `decode_failed`; a file that decodes to silence is `silence_only` and produces no fingerprint at all, rather than being matched against other silent files.
**Not yet claimed:** No Windows runtime run, and no audio file was decoded during testing. The transcode case is a synthetic requantisation (12-bit and 8-bit), not a real MP3/AAC/FLAC encode; the "same loudness envelope, different song" case uses two synthetic tone stacks; the corrupt-audio and ffmpeg-absent cases are covered at the decision level, not against real files. A real transcoded fixture set, the false-positive set, and the offline-only path through the built app are still human steps.
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
**Closure status:** CLOSED IN CODE FOR ZIP, EXPLICITLY REFUSED FOR 7z/RAR, NOT RUNTIME VERIFIED. Implemented in `src-tauri/src/completion14/m03.rs` (orchestration) and `m03_archives.rs`, `m03_media.rs`.
**Current limitation:** Current path compares archive manifests without extracting content; ZIP uses a Windows/.NET compression route and 7z/RAR depend on external 7-Zip listing. The external-tool dependency and format/parser coverage keep this partial.
- **ZIP is now parsed natively in Rust, and nothing is ever opened.** `m03_archives.rs` seeks to the end-of-central-directory record (with ZIP64 support), bounds every read against the file length, and reads only the central directory. There is exactly one `File::open` in the reader and it opens the archive; there is no code path that reads an entry's compressed bytes, and a test asserts both facts against the source. This is the safety property, not an optimisation: a hostile archive cannot be unpacked by being compared.
- **Names are preserved, not sanitized away.** Each entry keeps `original_name` exactly as stored, decoded per the specification — UTF-8 when general-purpose bit 11 is set, CP437 otherwise, **except** when a validated Info-ZIP Unicode Path extra field (0x7075) supplies the real name, whose CRC-32 is checked before it is trusted. That field is what keeps an Arabic name from becoming mojibake in an archive that nominally claims CP437, and the CRC check means a fabricated field is ignored. A separate `normalized_path` is used only for comparison.
- **Normalization is published and minimal.** `\` becomes `/`, empty and `.` segments are dropped, and **only ASCII letters** are lowercased (`case_policy: "ascii_lowercase_only"`). Folding non-ASCII case would need a locale and a case table, and getting either wrong would rewrite exactly the names this must preserve; the resulting limitation — two archives differing in the case of a non-ASCII name are reported as different — is stated in the result.
- **The manifest hash is the tuple (normalized path, uncompressed size, CRC-32)**, sorted by path, with unit separators so no crafted name can forge a tuple boundary. Compression method and compressed size are deliberately **excluded**, which is what makes "same content, different compression level" match; entry order is excluded, which is what makes a re-write by a different archiver match; directory records are excluded along with their count, because a zero-size zero-CRC directory record describes no content. Non-directory entry count is still bound, so adding a file still changes the hash. Compression method and compressed size are still *reported* per entry as evidence.
- **Anti-bomb limits abort bounded.** Entry count (65 536), total declared uncompressed bytes (8 GiB), compression ratio (1 000:1), a 32 MiB cap on central-directory bytes read, and per-record bounds on the name/extra/comment lengths. A ratio claim is checked *before* the entry is accepted, so a 1 KiB archive claiming just under 4 GiB aborts with `compression_ratio_limit_exceeded` and yields zero entries. A declared size with no compressed bytes reports an infinite ratio rather than a misleading zero. A directory that declares more entries than its bytes contain is reported as `central_directory_short`, not as a complete manifest.
- **Encrypted archives are reported, not hidden.** General-purpose bit 0 and compression method 99 both mark an entry encrypted; the archive is summarized as `encrypted` with a bilingual note explaining that the central directory still records the plaintext CRC-32 so the manifest is comparable, and that no password was tried and no entry was opened.
- **Path traversal is flagged, never followed.** `..` segments, absolute roots and drive prefixes are detected, counted, and kept under a distinct `<path-traversal>/` prefix so they hash differently from a clean name. No name from an archive is ever resolved against a filesystem.
- **Nested archives are detected and reported** with `nestedArchiveContentsCompared: false`. They are not opened, and the limitation says two archives holding different nested archives are therefore not distinguished by them.
- **7z/RAR are refused, with a type.** `.7z`, `.rar`, `.tar` and `.gz` have no native reader in this build. A real 7-Zip binary is detected once; if present, its resolved path, the version it printed and the licence line it printed are recorded as evidence and it is used for **listing only**, never extraction, with a pure `7z l -slt` parser that is unit-tested against real listing text. If absent, each such file is counted and reported through `formatsUnsupported` with a bilingual reason and **no manifest hash at all** — there is no code path that could produce one.
- **Exact bytes and equivalent manifests are different claims.** Byte-identical archives form an actionable `verified_exact` group; equal manifests form a non-actionable `equivalent_manifest` group carrying `actionable: false` and a warning that equivalent manifests are not equivalent bytes.
**Not yet claimed:** No Windows runtime run, and no 7-Zip binary was exercised during testing (its listing parser is tested against captured `7z l -slt` output text). No real ZIP produced by a third-party archiver, a real AES-encrypted archive, a real ZIP64 archive or a real zip bomb has been opened by the parser; the fixtures are constructed byte-for-byte in the tests. The "no extraction side effects" proof in the shipped app, the manifest-normalization evidence against real archives, the dependency provenance for a real 7-Zip install, and the bounded behaviour on a malicious archive fixture are still human steps.
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
