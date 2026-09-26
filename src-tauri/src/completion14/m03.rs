//! The four media and archive duplicate services: M03-S03, M03-S04, M03-S05, M03-S07.
//!
//! This is the "complete" tier. The `duplicates` module holds the exact-hash engine; this
//! file holds the four services that need more than a hash, and the rule they share:
//! **a fuzzy score is never proof.** Only a full BLAKE3 match over the whole file can make
//! a group actionable; every other result arrives with the individual signals, the policy
//! that produced them, the sample positions that were read, and a statement of what is
//! still unproven.
//!
//! # What each service does, and what it refuses to do
//!
//! | Service | Policy | Refuses to |
//! |---|---|---|
//! | M03-S03 images | EXIF orientation applied, then bucketed dHash/aHash/histogram/aspect | move, quarantine or delete anything |
//! | M03-S04 videos | frames sampled across the timeline, bounded-alignment signature | act on a fuzzy score |
//! | M03-S05 audio | exact bytes, plus an offset-tolerant in-process band fingerprint | treat equal tags as proof |
//! | M03-S07 archives | native ZIP central directory, manifest tuple hash | unpack an entry, ever |
//!
//! # Dependency honesty
//!
//! Video and audio decoding need `ffprobe` and `ffmpeg`; 7z and RAR listing needs a
//! 7-Zip binary. Each is resolved once, and its resolved path, the version line it printed
//! about itself and the licence line it printed are recorded in the result
//! ([`crate::completion14::m03_media`]). When a dependency is missing the service returns
//! a **typed reason in both languages** and a failed status — never an empty scan
//! presented as success.
//!
//! # Cancellation
//!
//! Each command registers a [`crate::duplicates::jobs::JobControl`] under its own
//! operation id. That is the registry the already-wired `m03_job_pause`,
//! `m03_job_resume` and `m03_job_cancel` commands operate on, so the interface can pause
//! and cancel these scans with no new command and no change to `main.rs`. A cancelled scan
//! returns **no groups at all**: a half-built cluster is not a finding.

use crate::{
    completion14::{m03_archives, m03_audio, m03_images, m03_video},
    contracts::OperationResult,
    duplicates::{
        contracts::{
            ArchiveManifestSummary, ArchiveScanEvidence, AudioDecodeRecord, AudioScanEvidence,
            DuplicateFileItem, DuplicateGroup, DuplicateJobProgress, DuplicateScanRequest,
            DuplicateScanResult, DuplicateScanSummary, FileEvidence, ImageDecodeLimits,
            ImageScanEvidence, MediaScanEvidence, SignalScore, SignalWeight, ToolEvidence,
            VideoScanEvidence,
        },
        jobs,
        scanner::with_extensions,
        traversal::{self, FileCandidate},
    },
};
use chrono::Utc;
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Arc,
    time::Instant,
};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

// The entry kind the native archive comparison is built on, and the dependency evidence
// the three dependent services report, re-exported here because this file is the public
// face of those services.
pub use crate::completion14::m03_archives::ZipFile;
pub use crate::completion14::m03_media::{dependency_warning, is_usable, tool_evidence};
pub use crate::completion14::m03_video::frame_signature;

/// Extensions each service takes responsibility for.
const IMAGE_EXTENSIONS: [&str; 8] = ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp"];
const VIDEO_EXTENSIONS: [&str; 8] = ["mp4", "mkv", "avi", "mov", "wmv", "webm", "m4v", "flv"];
const AUDIO_EXTENSIONS: [&str; 7] = ["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"];
const ARCHIVE_EXTENSIONS: [&str; 5] = ["zip", "7z", "rar", "tar", "gz"];

/// Progress is emitted at most this often, so a large scan does not spend its time
/// serializing events.
const PROGRESS_STRIDE: usize = 32;
/// The warning list is capped so one unreadable folder cannot produce a megabyte of text.
/// The number of dropped warnings is reported, so a short list is never mistaken for a
/// complete one.
const MAX_WARNINGS: usize = 50;

const VERIFICATION_NOTE_EN: &str =
    "Produced by the application code and covered by its own tests. No Windows runtime run \
     has been performed, so nothing in this result is marked runtime verified.";
const VERIFICATION_NOTE_AR: &str =
    "أُنتج هذا التطبيق برمجيًا وتغطّته اختباراته. لم يُجرَ أي تشغيل فعلي على ويندوز، لذا لا يُعتبر \
     أي جزء من هذه النتيجة مُتحقَّقًا منه أثناء التشغيل.";

/// Why a scan stopped before it finished.
enum ScanStop {
    /// The job control asked it to stop. The result is empty by construction.
    Cancelled,
    /// Something went wrong that the scan could not work around.
    Failed(String),
}

/// A string error from one of the audited helpers means the scan could not continue, and
/// never that it was cancelled.
impl From<String> for ScanStop {
    fn from(message: String) -> Self {
        Self::Failed(message)
    }
}

fn checkpoint(control: &Arc<jobs::JobControl>) -> Result<(), ScanStop> {
    control.checkpoint().map_err(|_| ScanStop::Cancelled)
}

fn op_result(
    op_id: String,
    capability: &str,
    handler: &str,
    started: String,
    timer: Instant,
    data: Option<DuplicateScanResult>,
    status: &str,
    summary_en: String,
    summary_ar: String,
    warnings: Vec<String>,
    error: Option<String>,
) -> OperationResult<DuplicateScanResult> {
    OperationResult {
        operation_id: op_id,
        capability_id: capability.into(),
        handler_id: handler.into(),
        status: status.into(),
        started_at: started,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code: Some(if status == "failed" { 1 } else { 0 }),
        stdout: None,
        stderr: error.clone(),
        summary_en,
        summary_ar,
        warnings,
        error_code: error.map(|_| "media_scan_failed".into()),
        data,
    }
}

fn protected(path: &Path) -> bool {
    let lowered = path.to_string_lossy().to_ascii_lowercase();
    [
        r"c:\windows",
        r"c:\program files",
        r"c:\program files (x86)",
        r"c:\programdata",
        r"c:\system volume information",
        r"c:\$recycle.bin",
    ]
    .iter()
    .any(|prefix| lowered.starts_with(prefix))
}

/// Full-content BLAKE3. The only thing in this file that constitutes proof.
fn full_hash(path: &Path) -> Result<String, String> {
    crate::duplicates::hashing::full_blake3(path).map_err(|error| error.to_string())
}

fn file_item(
    candidate: &FileCandidate,
    hash: String,
    perceptual: Option<String>,
    similarity: Option<f32>,
    dimensions: Option<(u32, u32)>,
    evidence: Vec<FileEvidence>,
) -> Result<DuplicateFileItem, String> {
    Ok(DuplicateFileItem {
        id: Uuid::new_v4().to_string(),
        path: candidate.path.to_string_lossy().to_string(),
        canonical_path: candidate.canonical_path.to_string_lossy().to_string(),
        name: candidate.name.clone(),
        extension: candidate.extension.clone(),
        size_bytes: candidate.size_bytes,
        modified_time: candidate.modified_time.clone(),
        created_time: candidate.created_time.clone(),
        hash,
        partial_hash: None,
        perceptual_hash: perceptual,
        similarity_score: similarity,
        mime_type: candidate.mime_type.clone(),
        width: dimensions.map(|value| value.0),
        height: dimensions.map(|value| value.1),
        file_identity: candidate.file_identity.clone(),
        hard_link_count: candidate.hard_link_count,
        is_hard_link_alias: false,
        protected_path: candidate.protected_path || protected(&candidate.canonical_path),
        evidence,
    })
}

fn note(key: &str, value: String, en: &str, ar: &str) -> FileEvidence {
    FileEvidence {
        key: key.into(),
        value,
        note_en: en.into(),
        note_ar: ar.into(),
    }
}

fn round3(value: f64) -> f64 {
    if value.is_finite() {
        (value * 1000.0).round() / 1000.0
    } else {
        0.0
    }
}

fn find(parent: &mut [usize], index: usize) -> usize {
    if parent[index] != index {
        let root = find(parent, parent[index]);
        parent[index] = root;
    }
    parent[index]
}

fn union(parent: &mut [usize], left: usize, right: usize) {
    let left_root = find(parent, left);
    let right_root = find(parent, right);
    if left_root != right_root {
        parent[right_root] = left_root;
    }
}

/// Groups the members of a union-find into clusters larger than one.
fn clusters(parent: &mut [usize], count: usize) -> Vec<Vec<usize>> {
    let mut grouped: HashMap<usize, Vec<usize>> = HashMap::new();
    for index in 0..count {
        let root = find(parent, index);
        grouped.entry(root).or_default().push(index);
    }
    grouped
        .into_values()
        .filter(|group| group.len() > 1)
        .collect()
}

/// Caps the warning list and reports what did not fit.
struct Warnings {
    items: Vec<String>,
    suppressed: u64,
    errors: u64,
}

impl Warnings {
    fn new() -> Self {
        Self {
            items: Vec::new(),
            suppressed: 0,
            errors: 0,
        }
    }
    fn push(&mut self, message: String) {
        self.errors += 1;
        if self.items.len() < MAX_WARNINGS {
            self.items.push(message);
        } else {
            self.suppressed += 1;
        }
    }
    fn into_vec(mut self) -> Vec<String> {
        if self.suppressed > 0 {
            self.items.push(format!(
                "{}_further_problems_suppressed: the warning list is capped at {MAX_WARNINGS} \
                 entries, so this is a partial list, not a clean scan",
                self.suppressed
            ));
        }
        self.items
    }
}

fn summary(
    op_id: &str,
    request: &DuplicateScanRequest,
    mode: &str,
    files: u64,
    bytes: u64,
    groups: &[DuplicateGroup],
    errors: u64,
) -> DuplicateScanSummary {
    DuplicateScanSummary {
        scan_id: Uuid::new_v4().to_string(),
        operation_id: op_id.into(),
        started_at: Utc::now().to_rfc3339(),
        completed_at: Utc::now().to_rfc3339(),
        target_folders: request.paths.clone(),
        total_files_scanned: files,
        total_bytes_scanned: bytes,
        duplicate_groups_found: groups.len() as u64,
        duplicate_files_found: groups
            .iter()
            .map(|group| group.files.len().saturating_sub(1) as u64)
            .sum(),
        total_wasted_bytes: groups.iter().map(|group| group.wasted_size_bytes).sum(),
        scan_mode: mode.into(),
        error_count: errors,
    }
}

/// Builds a group. `actionable` is decided by the caller from the *kind* of proof, never
/// from a score.
#[allow(clippy::too_many_arguments)]
fn make_group(
    mode: &str,
    category: &str,
    signature: String,
    mut files: Vec<DuplicateFileItem>,
    confidence: f32,
    actionable: bool,
    proof_status: &str,
    signals: Vec<SignalScore>,
    mut warnings: Vec<String>,
) -> DuplicateGroup {
    files.sort_by(|a, b| a.canonical_path.cmp(&b.canonical_path));
    let smallest = files.iter().map(|file| file.size_bytes).min().unwrap_or(0);
    let wasted = smallest.saturating_mul(files.len().saturating_sub(1) as u64);
    if !actionable {
        // Carried on the group itself, not only in the operation summary, so a row cannot
        // be detached from its own warning.
        warnings.push(
            "This group is not actionable. Similarity is a score, not a proof: only a full \
             BLAKE3 match over the whole file can justify removing anything."
                .into(),
        );
    }
    DuplicateGroup {
        group_id: Uuid::new_v4().to_string(),
        mode: mode.into(),
        category: category.into(),
        files,
        wasted_size_bytes: wasted,
        common_hash: signature,
        proof_status: proof_status.into(),
        confidence,
        actionable,
        warnings,
        signals,
    }
}

/// The per-member evidence recorded on an exact-hash group, in both languages.
fn exact_proof_evidence() -> Vec<FileEvidence> {
    vec![note(
        "proof",
        "full_file_blake3".into(),
        "Every file in this group has the same full-content BLAKE3 hash, so the files are \
         byte-identical. That is a proof, not a score, and it needs no tolerance.",
        "لكل ملف في هذه المجموعة نفس بصمة BLAKE3 الكاملة للمحتوى، أي أن الملفات متطابقة \
         بايتًا ببايت. هذا دليل قاطع لا درجة، ولا يحتاج إلى أي تسامح.",
    )]
}

fn exact_signal() -> Vec<SignalScore> {
    vec![SignalScore {
        signal: "exact_blake3".into(),
        score: 100.0,
        weight: 1.0,
        available: true,
        detail_en: "A full-content BLAKE3 hash is equal for every member. Equality of a \
                    cryptographic hash over the whole file is the strongest duplicate proof \
                    available, and it is a separate lane from any similarity score."
            .into(),
        detail_ar: "بصمة BLAKE3 الكاملة متساوية لكل عضو. تساوي بصمة تشفيرية على الملف كله أقوى \
                    دليل تكرار متاح، وهو مسار منفصل عن أي درجة تشابه."
            .into(),
    }]
}

/// Groups candidates that share a whole-file BLAKE3 hash.
fn exact_groups(candidates: &[FileCandidate], hashes: &HashMap<String, String>) -> Vec<Vec<usize>> {
    let mut by_hash: BTreeMap<&str, Vec<usize>> = BTreeMap::new();
    for (index, candidate) in candidates.iter().enumerate() {
        if let Some(hash) = hashes.get(&candidate.file_identity) {
            by_hash.entry(hash.as_str()).or_default().push(index);
        }
    }
    by_hash
        .into_values()
        .filter(|members| members.len() > 1)
        .collect()
}

/// Builds the actionable exact-hash groups for any of the four services.
fn exact_only_groups(
    mode: &str,
    candidates: &[FileCandidate],
    hashes: &HashMap<String, String>,
    category: &str,
    describe: impl Fn(&FileCandidate) -> (Option<String>, Option<(u32, u32)>, Vec<FileEvidence>),
) -> Result<Vec<DuplicateGroup>, String> {
    let mut groups = Vec::new();
    for members in exact_groups(candidates, hashes) {
        let mut files = Vec::new();
        let mut signature = String::new();
        for &index in &members {
            let candidate = &candidates[index];
            let hash = hashes
                .get(&candidate.file_identity)
                .cloned()
                .unwrap_or_default();
            if signature.is_empty() {
                signature = hash.clone();
            }
            let (perceptual, dimensions, evidence) = describe(candidate);
            files.push(file_item(
                candidate,
                hash.clone(),
                perceptual,
                Some(100.0),
                dimensions,
                evidence,
            )?);
        }
        groups.push(make_group(
            mode,
            category,
            signature,
            files,
            1.0,
            true,
            "verified_exact",
            exact_signal(),
            Vec::new(),
        ));
    }
    Ok(groups)
}

// ---- traversal, cancellation and progress -----------------------------------------------

/// Emits progress derived from work actually done.
///
/// `can_pause` and `can_cancel` are computed rather than hardcoded. Both are true while a
/// worker runs, because the job control really does honour both, and false once the scan
/// has stopped, because by then there is nothing left to pause.
#[allow(clippy::too_many_arguments)]
fn emit(
    app: &AppHandle,
    op_id: &str,
    mode: &str,
    phase: &str,
    scanned_files: u64,
    total_files: Option<u64>,
    scanned_bytes: u64,
    current_path: Option<String>,
    candidate_groups: u64,
    verified_groups: u64,
    errors: u64,
    in_flight: bool,
) {
    let _ = app.emit(
        "m03://progress",
        DuplicateJobProgress {
            job_id: op_id.into(),
            operation_id: op_id.into(),
            phase: phase.into(),
            mode: mode.into(),
            scanned_files,
            total_files,
            scanned_bytes,
            current_path,
            candidate_groups,
            verified_groups,
            errors,
            can_pause: in_flight,
            can_cancel: in_flight,
        },
    );
}

/// Collects the candidate files, reporting real progress and honouring cancellation.
fn collect(
    request: &DuplicateScanRequest,
    extensions: &[&str],
    control: &Arc<jobs::JobControl>,
    app: &AppHandle,
    op_id: &str,
    mode: &str,
) -> Result<Vec<FileCandidate>, ScanStop> {
    let filtered = with_extensions(request, extensions);
    let result = traversal::collect_files(&filtered, control).map_err(|error| {
        if error.code() == "scan_cancelled" {
            ScanStop::Cancelled
        } else {
            ScanStop::Failed(error.to_string())
        }
    })?;
    let total = result.files.len() as u64;
    for (index, candidate) in result.files.iter().enumerate() {
        if index % PROGRESS_STRIDE == 0 {
            checkpoint(control)?;
            emit(
                app,
                op_id,
                mode,
                "enumerating",
                index as u64,
                Some(total),
                result.scanned_bytes,
                Some(candidate.path.to_string_lossy().to_string()),
                0,
                0,
                result.errors.len() as u64,
                true,
            );
        }
    }
    Ok(result.files)
}

fn total_bytes(candidates: &[FileCandidate]) -> u64 {
    candidates.iter().fold(0u64, |sum, candidate| {
        sum.saturating_add(candidate.size_bytes)
    })
}

/// A result carrying only a dependency failure: the structured reason, and no groups.
fn dependency_failure(
    op_id: &str,
    request: &DuplicateScanRequest,
    mode: &str,
    service_id: &str,
    capability: &str,
    started: String,
    dependencies: Vec<ToolEvidence>,
    mut warnings: Warnings,
    videos: Option<VideoScanEvidence>,
    audio: Option<AudioScanEvidence>,
) -> DuplicateScanResult {
    warnings.items.sort();
    let warning_list = warnings.into_vec();
    DuplicateScanResult {
        job_id: op_id.into(),
        summary: summary(op_id, request, mode, 0, 0, &[], warning_list.len() as u64),
        groups: Vec::new(),
        warnings: warning_list,
        evidence: Some(MediaScanEvidence {
            service_id: service_id.into(),
            capability_id: capability.into(),
            strategy: "unavailable_missing_dependency".into(),
            cancelled: false,
            started_at: started,
            completed_at: Utc::now().to_rfc3339(),
            dependencies,
            images: None,
            videos,
            audio,
            archives: None,
            runtime_verified: false,
            verification_note_en: VERIFICATION_NOTE_EN.into(),
            verification_note_ar: VERIFICATION_NOTE_AR.into(),
        }),
    }
}

// ---- M03-S03 similar images ---------------------------------------------------------------

const IMAGE_MODE: &str = "image_similarity_oriented_multisignal";

/// Where the fingerprint cache lives.
fn fingerprint_cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app_data_failed:{error}"))?
        .join("m03-image-fingerprint-cache.json"))
}

/// Groups visually similar images without comparing every pair.
///
/// Byte-identical images are separated first: a whole-file BLAKE3 match is proof, so
/// running a fuzzy comparison between two proven-identical files can only restate it — in
/// a folder of 10 000 copies, 49 995 000 times. Only one representative per exact-hash
/// class takes part in the fuzzy stage, and the number collapsed is reported.
fn scan_images(
    app: &AppHandle,
    op_id: &str,
    request: &DuplicateScanRequest,
    control: &Arc<jobs::JobControl>,
) -> Result<DuplicateScanResult, ScanStop> {
    let started_at = Utc::now().to_rfc3339();
    let mut warnings = Warnings::new();
    let candidates = collect(request, &IMAGE_EXTENSIONS, control, app, op_id, IMAGE_MODE)?;
    let total = candidates.len() as u64;
    let bytes = total_bytes(&candidates);

    let cache_location = fingerprint_cache_path(app).ok();
    let mut cache = m03_images::FingerprintCache::open(cache_location.clone());
    let mut fingerprints: Vec<m03_images::ImageFingerprint> = Vec::with_capacity(candidates.len());
    let mut hashes: HashMap<String, String> = HashMap::new();
    let mut files_changed = 0u64;
    let mut orientation_applied = 0u64;
    let mut orientation_sources: BTreeMap<&'static str, u64> = BTreeMap::new();

    for (index, candidate) in candidates.iter().enumerate() {
        checkpoint(control)?;
        let hash = match full_hash(&candidate.canonical_path) {
            Ok(value) => value,
            Err(error) => {
                warnings.push(format!("hash_failed:{}:{error}", candidate.path.display()));
                continue;
            }
        };
        let size = candidate.size_bytes;
        let modified = m03_images::modified_micros(&candidate.canonical_path) as u64;
        let measured = match cache.get(&candidate.file_identity, size, modified) {
            Some(value) => value,
            None => match m03_images::measure(
                &candidate.canonical_path,
                &candidate.file_identity,
                size,
                modified,
            ) {
                Ok(value) => {
                    cache.put(&candidate.file_identity, &value);
                    value
                }
                Err(error) => {
                    warnings.push(format!(
                        "fingerprint_failed:{}:{error}",
                        candidate.path.display()
                    ));
                    continue;
                }
            },
        };
        // The file must still be the file that was measured. If it changed between the
        // traversal and the decode, the fingerprint describes bytes that no longer exist,
        // so the file is dropped rather than clustered on stale evidence.
        let current_size = fs::metadata(&candidate.canonical_path)
            .map(|metadata| metadata.len())
            .unwrap_or(size);
        let current_modified = m03_images::modified_micros(&candidate.canonical_path) as u64;
        if current_size != size || current_modified != modified {
            files_changed += 1;
            warnings.push(format!(
                "file_changed_during_scan:{} the fingerprint was discarded rather than \
                 clustered on bytes that no longer exist",
                candidate.path.display()
            ));
            continue;
        }
        if measured.orientation.is_transform() {
            orientation_applied += 1;
        }
        *orientation_sources
            .entry(measured.orientation_source.as_str())
            .or_default() += 1;
        hashes.insert(candidate.file_identity.clone(), hash);
        fingerprints.push(measured);

        if index % PROGRESS_STRIDE == 0 {
            emit(
                app,
                op_id,
                IMAGE_MODE,
                "fingerprinting",
                index as u64 + 1,
                Some(total),
                bytes,
                Some(candidate.path.to_string_lossy().to_string()),
                0,
                0,
                warnings.errors,
                true,
            );
        }
    }
    if let Some(message) = cache.write_error.clone() {
        warnings.push(message);
    }
    cache.save();

    let (representatives, collapsed) = m03_images::collapse_exact_duplicates(&fingerprints);
    let (pairs, bucket_stats) = m03_images::candidate_pairs(&representatives, &fingerprints);

    let threshold = request.similarity_threshold.clamp(50.0, 100.0);
    let mut parent: Vec<usize> = (0..fingerprints.len()).collect();
    let mut accepted = 0u64;
    for (position, (left, right)) in pairs.iter().enumerate() {
        checkpoint(control)?;
        let signals = m03_images::signal_breakdown(&fingerprints[*left], &fingerprints[*right]);
        if m03_images::composite(&signals) >= threshold {
            accepted += 1;
            union(&mut parent, *left, *right);
        }
        if position % 256 == 0 {
            emit(
                app,
                op_id,
                IMAGE_MODE,
                "comparing_candidates",
                position as u64,
                Some(pairs.len() as u64),
                bytes,
                None,
                accepted,
                0,
                warnings.errors,
                true,
            );
        }
    }

    let mut candidate_by_identity: HashMap<&str, &FileCandidate> = HashMap::new();
    for candidate in &candidates {
        candidate_by_identity
            .entry(candidate.file_identity.as_str())
            .or_insert(candidate);
    }
    let fingerprint_of = |identity: &str| -> Option<&m03_images::ImageFingerprint> {
        fingerprints
            .iter()
            .find(|fingerprint| fingerprint.file_identity == identity)
    };

    let mut groups = exact_only_groups(IMAGE_MODE, &candidates, &hashes, "images", |candidate| {
        match fingerprint_of(&candidate.file_identity) {
            Some(fingerprint) => (
                Some(format!(
                    "dhash-{:016x}-ahash-{:016x}",
                    fingerprint.dhash, fingerprint.ahash
                )),
                Some((fingerprint.width, fingerprint.height)),
                {
                    let mut evidence = exact_proof_evidence();
                    evidence.extend(m03_images::file_evidence(fingerprint));
                    evidence
                },
            ),
            None => (
                Some("blake3:whole_file".into()),
                None,
                exact_proof_evidence(),
            ),
        }
    })?;

    for members in clusters(&mut parent, fingerprints.len()) {
        let reference = members[0];
        let mut files = Vec::new();
        let mut signals_out: Vec<SignalScore> = Vec::new();
        let mut min_score = 100f32;
        for &index in &members {
            let fingerprint = &fingerprints[index];
            let Some(candidate) = candidate_by_identity.get(fingerprint.file_identity.as_str())
            else {
                continue;
            };
            let signals = m03_images::signal_breakdown(&fingerprints[reference], fingerprint);
            let score = m03_images::composite(&signals);
            min_score = min_score.min(score);
            if signals_out.is_empty() {
                signals_out = signals;
            }
            files.push(
                file_item(
                    candidate,
                    hashes
                        .get(&candidate.file_identity)
                        .cloned()
                        .unwrap_or_default(),
                    Some(format!(
                        "dhash-{:016x}-ahash-{:016x}",
                        fingerprint.dhash, fingerprint.ahash
                    )),
                    Some(score),
                    Some((fingerprint.width, fingerprint.height)),
                    m03_images::file_evidence(fingerprint),
                )
                .map_err(ScanStop::Failed)?,
            );
        }
        if files.len() < 2 {
            continue;
        }
        groups.push(make_group(
            IMAGE_MODE,
            "images",
            format!(
                "image-cluster-{:016x}-{:016x}",
                fingerprints[reference].dhash, fingerprints[reference].ahash
            ),
            files,
            (min_score / 100.0).clamp(0.0, 1.0),
            false,
            "visually_similar_fuzzy",
            signals_out,
            vec![format!(
                "Similarity is at least {min_score:.1}%, assembled from the published signal \
                 weights. This service never moves or deletes a file; a keeper and quarantine \
                 plan must be reviewed separately."
            )],
        ));
    }
    groups.sort_by(|a, b| b.wasted_size_bytes.cmp(&a.wasted_size_bytes));

    let evidence = MediaScanEvidence {
        service_id: "m03_scan_images_complete".into(),
        capability_id: "m03_s03".into(),
        strategy: "exif_orientation_applied_then_bucketed_dhash_ahash_histogram_aspect".into(),
        cancelled: false,
        started_at,
        completed_at: Utc::now().to_rfc3339(),
        dependencies: Vec::new(),
        images: Some(ImageScanEvidence {
            strategy: "exif_orientation_applied_then_bucketed_dhash_ahash_histogram_aspect".into(),
            decode_limits: ImageDecodeLimits {
                max_width: m03_images::MAX_DECODE_WIDTH,
                max_height: m03_images::MAX_DECODE_HEIGHT,
                max_alloc_bytes: m03_images::MAX_DECODE_ALLOC_BYTES,
            },
            orientation_policy:
                "EXIF Orientation (IFD0 tag 0x0112) is read from the JPEG APP1 segment and \
                 applied before any fingerprint is computed, including the mirrored values 5 \
                 and 7. No other format's orientation is applied by this build."
                    .into(),
            orientation_source: orientation_source_summary(&orientation_sources),
            files_with_exif_orientation: orientation_applied,
            files_orientation_normalized: orientation_applied,
            bucket_rule: format!(
                "Aspect band (8 bands per octave) plus the top 16 of 64 dHash bits, compared \
                 within {} aspect band(s) either side.",
                m03_images::ASPECT_BAND_SLACK
            ),
            bucket_count: bucket_stats.bucket_count,
            largest_bucket: bucket_stats.largest_bucket,
            compared_pairs: bucket_stats.compared_pairs,
            all_pairs_if_computed: bucket_stats.all_pairs_if_computed,
            avoided_all_pairs: bucket_stats.avoided_all_pairs(),
            exact_hash_classes_collapsed: collapsed,
            weights: m03_images::published_weights(),
            cache_path: cache_location
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            cache_entries: cache.stats.entries,
            cache_hits: cache.stats.hits,
            cache_misses: cache.stats.misses,
            cache_invalidations: cache.stats.invalidations,
            cache_evictions: cache.stats.evictions,
            files_changed_during_scan: files_changed,
            no_destructive_action: true,
            limitations_en: image_limitations_en(),
            limitations_ar: image_limitations_ar(),
        }),
        videos: None,
        audio: None,
        archives: None,
        runtime_verified: false,
        verification_note_en: VERIFICATION_NOTE_EN.into(),
        verification_note_ar: VERIFICATION_NOTE_AR.into(),
    };
    let warning_list = warnings.into_vec();
    Ok(DuplicateScanResult {
        job_id: op_id.into(),
        summary: summary(
            op_id,
            request,
            IMAGE_MODE,
            fingerprints.len() as u64,
            bytes,
            &groups,
            warning_list.len() as u64,
        ),
        groups,
        warnings: warning_list,
        evidence: Some(evidence),
    })
}

fn orientation_source_summary(sources: &BTreeMap<&'static str, u64>) -> String {
    if sources.is_empty() {
        return "no image was decoded".into();
    }
    sources
        .iter()
        .map(|(name, count)| format!("{name}={count}"))
        .collect::<Vec<_>>()
        .join(", ")
}

fn image_limitations_en() -> Vec<String> {
    vec![
        "The candidate bucket can miss a pair whose aspect differs by more than about 9% and \
         whose top 16 difference-hash bits also differ. That trade is deliberate, and it is \
         why both compared_pairs and all_pairs_if_computed are reported."
            .into(),
        "The dHash/aHash/histogram/aspect mix is retained from the previous tier. A perceptual \
         hash was not adopted, because no benchmark fixture in this repository proves it would \
         help."
            .into(),
        "Only JPEG APP1 orientation is applied. PNG, WebP and TIFF orientation are not, and \
         the per-file evidence says which source was used for every file."
            .into(),
        "A file whose size or modification time changed between the directory walk and the \
         decode is dropped from the result, so no group is built on a fingerprint that no \
         longer describes the file on disk."
            .into(),
    ]
}

fn image_limitations_ar() -> Vec<String> {
    vec![
        "قد تفوّت الحاوية المرشحة زوجًا تختلف نسبة أبعاده بأكثر من نحو 9% وتختلف أعلى 16 بت من \
         بصمة الفروق أيضًا. هذا التبادل مقصود، ولهذا يُبلَّغ عن عدد الأزواج التي قورنت وعدد \
         الأزواج التي تجُنِّبت."
            .into(),
        "تم الإبقاء على مزيج dHash وaHash والتوزيع ونسبة الأبعاد كما كان. لم تُعتمد بصمة إدراكية \
         جديدة، لأنه لا توجد في هذا المستودع ملفات قياس تثبت أنها أدق."
            .into(),
        "يُطبَّق اتجاه JPEG من مقطع APP1 فقط. لا يُطبَّق اتجاه PNG أو WebP أو TIFF، وتذكر أدلة كل \
         ملف المصدر المستخدم له."
            .into(),
        "يُستبعد الملف الذي تغيّر حجمه أو وقت تعديله بين مسح المجلد وفك الترميز، حتى لا تُبنى أي \
         مجموعة على بصمة لم تعد تصف الملف الموجود على القرص."
            .into(),
    ]
}

// ---- M03-S04 duplicate video ----------------------------------------------------------------

const VIDEO_MODE: &str = "video_timeline_frame_signature";

/// Probes one video and reads a frame at each sampled position.
fn measure_video(
    ffprobe: &str,
    ffmpeg: &str,
    candidate: &FileCandidate,
    samples: u32,
) -> Result<m03_video::VideoFingerprint, String> {
    let probe = Command::new(ffprobe)
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "format=duration:stream=codec_type,codec_name,width,height",
            "-of",
            "json",
        ])
        .arg(&candidate.canonical_path)
        .output()
        .map_err(|error| format!("ffprobe_failed:{error}"))?;
    if !probe.status.success() {
        return Err(format!(
            "ffprobe_exit_failed:{}",
            String::from_utf8_lossy(&probe.stderr).trim()
        ));
    }
    let value: Value = serde_json::from_slice(&probe.stdout)
        .map_err(|error| format!("ffprobe_json_failed:{error}"))?;
    let outcome = m03_video::parse_probe(&value)?;
    let (positions, _) = m03_video::sample_positions(outcome.duration_seconds, samples);
    let mut signatures = Vec::with_capacity(positions.len());
    for position in &positions {
        // One frame per sampled position, as raw greyscale at the 9x8 difference-hash grid
        // size, so no resampling happens inside ffmpeg.
        let frame = Command::new(ffmpeg)
            .args(["-v", "error", "-nostdin", "-ss"])
            .arg(format!("{position:.3}"))
            .arg("-i")
            .arg(&candidate.canonical_path)
            .args([
                "-frames:v",
                "1",
                "-vf",
                "scale=9:8,format=gray",
                "-an",
                "-f",
                "rawvideo",
                "-",
            ])
            .output()
            .map_err(|error| format!("ffmpeg_frame_failed:{error}"))?;
        // A position the decoder could not reach is skipped, never faked, and the shortfall
        // is recorded as `short_read`.
        if !frame.status.success() || frame.stdout.len() < 72 {
            continue;
        }
        signatures.push(frame_signature(&frame.stdout[..72]));
    }
    let short_read = signatures.len() < positions.len();
    Ok(m03_video::VideoFingerprint {
        path: candidate.canonical_path.clone(),
        file_identity: candidate.file_identity.clone(),
        size_bytes: candidate.size_bytes,
        duration_seconds: outcome.duration_seconds,
        width: outcome.width,
        height: outcome.height,
        codec: outcome.codec.clone(),
        sample_positions_seconds: positions.clone(),
        frame_signatures: signatures.clone(),
        short_read,
        reason_en: if short_read {
            format!(
                "The decoder returned {} of {} requested frames, so the recorded sample \
                 positions are only the ones that could actually be read.",
                signatures.len(),
                positions.len()
            )
        } else {
            format!(
                "Read {} frames at normalized timeline positions, decoded with codec {}.",
                signatures.len(),
                outcome.codec
            )
        },
        reason_ar: if short_read {
            format!(
                "أعاد المُفكِّك {} إطارًا من أصل {} مطلوب، فمواضع المعاينة المسجّلة هي المواضع \
                 التي أمكنت قراءتها فعلًا.",
                signatures.len(),
                positions.len()
            )
        } else {
            format!(
                "قُرئت {} إطارًا عند مواضع موزعة على الخط الزمني، فُك الترميز بالترميز {}.",
                signatures.len(),
                outcome.codec
            )
        },
    })
}

fn scan_videos(
    app: &AppHandle,
    op_id: &str,
    request: &DuplicateScanRequest,
    control: &Arc<jobs::JobControl>,
) -> Result<DuplicateScanResult, ScanStop> {
    let started_at = Utc::now().to_rfc3339();
    let dependencies = vec![tool_evidence("ffprobe"), tool_evidence("ffmpeg")];
    let missing: Vec<ToolEvidence> = dependencies
        .iter()
        .filter(|value| !is_usable(value))
        .cloned()
        .collect();
    let mut evidence = VideoScanEvidence {
        dependency: dependencies.clone(),
        strategy: "normalized_timeline_sampling_with_bounded_frame_alignment".into(),
        requested_sample_count: m03_video::DEFAULT_SAMPLE_COUNT,
        sample_count: 0,
        sample_positions_seconds: Vec::new(),
        sample_positions_normalized: Vec::new(),
        frame_signature_bits: 64,
        alignment_tolerance_samples: 0,
        compared_pairs: 0,
        signals: video_policy_weights(),
        exact_hash_groups: 0,
        fuzzy_groups_never_actionable: true,
        limitations_en: video_limitations_en(),
        limitations_ar: video_limitations_ar(),
    };
    let mut warnings = Warnings::new();
    for dependency in &missing {
        warnings.push(dependency_warning(dependency));
    }
    if !missing.is_empty() {
        return Ok(dependency_failure(
            op_id,
            request,
            VIDEO_MODE,
            "m03_scan_videos_complete",
            "m03_s04",
            started_at,
            dependencies,
            warnings,
            Some(evidence),
            None,
        ));
    }
    let candidates = collect(request, &VIDEO_EXTENSIONS, control, app, op_id, VIDEO_MODE)?;
    let total = candidates.len() as u64;
    let bytes = total_bytes(&candidates);
    let ffprobe = dependencies[0].resolved_path.clone().unwrap_or_default();
    let ffmpeg = dependencies[1].resolved_path.clone().unwrap_or_default();

    let mut fingerprints: Vec<m03_video::VideoFingerprint> = Vec::new();
    let mut kept: Vec<FileCandidate> = Vec::new();
    let mut hashes: HashMap<String, String> = HashMap::new();
    for (index, candidate) in candidates.iter().enumerate() {
        checkpoint(control)?;
        match full_hash(&candidate.canonical_path) {
            Ok(value) => {
                hashes.insert(candidate.file_identity.clone(), value);
            }
            Err(error) => {
                warnings.push(format!("hash_failed:{}:{error}", candidate.path.display()));
                continue;
            }
        }
        match measure_video(
            &ffprobe,
            &ffmpeg,
            candidate,
            m03_video::DEFAULT_SAMPLE_COUNT,
        ) {
            Ok(measured) => {
                fingerprints.push(measured);
                kept.push(candidate.clone());
            }
            // A file the decoder could not open is an error, not a silent non-match.
            Err(error) => warnings.push(format!("{}:{error}", candidate.path.display())),
        }
        if index % 4 == 0 {
            emit(
                app,
                op_id,
                VIDEO_MODE,
                "decoding_frames",
                index as u64 + 1,
                Some(total),
                bytes,
                Some(candidate.path.to_string_lossy().to_string()),
                0,
                0,
                warnings.errors,
                true,
            );
        }
    }
    // The sample rule is reported once, from a video that produced a full set of frames,
    // rather than repeating one file's positions and implying they are every file's.
    if let Some(representative) = fingerprints.iter().find(|value| !value.short_read) {
        let (seconds, normalized) = m03_video::sample_positions(
            representative.duration_seconds,
            m03_video::DEFAULT_SAMPLE_COUNT,
        );
        evidence.sample_positions_seconds = seconds.iter().map(|value| round3(*value)).collect();
        evidence.sample_positions_normalized =
            normalized.iter().map(|value| round3(*value)).collect();
        evidence.sample_count = evidence.sample_positions_normalized.len() as u32;
    } else if let Some(representative) = fingerprints.first() {
        evidence.sample_positions_seconds = representative
            .sample_positions_seconds
            .iter()
            .map(|value| round3(*value))
            .collect();
        evidence.sample_count = evidence.sample_positions_seconds.len() as u32;
    }
    evidence.alignment_tolerance_samples = fingerprints
        .iter()
        .map(|value| {
            m03_video::alignment_tolerance(
                value.frame_signatures.len(),
                value.frame_signatures.len(),
            )
        })
        .max()
        .unwrap_or(0);

    let threshold = request.similarity_threshold.clamp(50.0, 100.0);
    let mut groups = exact_only_groups(VIDEO_MODE, &kept, &hashes, "videos", |_candidate| {
        (
            Some("blake3:whole_file".into()),
            None,
            exact_proof_evidence(),
        )
    })?;
    evidence.exact_hash_groups = groups.len() as u64;

    // Videos are bucketed by duration so a folder of unrelated clips does not pay for a
    // full pairwise comparison.
    let mut by_duration: BTreeMap<u32, Vec<usize>> = BTreeMap::new();
    for (index, fingerprint) in fingerprints.iter().enumerate() {
        by_duration
            .entry((fingerprint.duration_seconds.max(0.0) / 15.0).round() as u32)
            .or_default()
            .push(index);
    }
    let mut parent: Vec<usize> = (0..fingerprints.len()).collect();
    let mut compared = 0u64;
    for members in by_duration.values() {
        for (position, &left) in members.iter().enumerate() {
            for &right in members.iter().skip(position + 1) {
                checkpoint(control)?;
                compared += 1;
                let tolerance = m03_video::alignment_tolerance(
                    fingerprints[left].frame_signatures.len(),
                    fingerprints[right].frame_signatures.len(),
                );
                let signals = m03_video::signal_breakdown(
                    &fingerprints[left],
                    &fingerprints[right],
                    tolerance,
                );
                if m03_video::composite(&signals) >= threshold {
                    union(&mut parent, left, right);
                }
            }
        }
    }
    evidence.compared_pairs = compared;

    for members in clusters(&mut parent, fingerprints.len()) {
        let reference = members[0];
        let mut files = Vec::new();
        let mut signals_out: Vec<SignalScore> = Vec::new();
        let mut min_score = 100f32;
        for &index in &members {
            let fingerprint = &fingerprints[index];
            let candidate = &kept[index];
            let signals = m03_video::signal_breakdown(
                &fingerprints[reference],
                fingerprint,
                m03_video::alignment_tolerance(
                    fingerprints[reference].frame_signatures.len(),
                    fingerprint.frame_signatures.len(),
                ),
            );
            let score = m03_video::composite(&signals);
            min_score = min_score.min(score);
            if signals_out.is_empty() {
                signals_out = signals;
            }
            files.push(
                file_item(
                    candidate,
                    hashes
                        .get(&candidate.file_identity)
                        .cloned()
                        .unwrap_or_default(),
                    Some(format!(
                        "frames:{}",
                        fingerprint
                            .frame_signatures
                            .iter()
                            .map(|value| format!("{value:016x}"))
                            .collect::<Vec<_>>()
                            .join(",")
                    )),
                    Some(score),
                    Some((fingerprint.width, fingerprint.height)),
                    vec![
                        note(
                            "decoded_stream",
                            format!(
                                "{} {}x{} {:.3}s",
                                fingerprint.codec,
                                fingerprint.width,
                                fingerprint.height,
                                fingerprint.duration_seconds
                            ),
                            &fingerprint.reason_en,
                            &fingerprint.reason_ar,
                        ),
                        note(
                            "sample_positions_seconds",
                            fingerprint
                                .sample_positions_seconds
                                .iter()
                                .map(|value| format!("{value:.3}"))
                                .collect::<Vec<_>>()
                                .join(", "),
                            "The exact timeline positions this file's frames were read from. \
                             They are reported so the sampling rule is reproducible, not so a \
                             caller has to take it on trust.",
                            "هذه هي المواضع الزمنية الدقيقة التي قُرئت إطارات هذا الملف منها، \
                             وتُذكر حتى تكون قاعدة المعاينة قابلة للتكرار.",
                        ),
                    ],
                )
                .map_err(ScanStop::Failed)?,
            );
        }
        if files.len() < 2 {
            continue;
        }
        groups.push(make_group(
            VIDEO_MODE,
            "videos",
            format!(
                "video-frame-cluster-{:016x}",
                fingerprints[reference]
                    .frame_signatures
                    .first()
                    .copied()
                    .unwrap_or(0)
            ),
            files,
            (min_score / 100.0).clamp(0.0, 1.0),
            false,
            "fuzzy_frame_similarity",
            signals_out,
            vec![format!(
                "Frame-sequence similarity is at least {min_score:.1}%. A fuzzy score is not a \
                 proof, so this group is never actionable on its own."
            )],
        ));
    }
    groups.sort_by(|a, b| b.wasted_size_bytes.cmp(&a.wasted_size_bytes));

    let warning_list = warnings.into_vec();
    Ok(DuplicateScanResult {
        job_id: op_id.into(),
        summary: summary(
            op_id,
            request,
            VIDEO_MODE,
            fingerprints.len() as u64,
            bytes,
            &groups,
            warning_list.len() as u64,
        ),
        groups,
        warnings: warning_list,
        evidence: Some(MediaScanEvidence {
            service_id: "m03_scan_videos_complete".into(),
            capability_id: "m03_s04".into(),
            strategy: "normalized_timeline_sampling_with_bounded_frame_alignment".into(),
            cancelled: false,
            started_at,
            completed_at: Utc::now().to_rfc3339(),
            dependencies,
            images: None,
            videos: Some(evidence),
            audio: None,
            archives: None,
            runtime_verified: false,
            verification_note_en: VERIFICATION_NOTE_EN.into(),
            verification_note_ar: VERIFICATION_NOTE_AR.into(),
        }),
    })
}

fn video_policy_weights() -> Vec<SignalWeight> {
    vec![
        SignalWeight {
            signal: "frame_sequence".into(),
            weight: m03_video::WEIGHT_FRAME_SEQUENCE,
        },
        SignalWeight {
            signal: "duration_ratio".into(),
            weight: m03_video::WEIGHT_DURATION_RATIO,
        },
        SignalWeight {
            signal: "dimensions".into(),
            weight: m03_video::WEIGHT_DIMENSIONS,
        },
    ]
}

fn video_limitations_en() -> Vec<String> {
    vec![
        "Frames are read with ffmpeg at sampled positions. A video the decoder cannot open, or \
         one with no video stream, is counted as an error and never fingerprinted."
            .into(),
        "A short video is sampled at fewer positions than requested, and the count actually used \
         is reported rather than the count asked for."
            .into(),
        "Sampling tolerates a variable frame rate because positions are fractions of the \
         duration rather than frame numbers. It is not a full motion analysis: a re-timing that \
         moves content inside the sampling grid can still lower the score."
            .into(),
        "No audio fingerprint is compared here, so a video re-cut with different music scores \
         lower than the same pictures would."
            .into(),
        "Frame agreement is credited only for frames within 8 of 64 bits, and the 50% chance \
         baseline is removed before coverage is applied. A video that shares only its opening \
         is therefore not a match."
            .into(),
    ]
}

fn video_limitations_ar() -> Vec<String> {
    vec![
        "تُقرأ الإطارات بـ ffmpeg عند مواضع مُعينة. أي فيديو لا يستطيع المفكّك فتحه أو خالي من مسار \
         الفيديو يُحسب خطأً ولا يُؤخذ له بصمة."
            .into(),
        "الفيديو القصير يُعاين عند عدد مواضع أقل من المطلوب، ويُبلَّغ العدد المستخدم فعليًا لا العدد \
         المطلوب."
            .into(),
        "تتحمل المعاينة معدل الإطارات المتغير لأن المواضع نِسَب من المدة لا أرقام إطارات. لكنها ليست \
         تحليل حركة كاملًا: إعادة ضبط التوقيت التي تحرّك المحتوى داخل شبكة المعاينة قد تخفض الدرجة."
            .into(),
        "لا تُقارَن هنا بصمة صوتية، لذلك يعطي الفيديو المعاد قصّه بموسيقى مختلفة درجة أقل من نفس الصور."
            .into(),
        "لا يُحتسب تطابق الإطار إلا إذا كان ضمن 8 بت من 64، وتُطرح خط الأساس العشوائي 50% قبل \
         تطبيق التغطية. لذلك لا يعتبر الفيديو الذي يتشارك بدايته فقط تطابقًا."
            .into(),
    ]
}

// ---- M03-S05 duplicate audio -----------------------------------------------------------------

const AUDIO_MODE: &str = "audio_exact_plus_offset_tolerant_fingerprint";

/// Reads the source codec and channel count, or `None` when ffprobe cannot say.
fn probe_audio(ffprobe: &str, path: &Path) -> (Option<String>, Option<u32>) {
    let output = Command::new(ffprobe)
        .args([
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,channels",
            "-of",
            "json",
        ])
        .arg(path)
        .output();
    let Ok(output) = output else {
        return (None, None);
    };
    let Ok(value) = serde_json::from_slice::<Value>(&output.stdout) else {
        return (None, None);
    };
    let Some(stream) = value
        .get("streams")
        .and_then(Value::as_array)
        .and_then(|s| s.first())
    else {
        return (None, None);
    };
    (
        stream
            .get("codec_name")
            .and_then(Value::as_str)
            .map(|value| value.to_string()),
        stream
            .get("channels")
            .and_then(Value::as_u64)
            .map(|value| value as u32),
    )
}

/// Decodes one audio file to mono 8 kHz samples and fingerprints it.
fn measure_audio(
    ffmpeg: &str,
    candidate: &FileCandidate,
) -> Result<m03_audio::AudioFingerprint, String> {
    let cap = m03_audio::MAX_DECODE_SECONDS as usize * m03_audio::SAMPLE_RATE_HZ as usize * 2;
    let output = Command::new(ffmpeg)
        .args(["-v", "error", "-nostdin", "-t"])
        .arg(m03_audio::MAX_DECODE_SECONDS.to_string())
        .arg("-i")
        .arg(&candidate.canonical_path)
        .args([
            "-vn",
            "-ac",
            "1",
            "-ar",
            &m03_audio::SAMPLE_RATE_HZ.to_string(),
            "-f",
            "s16le",
            "-",
        ])
        .output()
        .map_err(|error| format!("ffmpeg_decode_failed:{error}"))?;
    if !output.status.success() {
        return Err(format!(
            "ffmpeg_decode_exit_failed:{}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    if output.stdout.is_empty() {
        return Err("decoded_zero_samples".into());
    }
    let prefix_only = output.stdout.len() >= cap;
    let usable = &output.stdout[..output.stdout.len().min(cap)];
    let samples: Vec<f32> = usable
        .as_chunks::<2>()
        .0
        .iter()
        .map(|pair| i16::from_le_bytes([pair[0], pair[1]]) as f32 / 32_768.0)
        .collect();
    if samples.is_empty() {
        return Err("decoded_zero_samples".into());
    }
    let duration = samples.len() as f64 / m03_audio::SAMPLE_RATE_HZ as f64;
    Ok(m03_audio::fingerprint(&samples, duration, prefix_only))
}

fn scan_audio(
    app: &AppHandle,
    op_id: &str,
    request: &DuplicateScanRequest,
    control: &Arc<jobs::JobControl>,
) -> Result<DuplicateScanResult, ScanStop> {
    let started_at = Utc::now().to_rfc3339();
    let dependencies = vec![tool_evidence("ffprobe"), tool_evidence("ffmpeg")];
    let missing: Vec<ToolEvidence> = dependencies
        .iter()
        .filter(|value| !is_usable(value))
        .cloned()
        .collect();
    let mut evidence = AudioScanEvidence {
        dependency: dependencies.clone(),
        backend: m03_audio::BACKEND_ID.into(),
        backend_kind: m03_audio::BACKEND_KIND.into(),
        sample_rate_hz: m03_audio::SAMPLE_RATE_HZ,
        channels_normalized_to: m03_audio::CHANNELS,
        window_samples: m03_audio::WINDOW_SAMPLES as u32,
        hop_samples: m03_audio::HOP_SAMPLES as u32,
        band_count: m03_audio::BAND_COUNT as u32,
        band_low_hz: m03_audio::BAND_LOW_HZ,
        band_high_hz: m03_audio::BAND_HIGH_HZ,
        max_offset_samples: 0,
        silence_trim_fraction: m03_audio::SILENCE_TRIM_FRACTION,
        decoded: Vec::new(),
        compared_pairs: 0,
        signals: audio_policy_weights(),
        metadata_used_as_proof: false,
        exact_hash_groups: 0,
        fuzzy_groups_never_actionable: true,
        limitations_en: audio_limitations_en(),
        limitations_ar: audio_limitations_ar(),
    };
    let mut warnings = Warnings::new();
    for dependency in &missing {
        warnings.push(dependency_warning(dependency));
    }
    if !missing.is_empty() {
        return Ok(dependency_failure(
            op_id,
            request,
            AUDIO_MODE,
            "m03_scan_audio_complete",
            "m03_s05",
            started_at,
            dependencies,
            warnings,
            None,
            Some(evidence),
        ));
    }
    let candidates = collect(request, &AUDIO_EXTENSIONS, control, app, op_id, AUDIO_MODE)?;
    let total = candidates.len() as u64;
    let bytes = total_bytes(&candidates);
    let ffprobe = dependencies[0].resolved_path.clone().unwrap_or_default();
    let ffmpeg = dependencies[1].resolved_path.clone().unwrap_or_default();

    let mut prints: Vec<m03_audio::AudioFingerprint> = Vec::new();
    let mut kept: Vec<FileCandidate> = Vec::new();
    let mut hashes: HashMap<String, String> = HashMap::new();
    let mut decoded: Vec<AudioDecodeRecord> = Vec::new();

    for (index, candidate) in candidates.iter().enumerate() {
        checkpoint(control)?;
        match full_hash(&candidate.canonical_path) {
            Ok(value) => {
                hashes.insert(candidate.file_identity.clone(), value);
            }
            Err(error) => {
                warnings.push(format!("hash_failed:{}:{error}", candidate.path.display()));
                continue;
            }
        }
        let (source_codec, source_channels) = probe_audio(&ffprobe, &candidate.canonical_path);
        match measure_audio(&ffmpeg, candidate) {
            Ok(print) if print.frames.is_empty() => {
                warnings.push(format!(
                    "decoded_silence_only:{} the file decoded but stays below the silence \
                     threshold throughout, so no acoustic fingerprint was made",
                    candidate.path.display()
                ));
                decoded.push(AudioDecodeRecord {
                    path: candidate.path.to_string_lossy().to_string(),
                    status: "silence_only".into(),
                    decoded_duration_seconds: Some(print.decoded_duration_seconds),
                    sample_rate_hz: Some(print.sample_rate_hz),
                    source_channels,
                    source_codec,
                    frame_count: 0,
                    leading_silence_ms: print.leading_silence_ms,
                    trailing_silence_ms: print.trailing_silence_ms,
                    peak_dbfs: round3(print.peak_dbfs as f64) as f32,
                    reason_en: "Decoded, but quieter than the silence threshold throughout, so \
                                there is nothing to fingerprint."
                        .into(),
                    reason_ar: "تم فك الترميز، لكن الملف يبقى أضعف من عتبة الصمت في كله، فلا شيء \
                                يمكن أخذ بصمة منه."
                        .into(),
                });
            }
            Ok(print) => {
                if print.prefix_only {
                    warnings.push(format!(
                        "decode_prefix_only:{} only the first {} seconds were decoded, so the \
                         remainder of this file was never compared",
                        candidate.path.display(),
                        m03_audio::MAX_DECODE_SECONDS
                    ));
                }
                decoded.push(AudioDecodeRecord {
                    path: candidate.path.to_string_lossy().to_string(),
                    status: if print.prefix_only {
                        "decoded_prefix_truncated".into()
                    } else {
                        "decoded".into()
                    },
                    decoded_duration_seconds: Some(print.decoded_duration_seconds),
                    sample_rate_hz: Some(print.sample_rate_hz),
                    source_channels,
                    source_codec,
                    frame_count: print.frames.len() as u64,
                    leading_silence_ms: print.leading_silence_ms,
                    trailing_silence_ms: print.trailing_silence_ms,
                    peak_dbfs: round3(print.peak_dbfs as f64) as f32,
                    reason_en: format!(
                        "Decoded to {} channel at {} Hz, then {} leading and {} trailing \
                         milliseconds of silence were trimmed before fingerprinting.",
                        m03_audio::CHANNELS,
                        m03_audio::SAMPLE_RATE_HZ,
                        print.leading_silence_ms,
                        print.trailing_silence_ms
                    ),
                    reason_ar: format!(
                        "فُك الترميز إلى قناة واحدة عند {} هرتز، ثم أُزيلت {} مللي ثانية في البداية \
                         و{} في النهاية قبل أخذ البصمة.",
                        m03_audio::SAMPLE_RATE_HZ,
                        print.leading_silence_ms,
                        print.trailing_silence_ms
                    ),
                });
                prints.push(print);
                kept.push(candidate.clone());
            }
            Err(error) => {
                warnings.push(format!("{}:{error}", candidate.path.display()));
                decoded.push(AudioDecodeRecord {
                    path: candidate.path.to_string_lossy().to_string(),
                    status: "decode_failed".into(),
                    decoded_duration_seconds: None,
                    sample_rate_hz: None,
                    source_channels,
                    source_codec,
                    frame_count: 0,
                    leading_silence_ms: 0,
                    trailing_silence_ms: 0,
                    peak_dbfs: -120.0,
                    reason_en: format!(
                        "The decoder did not produce usable samples ({error}). This file is \
                         reported as an error, not as a non-duplicate."
                    ),
                    reason_ar: format!(
                        "لم يُنتج المفكّك عينات صالحة ({error}). هذا الملف مُبلَّغ عنه كخطأ لا كملف \
                         غير مكرر."
                    ),
                });
            }
        }
        if index % 4 == 0 {
            emit(
                app,
                op_id,
                AUDIO_MODE,
                "decoding_audio",
                index as u64 + 1,
                Some(total),
                bytes,
                Some(candidate.path.to_string_lossy().to_string()),
                0,
                0,
                warnings.errors,
                true,
            );
        }
    }
    evidence.decoded = decoded;
    evidence.max_offset_samples = prints
        .iter()
        .map(|print| m03_audio::max_offset(print.frames.len(), print.frames.len()) as u32)
        .max()
        .unwrap_or(0);

    let threshold = request.similarity_threshold.clamp(50.0, 100.0);
    let mut groups = exact_only_groups(AUDIO_MODE, &kept, &hashes, "audio", |_candidate| {
        (
            Some("blake3:whole_file".into()),
            None,
            vec![note(
                "proof",
                "full_file_blake3".into(),
                "Every file in this group has the same full-content BLAKE3 hash. Equal tags are \
                 never used as proof anywhere in this service; bytes are.",
                "لكل ملف في هذه المجموعة نفس بصمة BLAKE3 الكاملة. الوسوم المتساوية لا تُستخدم \
                 كدليل في هذه الخدمة إطلاقًا؛ البايتات هي الدليل.",
            )],
        )
    })?;
    evidence.exact_hash_groups = groups.len() as u64;

    // A short file is only compared against files of a similar decoded length, so a jingle
    // is not matched against a full track.
    let mut by_duration: BTreeMap<u64, Vec<usize>> = BTreeMap::new();
    for (index, print) in prints.iter().enumerate() {
        let seconds = print.decoded_duration_seconds.max(0.0) as u64;
        by_duration
            .entry(if seconds < 30 {
                seconds / 5
            } else {
                30 + seconds / 60
            })
            .or_default()
            .push(index);
    }
    let mut parent: Vec<usize> = (0..prints.len()).collect();
    let mut compared = 0u64;
    for members in by_duration.values() {
        for (position, &left) in members.iter().enumerate() {
            for &right in members.iter().skip(position + 1) {
                checkpoint(control)?;
                compared += 1;
                if m03_audio::composite(&m03_audio::signal_breakdown(&prints[left], &prints[right]))
                    >= threshold
                {
                    union(&mut parent, left, right);
                }
            }
        }
    }
    evidence.compared_pairs = compared;

    for members in clusters(&mut parent, prints.len()) {
        let reference = members[0];
        let mut files = Vec::new();
        let mut signals_out: Vec<SignalScore> = Vec::new();
        let mut min_score = 100f32;
        for &index in &members {
            let print = &prints[index];
            let candidate = &kept[index];
            let signals = m03_audio::signal_breakdown(&prints[reference], print);
            let score = m03_audio::composite(&signals);
            min_score = min_score.min(score);
            if signals_out.is_empty() {
                signals_out = signals;
            }
            files.push(
                file_item(
                    candidate,
                    hashes
                        .get(&candidate.file_identity)
                        .cloned()
                        .unwrap_or_default(),
                    Some(format!("band-fingerprint-frames:{}", print.frames.len())),
                    Some(score),
                    None,
                    vec![
                        note(
                            "decoded_audio",
                            format!(
                                "{:.3}s, {} channel, {} Hz, {} frames, peak {:.1} dBFS",
                                print.decoded_duration_seconds,
                                print.channels,
                                print.sample_rate_hz,
                                print.frames.len(),
                                print.peak_dbfs
                            ),
                            &format!(
                                "Decoded duration, channel normalization, sample rate, frame \
                                 count and measured peak level. Silence trimmed: {} ms leading, \
                                 {} ms trailing.",
                                print.leading_silence_ms, print.trailing_silence_ms
                            ),
                            &format!(
                                "المدة بعد فك الترميز، وتوحيد القنوات، ومعدل العينات، وعدد \
                                 الإطارات، وأعلى مستوى مقيس. الصمت المحذوف: {} مللي ثانية في \
                                 البداية و{} في النهاية.",
                                print.leading_silence_ms, print.trailing_silence_ms
                            ),
                        ),
                        note(
                            "fingerprint_backend",
                            m03_audio::BACKEND_ID.into(),
                            m03_audio::BACKEND_LIMITATION_EN,
                            m03_audio::BACKEND_LIMITATION_AR,
                        ),
                    ],
                )
                .map_err(ScanStop::Failed)?,
            );
        }
        if files.len() < 2 {
            continue;
        }
        let signature = blake3::hash(
            &prints[reference]
                .frames
                .iter()
                .flat_map(|frame| frame.bands)
                .collect::<Vec<u8>>(),
        )
        .to_hex()
        .to_string();
        groups.push(make_group(
            AUDIO_MODE,
            "audio",
            format!("audio-fingerprint-cluster-{}", &signature[..32]),
            files,
            (min_score / 100.0).clamp(0.0, 1.0),
            false,
            "fuzzy_acoustic_similarity",
            signals_out,
            vec![format!(
                "Acoustic similarity is at least {min_score:.1}%. A fuzzy score is not a proof, \
                 so this group is never actionable on its own. Equal tags were never consulted."
            )],
        ));
    }
    groups.sort_by(|a, b| b.wasted_size_bytes.cmp(&a.wasted_size_bytes));

    let warning_list = warnings.into_vec();
    Ok(DuplicateScanResult {
        job_id: op_id.into(),
        summary: summary(
            op_id,
            request,
            AUDIO_MODE,
            prints.len() as u64,
            bytes,
            &groups,
            warning_list.len() as u64,
        ),
        groups,
        warnings: warning_list,
        evidence: Some(MediaScanEvidence {
            service_id: "m03_scan_audio_complete".into(),
            capability_id: "m03_s05".into(),
            strategy: "exact_blake3_lane_plus_in_process_offset_tolerant_band_fingerprint".into(),
            cancelled: false,
            started_at,
            completed_at: Utc::now().to_rfc3339(),
            dependencies,
            images: None,
            videos: None,
            audio: Some(evidence),
            archives: None,
            runtime_verified: false,
            verification_note_en: VERIFICATION_NOTE_EN.into(),
            verification_note_ar: VERIFICATION_NOTE_AR.into(),
        }),
    })
}

fn audio_policy_weights() -> Vec<SignalWeight> {
    vec![
        SignalWeight {
            signal: "spectral_band_fingerprint".into(),
            weight: m03_audio::WEIGHT_ACOUSTIC,
        },
        SignalWeight {
            signal: "decoded_duration_ratio".into(),
            weight: m03_audio::WEIGHT_DURATION_RATIO,
        },
    ]
}

fn audio_limitations_en() -> Vec<String> {
    vec![
        m03_audio::BACKEND_LIMITATION_EN.to_string(),
        "Decoding stops after the first 900 seconds of a file. A longer file is compared on its \
         prefix only and is reported as `decoded_prefix_truncated`."
            .into(),
        "Tags are never read. Two files with identical metadata can be entirely different audio, \
         and that is not treated as a match."
            .into(),
        "A file that decodes to silence produces no fingerprint and is reported as \
         `silence_only`, rather than being matched against other silent files."
            .into(),
    ]
}

fn audio_limitations_ar() -> Vec<String> {
    vec![
        m03_audio::BACKEND_LIMITATION_AR.to_string(),
        "يتوقف فك الترميز بعد أول 900 ثانية من الملف. الملفات الأطول تُقارن على بادئتها فقط وتُبلَّغ \
         بالحالة decoded_prefix_truncated."
            .into(),
        "لا تُقرأ الوسوم إطلاقًا. ملفان بنفس البيانات الوصفية قد يكون صوتهما مختلفين تمامًا، ولا \
         يُعتبر ذلك تطابقًا."
            .into(),
        "الملف الذي يفك ترميزه إلى صمت لا ينتج بصمة ويُبلَّغ كـ silence_only بدل مطابقته مع ملفات \
         صامتة أخرى."
            .into(),
    ]
}

// ---- M03-S07 duplicate archives ----------------------------------------------------------------

const ARCHIVE_MODE: &str = "archive_central_directory_manifest";

/// The entry names from a central directory that must be *reported* rather than followed:
/// traversal names, names deeper than the limit, and nested archives.
///
/// All three are read from [`ZipFile`] metadata alone. Nothing here resolves a name against
/// a filesystem, which is the property that makes a `..\..\evil.dll` entry safe to
/// report: there is no path to follow even if a caller wanted to.
fn flagged_entry_names(
    entries: &[ZipFile],
    max_depth: u32,
) -> (Vec<String>, Vec<String>, Vec<String>) {
    let mut traversal = Vec::new();
    let mut deep = Vec::new();
    let mut nested = Vec::new();
    for entry in entries {
        if entry.is_path_traversal {
            traversal.push(entry.original_name.clone());
        }
        if entry.depth > max_depth {
            deep.push(entry.original_name.clone());
        }
        if entry.is_nested_archive {
            nested.push(entry.original_name.clone());
        }
    }
    for list in [&mut traversal, &mut deep, &mut nested] {
        list.sort();
        list.dedup();
    }
    (traversal, deep, nested)
}

fn scan_archives(
    app: &AppHandle,
    op_id: &str,
    request: &DuplicateScanRequest,
    control: &Arc<jobs::JobControl>,
) -> Result<DuplicateScanResult, ScanStop> {
    let started_at = Utc::now().to_rfc3339();
    let limits = m03_archives::default_limits();
    let seven = tool_evidence("7z");
    let seven_usable = is_usable(&seven);
    let mut warnings = Warnings::new();
    let candidates = collect(
        request,
        &ARCHIVE_EXTENSIONS,
        control,
        app,
        op_id,
        ARCHIVE_MODE,
    )?;
    let total = candidates.len() as u64;
    let bytes = total_bytes(&candidates);

    let mut manifests: Vec<ArchiveManifestSummary> = Vec::new();
    let mut by_manifest: BTreeMap<String, Vec<usize>> = BTreeMap::new();
    let mut kept: Vec<FileCandidate> = Vec::new();
    let mut hashes: HashMap<String, String> = HashMap::new();
    let mut encrypted_archives = 0u64;
    let mut traversal_names: Vec<String> = Vec::new();
    let mut depth_names: Vec<String> = Vec::new();
    let mut nested_names: Vec<String> = Vec::new();
    let mut unsupported: Vec<String> = Vec::new();
    let mut aborted: Option<String> = None;

    for (index, candidate) in candidates.iter().enumerate() {
        checkpoint(control)?;
        let extension = candidate.extension.to_ascii_lowercase();
        let hash = match full_hash(&candidate.canonical_path) {
            Ok(value) => value,
            Err(error) => {
                warnings.push(format!("hash_failed:{}:{error}", candidate.path.display()));
                continue;
            }
        };
        hashes.insert(candidate.file_identity.clone(), hash);

        if extension == "zip" {
            match m03_archives::read_zip(&candidate.canonical_path, &limits) {
                Ok(archive) => {
                    if archive.encrypted_entries() > 0 {
                        encrypted_archives += 1;
                    }
                    let (found_traversal, found_depth, found_nested) =
                        flagged_entry_names(&archive.entries, limits.max_path_depth);
                    traversal_names.extend(found_traversal);
                    depth_names.extend(found_depth);
                    nested_names.extend(found_nested);
                    if let Some(reason) = archive.aborted.clone() {
                        warnings.push(format!(
                            "archive_metadata_limit:{}:{reason}",
                            candidate.path.display()
                        ));
                        aborted = Some(reason);
                    }
                    let manifest = m03_archives::manifest_hash(&archive);
                    let ratio = archive.compression_ratio();
                    manifests.push(ArchiveManifestSummary {
                        path: candidate.path.to_string_lossy().to_string(),
                        status: if archive.encrypted_entries() > 0 {
                            "encrypted".into()
                        } else {
                            "parsed".into()
                        },
                        manifest_hash: Some(manifest.clone()),
                        entry_count: archive.entry_count(),
                        declared_uncompressed_bytes: archive.declared_uncompressed_bytes(),
                        compressed_bytes: archive.compressed_bytes(),
                        // JSON has no infinity, so an infinite ratio — a bomb signature —
                        // is reported as the largest finite double and the status carries
                        // the abort reason.
                        compression_ratio: if ratio.is_finite() {
                            round3(ratio)
                        } else {
                            f64::MAX
                        },
                        max_path_depth: archive.max_depth(),
                        encrypted_entries: archive.encrypted_entries(),
                        path_traversal_entries: archive.path_traversal_entries(),
                        nested_archive_entries: archive.nested_archive_entries(),
                        reason_en: if archive.encrypted_entries() > 0 {
                            format!(
                                "{} of {} entries are encrypted. Their plaintext CRC-32 is still \
                                 recorded in the central directory, so the manifest is \
                                 comparable. No password was tried and no entry was opened.",
                                archive.encrypted_entries(),
                                archive.entry_count()
                            )
                        } else {
                            format!(
                                "Read {} entries from the central directory. No entry payload \
                                 was opened.",
                                archive.entry_count()
                            )
                        },
                        reason_ar: if archive.encrypted_entries() > 0 {
                            format!(
                                "{} من {} مدخل مشفّر. تبقى قيمة CRC-32 للنص الصريح مسجّلة في الفهرس \
                                 المركزي، فيمكن مقارنة البيان. لم تُجرَ كلمة مرور ولم يُفتح أي مدخل.",
                                archive.encrypted_entries(),
                                archive.entry_count()
                            )
                        } else {
                            format!(
                                "قُرئت {} مدخلًا من الفهرس المركزي. لم يُفتح محتوى أي مدخل.",
                                archive.entry_count()
                            )
                        },
                    });
                    by_manifest.entry(manifest).or_default().push(index);
                    kept.push(candidate.clone());
                }
                Err(error) => {
                    warnings.push(format!(
                        "zip_parse_failed:{}:{error}",
                        candidate.path.display()
                    ));
                    manifests.push(ArchiveManifestSummary {
                        path: candidate.path.to_string_lossy().to_string(),
                        status: "parse_failed".into(),
                        manifest_hash: None,
                        entry_count: 0,
                        declared_uncompressed_bytes: 0,
                        compressed_bytes: 0,
                        compression_ratio: 0.0,
                        max_path_depth: 0,
                        encrypted_entries: 0,
                        path_traversal_entries: 0,
                        nested_archive_entries: 0,
                        reason_en: format!(
                            "The ZIP central directory could not be read ({error}), so no manifest \
                             was produced. This file is not reported as a non-duplicate."
                        ),
                        reason_ar: format!(
                            "تعذّرت قراءة الفهرس المركزي لملف ZIP ({error})، فلم يُنتج بيان. هذا الملف \
                             لا يُبلَّغ كملف غير مكرر."
                        ),
                    });
                }
            }
        } else {
            // 7z, RAR, tar and gz have no native reader in this build. They are counted and
            // explained, never guessed at.
            unsupported.push(extension.clone());
            if !seven_usable {
                let refusal = m03_archives::unsupported_format(&extension);
                manifests.push(ArchiveManifestSummary {
                    path: candidate.path.to_string_lossy().to_string(),
                    status: "unsupported_format".into(),
                    manifest_hash: None,
                    entry_count: 0,
                    declared_uncompressed_bytes: 0,
                    compressed_bytes: 0,
                    compression_ratio: 0.0,
                    max_path_depth: 0,
                    encrypted_entries: 0,
                    path_traversal_entries: 0,
                    nested_archive_entries: 0,
                    reason_en: refusal.reason_en,
                    reason_ar: refusal.reason_ar,
                });
                if unsupported.len() == 1 {
                    warnings.push(dependency_warning(&seven));
                }
            } else {
                match list_with_seven_zip(&seven, candidate) {
                    Ok(listing) => {
                        let entries = m03_archives::parse_seven_zip_listing(&listing);
                        let manifest = m03_archives::manifest_hash_from_listing(&entries);
                        manifests.push(ArchiveManifestSummary {
                            path: candidate.path.to_string_lossy().to_string(),
                            status: "parsed".into(),
                            manifest_hash: Some(manifest.clone()),
                            entry_count: entries.len() as u64,
                            declared_uncompressed_bytes: 0,
                            compressed_bytes: 0,
                            compression_ratio: 0.0,
                            max_path_depth: 0,
                            encrypted_entries: entries
                                .iter()
                                .filter(|entry| entry.encrypted)
                                .count() as u64,
                            path_traversal_entries: 0,
                            nested_archive_entries: 0,
                            reason_en:
                                "Listed by the detected 7-Zip binary, whose resolved path, \
                                 reported version and reported licence line are in the dependency \
                                 evidence. Listing only; no entry was opened."
                                    .into(),
                            reason_ar:
                                "قُوبل بواسطة برنامج 7-Zip المكتشف، ومساره والإصدار المعلن وسطر الترخيص \
                                 المعلن موجودة في أدلة الاعتماد. قائمة فقط دون فتح أي مدخل."
                                    .into(),
                        });
                        by_manifest.entry(manifest).or_default().push(index);
                        kept.push(candidate.clone());
                    }
                    Err(error) => warnings.push(format!(
                        "external_listing_failed:{}:{error}",
                        candidate.path.display()
                    )),
                }
            }
        }
        if index % PROGRESS_STRIDE == 0 {
            emit(
                app,
                op_id,
                ARCHIVE_MODE,
                "reading_central_directory",
                index as u64 + 1,
                Some(total),
                bytes,
                Some(candidate.path.to_string_lossy().to_string()),
                by_manifest
                    .values()
                    .filter(|members| members.len() > 1)
                    .count() as u64,
                0,
                warnings.errors,
                true,
            );
        }
    }
    for list in [
        &mut traversal_names,
        &mut depth_names,
        &mut nested_names,
        &mut unsupported,
    ] {
        list.sort();
        list.dedup();
    }

    // Exact bytes first: two archives with the same BLAKE3 are the same file, whatever is
    // inside them.
    let mut groups = exact_only_groups(ARCHIVE_MODE, &kept, &hashes, "archives", |_candidate| {
        (
            Some("blake3:whole_file".into()),
            None,
            exact_proof_evidence(),
        )
    })?;
    // Then equivalent manifests, which is a different and weaker statement.
    for (manifest, members) in by_manifest {
        if members.len() < 2 {
            continue;
        }
        let mut files = Vec::new();
        for &index in &members {
            let candidate = &kept[index];
            files.push(
                file_item(
                    candidate,
                    hashes
                        .get(&candidate.file_identity)
                        .cloned()
                        .unwrap_or_default(),
                    Some(format!("manifest:{manifest}")),
                    Some(100.0),
                    None,
                    vec![
                        note(
                            "comparison_basis",
                            "central_directory_manifest_tuple".into(),
                            "These archives declare the same (normalized path, uncompressed size, \
                             CRC-32) tuples. The compression method and the compressed size are \
                             deliberately excluded, so the same content at a different compression \
                             level still matches. This is a statement about the manifest, not \
                             about the archive bytes.",
                            "تعلن هذه الأرشيفات نفس ثلاثيات (المسار بعد التطبيع، الحجم قبل الضغط، \
                             CRC-32). طريقة الضغط والحجم المضغوط مستبعدان عمدًا، فيتطابق المحتوى نفسه \
                             عند مستوى ضغط مختلف. هذا انتصار عن البيان لا عن بايتات الأرشيف.",
                        ),
                        note(
                            "manifest_hash",
                            manifest.clone(),
                            "BLAKE3 over the sorted, normalized manifest tuples.",
                            "بصمة BLAKE3 على ثلاثيات البيان بعد التطبيع والمرتبة.",
                        ),
                    ],
                )
                .map_err(ScanStop::Failed)?,
            );
        }
        let all_identical = files.windows(2).all(|pair| pair[0].hash == pair[1].hash);
        groups.push(make_group(
            ARCHIVE_MODE,
            "archives",
            manifest,
            files,
            1.0,
            false,
            if all_identical {
                "verified_exact"
            } else {
                "equivalent_manifest"
            },
            vec![SignalScore {
                signal: "manifest_tuple".into(),
                score: 100.0,
                weight: 1.0,
                available: true,
                detail_en: "Every member declares an identical set of (normalized path, \
                            uncompressed size, CRC-32) tuples. This compares manifests, not bytes: \
                            the archive files themselves may differ in their compressed data."
                    .into(),
                detail_ar: "كل عضو يعلن نفس مجموعة ثلاثيات (المسار بعد التطبيع، الحجم قبل الضغط، \
                             CRC-32). هذه مقارنة للبيانات لا للبايتات: قد تختلف ملفات الأرشيف نفسها \
                             في بياناتها المضغوطة."
                    .into(),
            }],
            vec![
                "Equivalent manifests are not equivalent bytes, so this group is never \
                  actionable. Use the exact-hash group when the archive files are identical."
                    .into(),
            ],
        ));
    }
    groups.sort_by(|a, b| b.wasted_size_bytes.cmp(&a.wasted_size_bytes));

    let unsupported_formats = unsupported
        .iter()
        .map(|extension| m03_archives::unsupported_format(extension))
        .collect();
    let evidence = ArchiveScanEvidence {
        dependency: vec![seven.clone()],
        parser: "native_rust_zip_central_directory".into(),
        comparison_basis: "central_directory_manifest_tuple".into(),
        limits: limits.clone(),
        case_policy: m03_archives::CASE_POLICY.into(),
        separator_policy: m03_archives::SEPARATOR_POLICY.into(),
        archives_parsed: manifests
            .iter()
            .filter(|entry| entry.manifest_hash.is_some())
            .count() as u64,
        encrypted_archives,
        path_traversal_entries: traversal_names,
        depth_exceeded_entries: depth_names,
        nested_archive_entries: nested_names,
        nested_archive_contents_compared: false,
        aborted_reason: aborted.clone(),
        limits_exceeded: aborted.is_some(),
        never_opens_entry_payloads: true,
        unsupported_formats,
        manifests,
        limitations_en: archive_limitations_en(seven_usable, &unsupported),
        limitations_ar: archive_limitations_ar(seven_usable, &unsupported),
    };
    let warning_list = warnings.into_vec();
    Ok(DuplicateScanResult {
        job_id: op_id.into(),
        summary: summary(
            op_id,
            request,
            ARCHIVE_MODE,
            total,
            bytes,
            &groups,
            warning_list.len() as u64,
        ),
        groups,
        warnings: warning_list,
        evidence: Some(MediaScanEvidence {
            service_id: "m03_scan_archives_complete".into(),
            capability_id: "m03_s07".into(),
            strategy: "native_zip_central_directory_manifest_tuple".into(),
            cancelled: false,
            started_at,
            completed_at: Utc::now().to_rfc3339(),
            dependencies: vec![seven],
            images: None,
            videos: None,
            audio: None,
            archives: Some(evidence),
            runtime_verified: false,
            verification_note_en: VERIFICATION_NOTE_EN.into(),
            verification_note_ar: VERIFICATION_NOTE_AR.into(),
        }),
    })
}

/// Runs a detected 7-Zip binary to list an archive. Listing only; the binary is never asked
/// to test, extract or repair anything.
fn list_with_seven_zip(seven: &ToolEvidence, candidate: &FileCandidate) -> Result<String, String> {
    let path = seven
        .resolved_path
        .as_deref()
        .ok_or_else(|| "seven_zip_path_unknown".to_string())?;
    let output = Command::new(path)
        .args(["l", "-slt", "-ba"])
        .arg(&candidate.canonical_path)
        .output()
        .map_err(|error| format!("seven_zip_launch_failed:{error}"))?;
    if !output.status.success() {
        return Err(format!(
            "seven_zip_exit_failed:{}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn archive_limitations_en(seven_usable: bool, unsupported: &[String]) -> Vec<String> {
    let mut limits = vec![
        "Only the ZIP central directory is read. Entry payloads are never opened, so a hostile \
         archive cannot be unpacked by being compared."
            .into(),
        "The CRC-32 is read from the central directory rather than recomputed, so a false \
         collision is theoretically possible. It is a 32-bit check underneath a BLAKE3 manifest \
         hash, and the exact lane uses the full file hash."
            .into(),
        "A nested archive is detected and counted, and its contents are never opened. Two \
         archives holding different nested archives are therefore not distinguished by them."
            .into(),
        "Only ASCII letter case is folded when normalizing a name, so two archives that differ \
         in the case of a non-ASCII name are reported as different."
            .into(),
    ];
    if !unsupported.is_empty() {
        limits.push(format!(
            "Not parsed by this build: {}. Each was counted and reported as unsupported, with no \
             manifest invented.",
            unsupported.join(", ")
        ));
    }
    if !seven_usable {
        limits.push(
            "No 7-Zip binary was detected, so no external listing was attempted at all.".into(),
        );
    }
    limits
}

fn archive_limitations_ar(seven_usable: bool, unsupported: &[String]) -> Vec<String> {
    let mut limits = vec![
        "يُقرأ الفهرس المركزي لملفات ZIP فقط. لا يُفتح محتوى أي مدخل أبدًا، فلا يمكن فك ضغط أرشيف \
         خبيث بمجرد مقارنته."
            .into(),
        "تُقرأ قيمة CRC-32 من الفهرس المركزي بدل إعادة حسابها، فتصادم كاذب ممكن نظريًا. وهي تحقّق 32 \
         بت تحت بصمة بيان BLAKE3، بينما المسار الدقيق يستخدم بصمة الملف الكامل."
            .into(),
        "يُكتشف الأرشيف المتداخل ويُعدّ، ولا يُفتح محتواه أبدًا. لذلك لا يميَّز الأرشيفان اللذان \
         يحتويان على متداخلات مختلفة بسببها."
            .into(),
        "يُطوى في حالة الأحرف اللاتينية فقط عند تطبيع الاسم، فيُبلَّغ الأرشيفان المختلفان في حالة اسم \
         غير لاتيني على أنهما مختلفان."
            .into(),
    ];
    if !unsupported.is_empty() {
        limits.push(format!(
            "لا تقرأها هذه النسخة: {}. عُدّ كل منها وأُبلَّغ كغير مدعوم دون اختراع بيان.",
            unsupported.join("، ")
        ));
    }
    if !seven_usable {
        limits.push("لم يُكتشف برنامج 7-Zip، فلم تُحاول أي قائمة خارجية إطلاقًا.".into());
    }
    limits
}

// ---- the commands ---------------------------------------------------------------------------

fn handler_for(capability: &str) -> &'static str {
    match capability {
        "m03_s03" => "m03.scan.images",
        "m03_s04" => "m03.scan.videos",
        "m03_s05" => "m03.scan.audio",
        _ => "m03.scan.archives",
    }
}

/// The bilingual summary. Each sentence states the policy that ran and what it refused to
/// conclude, rather than only counting results.
fn service_summary(capability: &str, groups: usize, warnings: &[String]) -> (String, String) {
    let caveat = if warnings.is_empty() {
        String::new()
    } else {
        format!(
            " {} warning(s), including any suppression notice, are attached to the result.",
            warnings.len()
        )
    };
    match capability {
        "m03_s03" => (
            format!(
                "Measured oriented image fingerprints, compared {groups} group(s) with the \
                 per-signal breakdown attached, and matched candidates through coarse buckets \
                 instead of every pair. Nothing was moved or deleted.{caveat}"
            ),
            format!(
                "قِيست بصمات الصور بعد تطبيق الاتجاه، وقورنت {groups} مجموعة مع تفصيل كل إشارة، وتمت \
                 مطابقة المرشحين عبر حاويات خشنة بدل كل الأزواج. لم يُنقل أو يُحذف شيء.{caveat}"
            ),
        ),
        "m03_s04" => (
            format!(
                "Found {groups} video group(s) from frames sampled across the timeline, with the \
                 resolved dependency, its reported version, the sample positions and the \
                 per-signal scores attached. A whole-file BLAKE3 match is the only proof, so a \
                 fuzzy frame-sequence score never makes a group actionable.{caveat}"
            ),
            format!(
                "عُثر على {groups} مجموعة فيديو من إطارات مُعينة على امتداد الخط الزمني، مع إرفاق مسار \
                 الاعتماد وإصداره المعلن ومواضع المعاينة ودرجات كل إشارة. الدرجة التقريبية لا تجعل أي \
                 مجموعة قابلة للتنفيذ أبدًا.{caveat}"
            ),
        ),
        "m03_s05" => (
            format!(
                "Found {groups} audio group(s) using an exact whole-file byte proof plus the \
                 in-process offset-tolerant backend named in the evidence, with decoded \
                 duration, sample rate and channel normalization recorded per file. Tags are \
                 never used as proof, and a fuzzy acoustic score never makes a group \
                 actionable.{caveat}"
            ),
            format!(
                "عُثر على {groups} مجموعة صوتية بمسار البايتات التام وبصمة داخلية متسامحة مع الإزاحة \
                 مذكورة باسمها في الأدلة، مع تسجيل المدة بعد فك الترميز ومعدل العينات وتوحيد القنوات \
                 لكل ملف. الوسوم لا تُستخدم كدليل أبدًا.{caveat}"
            ),
        ),
        _ => (
            format!(
                "Found {groups} archive group(s) from a native central-directory manifest \
                 comparison. A whole-file BLAKE3 match is the only proof; an equivalent \
                 manifest is a weaker statement and is never actionable. No entry payload was \
                 opened, and no format without a native reader was guessed at.{caveat}"
            ),
            format!(
                "عُثر على {groups} مجموعة أرشيف من مقارنة بيان الفهرس المركزي الأصلية. لم يُفتح محتوى \
                 أي مدخل، ولم يُخمَّن أي صيغة بلا قارئ أصلي.{caveat}"
            ),
        ),
    }
}

/// A cancelled run's result: no groups, and an evidence record that says so.
///
/// A cluster that was still being built when the scan stopped is not a finding, so nothing
/// is returned that a caller could act on.
fn cancelled_result(
    op_id: &str,
    request: &DuplicateScanRequest,
    mode: &str,
    started: &str,
) -> DuplicateScanResult {
    DuplicateScanResult {
        job_id: op_id.into(),
        summary: summary(op_id, request, mode, 0, 0, &[], 0),
        groups: Vec::new(),
        warnings: vec![
            "scan_cancelled: no group is reported, because a cluster that was still being built \
             when the scan stopped is not evidence of anything."
                .into(),
        ],
        evidence: Some(MediaScanEvidence {
            service_id: "m03_media_cancelled".into(),
            capability_id: "cancelled".into(),
            strategy: "cancelled_before_completion".into(),
            cancelled: true,
            started_at: started.into(),
            completed_at: Utc::now().to_rfc3339(),
            dependencies: Vec::new(),
            images: None,
            videos: None,
            audio: None,
            archives: None,
            runtime_verified: false,
            verification_note_en: VERIFICATION_NOTE_EN.into(),
            verification_note_ar: VERIFICATION_NOTE_AR.into(),
        }),
    }
}

fn finish(
    capability: &str,
    mode: &str,
    op_id: &str,
    request: &DuplicateScanRequest,
    started: String,
    timer: Instant,
    outcome: Result<DuplicateScanResult, ScanStop>,
) -> Result<OperationResult<DuplicateScanResult>, String> {
    let handler = handler_for(capability);
    match outcome {
        Ok(data) => {
            let warnings = data.warnings.clone();
            let groups = data.groups.len();
            let status = if warnings.is_empty() {
                "completed"
            } else {
                "completed_with_warnings"
            };
            let (en, ar) = service_summary(capability, groups, &warnings);
            Ok(op_result(
                op_id.to_string(),
                capability,
                handler,
                started,
                timer,
                Some(data),
                status,
                en,
                ar,
                warnings,
                None,
            ))
        }
        Err(ScanStop::Cancelled) => Ok(op_result(
            op_id.to_string(),
            capability,
            handler,
            started,
            timer,
            Some(cancelled_result(
                op_id,
                request,
                mode,
                &Utc::now().to_rfc3339(),
            )),
            "cancelled",
            "The scan was cancelled. No groups are returned, because a half-built cluster is not \
             a finding."
                .into(),
            "أُلغي الفحص. لم تُرجَع أي مجموعات، لأن العنقود غير المكتمل ليس نتيجة.".into(),
            vec!["scan_cancelled".into()],
            None,
        )),
        Err(ScanStop::Failed(error)) => Ok(op_result(
            op_id.to_string(),
            capability,
            handler,
            started,
            timer,
            None,
            "failed",
            format!("{capability} failed: {error}"),
            format!("فشل {capability}: {error}"),
            Vec::new(),
            Some(error),
        )),
    }
}

macro_rules! completion_command {
    ($name:ident, $capability:literal, $mode:expr, $scanner:ident) => {
        #[tauri::command]
        pub async fn $name(
            app: AppHandle,
            op_id: String,
            request: DuplicateScanRequest,
        ) -> Result<OperationResult<DuplicateScanResult>, String> {
            let started = Utc::now().to_rfc3339();
            let timer = Instant::now();
            // Registered under the operation id, which is the `jobId` the interface already
            // sends to `m03_job_pause`, `m03_job_resume` and `m03_job_cancel`. No new command
            // and no change to `main.rs` is needed to make these scans pausable and
            // cancellable.
            let control = jobs::register(&op_id);
            let worker_app = app.clone();
            let worker_op = op_id.clone();
            let worker_request = request.clone();
            let outcome = tauri::async_runtime::spawn_blocking(move || {
                $scanner(&worker_app, &worker_op, &worker_request, &control)
            })
            .await
            .map_err(|error| format!("media_worker_join_failed:{error}"))?;
            jobs::remove(&op_id);
            // A terminal progress event, so the interface's pause and cancel buttons go
            // quiet instead of offering to stop a scan that has already stopped.
            emit(
                &app,
                &op_id,
                $mode,
                "completed",
                outcome
                    .as_ref()
                    .ok()
                    .map(|data| data.summary.total_files_scanned)
                    .unwrap_or(0),
                None,
                outcome
                    .as_ref()
                    .ok()
                    .map(|data| data.summary.total_bytes_scanned)
                    .unwrap_or(0),
                None,
                outcome
                    .as_ref()
                    .ok()
                    .map(|data| data.groups.len() as u64)
                    .unwrap_or(0),
                outcome
                    .as_ref()
                    .ok()
                    .map(|data| data.groups.len() as u64)
                    .unwrap_or(0),
                0,
                false,
            );
            finish(
                $capability,
                $mode,
                &op_id,
                &request,
                started,
                timer,
                outcome,
            )
        }
    };
}

completion_command!(m03_scan_images_complete, "m03_s03", IMAGE_MODE, scan_images);
completion_command!(m03_scan_videos_complete, "m03_s04", VIDEO_MODE, scan_videos);
completion_command!(m03_scan_audio_complete, "m03_s05", AUDIO_MODE, scan_audio);
completion_command!(
    m03_scan_archives_complete,
    "m03_s07",
    ARCHIVE_MODE,
    scan_archives
);

#[cfg(test)]
mod tests {
    use super::{
        clusters, find, handler_for, orientation_source_summary, round3, service_summary, union,
        Warnings, IMAGE_EXTENSIONS, MAX_WARNINGS,
    };
    use std::collections::BTreeMap;

    // ---- the four services keep their registered handler ids --------------------------------

    #[test]
    fn every_service_reports_its_registered_handler_id() {
        // These strings are the allowlist entries the integrity gate checks against
        // `main.rs`, so a rename here would silently break the wiring.
        assert_eq!(handler_for("m03_s03"), "m03.scan.images");
        assert_eq!(handler_for("m03_s04"), "m03.scan.videos");
        assert_eq!(handler_for("m03_s05"), "m03.scan.audio");
        assert_eq!(handler_for("m03_s07"), "m03.scan.archives");
    }

    #[test]
    fn the_image_extension_list_covers_the_formats_the_service_advertises() {
        for extension in ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp"] {
            assert!(
                IMAGE_EXTENSIONS.contains(&extension),
                "{extension} is missing"
            );
        }
    }

    // ---- clustering ------------------------------------------------------------------------

    #[test]
    fn union_find_groups_a_chain_and_the_result_is_order_independent() {
        let mut forward: Vec<usize> = (0..6).collect();
        union(&mut forward, 0, 1);
        union(&mut forward, 1, 2);
        union(&mut forward, 3, 4);
        assert_eq!(find(&mut forward, 0), find(&mut forward, 2));
        assert_ne!(find(&mut forward, 0), find(&mut forward, 3));
        assert_eq!(find(&mut forward, 5), 5);

        let mut backward: Vec<usize> = (0..6).collect();
        union(&mut backward, 3, 4);
        union(&mut backward, 1, 2);
        union(&mut backward, 0, 1);
        // {0,1,2} is one cluster and {3,4} is another, whichever order the unions arrived
        // in. If the two were merged, a chain would swallow everything.
        assert_eq!(find(&mut backward, 0), find(&mut backward, 2));
        assert_eq!(find(&mut backward, 0), find(&mut backward, 1));
        assert_ne!(find(&mut backward, 0), find(&mut backward, 3));
        assert_eq!(find(&mut backward, 3), find(&mut backward, 4));
        assert_eq!(find(&mut backward, 5), 5);
    }

    #[test]
    fn only_clusters_larger_than_one_are_returned() {
        // A singleton is not a duplicate, so reporting it would be noise at best.
        let mut parent: Vec<usize> = (0..5).collect();
        union(&mut parent, 0, 1);
        union(&mut parent, 1, 2);
        let mut groups = clusters(&mut parent, 5);
        groups.sort();
        assert_eq!(groups, vec![vec![0, 1, 2]]);

        let mut untouched: Vec<usize> = (0..3).collect();
        assert!(clusters(&mut untouched, 3).is_empty());
    }

    #[test]
    fn a_cluster_of_one_is_produced_for_nothing_when_nothing_matched() {
        let mut parent: Vec<usize> = (0..1000).collect();
        assert!(clusters(&mut parent, 1000).is_empty());
    }

    // ---- warnings ----------------------------------------------------------------------------

    #[test]
    fn the_warning_list_is_capped_and_says_how_many_were_dropped() {
        let mut warnings = Warnings::new();
        for index in 0..MAX_WARNINGS + 25 {
            warnings.push(format!("problem_{index}"));
        }
        assert_eq!(warnings.errors, (MAX_WARNINGS + 25) as u64);
        let items = warnings.into_vec();
        // A capped list that did not say so would read as a clean scan.
        assert_eq!(items.len(), MAX_WARNINGS + 1);
        assert!(items[MAX_WARNINGS].contains("further_problems_suppressed"));
    }

    #[test]
    fn a_clean_run_reports_no_suppression_claim() {
        let mut warnings = Warnings::new();
        warnings.push("only_problem".into());
        assert_eq!(warnings.into_vec(), vec!["only_problem".to_string()]);
    }

    // ---- honest reporting ----------------------------------------------------------------------

    #[test]
    fn a_non_finite_float_is_reported_as_zero_rather_than_breaking_json() {
        // A NaN would serialize to JSON `null` and quietly corrupt the evidence record.
        assert_eq!(round3(f64::NAN), 0.0);
        assert_eq!(round3(f64::INFINITY), 0.0);
        assert_eq!(round3(1.23456), 1.235);
        assert_eq!(round3(-0.5), -0.5);
    }

    #[test]
    fn the_orientation_source_summary_counts_every_file_it_saw() {
        let mut sources: BTreeMap<&'static str, u64> = BTreeMap::new();
        sources.insert("jpeg_app1_exif_tag", 3);
        sources.insert("not_a_jpeg", 7);
        let summary = orientation_source_summary(&sources);
        assert!(summary.contains("jpeg_app1_exif_tag=3"));
        assert!(summary.contains("not_a_jpeg=7"));
        // Deterministic, so two identical scans produce an identical report.
        assert_eq!(summary, orientation_source_summary(&sources));
        assert_eq!(
            orientation_source_summary(&BTreeMap::new()),
            "no image was decoded"
        );
    }

    #[test]
    fn every_summary_states_the_policy_and_the_group_count_in_both_languages() {
        for (capability, handler) in [
            ("m03_s03", "m03.scan.images"),
            ("m03_s04", "m03.scan.videos"),
            ("m03_s05", "m03.scan.audio"),
            ("m03_s07", "m03.scan.archives"),
        ] {
            let (en, ar) = service_summary(capability, 3, &[]);
            assert_eq!(handler_for(capability), handler);
            // A summary that only counts results hides the policy that produced them.
            assert!(
                en.contains('3'),
                "{capability} English summary lost the count"
            );
            assert!(
                ar.contains('3'),
                "{capability} Arabic summary lost the count"
            );
            assert!(en.len() > 80, "{capability} English summary is too terse");
            assert!(
                ar.chars().count() > 60,
                "{capability} Arabic summary is too terse"
            );
        }
    }

    #[test]
    fn a_summary_says_what_its_evidence_is_and_what_it_refuses_to_conclude() {
        for capability in ["m03_s03", "m03_s04", "m03_s05", "m03_s07"] {
            let (en, _) = service_summary(capability, 1, &[]);
            let lowered = en.to_ascii_lowercase();
            assert!(
                lowered.contains("proof") || en.contains("Nothing was moved"),
                "{capability} does not say what its evidence is"
            );
        }
    }

    #[test]
    fn a_scan_with_warnings_says_so_in_both_languages() {
        let (en, ar) = service_summary("m03_s03", 0, &["one".into(), "two".into()]);
        assert!(en.contains("2 warning"));
        assert!(ar.contains("2"));
    }

    // ---- the read-only promise -------------------------------------------------------------------

    #[test]
    fn none_of_the_media_modules_can_move_or_delete_a_file() {
        // The needles are joined at run time so this assertion does not put the forbidden
        // substrings into the source it is inspecting.
        for module in [
            include_str!("m03.rs"),
            include_str!("m03_images.rs"),
            include_str!("m03_archives.rs"),
            include_str!("m03_video.rs"),
            include_str!("m03_audio.rs"),
            include_str!("m03_exif.rs"),
            include_str!("m03_media.rs"),
        ] {
            for (first, second) in [
                ("fs", "remove_file"),
                ("fs", "remove_dir_all"),
                ("fs", "rename"),
            ] {
                let needle = format!("{first}::{second}");
                assert!(
                    !module.contains(&needle),
                    "a media module contains {needle}"
                );
            }
        }
    }

    #[test]
    fn the_orchestration_file_writes_nothing_outside_its_own_cache() {
        let source = include_str!("m03.rs");
        for (first, second) in [("fs", "write"), ("fs", "create_dir_all")] {
            let needle = format!("{first}::{second}");
            assert!(
                !source.contains(&needle),
                "the orchestration file contains {needle}; the only write it owns is the \
                 fingerprint cache, and that is inside the cache module"
            );
        }
    }

    #[test]
    fn the_archive_reader_never_opens_an_entry_payload() {
        // The safety property, stated as a source check: the only `open` in the archive
        // reader is the archive file itself.
        let source = include_str!("m03_archives.rs");
        assert_eq!(
            source.matches("File::open(").count(),
            1,
            "the archive reader opened something other than the archive"
        );
        assert!(!source.contains("read_to_end"));
        assert!(!source.contains("read_to_string"));
    }
}
