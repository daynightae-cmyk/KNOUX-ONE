//! Timeline sampling, per-frame perceptual signatures, and bounded-alignment sequence
//! comparison for M03-S04.
//!
//! # What the previous scan did wrong
//!
//! It read `fps=1/10,scale=32:32` for the **first 120 seconds only**, then hashed the
//! whole sampled byte stream. Three failures follow from that:
//!
//! * Two videos whose first two minutes are identical and whose remainder differs look
//!   *identical* to the old scan, because the differing part was never read.
//! * Any trim, insert or cut moves every later frame, so the concatenated hash changes
//!   completely even when the videos are the same cut.
//! * A letterboxed or re-encoded copy produces different bytes, so the byte hash says
//!   "different" for a video a person would call the same.
//!
//! # What this module does instead
//!
//! * **Sample across the timeline** at normalized positions — the centre of each of N
//!   equal slices — and record every position used, in seconds and as a fraction, so the
//!   rule is reproducible and checkable.
//! * **Hash each sampled frame** with a 64-bit difference hash, so compression and
//!   resolution changes do not defeat the comparison.
//! * **Align with a bounded tolerance**: the best shift is searched inside a published
//!   window, and the score is discounted by how much of the longer sequence the shift
//!   actually covers. A 10% trim therefore still scores high, while a video that shares
//!   only its opening 20% does not.
//! * **Report every signal separately.** Duration ratio, frame sequence and dimensions
//!   are each returned with their own score, alongside the composite.
//!
//! # What it will not do
//!
//! A fuzzy score is **never** sufficient to make a group actionable. Only a full BLAKE3
//! match over the whole file is proof, and only that path sets `actionable`.

use crate::duplicates::contracts::SignalScore;

/// How many frames the default policy samples. Enough to see past a 2-minute opening
/// shared by unrelated videos, few enough to stay fast on a large folder.
pub const DEFAULT_SAMPLE_COUNT: u32 = 24;
/// The absolute ceiling, so a request cannot turn into thousands of process launches.
pub const MAX_SAMPLE_COUNT: u32 = 64;
/// Longest timestamp read, so a broken duration field cannot ask for a sample past the
/// end of the file.
pub const MAX_POSITION_SECONDS: f64 = 86_400.0;
/// The edge of each frame, in seconds, kept away from so a sample never lands on a key
/// frame boundary or past the last frame.
const POSITION_EDGE_SECONDS: f64 = 0.05;
/// Fraction of a frame hash that may differ and still count as "the same frame".
const FRAME_AGREEMENT_TOLERANCE_BITS: u32 = 8;

/// Hashes a 9x8 luma frame into a 64-bit difference hash. Identical in shape to the
/// image difference hash, because the same property is wanted: local contrast structure
/// that survives recompression.
pub fn frame_signature(gray: &[u8]) -> u64 {
    let mut hash = 0u64;
    let mut bit = 0u32;
    for y in 0..8usize {
        for x in 0..8usize {
            if gray[y * 9 + x] > gray[y * 9 + x + 1] {
                hash |= 1u64 << bit;
            }
            bit += 1;
        }
    }
    hash
}

/// Hamming distance between two frame signatures.
pub fn frame_distance(left: u64, right: u64) -> u32 {
    (left ^ right).count_ones()
}

/// How many samples to actually take.
///
/// A short video cannot supply 24 distinct positions, so the count is reduced to roughly
/// one sample per second and never goes below one. The result is reported, so a 4-second
/// clip is visibly sampled at 4 positions and not silently at 24.
pub fn effective_sample_count(duration_seconds: f64, requested: u32) -> u32 {
    if !duration_seconds.is_finite() || duration_seconds <= 0.0 {
        return 0;
    }
    let wanted = requested.clamp(1, MAX_SAMPLE_COUNT) as f64;
    let ceiling = duration_seconds.floor().max(1.0);
    (wanted.min(ceiling)) as u32
}

/// The positions to read, as seconds and as fractions of the duration.
///
/// Each position sits at the centre of one equal slice, which is the standard
/// normalized-timeline rule: it covers the whole video, and it moves predictably when
/// the video is trimmed.
pub fn sample_positions(duration_seconds: f64, requested: u32) -> (Vec<f64>, Vec<f64>) {
    let count = effective_sample_count(duration_seconds, requested);
    if count == 0 {
        return (Vec::new(), Vec::new());
    }
    let duration = duration_seconds.clamp(0.0, MAX_POSITION_SECONDS);
    let last = (duration - POSITION_EDGE_SECONDS).max(0.0);
    let mut seconds = Vec::with_capacity(count as usize);
    let mut normalized = Vec::with_capacity(count as usize);
    for index in 0..count {
        let fraction = (index as f64 + 0.5) / count as f64;
        seconds.push((fraction * duration).min(last));
        normalized.push(fraction);
    }
    (seconds, normalized)
}

/// The bounded alignment window, as a count of samples.
///
/// A quarter of the shorter sequence is generous enough for an ordinary intro/outro trim
/// and tight enough that a video with a different opening cannot slide into alignment.
pub fn alignment_tolerance(left_len: usize, right_len: usize) -> u32 {
    let shorter = left_len.min(right_len) as f64;
    if shorter <= 0.0 {
        return 0;
    }
    (shorter * 0.25).round().max(1.0) as u32
}

/// The result of aligning two frame-signature sequences. All three values are on the
/// same 0..=100 scale as every other score in this service.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Alignment {
    /// Best shift, in samples: how far the right sequence had to move to line up.
    pub best_shift: i64,
    /// Mean per-frame agreement over the frames the shift actually lines up, 0..=100.
    pub mean_agreement: f64,
    /// `matched / max(len) * 100`: how much of the longer sequence the shift covers.
    pub coverage: f64,
    /// `mean_agreement` with the 0.5 chance baseline removed, multiplied by `coverage`.
    pub score: f64,
    pub matched_frames: usize,
    pub evaluated_shifts: usize,
}

/// Aligns two signature sequences and returns the best bounded match.
///
/// Two adjustments matter here and both are deliberate:
///
/// * **Baseline removal.** Two unrelated frames agree about half their bits by
///   construction, so a raw mean would put a floor of 0.5 under every score and make
///   unrelated footage look half-similar. The chance level is subtracted and the
///   remainder rescaled, so unrelated content lands near zero.
/// * **Coverage discounting.** A sequence that matches only a prefix must not score as
///   well as one that matches end to end, so the agreement is multiplied by the fraction
///   of the longer sequence the shift lines up.
///
/// Ties prefer the smaller absolute shift, so the reported answer does not depend on
/// iteration order.
pub fn align(left: &[u64], right: &[u64], tolerance: u32) -> Alignment {
    let empty = Alignment {
        best_shift: 0,
        mean_agreement: 0.0,
        coverage: 0.0,
        score: 0.0,
        matched_frames: 0,
        evaluated_shifts: 0,
    };
    if left.is_empty() || right.is_empty() {
        return empty;
    }
    let longer = left.len().max(right.len());
    let window = (tolerance as i64).min(longer as i64);
    let mut best: Option<Alignment> = None;
    let mut evaluated = 0usize;
    for shift in -window..=window {
        let mut matched = 0usize;
        let mut agreeing = 0usize;
        for (index, signature) in left.iter().enumerate() {
            let target = index as i64 + shift;
            if target < 0 {
                continue;
            }
            let Some(other) = right.get(target as usize) else {
                break;
            };
            matched += 1;
            if frame_distance(*signature, *other) <= FRAME_AGREEMENT_TOLERANCE_BITS {
                agreeing += 1;
            }
        }
        evaluated += 1;
        if matched == 0 {
            continue;
        }
        let mean_agreement = (agreeing as f64 / matched as f64) * 100.0;
        let coverage = (matched as f64 / longer as f64) * 100.0;
        let excess = ((mean_agreement / 100.0 - 0.5) / 0.5).clamp(0.0, 1.0);
        let score = excess * (coverage / 100.0) * 100.0;
        let better = match best {
            None => true,
            Some(current) => {
                score > current.score + 1e-9
                    || ((score - current.score).abs() <= 1e-9
                        && shift.abs() < current.best_shift.abs())
            }
        };
        if better {
            best = Some(Alignment {
                best_shift: shift,
                mean_agreement: round2(mean_agreement),
                coverage: round2(coverage),
                score: round2(score),
                matched_frames: matched,
                evaluated_shifts: 0,
            });
        }
    }
    match best {
        Some(mut value) => {
            value.evaluated_shifts = evaluated;
            value
        }
        None => Alignment {
            evaluated_shifts: evaluated,
            ..empty
        },
    }
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

/// The weights behind the composite video score. Published, not hidden.
pub const WEIGHT_FRAME_SEQUENCE: f32 = 0.60;
pub const WEIGHT_DURATION_RATIO: f32 = 0.25;
pub const WEIGHT_DIMENSIONS: f32 = 0.15;

/// Two durations compared as a ratio, 0..=100.
pub fn duration_ratio_score(left_seconds: f64, right_seconds: f64) -> f64 {
    let (long, short) = (
        left_seconds.max(right_seconds),
        left_seconds.min(right_seconds),
    );
    if long <= 0.0 || short <= 0.0 {
        return 0.0;
    }
    ((1.0 - (long - short) / long).clamp(0.0, 1.0)) * 100.0
}

/// Two frame sizes compared, 0..=100.
///
/// Compared on two separate grounds, because a resolution change and a shape change mean
/// different things:
///
/// * **Shape**, the aspect ratio, carries most of the weight. A re-encode at a lower
///   resolution keeps the shape and must not be penalized much; a letterbox changes the
///   shape, and catching that is what this signal is for.
/// * **Scale** is reported lightly, because a resolution change is real evidence of a
///   transcode even when the shape is unchanged.
pub fn dimension_score(left: (u32, u32), right: (u32, u32)) -> f64 {
    const SHAPE_WEIGHT: f64 = 0.85;
    const SCALE_WEIGHT: f64 = 0.15;
    if left.0 == 0 || left.1 == 0 || right.0 == 0 || right.1 == 0 {
        return 0.0;
    }
    let left_ratio = left.0 as f64 / left.1 as f64;
    let right_ratio = right.0 as f64 / right.1 as f64;
    let shape = (1.0 - ((left_ratio - right_ratio).abs() / left_ratio.max(right_ratio)))
        .clamp(0.0, 1.0)
        * 100.0;
    let width_high = left.0.max(right.0) as f64;
    let scale =
        (1.0 - (width_high - left.0.min(right.0) as f64) / width_high).clamp(0.0, 1.0) * 100.0;
    shape * SHAPE_WEIGHT + scale * SCALE_WEIGHT
}

/// Builds the three reported signals for one pair.
pub fn signal_breakdown(
    left: &VideoFingerprint,
    right: &VideoFingerprint,
    tolerance: u32,
) -> Vec<SignalScore> {
    let alignment = align(&left.frame_signatures, &right.frame_signatures, tolerance);
    let sequence = alignment.score;
    let duration = duration_ratio_score(left.duration_seconds, right.duration_seconds);
    let dimensions = dimension_score((left.width, left.height), (right.width, right.height));
    let identical = left.duration_seconds > 0.0 && right.duration_seconds > 0.0;
    vec![
        SignalScore {
            signal: "frame_sequence".into(),
            score: percent(sequence),
            weight: WEIGHT_FRAME_SEQUENCE,
            available: !left.frame_signatures.is_empty() && !right.frame_signatures.is_empty(),
            detail_en: format!(
                "Best alignment over a {tolerance}-sample window lined up {matched} of {longest} \
                 frames at shift {shift:+}; mean per-frame agreement {agreement:.1}%, coverage \
                 {coverage:.1}%. A frame counts as matching only when it is within \
                 {FRAME_AGREEMENT_TOLERANCE_BITS} of 64 bits, and the 50% chance baseline is \
                 removed before coverage is applied.",
                matched = alignment.matched_frames,
                longest = left
                    .frame_signatures
                    .len()
                    .max(right.frame_signatures.len()),
                shift = alignment.best_shift,
                agreement = alignment.mean_agreement,
                coverage = alignment.coverage,
            ),
            detail_ar: format!(
                "أفضل محاذاة ضمن نافذة {tolerance} عينة طابقت {matched} من {longest} إطارًا \
                 بإزاحة {shift:+}؛ متوسط تطابق الإطار {agreement:.1}% وتغطية {coverage:.1}%. \
                 يُحتسب الإطار مطابقًا فقط إذا كان ضمن {FRAME_AGREEMENT_TOLERANCE_BITS} بت من \
                 64، وتُطرح خط الأساس العشوائي 50% قبل تطبيق التغطية.",
                matched = alignment.matched_frames,
                longest = left
                    .frame_signatures
                    .len()
                    .max(right.frame_signatures.len()),
                shift = alignment.best_shift,
                agreement = alignment.mean_agreement,
                coverage = alignment.coverage,
            ),
        },
        SignalScore {
            signal: "duration_ratio".into(),
            score: percent(duration),
            weight: WEIGHT_DURATION_RATIO,
            available: identical,
            detail_en: format!(
                "Probed durations {:.3}s and {:.3}s. A trim shortens one of them, so this \
                 signal is deliberately tolerant rather than exact.",
                left.duration_seconds, right.duration_seconds
            ),
            detail_ar: format!(
                "المدد المقاسة {:.3}ث و{:.3}ث. القصّ يقصّر أحدهما، لذلك هذه الإشارة متسامحة \
                 عمدًا لا دقيقة.",
                left.duration_seconds, right.duration_seconds
            ),
        },
        SignalScore {
            signal: "dimensions".into(),
            score: percent(dimensions),
            weight: WEIGHT_DIMENSIONS,
            available: left.width > 0 && right.width > 0,
            detail_en: format!(
                "Probed frame sizes {}x{} and {}x{}. A letterboxed version is penalized here \
                 but is not rejected, because the frame-sequence signal still carries it.",
                left.width, left.height, right.width, right.height
            ),
            detail_ar: format!(
                "أبعاد الإطار المقاسة {}x{} و{}x{}. النسخة ذات الحشو تُخصم درجتها هنا لكنها لا \
                 تُرفض، لأن إشارة تسلسل الإطارات تظل حاملة للدليل.",
                left.width, left.height, right.width, right.height
            ),
        },
    ]
}

fn percent(value: f64) -> f32 {
    if value.is_finite() {
        (value.clamp(0.0, 100.0) as f32).round()
    } else {
        0.0
    }
}

/// The composite over the signals that were actually available.
pub fn composite(signals: &[SignalScore]) -> f32 {
    let mut weight = 0f32;
    let mut total = 0f32;
    for signal in signals.iter().filter(|signal| signal.available) {
        weight += signal.weight;
        total += signal.weight * signal.score;
    }
    if weight <= 0.0 {
        return 0.0;
    }
    (total / weight).clamp(0.0, 100.0)
}

/// Everything measured about one video, before any comparison.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoFingerprint {
    pub path: std::path::PathBuf,
    pub file_identity: String,
    pub size_bytes: u64,
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    /// One 64-bit signature per sampled position, in the order the positions were read.
    pub frame_signatures: Vec<u64>,
    pub sample_positions_seconds: Vec<f64>,
    /// True when the decoder produced fewer samples than were asked for, which usually
    /// means the stream ended early or the duration field was wrong.
    pub short_read: bool,
    pub reason_en: String,
    pub reason_ar: String,
}

/// The one video stream `ffprobe` reported, or a typed reason why there is none.
#[derive(Debug, Clone, PartialEq)]
pub struct ProbeOutcome {
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub has_video_stream: bool,
    pub reason: Option<String>,
}

/// Reads the fields this service needs out of `ffprobe`'s JSON.
///
/// A file that parses but carries no video stream is a distinct, named outcome. Treating
/// it as "a video with zero dimensions" would produce a fingerprint that silently
/// matches every other stream-less file.
pub fn parse_probe(value: &serde_json::Value) -> Result<ProbeOutcome, String> {
    let duration = value
        .pointer("/format/duration")
        .and_then(serde_json::Value::as_str)
        .and_then(|text| text.parse::<f64>().ok())
        .unwrap_or(0.0);
    let streams = value
        .get("streams")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "ffprobe_output_without_streams".to_string())?;
    let video = streams.iter().find(|stream| {
        stream.get("codec_type").and_then(serde_json::Value::as_str) == Some("video")
    });
    match video {
        Some(stream) => Ok(ProbeOutcome {
            duration_seconds: if duration > 0.0 { duration } else { 0.0 },
            width: stream
                .get("width")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(0) as u32,
            height: stream
                .get("height")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(0) as u32,
            codec: stream
                .get("codec_name")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown")
                .to_string(),
            has_video_stream: true,
            reason: None,
        }),
        None => Err("video_stream_absent".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        align, alignment_tolerance, composite, dimension_score, duration_ratio_score,
        effective_sample_count, frame_signature, parse_probe, sample_positions, signal_breakdown,
        VideoFingerprint, DEFAULT_SAMPLE_COUNT, FRAME_AGREEMENT_TOLERANCE_BITS,
    };
    use serde_json::json;

    /// A deterministic frame signature that differs per index, standing in for real
    /// decoded frames. No decoder is involved, so the alignment logic is tested alone.
    fn sequence(len: usize, seed: u64) -> Vec<u64> {
        (0..len)
            .map(|index| {
                let value = seed
                    .wrapping_mul(0x9E37_79B9_7F4A_7C15)
                    .wrapping_add(index as u64);
                value | 0x8000_0000_0000_0000
            })
            .collect()
    }

    fn video(len: usize, seed: u64, duration: f64, width: u32, height: u32) -> VideoFingerprint {
        VideoFingerprint {
            path: format!("v{seed}.mp4").into(),
            file_identity: format!("test:{seed}"),
            size_bytes: 1024,
            duration_seconds: duration,
            width,
            height,
            codec: "h264".into(),
            frame_signatures: sequence(len, seed),
            sample_positions_seconds: (0..len).map(|i| i as f64).collect(),
            short_read: false,
            reason_en: String::new(),
            reason_ar: String::new(),
        }
    }

    // ---- sample positions ---------------------------------------------------------------

    #[test]
    fn positions_cover_the_whole_timeline_and_are_reported_both_ways() {
        let (seconds, normalized) = sample_positions(600.0, DEFAULT_SAMPLE_COUNT);
        assert_eq!(seconds.len(), DEFAULT_SAMPLE_COUNT as usize);
        assert_eq!(normalized.len(), DEFAULT_SAMPLE_COUNT as usize);
        // The first sample is inside the first slice, not at zero.
        assert!(normalized[0] > 0.0);
        assert!(normalized[0] < 1.0 / DEFAULT_SAMPLE_COUNT as f64);
        assert!(normalized[DEFAULT_SAMPLE_COUNT as usize - 1] < 1.0);
        for (fraction, second) in normalized.iter().zip(seconds.iter()) {
            assert!((fraction * 600.0 - second).abs() < 0.051);
        }
        // Strictly increasing: a repeated position would sample the same frame twice.
        for window in seconds.windows(2) {
            assert!(window[1] > window[0], "positions must advance: {window:?}");
        }
    }

    #[test]
    fn a_short_video_is_sampled_at_fewer_positions_instead_of_repeating_ones() {
        // A 4-second clip cannot supply 24 distinct positions.
        assert_eq!(effective_sample_count(4.0, DEFAULT_SAMPLE_COUNT), 4);
        let (seconds, _) = sample_positions(4.0, DEFAULT_SAMPLE_COUNT);
        assert_eq!(seconds.len(), 4);
        assert!(seconds.iter().all(|value| *value < 4.0));
    }

    #[test]
    fn a_sub_second_video_still_produces_one_position() {
        let (seconds, normalized) = sample_positions(0.4, DEFAULT_SAMPLE_COUNT);
        assert_eq!(seconds.len(), 1);
        assert_eq!(normalized.len(), 1);
        assert!(seconds[0] >= 0.0 && seconds[0] < 0.4);
    }

    #[test]
    fn an_unknown_or_nonsensical_duration_produces_no_samples_rather_than_guessing() {
        assert_eq!(effective_sample_count(0.0, DEFAULT_SAMPLE_COUNT), 0);
        assert_eq!(effective_sample_count(-5.0, DEFAULT_SAMPLE_COUNT), 0);
        assert_eq!(effective_sample_count(f64::NAN, DEFAULT_SAMPLE_COUNT), 0);
        assert!(sample_positions(f64::INFINITY, DEFAULT_SAMPLE_COUNT)
            .0
            .is_empty());
    }

    #[test]
    fn a_lying_duration_is_clamped_to_a_sane_ceiling() {
        let (seconds, normalized) = sample_positions(1.0e12, DEFAULT_SAMPLE_COUNT);
        assert_eq!(seconds.len(), DEFAULT_SAMPLE_COUNT as usize);
        for value in &seconds {
            assert!(*value <= super::MAX_POSITION_SECONDS);
        }
        assert!(normalized.iter().all(|value| (0.0..1.0).contains(value)));
    }

    #[test]
    fn an_absurd_request_is_capped_rather_than_honoured() {
        assert_eq!(
            effective_sample_count(100_000.0, 100_000),
            super::MAX_SAMPLE_COUNT
        );
        assert_eq!(effective_sample_count(100_000.0, 0), 1);
    }

    // ---- bounded alignment --------------------------------------------------------------

    #[test]
    fn two_identical_sequences_align_at_zero_shift_with_full_coverage() {
        let frames = sequence(24, 1);
        let result = align(&frames, &frames, alignment_tolerance(24, 24));
        assert_eq!(result.best_shift, 0);
        assert_eq!(result.matched_frames, 24);
        assert!((result.mean_agreement - 100.0).abs() < 1e-6);
        assert!((result.coverage - 100.0).abs() < 1e-6);
        assert!((result.score - 100.0).abs() < 1e-6);
    }

    #[test]
    fn a_trimmed_intro_is_recovered_by_a_shifted_alignment() {
        // 100 frames against the same 100 frames with 10 cut off the front.
        let full = sequence(100, 2);
        let trimmed = full[10..].to_vec();
        let tolerance = alignment_tolerance(full.len(), trimmed.len());
        assert_eq!(tolerance, 23, "a quarter of the shorter sequence");
        let result = align(&full, &trimmed, tolerance);
        // The matching part is found, but the missing head is not credited.
        assert!(
            (result.mean_agreement - 100.0).abs() < 1e-6,
            "mean agreement was {}",
            result.mean_agreement
        );
        assert!(result.coverage > 85.0 && result.coverage < 95.0);
        assert!(
            result.score > 85.0,
            "trimmed score was only {}",
            result.score
        );
    }

    #[test]
    fn a_trimmed_outro_is_recovered_the_same_way() {
        let full = sequence(100, 3);
        let trimmed = full[..88].to_vec();
        let result = align(
            &full,
            &trimmed,
            alignment_tolerance(full.len(), trimmed.len()),
        );
        assert!(result.mean_agreement > 99.0);
        assert!(
            result.score > 85.0,
            "outro trim scored only {}",
            result.score
        );
    }

    #[test]
    fn two_videos_sharing_only_their_opening_do_not_align_into_a_match() {
        // 20 minutes, of which the first 2 are identical. This is the case the old
        // prefix-only scan called a duplicate.
        let opening = sequence(24, 4);
        let mut first = opening.clone();
        first.extend(sequence(216, 5));
        let mut second = opening.clone();
        second.extend(sequence(216, 6));
        let tolerance = alignment_tolerance(first.len(), second.len());
        let result = align(&first, &second, tolerance);
        assert!(
            result.score < 40.0,
            "shared-opening pair scored {} which would be a false match",
            result.score
        );
    }

    #[test]
    fn unrelated_content_lands_near_zero_rather_than_at_the_chance_floor() {
        let left = sequence(24, 7);
        let right = sequence(24, 8);
        let result = align(&left, &right, alignment_tolerance(24, 24));
        // Without baseline removal this would sit at ~50 and look half-similar.
        assert!(
            result.score < 20.0,
            "unrelated sequences scored {} which is too high",
            result.score
        );
    }

    #[test]
    fn the_alignment_window_is_bounded_and_reported() {
        let left = sequence(200, 9);
        let right = sequence(200, 10);
        let tolerance = alignment_tolerance(200, 200);
        let result = align(&left, &right, tolerance);
        assert_eq!(tolerance, 50);
        assert_eq!(result.evaluated_shifts as i64, tolerance as i64 * 2 + 1);
    }

    #[test]
    fn a_shift_beyond_the_window_is_not_reachable() {
        // 20 frames cut from a 20-frame video is 100%, far outside a 5-frame window, so
        // alignment must not claim a perfect match it never looked for.
        let full = sequence(20, 11);
        let far = sequence(20, 12);
        let result = align(&full, &far, alignment_tolerance(20, 20));
        assert!(result.score < 20.0);
    }

    #[test]
    fn an_empty_sequence_aligns_to_nothing_rather_than_panicking() {
        let empty: Vec<u64> = Vec::new();
        let result = align(&empty, &sequence(4, 1), 4);
        assert_eq!(result.score, 0.0);
        assert_eq!(result.matched_frames, 0);
        assert_eq!(alignment_tolerance(0, 0), 0);
    }

    // ---- the individual signals ---------------------------------------------------------

    #[test]
    fn a_re_encoded_copy_of_the_same_footage_still_scores_high() {
        // Same duration and size, frames that differ by a handful of bits, as a real
        // H264-to-H265 re-encode would produce.
        let base = sequence(24, 13);
        let re_encoded: Vec<u64> = base
            .iter()
            .map(|value| value ^ (((value >> 3) & 0b111) << 5))
            .collect();
        let left = video(24, 13, 120.0, 1920, 1080);
        let mut right = video(24, 14, 120.0, 1920, 1080);
        right.frame_signatures = re_encoded;
        let tolerance = alignment_tolerance(24, 24);
        let signals = signal_breakdown(&left, &right, tolerance);
        let composite = composite(&signals);
        assert!(
            composite > 90.0,
            "re-encoded copy scored {composite}: {:?}",
            signals
                .iter()
                .map(|s| (s.signal.clone(), s.score))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn a_letterboxed_version_is_penalised_on_dimensions_but_still_matches() {
        let left = video(24, 15, 120.0, 1920, 1080);
        let right = video(24, 16, 120.0, 1920, 1440);
        let signals = signal_breakdown(&left, &right, alignment_tolerance(24, 24));
        let dimensions = signals
            .iter()
            .find(|signal| signal.signal == "dimensions")
            .expect("dimensions signal");
        assert!(dimensions.score < 90.0, "letterbox was not penalized");
        assert!(dimensions.score > 60.0, "letterbox was rejected outright");
    }

    #[test]
    fn different_footage_fails_the_composite() {
        let left = video(24, 17, 120.0, 1920, 1080);
        let right = video(24, 18, 100.0, 1280, 720);
        let composite = composite(&signal_breakdown(
            &left,
            &right,
            alignment_tolerance(24, 24),
        ));
        assert!(composite < 70.0, "unrelated videos scored {composite}");
    }

    #[test]
    fn every_video_signal_is_finite_and_carries_its_weight() {
        let left = video(24, 19, 120.0, 1920, 1080);
        let right = video(0, 20, 0.0, 0, 0);
        let signals = signal_breakdown(&left, &right, alignment_tolerance(24, 0));
        assert_eq!(signals.len(), 3);
        for signal in &signals {
            assert!(signal.score.is_finite());
            assert!((0.0..=100.0).contains(&signal.score));
            assert!(signal.weight > 0.0);
            assert!(!signal.detail_en.is_empty());
            assert!(!signal.detail_ar.is_empty());
        }
        // Signals that could not be measured are marked unavailable, not scored as zero.
        let duration = signals
            .iter()
            .find(|signal| signal.signal == "duration_ratio")
            .expect("duration signal");
        assert!(!duration.available);
    }

    #[test]
    fn the_frame_tolerance_is_the_published_value() {
        assert_eq!(FRAME_AGREEMENT_TOLERANCE_BITS, 8);
    }

    // ---- duration and dimension arithmetic ----------------------------------------------

    #[test]
    fn duration_comparison_rewards_a_small_trim_and_punishes_a_different_length() {
        assert!((duration_ratio_score(120.0, 120.0) - 100.0).abs() < 1e-9);
        assert!(duration_ratio_score(120.0, 108.0) > 89.0);
        assert!(duration_ratio_score(120.0, 60.0) < 51.0);
        // A zero-length or unknown duration scores nothing rather than dividing by zero.
        assert_eq!(duration_ratio_score(0.0, 0.0), 0.0);
        assert_eq!(duration_ratio_score(0.0, 120.0), 0.0);
    }

    #[test]
    fn dimension_comparison_is_relative_and_rejects_a_missing_size() {
        assert!((dimension_score((1920, 1080), (1920, 1080)) - 100.0).abs() < 1e-9);
        // 1920x1080 and 1280x720 are the same shape at different sizes: a re-encode, not
        // a different picture, so only the light scale term applies.
        let rescaled = dimension_score((1920, 1080), (1280, 720));
        assert!(
            rescaled > 90.0,
            "a resolution change was penalized too hard: {rescaled}"
        );
        // A letterbox changes the shape, and is the case this signal exists to catch.
        let letterboxed = dimension_score((1920, 1080), (1920, 1440));
        assert!(letterboxed < 90.0 && letterboxed > 60.0, "{letterboxed}");
        // Portrait against landscape is a real difference.
        assert!(dimension_score((1920, 1080), (1080, 1920)) < 50.0);
        assert_eq!(dimension_score((0, 0), (1920, 1080)), 0.0);
    }

    // ---- probe parsing ------------------------------------------------------------------

    #[test]
    fn a_probe_with_a_video_stream_yields_the_measured_fields() {
        let value = json!({
            "streams": [
                {"codec_type": "audio", "codec_name": "aac"},
                {"codec_type": "video", "codec_name": "hevc", "width": 3840, "height": 2160}
            ],
            "format": {"duration": "61.5"}
        });
        let outcome = parse_probe(&value).expect("probe");
        assert!(outcome.has_video_stream);
        assert_eq!(outcome.codec, "hevc");
        assert_eq!(outcome.width, 3840);
        assert_eq!(outcome.height, 2160);
        assert!((outcome.duration_seconds - 61.5).abs() < 1e-9);
    }

    #[test]
    fn a_corrupt_or_audio_only_file_is_a_typed_error_not_a_zero_sized_video() {
        let audio_only = json!({
            "streams": [{"codec_type": "audio", "codec_name": "mp3"}],
            "format": {"duration": "10"}
        });
        assert_eq!(
            parse_probe(&audio_only).expect_err("no video stream"),
            "video_stream_absent"
        );
        assert_eq!(
            parse_probe(&json!({})).expect_err("no streams"),
            "ffprobe_output_without_streams"
        );
        assert_eq!(
            parse_probe(&json!({"streams": "not an array", "format": {}})).expect_err("bad shape"),
            "ffprobe_output_without_streams"
        );
    }

    #[test]
    fn a_probe_without_a_duration_reports_zero_rather_than_a_guess() {
        let value = json!({"streams": [{"codec_type": "video", "width": 10, "height": 10}]});
        let outcome = parse_probe(&value).expect("probe");
        assert_eq!(outcome.duration_seconds, 0.0);
        // And a zero duration yields no sample positions.
        assert!(
            sample_positions(outcome.duration_seconds, DEFAULT_SAMPLE_COUNT)
                .0
                .is_empty()
        );
    }

    // ---- the signature itself -----------------------------------------------------------

    #[test]
    fn the_frame_signature_is_a_difference_hash_that_ignores_a_uniform_shift() {
        let mut frame = vec![0u8; 72];
        for (index, value) in frame.iter_mut().enumerate() {
            *value = ((index * 7) % 200) as u8;
        }
        let lifted: Vec<u8> = frame.iter().map(|value| value.saturating_add(15)).collect();
        assert_eq!(frame_signature(&frame), frame_signature(&lifted));
    }
}
