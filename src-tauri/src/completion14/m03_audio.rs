//! Offset-tolerant acoustic fingerprinting for M03-S05.
//!
//! # Why not Chromaprint
//!
//! The closure specification permits "Chromaprint-style fingerprints **or an equivalent
//! permissive backend**", and explicitly says not to adopt a dependency whose licensing
//! cannot be confirmed. Chromaprint is a C library behind a native binding; shipping it
//! would mean a build-time dependency this repository cannot verify offline. So the
//! fingerprint below is implemented here, in-process, from decoded samples — and the
//! result says so by name, in `AudioScanEvidence::backend`.
//!
//! It is a *band-energy* fingerprint: each analysis frame is reduced to 24 logarithmic
//! band levels, each level is expressed as a deviation from that frame's own mean (which
//! is what makes it gain-invariant), and the deviation is quantized to one nibble. Two
//! recordings are compared by searching a bounded range of frame offsets and scoring the
//! best one, discounted by how much of the longer signal the offset covers.
//!
//! Magnitude spectra are used rather than the time-domain signal, which is what makes
//! the fingerprint tolerant of a sub-frame timing difference: a 16 ms shift barely moves a
//! band's energy even though it moves the samples a great deal.
//!
//! # What it is, stated plainly
//!
//! * It detects **near-duplicate audio** — the same recording at another bitrate, another
//!   codec, another tag, another gain, with silence added at one end.
//! * It is **not** a commercial-recognition fingerprint. It does not identify which
//!   recording a file is, and it makes no claim to.
//! * It has no sub-fingerprint shingling or error correction, so it is more brittle to
//!   heavy editing than Chromaprint would be. That is a real limitation and it is
//!   reported in `limitations_en` / `limitations_ar` on every result.
//! * It needs decoded samples, so decoding still requires `ffmpeg`. When that is absent
//!   the service says so; it never falls back to comparing tags.

use crate::duplicates::contracts::SignalScore;
use serde::{Deserialize, Serialize};

/// Everything is decoded to this rate. 8 kHz keeps the full telephony band, which is
/// where a recording's identity lives, at a quarter of CD-rate cost.
pub const SAMPLE_RATE_HZ: u32 = 8_000;
/// Mono, so a stereo file and its mono downmix are comparable.
pub const CHANNELS: u32 = 1;
/// Analysis window. 1024 samples at 8 kHz is 128 ms.
pub const WINDOW_SAMPLES: usize = 1024;
/// Hop between frames. 512 samples is 64 ms, a 50% overlap.
pub const HOP_SAMPLES: usize = 512;
/// Logarithmically spaced bands, 100 Hz to 3 800 Hz.
pub const BAND_COUNT: usize = 24;
pub const BAND_LOW_HZ: u32 = 100;
pub const BAND_HIGH_HZ: u32 = 3_800;
/// Largest relative offset the comparison will search, as a fraction of the shorter
/// fingerprint. At 0.25 and 64 ms per frame, a five-minute recording tolerates about
/// 19 seconds of inserted or removed material at either end.
pub const MAX_OFFSET_FRACTION: f64 = 0.25;
/// Leading and trailing probes quieter than this fraction of the loudest probe are
/// treated as silence and trimmed. At 0.02 that is roughly 34 dB down.
pub const SILENCE_TRIM_FRACTION: f32 = 0.02;
/// The probe used to find the silence boundary: short, so the reported boundary is
/// accurate to one probe rather than to a whole 128 ms window.
const SILENCE_PROBE_SAMPLES: usize = 64;
/// Longest stretch of audio decoded from one file.
pub const MAX_DECODE_SECONDS: u32 = 900;
/// The weights behind the composite acoustic score. Published, not hidden.
pub const WEIGHT_ACOUSTIC: f32 = 0.75;
pub const WEIGHT_DURATION_RATIO: f32 = 0.25;
/// How many decibels a band may deviate from the frame mean before it saturates.
const BAND_DEVIATION_DB_RANGE: f32 = 6.0;
/// A band below this absolute energy reads as zero, so the numerical floor of silence
/// cannot become a fingerprint in its own right.
const BAND_FLOOR: f32 = 1.0e-9;
/// Worst mean band distance that still counts as a full-strength match: a third of the
/// 0..15 nibble scale. Beyond that the score falls off, so "nearly the same" stays
/// distinguishable from "the same".
const MATCH_DISTANCE_LIMIT: f64 = 1.0 / 3.0;

/// One analysed frame: 24 band levels, each 0..=15, expressed relative to the frame's
/// own mean level. Equal-length vectors are compared directly.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Frame {
    pub bands: [u8; BAND_COUNT],
}

impl Frame {
    /// Mean absolute difference against another frame, 0..=360.
    pub fn distance(&self, other: &Self) -> u32 {
        self.bands
            .iter()
            .zip(other.bands.iter())
            .map(|(a, b)| a.abs_diff(*b) as u32)
            .sum()
    }
}

/// The bin index of each band edge, derived from the window size and the sample rate.
/// Kept as a pure function so the layout is testable without decoding anything.
pub fn band_edges(window_samples: usize, sample_rate_hz: u32) -> Vec<u32> {
    let half = (window_samples / 2) as i64;
    let nyquist = (sample_rate_hz / 2) as f32;
    let high = (BAND_HIGH_HZ as f32).min(nyquist);
    let low = (BAND_LOW_HZ as f32).min(high);
    let mut edges = Vec::with_capacity(BAND_COUNT + 1);
    for index in 0..=BAND_COUNT {
        let fraction = index as f32 / BAND_COUNT as f32;
        // Logarithmic spacing: pitch is perceived logarithmically, and a linear layout
        // would put almost every band above 2 kHz, where a duplicate still matches but a
        // resample of one moves it a great deal.
        let hz = low * (high / low).powf(fraction);
        let bin = ((hz / sample_rate_hz as f32) * window_samples as f32).round();
        edges.push((bin as i64).clamp(0, half) as u32);
    }
    // Guarantee every band spans at least one bin, otherwise a band would read zero
    // forever and the fingerprint would carry a dead column.
    for index in 1..edges.len() {
        if edges[index] <= edges[index - 1] {
            edges[index] = (edges[index - 1] + 1).min(half as u32);
        }
    }
    edges
}

/// In-place iterative radix-2 Cooley–Tukey FFT over interleaved real/imaginary pairs.
///
/// `values` must have a power-of-two length. Implemented here rather than pulled in as a
/// dependency so the acoustic backend stays in-process and readable. A length that is not
/// a power of two is left untouched rather than producing nonsense.
pub fn fft_in_place(values: &mut [(f64, f64)]) {
    let length = values.len();
    if length < 2 || !length.is_power_of_two() {
        return;
    }
    // Bit-reversal permutation.
    let mut target = 0usize;
    for index in 1..length {
        let mut bit = length >> 1;
        while target & bit != 0 {
            target ^= bit;
            bit >>= 1;
        }
        target |= bit;
        if index < target {
            values.swap(index, target);
        }
    }
    let mut size = 2usize;
    while size <= length {
        let angle = -2.0 * std::f64::consts::PI / size as f64;
        let (step_real, step_imag) = (angle.cos(), angle.sin());
        for chunk in values.chunks_exact_mut(size) {
            let mut factor_real = 1.0f64;
            let mut factor_imag = 0.0f64;
            for offset in 0..size / 2 {
                let (even_real, even_imag) = chunk[offset];
                let (odd_real, odd_imag) = chunk[offset + size / 2];
                let product_real = odd_real * factor_real - odd_imag * factor_imag;
                let product_imag = odd_real * factor_imag + odd_imag * factor_real;
                chunk[offset] = (even_real + product_real, even_imag + product_imag);
                chunk[offset + size / 2] = (even_real - product_real, even_imag - product_imag);
                let next_real = factor_real * step_real - factor_imag * step_imag;
                factor_imag = factor_real * step_imag + factor_imag * step_real;
                factor_real = next_real;
            }
        }
        size <<= 1;
    }
}

/// The Hann window, applied so the frame edges do not leak energy into the bands.
fn hann(length: usize) -> Vec<f64> {
    (0..length)
        .map(|index| {
            let phase = 2.0 * std::f64::consts::PI * index as f64 / length as f64;
            0.5 - 0.5 * phase.cos()
        })
        .collect()
}

/// Reduces one full window of mono samples to a `Frame`.
///
/// The band levels are stored as a deviation from the frame's **own** mean, which is what
/// cancels a gain change: multiplying every sample by a constant shifts every band by the
/// same number of decibels, and the shift disappears in the subtraction.
pub fn analyze_frame(samples: &[f32]) -> Frame {
    let mut bands = [0u8; BAND_COUNT];
    if samples.len() < WINDOW_SAMPLES {
        return Frame { bands };
    }
    let window = hann(WINDOW_SAMPLES);
    let mut buffer: Vec<(f64, f64)> = window
        .iter()
        .zip(samples.iter().take(WINDOW_SAMPLES))
        .map(|(weight, sample)| (*sample as f64 * weight, 0.0))
        .collect();
    fft_in_place(&mut buffer);

    let edges = band_edges(WINDOW_SAMPLES, SAMPLE_RATE_HZ);
    let mut decibels = [0f32; BAND_COUNT];
    for (level, span) in decibels.iter_mut().zip(edges.windows(2)) {
        let slice = &buffer[span[0] as usize..span[1] as usize];
        let energy: f64 = slice
            .iter()
            .map(|(real, imag)| real * real + imag * imag)
            .sum();
        let scaled = ((energy / WINDOW_SAMPLES as f64) as f32).max(BAND_FLOOR);
        *level = 10.0 * scaled.log10();
    }
    let mean = decibels.iter().sum::<f32>() / BAND_COUNT as f32;
    for band in 0..BAND_COUNT {
        let deviation = (decibels[band] - mean) / BAND_DEVIATION_DB_RANGE;
        bands[band] = ((deviation + 1.0) * 7.5).round().clamp(0.0, 15.0) as u8;
    }
    Frame { bands }
}

/// Mean square of a slice. Used for the silence probes.
pub fn frame_energy(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    samples.iter().map(|sample| *sample * *sample).sum::<f32>() / samples.len() as f32
}

/// The loudest-sample level in dBFS, so a silent file is visibly silent.
pub fn peak_dbfs(samples: &[f32]) -> f32 {
    let peak = samples
        .iter()
        .fold(0f32, |highest, sample| highest.max(sample.abs()));
    if peak <= 0.0 {
        return -120.0;
    }
    (20.0 * peak.log10()).clamp(-120.0, 0.0)
}

/// A built fingerprint, with the trimming that was applied recorded alongside it.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AudioFingerprint {
    pub frames: Vec<Frame>,
    pub decoded_duration_seconds: f64,
    pub sample_rate_hz: u32,
    pub channels: u32,
    /// Measured to within one probe (8 ms), not to the sample.
    pub leading_silence_ms: u64,
    pub trailing_silence_ms: u64,
    pub peak_dbfs: f32,
    /// True when decoding stopped at [`MAX_DECODE_SECONDS`], so the rest was never read.
    pub prefix_only: bool,
}

/// The silent margin at each end, and the frames between them.
struct Trimmed {
    frames: Vec<Frame>,
    leading_ms: u64,
    trailing_ms: u64,
}

/// Trims leading and trailing silence, then analyses what is left.
///
/// The boundary is found with a short probe at each hop position rather than a whole
/// window, so a silence that is not hop-aligned still leaves the signal starting at
/// approximately the right place. The residual error is under one hop, and the magnitude
/// spectrum absorbs it — which is why a shifted copy still matches.
fn trim_silence(samples: &[f32]) -> Trimmed {
    let nothing = Trimmed {
        frames: Vec::new(),
        leading_ms: 0,
        trailing_ms: 0,
    };
    if samples.is_empty() {
        return nothing;
    }
    let mut probe_energy: Vec<f32> = Vec::new();
    let mut index = 0usize;
    while index + SILENCE_PROBE_SAMPLES <= samples.len() {
        probe_energy.push(frame_energy(&samples[index..index + SILENCE_PROBE_SAMPLES]));
        index += HOP_SAMPLES;
    }
    let peak = probe_energy.iter().copied().fold(0f32, f32::max);
    if peak <= 0.0 {
        return nothing;
    }
    let threshold = peak * SILENCE_TRIM_FRACTION;
    let first = probe_energy
        .iter()
        .position(|energy| *energy >= threshold)
        .unwrap_or(probe_energy.len());
    let end_hop = probe_energy
        .iter()
        .rposition(|energy| *energy >= threshold)
        .map(|position| position + 1)
        .unwrap_or(first);

    let start_bound = first * HOP_SAMPLES;
    let end_bound = (end_hop * HOP_SAMPLES).min(samples.len());
    let mut frames = Vec::new();
    let mut start = start_bound;
    while start + WINDOW_SAMPLES <= end_bound {
        frames.push(analyze_frame(&samples[start..start + WINDOW_SAMPLES]));
        start += HOP_SAMPLES;
    }
    let leading_ms = (start_bound as f64 / SAMPLE_RATE_HZ as f64 * 1000.0) as u64;
    let trailing_ms = ((samples.len() as f64 - end_bound as f64).max(0.0) / SAMPLE_RATE_HZ as f64
        * 1000.0) as u64;
    Trimmed {
        frames,
        leading_ms,
        trailing_ms,
    }
}

/// Builds a fingerprint from decoded mono samples.
pub fn fingerprint(
    samples: &[f32],
    decoded_duration_seconds: f64,
    prefix_only: bool,
) -> AudioFingerprint {
    let trimmed = trim_silence(samples);
    AudioFingerprint {
        frames: trimmed.frames,
        decoded_duration_seconds,
        sample_rate_hz: SAMPLE_RATE_HZ,
        channels: CHANNELS,
        leading_silence_ms: trimmed.leading_ms,
        trailing_silence_ms: trimmed.trailing_ms,
        peak_dbfs: peak_dbfs(samples),
        prefix_only,
    }
}

/// The best offset match between two fingerprint sequences.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct OffsetMatch {
    /// Best offset in frames: how far the right signal had to move to line up.
    pub best_offset: i64,
    /// Mean per-frame band distance, 0..=1, where 0 is identical.
    pub mean_distance: f64,
    /// `matched / max(len) * 100`: how much of the longer signal the offset covers.
    pub coverage: f64,
    /// 0..=100. A perfect match is 100.
    pub score: f64,
    pub matched_frames: usize,
}

/// The largest relative offset that will be searched, in frames.
pub fn max_offset(left_len: usize, right_len: usize) -> i64 {
    let shorter = left_len.min(right_len) as f64;
    if shorter <= 0.0 {
        return 0;
    }
    ((shorter * MAX_OFFSET_FRACTION).round() as i64).max(1)
}

/// Searches a bounded range of offsets and returns the best match.
///
/// The tolerance is what makes a leading or trailing silence difference, an inserted
/// intro, or a slightly different edit stop being a reason to call two files different.
/// Ties prefer the smaller absolute offset, so the reported answer does not depend on
/// iteration order.
pub fn align_offset_tolerant(left: &[Frame], right: &[Frame]) -> OffsetMatch {
    let none = OffsetMatch {
        best_offset: 0,
        mean_distance: 1.0,
        coverage: 0.0,
        score: 0.0,
        matched_frames: 0,
    };
    if left.is_empty() || right.is_empty() {
        return none;
    }
    let longer = left.len().max(right.len());
    let window = max_offset(left.len(), right.len());
    let worst = (BAND_COUNT * 15) as f64;
    let mut best = none;
    for offset in -window..=window {
        let mut matched = 0usize;
        let mut total = 0u32;
        for (index, frame) in left.iter().enumerate() {
            let target = index as i64 + offset;
            if target < 0 {
                continue;
            }
            let Some(other) = right.get(target as usize) else {
                break;
            };
            matched += 1;
            total += frame.distance(other);
        }
        if matched == 0 {
            continue;
        }
        let mean_distance = (total as f64 / matched as f64) / worst;
        let coverage = matched as f64 / longer as f64;
        let quality = (1.0 - mean_distance / MATCH_DISTANCE_LIMIT).clamp(0.0, 1.0);
        let score = quality * coverage * 100.0;
        let better = score > best.score + 1e-9
            || ((score - best.score).abs() <= 1e-9 && offset.abs() < best.best_offset.abs());
        if better {
            best = OffsetMatch {
                best_offset: offset,
                mean_distance,
                coverage,
                score,
                matched_frames: matched,
            };
        }
    }
    best
}

/// Duration agreement, 0..=100. A trimmed file legitimately differs, so this is a ratio.
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

/// The two reported signals for one pair, with the offset evidence spelled out.
pub fn signal_breakdown(left: &AudioFingerprint, right: &AudioFingerprint) -> Vec<SignalScore> {
    let match_result = align_offset_tolerant(&left.frames, &right.frames);
    let window = max_offset(left.frames.len(), right.frames.len());
    let window_seconds = window as f64 * HOP_SAMPLES as f64 / SAMPLE_RATE_HZ as f64;
    let longest = left.frames.len().max(right.frames.len());
    let duration = duration_ratio_score(
        left.decoded_duration_seconds,
        right.decoded_duration_seconds,
    );
    vec![
        SignalScore {
            signal: "spectral_band_fingerprint".into(),
            score: percent(match_result.score),
            weight: WEIGHT_ACOUSTIC,
            available: !left.frames.is_empty() && !right.frames.is_empty(),
            detail_en: format!(
                "In-process band-energy fingerprint; no external fingerprint library is \
                 involved. The best of a +/-{window}-frame offset search (about \
                 {window_seconds:.1} s) lined up {matched} of {longest} frames at offset \
                 {offset:+}; mean band distance {distance:.4} against a worst case of \
                 {worst}; coverage {coverage:.1}%.",
                matched = match_result.matched_frames,
                offset = match_result.best_offset,
                distance = match_result.mean_distance,
                worst = BAND_COUNT * 15,
                coverage = match_result.coverage * 100.0,
            ),
            detail_ar: format!(
                "بصمة أشرطة طيفية منفَّذة داخل العملية، دون أي مكتبة بصمات خارجية. أفضل نتيجة \
                 ضمن بحث إزاحة +/-{window} إطارًا (نحو {window_seconds:.1} ثانية) طابقت \
                 {matched} من {longest} إطارًا بإزاحة {offset:+}؛ متوسط مسافة الأشرطة \
                 {distance:.4} من أسوأ قيمة {worst}؛ تغطية {coverage:.1}%.",
                matched = match_result.matched_frames,
                offset = match_result.best_offset,
                distance = match_result.mean_distance,
                worst = BAND_COUNT * 15,
                coverage = match_result.coverage * 100.0,
            ),
        },
        SignalScore {
            signal: "decoded_duration_ratio".into(),
            score: percent(duration),
            weight: WEIGHT_DURATION_RATIO,
            available: left.decoded_duration_seconds > 0.0 && right.decoded_duration_seconds > 0.0,
            detail_en: format!(
                "Decoded durations {:.3}s and {:.3}s, converted to {} channel at {} Hz after \
                 trimming {} ms of leading and {} ms of trailing silence.",
                left.decoded_duration_seconds,
                right.decoded_duration_seconds,
                right.channels,
                right.sample_rate_hz,
                left.leading_silence_ms,
                left.trailing_silence_ms,
            ),
            detail_ar: format!(
                "المدد بعد فك الترميز {:.3}ث و{:.3}ث، محولة إلى قناة واحدة عند {} هرتز بعد \
                 إزالة {} مللي ثانية في البداية و{} مللي ثانية في النهاية.",
                left.decoded_duration_seconds,
                right.decoded_duration_seconds,
                right.sample_rate_hz,
                left.leading_silence_ms,
                left.trailing_silence_ms,
            ),
        },
    ]
}

/// Clamps to a finite 0..=100 percentage, rounded to one decimal so a reported score is
/// stable. The input is already on that scale, so nothing is rescaled here.
fn percent(value: f64) -> f32 {
    if value.is_finite() {
        ((value.clamp(0.0, 100.0) * 10.0).round() / 10.0) as f32
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

/// The exact identifier this backend is, and the honest sentence about it.
pub const BACKEND_ID: &str = "in_process_spectral_band_fingerprint_v1";
pub const BACKEND_KIND: &str = "in_process";
pub const BACKEND_LIMITATION_EN: &str =
    "This is a band-energy fingerprint implemented in this process, not Chromaprint. It is a \
     near-duplicate signal only: it does not identify a recording, it has no shingling or error \
     correction, and heavy editing or a large lowpass change can defeat it. A high score means \
     \"these two look like the same audio\", never \"this is the same master\".";
pub const BACKEND_LIMITATION_AR: &str =
    "هذه بصمة أشرطة طيفية منفَّذة داخل هذه العملية وليست Chromaprint. هي إشارة تشابه قريب فقط: \
     لا تُحدِّد التسجيل، ولا تتضمن تقطيعًا أو تصحيح أخطاء، وقد يفشل أمام تحرير كبير أو ترشيح \
     شديد. الدرجة العالية تعني أن الصوتين يبدوان متشابهين، ولا تعني أنهما الملف الأصلي نفسه.";

#[cfg(test)]
mod tests {
    use super::{
        align_offset_tolerant, analyze_frame, band_edges, composite, duration_ratio_score,
        fft_in_place, fingerprint, frame_energy, max_offset, peak_dbfs, signal_breakdown,
        AudioFingerprint, Frame, BACKEND_ID, BACKEND_KIND, BACKEND_LIMITATION_AR,
        BACKEND_LIMITATION_EN, BAND_COUNT, HOP_SAMPLES, SAMPLE_RATE_HZ, WINDOW_SAMPLES,
    };

    /// A tone stack plus a deterministic dither, so the spectral shape is stable and
    /// distinctive. Built here rather than shipped as a fixture so the test states
    /// exactly what signal it is testing.
    fn tones(seconds: usize, frequencies: &[(f32, f32)], seed: u32) -> Vec<f32> {
        let length = seconds * SAMPLE_RATE_HZ as usize;
        (0..length)
            .map(|index| {
                let t = index as f32 / SAMPLE_RATE_HZ as f32;
                let body: f32 = frequencies
                    .iter()
                    .map(|(frequency, amplitude)| {
                        (2.0 * std::f32::consts::PI * frequency * t).sin() * amplitude
                    })
                    .sum();
                let dither = ((index as u32)
                    .wrapping_mul(2_654_435_761)
                    .wrapping_add(seed)
                    % 97) as f32
                    / 97.0
                    - 0.5;
                body * 0.2 + dither * 0.02
            })
            .collect()
    }

    fn song_a(seconds: usize) -> Vec<f32> {
        tones(seconds, &[(440.0, 1.0), (660.0, 0.6), (220.0, 0.4)], 1)
    }

    fn song_b(seconds: usize) -> Vec<f32> {
        // Same length and a comparable amplitude envelope, a different spectrum.
        tones(seconds, &[(330.0, 0.8), (1_480.0, 0.5), (110.0, 0.7)], 2)
    }

    fn audio(samples: &[f32], seconds: f64) -> AudioFingerprint {
        fingerprint(samples, seconds, false)
    }

    // ---- the FFT ------------------------------------------------------------------------

    #[test]
    fn the_fft_of_a_pure_tone_peaks_at_that_tone() {
        let mut buffer: Vec<(f64, f64)> = (0..1024)
            .map(|index| {
                let phase = 2.0 * std::f64::consts::PI * 64.0 * index as f64 / 1024.0;
                (phase.cos(), 0.0)
            })
            .collect();
        fft_in_place(&mut buffer);
        let mut energies: Vec<(usize, f64)> = buffer
            .iter()
            .enumerate()
            .take(512)
            .map(|(bin, (real, imag))| (bin, real * real + imag * imag))
            .collect();
        energies.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        assert_eq!(energies[0].0, 64, "the tone landed in the wrong bin");
    }

    #[test]
    fn the_fft_round_trip_returns_the_original_signal() {
        // The inverse of a forward transform is a conjugate, the forward transform, and a
        // conjugate again, divided by the length. Getting that order wrong yields a
        // time-reversed signal, which is why this is checked rather than assumed.
        let original: Vec<(f64, f64)> = (0..256)
            .map(|index| ((index as f64 * 0.37).sin(), (index as f64 * 0.11).cos()))
            .collect();
        let mut spectrum = original.clone();
        fft_in_place(&mut spectrum);
        // The inverse is a conjugate, a forward transform, and a conjugate again, all
        // divided by the length. Dropping either conjugate leaves a time-reversed result,
        // which is exactly the kind of near-miss this test exists to catch.
        for pair in spectrum.iter_mut() {
            pair.1 = -pair.1;
        }
        fft_in_place(&mut spectrum);
        for pair in spectrum.iter_mut() {
            pair.1 = -pair.1;
        }
        let length = spectrum.len() as f64;
        for index in 0..spectrum.len() {
            assert!((spectrum[index].0 / length - original[index].0).abs() < 1e-9);
            assert!((spectrum[index].1 / length - original[index].1).abs() < 1e-9);
        }
    }

    #[test]
    fn the_fft_refuses_degenerate_lengths_instead_of_panicking() {
        let mut odd = vec![(1.0, 0.0), (2.0, 0.0), (3.0, 0.0)];
        fft_in_place(&mut odd);
        assert_eq!(odd, vec![(1.0, 0.0), (2.0, 0.0), (3.0, 0.0)]);
        let mut tiny = vec![(1.0, 0.0)];
        fft_in_place(&mut tiny);
        let mut empty: Vec<(f64, f64)> = Vec::new();
        fft_in_place(&mut empty);
    }

    // ---- the band layout ----------------------------------------------------------------

    #[test]
    fn bands_are_logarithmically_spaced_and_every_one_spans_at_least_one_bin() {
        let edges = band_edges(WINDOW_SAMPLES, SAMPLE_RATE_HZ);
        assert_eq!(edges.len(), BAND_COUNT + 1);
        for index in 1..edges.len() {
            assert!(
                edges[index] > edges[index - 1],
                "band {index} is empty: {edges:?}"
            );
        }
        let low_width =
            (edges[1] - edges[0]) as f32 * SAMPLE_RATE_HZ as f32 / WINDOW_SAMPLES as f32;
        let high_width = (edges[BAND_COUNT] - edges[BAND_COUNT - 1]) as f32 * SAMPLE_RATE_HZ as f32
            / WINDOW_SAMPLES as f32;
        // Constant ratio per band means the top bands are wider in hertz than the bottom
        // ones, which is the whole point of a logarithmic layout.
        assert!(
            high_width > low_width,
            "low {low_width} !> high {high_width}"
        );
    }

    #[test]
    fn a_low_sample_rate_clamps_the_layout_instead_of_reading_past_the_buffer() {
        let edges = band_edges(WINDOW_SAMPLES, 2_000);
        for window in edges.windows(2) {
            assert!(window[1] > window[0]);
            assert!(window[1] as usize <= WINDOW_SAMPLES / 2);
        }
    }

    // ---- gain invariance and silence ----------------------------------------------------

    #[test]
    fn a_uniform_gain_change_does_not_meaningfully_change_the_fingerprint() {
        // The bands are stored as a deviation from the frame's own mean, so a gain cancels
        // in exact arithmetic. It is not *bit* exact: a band sitting on a quantization
        // boundary can tip one nibble, and floating-point `log10` differs in its last
        // digit. So the guarantee under test is that the match survives, not that the two
        // byte streams are equal.
        let original = audio(&song_a(3), 3.0);
        for gain in [4.0f32, 0.05f32] {
            let scaled: Vec<f32> = song_a(3).iter().map(|value| value * gain).collect();
            let other = audio(&scaled, 3.0);
            let result = align_offset_tolerant(&original.frames, &other.frames);
            assert!(
                result.score > 95.0,
                "a gain of {gain} changed the score to {}",
                result.score
            );
        }
        // The gain really did change the signal, so the test is not passing vacuously: the
        // measured peak level moved up by a substantial amount.
        let base = song_a(3);
        let before = peak_dbfs(&base);
        let after = peak_dbfs(&base.iter().map(|value| value * 4.0).collect::<Vec<_>>());
        assert!(
            after - before > 6.0,
            "the peak level moved by only {} dB, so the gain did not really happen",
            after - before
        );
    }

    #[test]
    fn a_clipped_peak_is_reported_rather_than_hidden() {
        assert!(peak_dbfs(&vec![0.999f32; 4_000]) > -1.0);
        assert_eq!(peak_dbfs(&[0.0f32; 10]), -120.0);
    }

    #[test]
    fn leading_and_trailing_silence_is_trimmed_and_measured() {
        // The padding is a whole number of hops, so the assertion is about the trimming
        // rule and not about sub-hop resampling.
        let padding = 15 * HOP_SAMPLES;
        let music = song_a(3);
        let mut padded = vec![0f32; padding];
        padded.extend_from_slice(&music);
        padded.extend(vec![0f32; padding]);
        let plain = audio(&music, 3.0);
        let with_silence = audio(&padded, padded.len() as f64 / SAMPLE_RATE_HZ as f64);
        assert!(with_silence.leading_silence_ms >= 950);
        assert!(with_silence.trailing_silence_ms >= 950);
        assert!(plain.leading_silence_ms < 100);
        let result = align_offset_tolerant(&plain.frames, &with_silence.frames);
        assert!(
            result.score > 95.0,
            "padding changed the match: {}",
            result.score
        );
    }

    #[test]
    fn a_silent_file_produces_no_frames_and_says_so() {
        let silence = vec![0f32; 4 * SAMPLE_RATE_HZ as usize];
        let print = audio(&silence, 4.0);
        assert!(print.frames.is_empty());
        assert_eq!(print.peak_dbfs, -120.0);
        assert_eq!(
            align_offset_tolerant(&print.frames, &audio(&song_a(2), 2.0).frames).score,
            0.0
        );
    }

    #[test]
    fn a_frame_shorter_than_the_window_yields_neutral_bands_not_a_read_past_the_end() {
        assert_eq!(analyze_frame(&vec![0.5f32; 100]).bands, [0u8; BAND_COUNT]);
    }

    // ---- the comparison -----------------------------------------------------------------

    #[test]
    fn the_same_audio_fingerprints_identically() {
        let left = audio(&song_a(4), 4.0);
        let right = audio(&song_a(4), 4.0);
        let result = align_offset_tolerant(&left.frames, &right.frames);
        assert_eq!(result.score, 100.0);
        assert_eq!(result.best_offset, 0);
    }

    #[test]
    fn a_tag_change_cannot_affect_the_result_because_tags_are_never_read() {
        // The fingerprint is a pure function of decoded samples. Two calls on the same
        // samples are identical by construction, which is the strongest statement this
        // module can make about metadata: it is not an input.
        let samples = song_a(2);
        assert_eq!(audio(&samples, 2.0).frames, audio(&samples, 2.0).frames);
    }

    #[test]
    fn a_lossy_transcode_simulation_still_matches() {
        // A real MP3/AAC/FLAC transcode needs an encoder, so these stand in for one by
        // requantising to a given precision, which is the part of a lossy encode that
        // perturbs a magnitude spectrum most.
        let original = song_a(4);
        let left = audio(&original, 4.0);
        for (bits, floor) in [(12u32, 90.0f64), (8u32, 84.0f64)] {
            let levels = (1i64 << bits) - 1;
            let requantised: Vec<f32> = original
                .iter()
                .map(|value| (value.clamp(-1.0, 1.0) * levels as f32).round() / levels as f32)
                .collect();
            let score = align_offset_tolerant(&left.frames, &audio(&requantised, 4.0).frames).score;
            assert!(
                score > floor,
                "{bits}-bit requantisation scored only {score}"
            );
        }
    }

    #[test]
    fn a_severely_band_limited_transcode_degrades_the_score_and_says_so() {
        // A 1.2 kHz one-pole lowpass is far more destructive than any realistic encode at
        // this sample rate. It must visibly lower the score, which is why the limitation
        // text promises no error correction.
        let original = song_a(4);
        let alpha = 1.0 - (-2.0 * std::f32::consts::PI * 1_200.0 / SAMPLE_RATE_HZ as f32).exp();
        let mut state = 0f32;
        let filtered: Vec<f32> = original
            .iter()
            .map(|value| {
                state += alpha * (value - state);
                state
            })
            .collect();
        let score =
            align_offset_tolerant(&audio(&original, 4.0).frames, &audio(&filtered, 4.0).frames)
                .score;
        assert!(
            score < 100.0,
            "a heavy lowpass scored {score}; the documented limitation is not real"
        );
    }

    #[test]
    fn a_different_recording_with_the_same_loudness_envelope_does_not_match() {
        let left = audio(&song_a(4), 4.0);
        let right = audio(&song_b(4), 4.0);
        // Both are the same length and a similar peak, so only the spectrum differs.
        assert!((left.peak_dbfs - right.peak_dbfs).abs() < 6.0);
        let score = align_offset_tolerant(&left.frames, &right.frames).score;
        assert!(
            score < 70.0,
            "same-envelope different song scored {score}, which would be a false match"
        );
    }

    #[test]
    fn an_inserted_intro_is_reported_as_an_offset_rather_than_hidden() {
        let music = song_a(4);
        let intro = 4 * HOP_SAMPLES;
        let mut with_intro = tones(1, &[(880.0, 1.0)], 99);
        with_intro.extend_from_slice(&music);
        let left = audio(&music, 4.0);
        let right = audio(&with_intro, with_intro.len() as f64 / SAMPLE_RATE_HZ as f64);
        let result = align_offset_tolerant(&left.frames, &right.frames);
        assert!(
            result.best_offset > 0,
            "an inserted intro must be visible as an offset, not silently absorbed"
        );
        // Coverage is deliberately reduced by the intro, so the score is good but not
        // perfect. That is the honest outcome: the two are not the same length.
        assert!(
            result.score > 70.0,
            "inserted intro scored {}",
            result.score
        );
        assert!(result.score < 100.0);
        let _ = intro;
    }

    #[test]
    fn the_offset_window_is_bounded() {
        assert_eq!(max_offset(0, 100), 0);
        assert_eq!(max_offset(1, 1), 1);
        assert_eq!(max_offset(100, 100), 25);
        // 200 frames is a 25% window of 50, so a 200-frame shift is unreachable.
        assert!(max_offset(200, 200) <= 50);
    }

    #[test]
    fn an_empty_fingerprint_never_matches_anything() {
        let result = align_offset_tolerant(&Vec::new(), &audio(&song_a(1), 1.0).frames);
        assert_eq!(result.score, 0.0);
        assert_eq!(result.matched_frames, 0);
    }

    #[test]
    fn a_short_fingerprint_tolerates_a_misaligned_pair_without_panicking() {
        let left = vec![Frame::default()];
        let right = vec![Frame::default(); 40];
        let result = align_offset_tolerant(&left, &right);
        assert!(result.score.is_finite());
        assert!(result.matched_frames >= 1);
    }

    // ---- reporting ----------------------------------------------------------------------

    #[test]
    fn the_reported_signals_cover_what_was_actually_measured() {
        let left = audio(&song_a(3), 3.0);
        let right = audio(&song_a(3), 3.0);
        let signals = signal_breakdown(&left, &right);
        assert_eq!(signals.len(), 2);
        for signal in &signals {
            assert!(signal.available);
            assert!(signal.score.is_finite());
            assert!((0.0..=100.0).contains(&signal.score));
            assert!(!signal.detail_en.is_empty());
            assert!(!signal.detail_ar.is_empty());
        }
        assert_eq!(composite(&signals), 100.0);
    }

    #[test]
    fn a_file_that_could_not_be_decoded_contributes_no_available_signal() {
        let decoded = audio(&song_a(3), 3.0);
        let failed = AudioFingerprint {
            frames: Vec::new(),
            decoded_duration_seconds: 0.0,
            sample_rate_hz: SAMPLE_RATE_HZ,
            channels: super::CHANNELS,
            leading_silence_ms: 0,
            trailing_silence_ms: 0,
            peak_dbfs: -120.0,
            prefix_only: false,
        };
        let signals = signal_breakdown(&decoded, &failed);
        assert!(signals.iter().all(|signal| !signal.available));
        assert_eq!(composite(&signals), 0.0, "an undecoded file must not score");
    }

    #[test]
    fn duration_comparison_handles_a_missing_duration() {
        assert!(
            (duration_ratio_score(3.0, 3.0) - 100.0).abs() < 1e-9,
            "identical lengths"
        );
        assert!(duration_ratio_score(3.0, 2.7) > 89.0, "a 10% trim");
        // A duration nothing can be measured from must score nothing. Reporting 100 for two
        // unknown lengths would be the worst possible answer: it would invent a perfect
        // match out of no information at all.
        assert_eq!(
            duration_ratio_score(0.0, 0.0),
            0.0,
            "two unknown durations must not look like a perfect match"
        );
        assert_eq!(
            duration_ratio_score(0.0, 5.0),
            0.0,
            "one unknown duration must not score like a measured one"
        );
    }

    #[test]
    fn the_backend_names_itself_and_states_its_limits_in_both_languages() {
        assert!(BACKEND_ID.contains("in_process"));
        assert_eq!(BACKEND_KIND, "in_process");
        assert!(BACKEND_LIMITATION_EN.contains("not Chromaprint"));
        assert!(BACKEND_LIMITATION_AR.contains("وليست Chromaprint"));
    }

    #[test]
    fn the_analysis_parameters_are_the_published_ones() {
        assert_eq!(SAMPLE_RATE_HZ, 8_000);
        assert_eq!(super::CHANNELS, 1);
        assert_eq!(WINDOW_SAMPLES, 1_024);
        assert_eq!(HOP_SAMPLES, 512);
        assert_eq!(BAND_COUNT, 24);
        assert_eq!(frame_energy(&[1.0, 1.0, 1.0, 1.0]), 1.0);
        assert_eq!(frame_energy(&[]), 0.0);
    }
}
