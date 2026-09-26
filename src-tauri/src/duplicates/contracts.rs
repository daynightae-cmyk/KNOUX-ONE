use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateScanRequest {
    pub paths: Vec<String>,
    #[serde(default)]
    pub excluded_paths: Vec<String>,
    #[serde(default = "default_min_size")]
    pub min_size_bytes: u64,
    pub max_size_bytes: Option<u64>,
    #[serde(default = "default_true")]
    pub include_subfolders: bool,
    #[serde(default = "default_similarity_threshold")]
    pub similarity_threshold: f32,
    #[serde(default)]
    pub extensions: Vec<String>,
    #[serde(default = "default_workers")]
    pub max_workers: usize,
}

fn default_true() -> bool {
    true
}
fn default_min_size() -> u64 {
    1_024
}
fn default_similarity_threshold() -> f32 {
    90.0
}
fn default_workers() -> usize {
    4
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateFileItem {
    pub id: String,
    pub path: String,
    pub canonical_path: String,
    pub name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub modified_time: String,
    pub created_time: String,
    pub hash: String,
    pub partial_hash: Option<String>,
    pub perceptual_hash: Option<String>,
    pub similarity_score: Option<f32>,
    pub mime_type: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub file_identity: String,
    pub hard_link_count: u64,
    pub is_hard_link_alias: bool,
    pub protected_path: bool,
    /// Measured facts about this one file, so a row can be explained later without
    /// re-running the scan. Deterministic order; never a guess presented as a reading.
    #[serde(default)]
    pub evidence: Vec<FileEvidence>,
}

/// One measured fact attached to a single file.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FileEvidence {
    pub key: String,
    pub value: String,
    pub note_en: String,
    pub note_ar: String,
}

/// One measured signal inside a similarity decision.
///
/// `available = false` means the signal could not be measured. Its `score` is then zero
/// and carries **no** evidence, so a composite built from it must be reported as a
/// partial measurement rather than as a completed comparison.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalScore {
    /// Stable machine name, for example `dhash`, `frame_sequence` or `manifest_tuple`.
    pub signal: String,
    /// 0..=100. Always finite.
    pub score: f32,
    /// The weight this signal carried in the composite score.
    pub weight: f32,
    pub available: bool,
    pub detail_en: String,
    pub detail_ar: String,
}

/// The weight one signal carries in a composite score, reported so a user can see how
/// the final number was assembled instead of trusting a single opaque value.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalWeight {
    pub signal: String,
    pub weight: f32,
}

/// Measured evidence about one external program this service depends on.
///
/// A missing program is always a typed reason. This build never substitutes a guess,
/// and never reports an empty but successful scan just because a tool is absent.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolEvidence {
    pub tool: String,
    pub required: bool,
    /// `resolved`, `absent`, or `present_version_unknown`.
    pub status: String,
    pub resolved_path: Option<String>,
    /// The first version line the program printed, kept verbatim.
    pub version: Option<String>,
    /// The verbatim line the program printed about its own licence, when it prints one.
    pub license_evidence: Option<String>,
    pub reason_en: String,
    pub reason_ar: String,
}

/// Bounds this service refuses to exceed, so a hostile or merely enormous input costs a
/// bounded amount of work instead of filling memory or hanging.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDecodeLimits {
    pub max_width: u32,
    pub max_height: u32,
    pub max_alloc_bytes: u64,
}

/// What the image scan actually did, including how it avoided an all-pairs comparison
/// and how the fingerprint cache behaved.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageScanEvidence {
    pub strategy: String,
    pub decode_limits: ImageDecodeLimits,
    pub orientation_policy: String,
    pub orientation_source: String,
    pub files_with_exif_orientation: u64,
    pub files_orientation_normalized: u64,
    pub bucket_rule: String,
    pub bucket_count: u64,
    pub largest_bucket: u64,
    pub compared_pairs: u64,
    /// `n * (n - 1) / 2`: what a full pairwise comparison would have cost.
    pub all_pairs_if_computed: u64,
    pub avoided_all_pairs: bool,
    /// Files removed from the fuzzy stage because a whole-file hash already proved they
    /// are the same file. Reported so "why were these two not compared" has an answer.
    pub exact_hash_classes_collapsed: u64,
    pub weights: Vec<SignalWeight>,
    pub cache_path: String,
    pub cache_entries: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub cache_invalidations: u64,
    pub cache_evictions: u64,
    pub files_changed_during_scan: u64,
    /// This service is read-only. It never moves, quarantines or deletes anything.
    pub no_destructive_action: bool,
    pub limitations_en: Vec<String>,
    pub limitations_ar: Vec<String>,
}

/// One frame-signature comparison decision, with the tolerance that was allowed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoScanEvidence {
    pub dependency: Vec<ToolEvidence>,
    pub strategy: String,
    pub requested_sample_count: u32,
    pub sample_count: u32,
    /// Seconds into each video where a frame was actually read, in the order used.
    pub sample_positions_seconds: Vec<f64>,
    /// The same positions as fractions of the duration, so the rule is reproducible.
    pub sample_positions_normalized: Vec<f64>,
    pub frame_signature_bits: u32,
    pub alignment_tolerance_samples: u32,
    pub compared_pairs: u64,
    /// The signals this policy combines, and what each one is worth. This is the policy,
    /// not a score: the measured scores for a real pair live on the group.
    pub signals: Vec<SignalWeight>,
    pub exact_hash_groups: u64,
    /// True by construction: only an exact BLAKE3 match can ever be actionable.
    pub fuzzy_groups_never_actionable: bool,
    pub limitations_en: Vec<String>,
    pub limitations_ar: Vec<String>,
}

/// What the audio decoder was actually asked to produce, and what came back.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDecodeRecord {
    pub path: String,
    /// `decoded`, `decode_failed`, or `silence_only`.
    pub status: String,
    pub decoded_duration_seconds: Option<f64>,
    pub sample_rate_hz: Option<u32>,
    pub source_channels: Option<u32>,
    pub source_codec: Option<String>,
    pub frame_count: u64,
    pub leading_silence_ms: u64,
    pub trailing_silence_ms: u64,
    pub peak_dbfs: f32,
    pub reason_en: String,
    pub reason_ar: String,
}

/// Which fingerprint produced the acoustic scores, and what it cannot do.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioScanEvidence {
    pub dependency: Vec<ToolEvidence>,
    /// The exact algorithm identifier, reported so a score is never anonymous.
    pub backend: String,
    /// `in_process` when no external fingerprint library is involved.
    pub backend_kind: String,
    pub sample_rate_hz: u32,
    pub channels_normalized_to: u32,
    pub window_samples: u32,
    pub hop_samples: u32,
    pub band_count: u32,
    pub band_low_hz: u32,
    pub band_high_hz: u32,
    pub max_offset_samples: u32,
    pub silence_trim_fraction: f32,
    pub decoded: Vec<AudioDecodeRecord>,
    pub compared_pairs: u64,
    /// The signals this policy combines, and what each one is worth.
    pub signals: Vec<SignalWeight>,
    /// Deliberately false: equal tags prove nothing about equal audio.
    pub metadata_used_as_proof: bool,
    pub exact_hash_groups: u64,
    pub fuzzy_groups_never_actionable: bool,
    pub limitations_en: Vec<String>,
    pub limitations_ar: Vec<String>,
}

/// Bounds enforced on archive metadata *before* any entry is trusted.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveScanLimits {
    pub max_entries: u64,
    pub max_declared_uncompressed_bytes: u64,
    pub max_compression_ratio: u64,
    pub max_path_depth: u32,
}

/// A format this build refuses to parse, with the reason instead of a pretend result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsupportedFormat {
    pub format: String,
    pub reason_en: String,
    pub reason_ar: String,
}

/// What one archive's central directory said, without opening a single entry payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveManifestSummary {
    pub path: String,
    /// `parsed`, `encrypted`, `unsupported_format`, `parse_failed`, or
    /// `aborted_metadata_limit`.
    pub status: String,
    pub manifest_hash: Option<String>,
    pub entry_count: u64,
    pub declared_uncompressed_bytes: u64,
    pub compressed_bytes: u64,
    pub compression_ratio: f64,
    pub max_path_depth: u32,
    pub encrypted_entries: u64,
    pub path_traversal_entries: u64,
    pub nested_archive_entries: u64,
    pub reason_en: String,
    pub reason_ar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveScanEvidence {
    pub dependency: Vec<ToolEvidence>,
    pub parser: String,
    /// `central_directory_manifest_tuple` — path, uncompressed size and CRC-32.
    pub comparison_basis: String,
    pub limits: ArchiveScanLimits,
    pub case_policy: String,
    pub separator_policy: String,
    pub archives_parsed: u64,
    pub encrypted_archives: u64,
    pub path_traversal_entries: Vec<String>,
    pub depth_exceeded_entries: Vec<String>,
    pub nested_archive_entries: Vec<String>,
    /// Always false: a nested archive's contents are never opened.
    pub nested_archive_contents_compared: bool,
    pub aborted_reason: Option<String>,
    pub limits_exceeded: bool,
    /// True by construction: only the central directory is ever read.
    pub never_opens_entry_payloads: bool,
    pub unsupported_formats: Vec<UnsupportedFormat>,
    pub manifests: Vec<ArchiveManifestSummary>,
    pub limitations_en: Vec<String>,
    pub limitations_ar: Vec<String>,
}

/// Everything the scan measured, attached to the result. This is the record a reviewer
/// reads to decide whether the numbers can be believed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaScanEvidence {
    pub service_id: String,
    pub capability_id: String,
    pub strategy: String,
    pub cancelled: bool,
    pub started_at: String,
    pub completed_at: String,
    pub dependencies: Vec<ToolEvidence>,
    pub images: Option<ImageScanEvidence>,
    pub videos: Option<VideoScanEvidence>,
    pub audio: Option<AudioScanEvidence>,
    pub archives: Option<ArchiveScanEvidence>,
    /// Only a human running the built application can set this. Static verification of
    /// the source never sets it, so it stays false here by construction.
    pub runtime_verified: bool,
    pub verification_note_en: String,
    pub verification_note_ar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub group_id: String,
    pub mode: String,
    pub category: String,
    pub files: Vec<DuplicateFileItem>,
    pub wasted_size_bytes: u64,
    pub common_hash: String,
    pub proof_status: String,
    pub confidence: f32,
    pub actionable: bool,
    #[serde(default)]
    pub warnings: Vec<String>,
    /// The individual signals behind `confidence`, so a group can be argued with.
    #[serde(default)]
    pub signals: Vec<SignalScore>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateScanSummary {
    pub scan_id: String,
    pub operation_id: String,
    pub started_at: String,
    pub completed_at: String,
    pub target_folders: Vec<String>,
    pub total_files_scanned: u64,
    pub total_bytes_scanned: u64,
    pub duplicate_groups_found: u64,
    pub duplicate_files_found: u64,
    pub total_wasted_bytes: u64,
    pub scan_mode: String,
    pub error_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateScanResult {
    pub job_id: String,
    pub groups: Vec<DuplicateGroup>,
    pub summary: DuplicateScanSummary,
    #[serde(default)]
    pub warnings: Vec<String>,
    /// The measured evidence for this scan. `None` only for scans whose producer has
    /// no evidence model of its own, never to hide an unmeasured claim.
    #[serde(default)]
    pub evidence: Option<MediaScanEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateJobProgress {
    pub job_id: String,
    pub operation_id: String,
    pub phase: String,
    pub mode: String,
    pub scanned_files: u64,
    pub total_files: Option<u64>,
    pub scanned_bytes: u64,
    pub current_path: Option<String>,
    pub candidate_groups: u64,
    pub verified_groups: u64,
    pub errors: u64,
    pub can_pause: bool,
    pub can_cancel: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperRuleConfig {
    pub prefer_date: Option<String>,
    pub prefer_path: Option<String>,
    pub preferred_directory: Option<String>,
    pub prefer_resolution: Option<String>,
    #[serde(default)]
    pub protected_paths: Vec<String>,
    #[serde(default = "default_true")]
    pub auto_select_non_keepers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperPlanRequest {
    pub groups: Vec<DuplicateGroup>,
    pub rules: KeeperRuleConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperGroupPlan {
    pub group_id: String,
    pub keeper_file_id: String,
    pub selected_file_ids: Vec<String>,
    pub reason: String,
    pub blocked: bool,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperPlanResult {
    pub plans: Vec<KeeperGroupPlan>,
    pub blocked_group_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineInput {
    pub group_id: String,
    pub original_path: String,
    pub keeper_path: String,
    pub expected_hash: String,
    pub reason: String,
    pub scan_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RestoreConflictMode {
    Fail,
    Rename,
    Replace,
    Choose,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub enum QuarantineRequest {
    #[serde(rename = "quarantine")]
    Quarantine { items: Vec<QuarantineInput> },
    #[serde(rename = "restore")]
    Restore {
        quarantine_id: String,
        conflict_mode: RestoreConflictMode,
        destination: Option<String>,
    },
    #[serde(rename = "purge")]
    Purge {
        quarantine_id: String,
        confirmation: String,
    },
    #[serde(rename = "list")]
    List,
    #[serde(rename = "verify")]
    Verify { quarantine_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineRecord {
    pub quarantine_id: String,
    pub scan_session_id: Option<String>,
    pub group_id: Option<String>,
    pub original_path: String,
    pub quarantine_path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub hash: String,
    pub file_identity: String,
    pub created_time: String,
    pub modified_time: String,
    pub quarantined_at: String,
    pub reason: String,
    pub keeper_path: String,
    pub status: String,
    pub verification_state: String,
    pub purge_state: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineActionResult {
    pub records: Vec<QuarantineRecord>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderComparisonRequest {
    pub paths: Vec<String>,
    #[serde(default)]
    pub excluded_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderDigest {
    pub path: String,
    pub digest: String,
    pub file_count: u64,
    pub total_bytes: u64,
    pub entries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderComparison {
    pub left_path: String,
    pub right_path: String,
    pub classification: String,
    pub common_entries: u64,
    pub left_only_entries: u64,
    pub right_only_entries: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderComparisonResult {
    pub folders: Vec<FolderDigest>,
    pub comparisons: Vec<FolderComparison>,
}
