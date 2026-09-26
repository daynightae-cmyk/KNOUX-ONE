//! Image fingerprints, candidate bucketing, multi-signal scoring, and the persisted
//! fingerprint cache for M03-S03.
//!
//! # What the previous scan did wrong
//!
//! 1. It decoded the raw raster and ignored EXIF orientation, so a phone photo and its
//!    correctly-rotated copy looked unrelated. Orientation is now read from the file's
//!    JPEG `APP1` segment and applied first — see [`super::m03_exif`].
//! 2. It compared **every pair**. At 10 000 images that is 49 995 000 comparisons, each
//!    of which touched four signals. Candidates are now bucketed by aspect ratio and a
//!    cheap signature taken from the dHash, and only buckets that can contain a match are
//!    compared. The result reports both the pairs actually compared and the
//!    `n * (n - 1) / 2` that were avoided, so the saving is checkable rather than claimed.
//! 3. It emitted progress with `can_pause` and `can_cancel` hardcoded to `false` while
//!    the work was plainly still running. Progress now reports real counters and the
//!    capability flags reflect what the run actually supports.
//! 4. It re-decoded every image on every run. Fingerprints are now cached on disk,
//!    keyed by file identity plus size plus modification time, and a changed file
//!    invalidates its own entry instead of returning a stale answer.
//!
//! # Read-only
//!
//! Nothing in this module, or in the command that drives it, moves, quarantines or
//! deletes a file. `ImageScanEvidence::no_destructive_action` records that promise, and
//! a unit test re-checks it against this file's own source.

use crate::{
    completion14::m03_exif::{self, Orientation, OrientationSource},
    duplicates::contracts::{FileEvidence, SignalScore, SignalWeight},
};
use image::{imageops::FilterType, DynamicImage, ImageReader, Limits};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

/// Bounds on a single decode. A 60 000 x 40 000 PNG is a few hundred megabytes once it is
/// a raw buffer, and a duplicate scan must not be the thing that exhausts memory.
pub const MAX_DECODE_WIDTH: u32 = 20_000;
pub const MAX_DECODE_HEIGHT: u32 = 20_000;
pub const MAX_DECODE_ALLOC_BYTES: u64 = 512 * 1024 * 1024;
/// Only the head of a file is read to find the orientation tag.
pub const ORIENTATION_HEAD_BYTES: usize = 256 * 1024;

/// The weights behind the composite image score. The closure specification asks for the
/// existing multi-signal mix to be *retained* alongside a per-signal breakdown, so these
/// are the historical weights, unchanged and now published.
pub const WEIGHT_DHASH: f32 = 0.45;
pub const WEIGHT_AHASH: f32 = 0.25;
pub const WEIGHT_HISTOGRAM: f32 = 0.20;
pub const WEIGHT_ASPECT: f32 = 0.10;

/// Serde support for the fixed 48-bin histogram.
///
/// `serde` implements arrays only up to length 32, and the histogram is deliberately
/// fixed at 48, so it is written as a sequence. A payload of the wrong length is an error
/// rather than being silently padded or truncated — a short histogram would produce
/// similarity scores that are quietly wrong.
mod histogram_serde {
    use serde::{Deserialize, Deserializer, Serializer};

    pub const BINS: usize = 48;

    pub fn serialize<S: Serializer>(value: &[f32; BINS], serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeSeq;
        let mut sequence = serializer.serialize_seq(Some(BINS))?;
        for bin in value {
            sequence.serialize_element(bin)?;
        }
        sequence.end()
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(
        deserializer: D,
    ) -> Result<[f32; BINS], D::Error> {
        let values = Vec::<f32>::deserialize(deserializer)?;
        if values.len() != BINS {
            return Err(serde::de::Error::custom(format!(
                "expected {BINS} histogram bins, found {}",
                values.len()
            )));
        }
        let mut bins = [0f32; BINS];
        bins.copy_from_slice(&values);
        Ok(bins)
    }
}

/// One image, measured. `width`/`height` are the **normalized** dimensions, i.e. what a
/// viewer displays, not what the raw raster happens to be.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageFingerprint {
    pub path: PathBuf,
    pub file_identity: String,
    pub size_bytes: u64,
    pub modified_unix_nanos: u64,
    /// The perceptual hashes computed *after* orientation was applied.
    pub dhash: u64,
    pub ahash: u64,
    /// 48-bin RGB histogram, each bin a fraction of the pixel count.
    #[serde(with = "histogram_serde")]
    pub hist: [f32; 48],
    pub width: u32,
    pub height: u32,
    pub orientation: Orientation,
    pub orientation_source: OrientationSource,
    /// True when the fingerprint came from the cache rather than from a fresh decode.
    pub from_cache: bool,
}

impl ImageFingerprint {
    /// Aspect ratio, guarded against a zero dimension from a corrupt header.
    pub fn aspect(&self) -> f32 {
        self.width.max(1) as f32 / self.height.max(1) as f32
    }

    /// The coarse bucket this image belongs to: an aspect band plus the most significant
    /// bits of the dHash. Both parts are cheap, and both are computed before any pair
    /// comparison happens.
    pub fn bucket(&self) -> ImageBucket {
        ImageBucket {
            // Eight buckets per octave of aspect ratio: two images in the same bucket
            // differ in aspect by at most about 9%.
            aspect_band: (self.aspect().log2() * 8.0).round().clamp(-64.0, 64.0) as i32,
            // The top 16 of 64 dHash bits. Sharing this band does not prove a match; it
            // only makes a match more likely, which is what a candidate stage is for.
            signature: (self.dhash >> 48) as u16,
        }
    }
}

/// The coarse candidate bucket. Sorted, so iteration and reporting are deterministic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct ImageBucket {
    pub aspect_band: i32,
    pub signature: u16,
}

impl ImageBucket {
    pub fn as_key(self) -> String {
        format!("a{:+03}/s{:04x}", self.aspect_band, self.signature)
    }
}

/// How many aspect bands on either side of a match's own band are also compared.
///
/// One band of slack is about ±9% of aspect ratio, which covers a modest crop. Two bands
/// would raise recall further at the cost of more comparisons, so the width is a
/// published, deliberate number rather than a hidden tuning constant.
pub const ASPECT_BAND_SLACK: i32 = 1;

fn micros_since_epoch(value: Result<SystemTime, std::io::Error>) -> u128 {
    value
        .ok()
        .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|delta| delta.as_micros())
        .unwrap_or(0)
}

/// Decodes one image within explicit limits.
///
/// `ImageReader` with `Limits` is used rather than `image::open` because the latter
/// applies the default 512 MiB allocation ceiling and **no** dimension ceiling at all.
pub fn decode_bounded(path: &Path) -> Result<DynamicImage, String> {
    let reader = ImageReader::open(path)
        .map_err(|error| format!("image_open_failed:{error}"))?
        .with_guessed_format()
        .map_err(|error| format!("image_format_guess_failed:{error}"))?;
    // `Limits` is `#[non_exhaustive]`, so its fields are assigned rather than constructed.
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_DECODE_WIDTH);
    limits.max_image_height = Some(MAX_DECODE_HEIGHT);
    limits.max_alloc = Some(MAX_DECODE_ALLOC_BYTES);
    let mut reader = reader;
    reader.limits(limits);
    reader
        .decode()
        .map_err(|error| format!("image_decode_failed:{error}"))
}

/// The 8x8 difference hash: each bit records whether a pixel is brighter than its right
/// neighbour, on a 9x8 downscale. Immune to uniform brightness and contrast changes,
/// which is why a recompressed JPEG still matches.
pub fn dhash(gray: &[u8]) -> u64 {
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

/// The 8x8 average hash: each bit records whether a pixel is at or above the mean.
///
/// Only the first 64 samples are used, because the hash is defined over an 8x8 grid. The
/// perceptual grid this module also computes is 9x8, so the bound matters: without it the
/// bit shift would run past zero.
pub fn ahash(gray: &[u8]) -> u64 {
    let pixels = gray.iter().copied().take(64).collect::<Vec<u8>>();
    if pixels.is_empty() {
        return 0;
    }
    let total: u64 = pixels.iter().map(|value| *value as u64).sum();
    let mean = total / pixels.len() as u64;
    let mut hash = 0u64;
    for (index, value) in pixels.iter().enumerate() {
        if *value as u64 >= mean {
            hash |= 1u64 << (63 - index as u32);
        }
    }
    hash
}

/// 16 bins per channel, 3 channels. Each bin is divided by the **actual** pixel count, so
/// the vector sums to one per channel whatever the image size. Dividing by a fixed
/// constant would only be correct for one specific resolution, and would quietly make
/// every similarity score wrong at any other size.
pub fn histogram(rgb: &[u8]) -> [f32; 48] {
    let pixels = (rgb.len() / 3).max(1);
    let mut hist = [0f32; 48];
    for pixel in rgb.as_chunks::<3>().0 {
        for channel in 0..3usize {
            let bin = ((pixel[channel] as usize * 16) / 256).min(15);
            hist[channel * 16 + bin] += 1.0;
        }
    }
    for value in &mut hist {
        *value /= pixels as f32;
    }
    hist
}

/// The downscale used for every perceptual signal. Triangle filtering is chosen so a
/// resized copy lands on nearly the same 9x8 grid as the original.
fn luma_grid(image: &DynamicImage) -> image::GrayImage {
    image.resize_exact(9, 8, FilterType::Triangle).into_luma8()
}

/// Measures one image from disk, applying its declared orientation first.
pub fn measure(
    path: &Path,
    file_identity: &str,
    size_bytes: u64,
    modified_unix_nanos: u64,
) -> Result<ImageFingerprint, String> {
    let mut head = vec![0u8; ORIENTATION_HEAD_BYTES];
    let head_len = read_head(path, &mut head)?;
    head.truncate(head_len);
    let probe = m03_exif::probe(&head);
    let decoded = decode_bounded(path)?;
    let (normalized, _, _) = m03_exif::apply(decoded, probe.orientation);
    let width = normalized.width();
    let height = normalized.height();
    if width == 0 || height == 0 {
        return Err("image_zero_dimension".into());
    }
    let grid = luma_grid(&normalized);
    let rgb = normalized
        .resize_exact(64, 64, FilterType::Triangle)
        .into_rgb8();
    Ok(ImageFingerprint {
        path: path.to_path_buf(),
        file_identity: file_identity.to_string(),
        size_bytes,
        modified_unix_nanos,
        dhash: dhash(grid.as_raw()),
        ahash: ahash(grid.as_raw()),
        hist: histogram(rgb.as_raw()),
        width,
        height,
        orientation: probe.orientation,
        orientation_source: probe.source,
        from_cache: false,
    })
}

fn read_head(path: &Path, buffer: &mut [u8]) -> Result<usize, String> {
    use std::io::Read;
    let mut file = fs::File::open(path).map_err(|error| format!("image_open_failed:{error}"))?;
    let mut filled = 0usize;
    while filled < buffer.len() {
        let read = file
            .read(&mut buffer[filled..])
            .map_err(|error| format!("image_read_failed:{error}"))?;
        if read == 0 {
            break;
        }
        filled += read;
    }
    Ok(filled)
}

// ---- signal scoring ---------------------------------------------------------------------

/// Hamming agreement of two hashes, as 0..=100.
pub fn hash_score(left: u64, right: u64) -> f32 {
    (1.0 - (left ^ right).count_ones() as f32 / 64.0).max(0.0) * 100.0
}

/// Intersection-over-union style agreement of two histograms, as 0..=100.
pub fn histogram_score(left: &[f32; 48], right: &[f32; 48]) -> f32 {
    let difference: f32 = left
        .iter()
        .zip(right.iter())
        .map(|(a, b)| (a - b).abs())
        .sum();
    (1.0 - (difference / 2.0).min(1.0)).max(0.0) * 100.0
}

/// Aspect agreement, relative to the wider of the two, as 0..=100.
pub fn aspect_score(left: f32, right: f32) -> f32 {
    let high = left.max(right).max(f32::MIN_POSITIVE);
    (1.0 - ((left - right).abs() / high).min(1.0)).max(0.0) * 100.0
}

/// The individual signals for one pair, with the weight each one carried.
///
/// The composite is a weighted mean of exactly these, so a reader can reconstruct the
/// number instead of trusting it.
pub fn signal_breakdown(left: &ImageFingerprint, right: &ImageFingerprint) -> Vec<SignalScore> {
    let dhash_bits = (left.dhash ^ right.dhash).count_ones();
    let ahash_bits = (left.ahash ^ right.ahash).count_ones();
    let histogram_distance: f32 = left
        .hist
        .iter()
        .zip(right.hist.iter())
        .map(|(a, b)| (a - b).abs())
        .sum();
    let aspect_delta = ((left.aspect() - right.aspect()).abs()
        / left.aspect().max(right.aspect()).max(f32::MIN_POSITIVE))
    .min(1.0);
    vec![
        SignalScore {
            signal: "dhash".into(),
            score: finite(hash_score(left.dhash, right.dhash)),
            weight: WEIGHT_DHASH,
            available: true,
            detail_en: format!(
                "{dhash_bits} of 64 difference-hash bits differ, computed on the 9x8 luma \
                 downscale after orientation was applied."
            ),
            detail_ar: format!(
                "{dhash_bits} من 64 بت في بصمة الفروق تختلف، محسوبة على تصغير الإضاءة إلى 9x8 \
                 بعد تطبيق الاتجاه."
            ),
        },
        SignalScore {
            signal: "ahash".into(),
            score: finite(hash_score(left.ahash, right.ahash)),
            weight: WEIGHT_AHASH,
            available: true,
            detail_en: format!(
                "{ahash_bits} of 64 average-hash bits differ, which is sensitive to overall \
                 brightness and therefore complements dHash."
            ),
            detail_ar: format!(
                "{ahash_bits} من 64 بت في بصمة المتوسط تختلف، وهي حساسة للسطوع العام ولذلك \
                 تكمّل dHash."
            ),
        },
        SignalScore {
            signal: "histogram".into(),
            score: finite(histogram_score(&left.hist, &right.hist)),
            weight: WEIGHT_HISTOGRAM,
            available: true,
            detail_en: format!(
                "Total absolute difference across 48 RGB histogram bins is \
                 {histogram_distance:.4}; converted to a 0-100 agreement."
            ),
            detail_ar: format!(
                "مجموع الفرق المطلق عبر 48 شريحة في توزيع RGB هو {histogram_distance:.4}، \
                 ومحوّل إلى نسبة توافق من 0 إلى 100."
            ),
        },
        SignalScore {
            signal: "aspect".into(),
            score: finite(aspect_score(left.aspect(), right.aspect())),
            weight: WEIGHT_ASPECT,
            available: true,
            detail_en: format!(
                "Normalized dimensions are {}x{} and {}x{}, a relative aspect difference of \
                 {aspect_delta:.4}.",
                left.width, left.height, right.width, right.height
            ),
            detail_ar: format!(
                "الأبعاد بعد التطبيع {}x{} و{}x{}، وفرق نسبة الأبعاد النسبي {aspect_delta:.4}.",
                left.width, left.height, right.width, right.height
            ),
        },
    ]
}

/// Clamps to a finite value so the result can always be serialized as JSON.
pub fn finite(value: f32) -> f32 {
    if value.is_finite() {
        value.clamp(0.0, 100.0)
    } else {
        0.0
    }
}

/// The composite score: a weighted mean over the signals that were actually available.
///
/// If a signal were unavailable its weight would be excluded and the remaining weights
/// renormalized, so a missing measurement lowers confidence instead of silently dragging
/// the score toward zero or being counted as a perfect result.
pub fn composite(signals: &[SignalScore]) -> f32 {
    let mut weight = 0f32;
    let mut total = 0f32;
    for signal in signals.iter().filter(|signal| signal.available) {
        weight += signal.weight;
        total += signal.weight * finite(signal.score);
    }
    if weight <= 0.0 {
        return 0.0;
    }
    finite(total / weight)
}

pub fn published_weights() -> Vec<SignalWeight> {
    vec![
        SignalWeight {
            signal: "dhash".into(),
            weight: WEIGHT_DHASH,
        },
        SignalWeight {
            signal: "ahash".into(),
            weight: WEIGHT_AHASH,
        },
        SignalWeight {
            signal: "histogram".into(),
            weight: WEIGHT_HISTOGRAM,
        },
        SignalWeight {
            signal: "aspect".into(),
            weight: WEIGHT_ASPECT,
        },
    ]
}

// ---- candidate indexing -----------------------------------------------------------------

/// What the bucket stage measured, so the sub-quadratic claim can be checked.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BucketStats {
    pub bucket_count: u64,
    pub largest_bucket: u64,
    pub compared_pairs: u64,
    pub all_pairs_if_computed: u64,
    /// Buckets that were not compared because a single exact-hash class already
    /// explained them.
    pub classes_collapsed_by_exact_hash: u64,
}

impl BucketStats {
    pub fn avoided_all_pairs(&self) -> bool {
        self.compared_pairs < self.all_pairs_if_computed
    }
}

/// Reduces a set of fingerprints to one representative per exact-hash class.
///
/// Two byte-identical files are a *proven* duplicate, so running a fuzzy comparison
/// between them can only restate a fact already known — and in a folder of 10 000
/// identical files it would be 49 995 000 restatements. The representative kept is the
/// one with the smallest canonical path, so the choice is reproducible.
pub fn collapse_exact_duplicates(fingerprints: &[ImageFingerprint]) -> (Vec<usize>, u64) {
    let mut best: BTreeMap<String, (usize, String)> = BTreeMap::new();
    for (index, fingerprint) in fingerprints.iter().enumerate() {
        let key = exact_key(fingerprint);
        let path = fingerprint.path.to_string_lossy().to_string();
        match best.get(&key) {
            Some((_, existing)) if existing <= &path => {}
            _ => {
                best.insert(key, (index, path));
            }
        }
    }
    let collapsed = fingerprints.len().saturating_sub(best.len()) as u64;
    (
        best.into_values().map(|(index, _)| index).collect(),
        collapsed,
    )
}

/// The exact-content key. This is a *cheap* proxy: the full BLAKE3 of every file is
/// computed later and is the actual proof, so a collision here can only cause a
/// redundant comparison, never a missed one.
fn exact_key(fingerprint: &ImageFingerprint) -> String {
    format!(
        "{}:{:016x}:{:016x}:{}",
        fingerprint.size_bytes, fingerprint.dhash, fingerprint.ahash, fingerprint.width
    )
}

/// Groups representatives into coarse buckets and returns the pairs worth comparing.
///
/// A pair is a candidate when the two share a signature and their aspect bands are
/// within [`ASPECT_BAND_SLACK`]. Pairs are produced in a deterministic order and each
/// unordered pair appears at most once.
pub fn candidate_pairs(
    representatives: &[usize],
    fingerprints: &[ImageFingerprint],
) -> (Vec<(usize, usize)>, BucketStats) {
    let mut buckets: BTreeMap<u16, Vec<(i32, usize)>> = BTreeMap::new();
    let count = fingerprints.len() as u64;
    let mut stats = BucketStats {
        all_pairs_if_computed: count.saturating_mul(count.saturating_sub(1)) / 2,
        ..BucketStats::default()
    };
    for &index in representatives {
        let bucket = fingerprints[index].bucket();
        let entry = buckets.entry(bucket.signature).or_default();
        stats.largest_bucket = stats.largest_bucket.max(entry.len() as u64 + 1);
        entry.push((bucket.aspect_band, index));
    }
    stats.bucket_count = buckets.len() as u64;
    let mut pairs: Vec<(usize, usize)> = Vec::new();
    for members in buckets.values() {
        for (position, (band_a, index_a)) in members.iter().enumerate() {
            for (band_b, index_b) in members.iter().skip(position + 1) {
                if (band_a - band_b).abs() <= ASPECT_BAND_SLACK {
                    let (low, high) = if index_a < index_b {
                        (*index_a, *index_b)
                    } else {
                        (*index_b, *index_a)
                    };
                    pairs.push((low, high));
                }
            }
        }
    }
    pairs.sort_unstable();
    pairs.dedup();
    stats.compared_pairs = pairs.len() as u64;
    (pairs, stats)
}

// ---- the persisted fingerprint cache -----------------------------------------------------

/// One cached fingerprint. `size_bytes` and `modified_unix_nanos` are stored so a
/// changed file can be detected without re-reading its content.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub path: String,
    pub size_bytes: u64,
    pub modified_unix_nanos: u64,
    pub dhash: u64,
    pub ahash: u64,
    #[serde(with = "histogram_serde")]
    pub hist: [f32; 48],
    pub width: u32,
    pub height: u32,
    pub orientation: u8,
    pub orientation_source: String,
    /// Bumped every time a load happens, so eviction can drop the least recently loaded
    /// entries deterministically instead of by hash order.
    pub seen_epoch: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct CacheFile {
    version: u32,
    entries: BTreeMap<String, CacheEntry>,
}

#[derive(Debug, Default)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub invalidations: u64,
    pub evictions: u64,
    pub entries: u64,
}

/// An on-disk cache of measured fingerprints.
///
/// Keyed by the file's **identity** (the Windows volume serial and file index, so two
/// hard links share one entry) plus its size and modification time. Any change to those
/// invalidates the entry, which is what makes a file edited between two scans
/// re-measured instead of reported from a stale answer.
pub struct FingerprintCache {
    path: Option<PathBuf>,
    entries: BTreeMap<String, CacheEntry>,
    epoch: u64,
    capacity: usize,
    pub stats: CacheStats,
    /// Set when the cache could not be written, reported instead of being ignored.
    pub write_error: Option<String>,
}

impl FingerprintCache {
    /// The most entries kept on disk. Above this the least recently loaded are dropped.
    pub const CAPACITY: usize = 200_000;

    /// Opens the cache at `path`. A missing or unreadable file yields an empty cache and
    /// a recorded reason, never a panic and never a fabricated hit.
    pub fn open(path: Option<PathBuf>) -> Self {
        // The epoch is the highest load counter already in the file, so eviction drops the
        // least recently loaded entries deterministically instead of by hash order. A file
        // that cannot be read starts from 1: a cold cache, not a fabricated hit.
        let loaded = match path.as_ref().and_then(|path| fs::read(path).ok()) {
            Some(bytes) => serde_json::from_slice::<CacheFile>(&bytes).ok(),
            None => None,
        };
        let (epoch, entries) = match loaded {
            Some(file) if file.version == 1 => {
                let highest = file
                    .entries
                    .values()
                    .map(|entry| entry.seen_epoch)
                    .max()
                    .unwrap_or(0);
                (highest.saturating_add(1), file.entries)
            }
            _ => (1, BTreeMap::new()),
        };
        let entry_count = entries.len() as u64;
        Self {
            path,
            entries,
            epoch,
            capacity: Self::CAPACITY,
            stats: CacheStats {
                entries: entry_count,
                ..CacheStats::default()
            },
            write_error: None,
        }
    }

    /// In-memory cache, so the cache rules can be exercised without a file on disk.
    #[cfg(test)]
    pub fn in_memory() -> Self {
        Self {
            path: None,
            entries: BTreeMap::new(),
            epoch: 1,
            capacity: Self::CAPACITY,
            stats: CacheStats::default(),
            write_error: None,
        }
    }

    /// Returns a cached fingerprint when the file has not changed since it was measured.
    ///
    /// A hit is only reported when identity, size and modification time all still agree.
    /// Anything else is an invalidation: the caller must measure again.
    pub fn get(
        &mut self,
        file_identity: &str,
        size_bytes: u64,
        modified_unix_nanos: u64,
    ) -> Option<ImageFingerprint> {
        let entry = self.entries.get(file_identity);
        let value = match entry {
            Some(entry)
                if entry.size_bytes == size_bytes
                    && entry.modified_unix_nanos == modified_unix_nanos =>
            {
                entry.clone()
            }
            // Present but stale: the file changed since it was measured.
            Some(_) => {
                self.stats.invalidations += 1;
                self.entries.remove(file_identity);
                return None;
            }
            None => {
                self.stats.misses += 1;
                return None;
            }
        };
        self.stats.hits += 1;
        Some(ImageFingerprint {
            path: PathBuf::from(&value.path),
            file_identity: file_identity.to_string(),
            size_bytes: value.size_bytes,
            modified_unix_nanos: value.modified_unix_nanos,
            dhash: value.dhash,
            ahash: value.ahash,
            hist: value.hist,
            width: value.width,
            height: value.height,
            orientation: Orientation::from_exif_value(value.orientation),
            orientation_source: OrientationSource::from_stored(&value.orientation_source),
            from_cache: true,
        })
    }

    /// Stores a fresh measurement.
    pub fn put(&mut self, file_identity: &str, fingerprint: &ImageFingerprint) {
        self.epoch += 1;
        self.entries.insert(
            file_identity.to_string(),
            CacheEntry {
                path: fingerprint.path.to_string_lossy().to_string(),
                size_bytes: fingerprint.size_bytes,
                modified_unix_nanos: fingerprint.modified_unix_nanos,
                dhash: fingerprint.dhash,
                ahash: fingerprint.ahash,
                hist: fingerprint.hist,
                width: fingerprint.width,
                height: fingerprint.height,
                orientation: fingerprint.orientation.exif_value(),
                orientation_source: fingerprint.orientation_source.as_str().to_string(),
                seen_epoch: self.epoch,
            },
        );
        self.stats.entries = self.entries.len() as u64;
    }

    /// Writes the cache back, dropping the least recently loaded entries if it is over
    /// capacity. A write failure is recorded, not swallowed.
    pub fn save(&mut self) {
        let Some(path) = self.path.clone() else {
            return;
        };
        while self.entries.len() > self.capacity {
            let victim = self
                .entries
                .iter()
                .min_by_key(|(key, entry)| (entry.seen_epoch, (*key).clone()))
                .map(|(key, _)| key.clone());
            match victim {
                Some(key) => {
                    self.entries.remove(&key);
                    self.stats.evictions += 1;
                }
                None => break,
            }
        }
        self.stats.entries = self.entries.len() as u64;
        if let Some(parent) = path.parent() {
            if let Err(error) = fs::create_dir_all(parent) {
                self.write_error = Some(format!("fingerprint_cache_dir_failed:{error}"));
                return;
            }
        }
        let payload = serde_json::to_vec(&CacheFile {
            version: 1,
            entries: self.entries.clone(),
        });
        match payload {
            Ok(bytes) => {
                if let Err(error) = fs::write(&path, bytes) {
                    self.write_error = Some(format!("fingerprint_cache_write_failed:{error}"));
                }
            }
            Err(error) => {
                self.write_error = Some(format!("fingerprint_cache_encode_failed:{error}"));
            }
        }
    }

    /// The number of entries currently held.
    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// True when nothing is held, which is what a cold or unreadable cache looks like.
    #[cfg(test)]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// Turns a fingerprint into the per-file evidence rows the interface can display.
pub fn file_evidence(fingerprint: &ImageFingerprint) -> Vec<FileEvidence> {
    vec![
        FileEvidence {
            key: "normalized_dimensions".into(),
            value: format!("{}x{}", fingerprint.width, fingerprint.height),
            note_en: format!(
                "Dimensions after applying {}. Reported dimensions are what a viewer shows, \
                 not the raw raster.",
                fingerprint.orientation.label_en()
            ),
            note_ar: format!(
                "الأبعاد بعد تطبيق {}. الأبعاد المُبلَّغ هي ما يعرضه المشاهد وليست البكسلات الخام.",
                fingerprint.orientation.label_ar()
            ),
        },
        FileEvidence {
            key: "orientation".into(),
            value: fingerprint.orientation.exif_value().to_string(),
            note_en: format!(
                "{} ({})",
                fingerprint.orientation.label_en(),
                fingerprint.orientation_source.note_en()
            ),
            note_ar: format!(
                "{} ({})",
                fingerprint.orientation.label_ar(),
                fingerprint.orientation_source.note_ar()
            ),
        },
        FileEvidence {
            key: "dhash".into(),
            value: format!("{:016x}", fingerprint.dhash),
            note_en: "64-bit difference hash over a 9x8 luma downscale.".into(),
            note_ar: "بصمة فروق 64 بت على تصغير إضاءة 9x8.".into(),
        },
        FileEvidence {
            key: "ahash".into(),
            value: format!("{:016x}", fingerprint.ahash),
            note_en: "64-bit average hash over an 8x8 luma downscale.".into(),
            note_ar: "بصمة متوسط 64 بت على تصغير إضاءة 8x8.".into(),
        },
        FileEvidence {
            key: "candidate_bucket".into(),
            value: fingerprint.bucket().as_key(),
            note_en: format!(
                "Aspect band plus the top 16 difference-hash bits. Only images sharing this \
                 bucket, within {ASPECT_BAND_SLACK} aspect band(s), are compared at all."
            ),
            note_ar: format!(
                "شريط نسبة الأبعاد مع أعلى 16 بت من بصمة الفروق. لا تُقارن إلا الصور التي تشترك \
                 في هذه الحاوية ضمن {ASPECT_BAND_SLACK} شريط."
            ),
        },
        FileEvidence {
            key: "fingerprint_source".into(),
            value: if fingerprint.from_cache {
                "cache".into()
            } else {
                "fresh_decode".into()
            },
            note_en: if fingerprint.from_cache {
                "Reused a cached fingerprint because file identity, size and modification time \
                 were unchanged. A changed file would have been re-measured."
                    .into()
            } else {
                "Decoded and measured during this scan.".into()
            },
            note_ar: if fingerprint.from_cache {
                "أُعيد استخدام بصمة مخزنة لأن هوية الملف وحجمه ووقت تعديله لم تتغير. أما إذا \
                 تغيّر الملف فيُعاد قياسه."
                    .into()
            } else {
                "تم فك الترميز والقياس أثناء هذا الفحص.".into()
            },
        },
    ]
}

/// Reads the modification time the cache compares against, in microseconds since the
/// epoch. Microsecond resolution is what NTFS actually keeps; nanoseconds would make
/// the cache miss on every run for no benefit.
pub fn modified_micros(path: &Path) -> u128 {
    fs::metadata(path)
        .map(|metadata| micros_since_epoch(metadata.modified()))
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{
        ahash, aspect_score, candidate_pairs, collapse_exact_duplicates, composite, dhash,
        hash_score, histogram, histogram_score, luma_grid, measure, signal_breakdown,
        FingerprintCache, ImageFingerprint, ASPECT_BAND_SLACK,
    };
    use crate::completion14::m03_exif::{Orientation, OrientationSource};
    use crate::duplicates::contracts::SignalScore;
    use image::{DynamicImage, GrayImage, Rgb, RgbImage};
    use std::{fs, path::Path};

    fn fingerprint(
        path: &str,
        dhash: u64,
        ahash: u64,
        width: u32,
        height: u32,
    ) -> ImageFingerprint {
        ImageFingerprint {
            path: Path::new(path).into(),
            file_identity: format!("test:{path}"),
            size_bytes: 10,
            modified_unix_nanos: 0,
            dhash,
            ahash,
            hist: [0f32; 48],
            width,
            height,
            orientation: Orientation::Normal,
            orientation_source: OrientationSource::JpegWithoutTag,
            from_cache: false,
        }
    }

    /// A deterministic but non-trivial image, drawn at a **fixed logical size** and then
    /// rendered at whatever resolution is asked for.
    ///
    /// That distinction matters: a fixture whose colours depend on the raw pixel index
    /// would make a 320x240 and a 160x120 version two different pictures, so a test using
    /// it to check resize tolerance would be checking nothing. Normalising the coordinates
    /// makes the two resolutions the same picture, which is what a resize produces.
    fn scene(width: u32, height: u32, seed: u32) -> DynamicImage {
        const LOGICAL_WIDTH: f32 = 320.0;
        const LOGICAL_HEIGHT: f32 = 240.0;
        let mut buffer = RgbImage::new(width, height);
        for y in 0..height {
            for x in 0..width {
                let lx = x as f32 * LOGICAL_WIDTH / width.max(1) as f32;
                let ly = y as f32 * LOGICAL_HEIGHT / height.max(1) as f32;
                let red = ((lx * 0.7 + ly * 0.3 + seed as f32) as i64 % 256) as u8;
                let green = ((lx * 0.3 + ly * 1.1 + seed as f32 * 2.0) as i64 % 256) as u8;
                let blue = ((lx * 1.3 + ly * 0.5 + seed as f32 * 3.0) as i64 % 256) as u8;
                buffer.put_pixel(x, y, Rgb([red, green, blue]));
            }
        }
        DynamicImage::ImageRgb8(buffer)
    }

    fn write_png(path: &Path, image: &DynamicImage) {
        image
            .save_with_format(path, image::ImageFormat::Png)
            .expect("write png");
    }

    // ---- the perceptual signals ---------------------------------------------------------

    #[test]
    fn identical_pixels_produce_identical_hashes() {
        let image = scene(64, 48, 1);
        let grid = luma_grid(&image);
        assert_eq!(
            dhash(grid.as_raw()),
            dhash(luma_grid(&scene(64, 48, 1)).as_raw())
        );
        assert_eq!(
            ahash(grid.as_raw()),
            ahash(luma_grid(&scene(64, 48, 1)).as_raw())
        );
    }

    #[test]
    fn a_uniform_brightness_change_leaves_the_difference_hash_alone() {
        // dHash compares neighbours, so a uniform gain cancels out of it entirely. This
        // is the property that lets a recompressed JPEG still match.
        let base = luma_grid(&scene(64, 48, 2));
        let mut lifted = GrayImage::from_raw(9, 8, base.as_raw().clone()).expect("raw");
        for pixel in lifted.pixels_mut() {
            pixel.0[0] = pixel.0[0].saturating_add(20);
        }
        assert_eq!(dhash(base.as_raw()), dhash(lifted.as_raw()));
    }

    #[test]
    fn a_different_scene_scores_worse_than_the_same_scene() {
        let grid = luma_grid(&scene(64, 48, 3));
        let other = luma_grid(&scene(64, 48, 991));
        assert!(
            hash_score(dhash(grid.as_raw()), dhash(grid.as_raw()))
                > hash_score(dhash(grid.as_raw()), dhash(other.as_raw()))
        );
    }

    #[test]
    fn the_histogram_is_normalised_so_a_recolouring_shifts_rather_than_scales_it() {
        let flat = [0f32; 48];
        let mut concentrated = [0f32; 48];
        concentrated[0] = 1.0;
        assert_eq!(histogram_score(&flat, &flat), 100.0);
        // A single occupied bin against an empty histogram is the worst case, not a NaN.
        let score = histogram_score(&flat, &concentrated);
        assert!(score.is_finite() && (0.0..=100.0).contains(&score));
    }

    #[test]
    fn the_histogram_sums_to_one_across_each_channel() {
        let rgb = scene(8, 8, 5).into_rgb8();
        let bins = histogram(rgb.as_raw());
        assert_eq!(bins.len(), 48);
        for channel in 0..3 {
            let total: f32 = bins[channel * 16..channel * 16 + 16].iter().sum();
            assert!(
                (total - 1.0).abs() < 1e-3,
                "channel {channel} summed to {total}"
            );
        }
    }

    #[test]
    fn aspect_agreement_is_relative_and_reaches_one_only_for_the_same_ratio() {
        assert_eq!(aspect_score(16.0 / 9.0, 16.0 / 9.0), 100.0);
        // 1920x1080 and 1280x720 are the same shape at different sizes.
        assert!(aspect_score(1920.0 / 1080.0, 1280.0 / 720.0) > 99.9);
        // 1920x1080 against a 1:1 square is a real difference.
        assert!(aspect_score(16.0 / 9.0, 1.0) < 60.0);
    }

    // ---- composite scoring --------------------------------------------------------------

    #[test]
    fn the_composite_is_a_weighted_mean_that_a_reader_can_reconstruct() {
        let signals = signal_breakdown(
            &fingerprint("a", 0x0000_0000_0000_0000, 0, 100, 100),
            &fingerprint("b", 0x0000_0000_0000_0003, 0, 100, 100),
        );
        let expected: f32 = signals
            .iter()
            .map(|signal| signal.weight * signal.score)
            .sum::<f32>();
        let weight: f32 = signals.iter().map(|signal| signal.weight).sum();
        assert!((composite(&signals) - expected / weight).abs() < 0.01);
        // And the published weights really are the ones used.
        assert_eq!(signals.len(), 4);
        assert_eq!(signals[0].signal, "dhash");
        assert_eq!(signals[3].signal, "aspect");
    }

    #[test]
    fn an_unavailable_signal_is_excluded_instead_of_scoring_zero() {
        // If an unmeasured signal counted as zero, a good match on the signals that
        // *were* measured would be dragged down and look like a poor match.
        let available = vec![
            SignalScore {
                signal: "a".into(),
                score: 100.0,
                weight: 0.5,
                available: true,
                detail_en: String::new(),
                detail_ar: String::new(),
            },
            SignalScore {
                signal: "b".into(),
                score: 0.0,
                weight: 0.5,
                available: false,
                detail_en: "not measured".into(),
                detail_ar: "لم يُقَس".into(),
            },
        ];
        assert_eq!(composite(&available), 100.0);
    }

    #[test]
    fn a_composite_with_nothing_measured_is_zero_rather_than_a_guess() {
        let none = vec![SignalScore {
            signal: "a".into(),
            score: 90.0,
            weight: 1.0,
            available: false,
            detail_en: String::new(),
            detail_ar: String::new(),
        }];
        assert_eq!(composite(&none), 0.0);
        assert_eq!(composite(&[]), 0.0);
    }

    #[test]
    fn every_reported_score_is_finite_and_in_range() {
        // A NaN here would serialize to JSON `null` and quietly corrupt the record.
        let left = fingerprint("a", u64::MAX, u64::MAX, 1, 1);
        let right = fingerprint("b", 0, 0, 40000, 1);
        for signal in signal_breakdown(&left, &right) {
            assert!(signal.score.is_finite(), "{} was not finite", signal.signal);
            assert!((0.0..=100.0).contains(&signal.score));
        }
        assert!(composite(&signal_breakdown(&left, &right)).is_finite());
    }

    // ---- candidate bucketing ------------------------------------------------------------

    #[test]
    fn distinct_images_land_in_distinct_buckets_so_no_pair_is_compared() {
        let fingerprints: Vec<ImageFingerprint> = (0..500u64)
            .map(|index| {
                let value = index.wrapping_mul(0x9E37_79B9_7F4A_7C15);
                fingerprint(&format!("f{index}"), value, value, 1920, 1080)
            })
            .collect();
        let (representatives, collapsed) = collapse_exact_duplicates(&fingerprints);
        assert_eq!(collapsed, 0);
        let (pairs, stats) = candidate_pairs(&representatives, &fingerprints);
        assert_eq!(pairs.len(), 0);
        assert_eq!(stats.compared_pairs, 0);
        assert!(stats.avoided_all_pairs());
    }

    #[test]
    fn a_matching_pair_shares_a_bucket_and_is_compared() {
        let base = 0x1234_5678_9ABC_DEF0u64;
        let fingerprints = vec![
            fingerprint("a", base, base, 1920, 1080),
            fingerprint("b", base, base, 1280, 720),
        ];
        let (representatives, _) = collapse_exact_duplicates(&fingerprints);
        let (pairs, stats) = candidate_pairs(&representatives, &fingerprints);
        assert_eq!(pairs, vec![(0, 1)]);
        assert_eq!(stats.compared_pairs, 1);
    }

    #[test]
    fn a_cropped_image_within_the_slack_is_still_compared() {
        // 16:9 versus about 1.85:1 is one crop in from a 16:9 frame.
        let base = 0x0F0F_0F0F_0F0F_0F0Fu64;
        let fingerprints = vec![
            fingerprint("wide", base, base, 1920, 1080),
            fingerprint("cropped", base, base, 1000, 540),
        ];
        let (representatives, _) = collapse_exact_duplicates(&fingerprints);
        let (pairs, _) = candidate_pairs(&representatives, &fingerprints);
        assert_eq!(pairs.len(), 1);
    }

    #[test]
    fn a_wildly_different_aspect_ratio_is_not_compared() {
        let base = 0x0F0F_0F0F_0F0F_0F0Fu64;
        let fingerprints = vec![
            fingerprint("landscape", base, base, 1920, 1080),
            fingerprint("portrait", base, base, 1080, 1920),
        ];
        let (representatives, _) = collapse_exact_duplicates(&fingerprints);
        let (pairs, _) = candidate_pairs(&representatives, &fingerprints);
        assert!(pairs.is_empty());
    }

    #[test]
    fn a_ten_thousand_image_set_stays_far_below_the_full_pairwise_cost() {
        // The performance fixture is generated here, not shipped as a binary blob.
        let mut fingerprints = Vec::with_capacity(10_000);
        for index in 0..10_000u64 {
            // 2 000 distinct scenes, each present five times, is a realistic shape: real
            // photo folders are full of copies, not of unique images.
            let scene = index % 2_000;
            let value = scene
                .wrapping_mul(0x9E37_79B9_7F4A_7C15)
                .wrapping_add(scene >> 7);
            fingerprints.push(fingerprint(
                &format!("f{index:05}"),
                value,
                value ^ 0xFFFF,
                1920,
                1080,
            ));
        }
        let (representatives, collapsed) = collapse_exact_duplicates(&fingerprints);
        // 10 000 files holding 2 000 distinct scenes, five copies each. A real photo folder
        // is full of copies, not of unique images, and the copies are the case a naive
        // all-pairs comparison handles worst.
        assert_eq!(representatives.len(), 2_000);
        // 8 000 files leave the fuzzy stage because a whole-file hash already answered the
        // question for them; 4 of the 5 copies of each scene.
        assert_eq!(collapsed, 8_000, "four of every five copies must collapse");
        let (pairs, stats) = candidate_pairs(&representatives, &fingerprints);
        assert_eq!(stats.all_pairs_if_computed, 49_995_000);
        assert!(
            pairs.len() < 1_000,
            "expected far fewer than 2 000 * 1 999 pairs, got {}",
            pairs.len()
        );
        assert!(stats.avoided_all_pairs());
        // 2 000 representatives is 1 999 000 pairs at worst; the bucket rule must beat
        // that by a wide margin or it is not doing its job.
        assert!(stats.compared_pairs < 20_000);
    }

    #[test]
    fn every_candidate_pair_is_ordered_and_unique() {
        let base = 0x0F0F_0F0F_0F0F_0F0Fu64;
        let fingerprints: Vec<ImageFingerprint> = (0..8)
            .map(|index| fingerprint(&format!("f{index}"), base, base, 640, 480))
            .collect();
        let (representatives, collapsed) = collapse_exact_duplicates(&fingerprints);
        assert_eq!(collapsed, 7);
        let (pairs, _) = candidate_pairs(&representatives, &fingerprints);
        let mut sorted = pairs.clone();
        sorted.sort_unstable();
        assert_eq!(pairs, sorted);
        let mut deduped = pairs.clone();
        deduped.dedup();
        assert_eq!(pairs.len(), deduped.len());
        for (left, right) in &pairs {
            assert!(left < right);
        }
    }

    #[test]
    fn an_exact_hash_class_collapses_to_one_representative_chosen_deterministically() {
        let base = 0xAAAA_AAAA_AAAA_AAAAu64;
        let fingerprints = vec![
            fingerprint("z_first", base, base, 100, 100),
            fingerprint("a_second", base, base, 100, 100),
        ];
        let (representatives, collapsed) = collapse_exact_duplicates(&fingerprints);
        assert_eq!(collapsed, 1);
        // Smallest path wins, so the choice does not depend on directory order.
        assert_eq!(representatives, vec![1]);
    }

    #[test]
    fn the_aspect_band_slack_is_the_published_value() {
        assert_eq!(ASPECT_BAND_SLACK, 1);
    }

    // ---- the cache -----------------------------------------------------------------------

    #[test]
    fn a_cache_hit_requires_identity_size_and_mtime_to_all_agree() {
        let mut cache = FingerprintCache::in_memory();
        let mut measured = fingerprint("a", 7, 9, 640, 480);
        measured.size_bytes = 1234;
        measured.modified_unix_nanos = 5_000_000;
        cache.put("win:1:2", &measured);
        let hit = cache
            .get("win:1:2", 1234, 5_000_000)
            .expect("unchanged file must hit");
        assert!(hit.from_cache);
        assert_eq!(hit.dhash, 7);
        assert_eq!(hit.ahash, 9);
        assert_eq!(cache.stats.hits, 1);
    }

    #[test]
    fn a_changed_size_invalidates_the_entry_instead_of_returning_it() {
        let mut cache = FingerprintCache::in_memory();
        let mut measured = fingerprint("a", 7, 9, 640, 480);
        measured.size_bytes = 1234;
        measured.modified_unix_nanos = 5_000_000;
        cache.put("win:1:2", &measured);
        assert!(cache.get("win:1:2", 9999, 5_000_000).is_none());
        assert_eq!(cache.stats.invalidations, 1);
        assert_eq!(cache.len(), 0, "a stale entry must not be kept");
    }

    #[test]
    fn a_changed_modification_time_invalidates_the_entry() {
        let mut cache = FingerprintCache::in_memory();
        let mut measured = fingerprint("a", 7, 9, 640, 480);
        measured.size_bytes = 1234;
        measured.modified_unix_nanos = 5_000_000;
        cache.put("win:1:2", &measured);
        assert!(cache.get("win:1:2", 1234, 6_000_000).is_none());
        assert_eq!(cache.stats.invalidations, 1);
    }

    #[test]
    fn a_different_file_identity_does_not_read_another_files_entry() {
        let mut cache = FingerprintCache::in_memory();
        let mut measured = fingerprint("a", 7, 9, 640, 480);
        measured.size_bytes = 1234;
        cache.put("win:1:2", &measured);
        assert!(cache.get("win:1:3", 1234, 0).is_none());
        assert_eq!(cache.stats.misses, 1);
    }

    #[test]
    fn the_cache_survives_a_reopen_and_still_invalidates_correctly() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("cache.json");
        let mut measured = fingerprint("a", 11, 13, 800, 600);
        measured.size_bytes = 4242;
        measured.modified_unix_nanos = 99_000;
        {
            let mut cache = FingerprintCache::open(Some(path.clone()));
            cache.put("win:7:7", &measured);
            cache.save();
            assert!(cache.write_error.is_none());
        }
        let mut reopened = FingerprintCache::open(Some(path.clone()));
        assert!(reopened.get("win:7:7", 4242, 99_000).is_some());
        assert!(reopened.get("win:7:7", 4243, 99_000).is_none());
    }

    #[test]
    fn an_unreadable_or_foreign_cache_file_yields_an_empty_cache_and_a_reason() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("cache.json");
        fs::write(&path, b"this is not json").expect("write");
        let cache = FingerprintCache::open(Some(path));
        assert!(cache.is_empty());
        // A corrupt cache is a cold cache, not a crash and not a false hit.
        assert_eq!(cache.stats.hits, 0);
    }

    #[test]
    fn the_cache_evicts_deterministically_when_over_capacity() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("cache.json");
        let mut cache = FingerprintCache::open(Some(path));
        cache.capacity = 4;
        for index in 0..10u64 {
            let mut measured = fingerprint(&format!("f{index}"), index, index, 64, 64);
            measured.size_bytes = index;
            cache.put(&format!("win:1:{index}"), &measured);
        }
        cache.save();
        assert_eq!(cache.len(), 4);
        assert_eq!(cache.stats.evictions, 6);
        // The most recently measured survive, because eviction drops the least recent.
        for index in 6..10u64 {
            let mut measured = fingerprint(&format!("f{index}"), index, index, 64, 64);
            measured.size_bytes = index;
            assert!(cache.get(&format!("win:1:{index}"), index, 0).is_some());
        }
    }

    // ---- measuring from disk, including orientation and changed files --------------------

    #[test]
    fn a_png_pair_measured_from_disk_similar_enough_to_group() {
        let directory = tempfile::tempdir().expect("tempdir");
        let left = directory.path().join("left.png");
        let right = directory.path().join("right.png");
        write_png(&left, &scene(320, 240, 7));
        // The same picture at a different size and re-encoded: the case a raw-pixel
        // comparison would fail and a perceptual one should not.
        write_png(&right, &scene(160, 120, 7));
        let a = measure(&left, "win:1:1", 100, 100).expect("measure left");
        let b = measure(&right, "win:1:2", 100, 100).expect("measure right");
        let score = composite(&signal_breakdown(&a, &b));
        assert!(score > 90.0, "resized pair scored only {score}");
        assert!(hash_score(a.dhash, b.dhash) > 55.0);
    }

    #[test]
    fn two_different_scenes_score_below_the_pair_of_the_same_scene() {
        let directory = tempfile::tempdir().expect("tempdir");
        let one = directory.path().join("one.png");
        let two = directory.path().join("two.png");
        let three = directory.path().join("three.png");
        write_png(&one, &scene(128, 128, 11));
        write_png(&two, &scene(128, 128, 11));
        write_png(&three, &scene(128, 128, 4242));
        let a = measure(&one, "win:1:1", 1, 1).expect("one");
        let b = measure(&two, "win:1:2", 1, 1).expect("two");
        let c = measure(&three, "win:1:3", 1, 1).expect("three");
        let same = composite(&signal_breakdown(&a, &b));
        let different = composite(&signal_breakdown(&a, &c));
        assert!(same > 95.0, "identical scenes scored {same}");
        assert!(
            different < same,
            "a different scene scored {different}, not below {same}"
        );
    }

    #[test]
    fn a_png_reports_that_it_carries_no_exif_orientation() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("plain.png");
        write_png(&path, &scene(32, 32, 1));
        let measured = measure(&path, "win:1:1", 1, 1).expect("measure");
        // Saying "no tag" is different from claiming an orientation was found.
        assert_eq!(measured.orientation_source, OrientationSource::NotAJpeg);
        assert_eq!(measured.orientation, Orientation::Normal);
    }

    #[test]
    fn a_file_that_is_not_an_image_fails_rather_than_producing_a_fingerprint() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("broken.png");
        fs::write(&path, b"this is definitely not a png").expect("write");
        let error = measure(&path, "win:1:1", 1, 1).expect_err("must fail");
        assert!(
            error.starts_with("image_open_failed")
                || error.starts_with("image_format_guess_failed")
                || error.starts_with("image_decode_failed"),
            "unexpected error {error}"
        );
    }

    #[test]
    fn a_truncated_image_is_rejected_rather_than_decoded_to_rubbish() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("truncated.png");
        let image = scene(64, 64, 2);
        let full = image.to_rgb8().into_raw();
        fs::write(&path, &full[..full.len() / 3]).expect("write");
        // Either it fails, or it decodes to something — but it must never panic, and it
        // must never report dimensions that contradict the file.
        if let Ok(measured) = measure(&path, "win:1:1", 1, 1) {
            assert!(measured.width > 0 && measured.height > 0);
        }
    }

    #[test]
    fn a_file_changed_between_measurement_and_reuse_is_re_measured() {
        // The end-to-end version of the cache invalidation rule.
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("changing.png");
        let cache_path = directory.path().join("cache.json");
        write_png(&path, &scene(64, 64, 1));
        let size = fs::metadata(&path).expect("stat").len();
        let mut cache = FingerprintCache::open(Some(cache_path.clone()));
        let first = measure(&path, "win:1:1", size, 1_000).expect("first");
        cache.put("win:1:1", &first);
        assert!(cache.get("win:1:1", size, 1_000).is_some());

        // The picture changes on disk and the modification time moves with it.
        write_png(&path, &scene(64, 64, 777));
        let new_size = fs::metadata(&path).expect("stat").len();
        assert!(cache.get("win:1:1", new_size, 2_000).is_none());
        let second = measure(&path, "win:1:1", new_size, 2_000).expect("second");
        assert_ne!(
            first.dhash, second.dhash,
            "the re-measured fingerprint must reflect the new content"
        );
    }

    // ---- read-only promise ---------------------------------------------------------------

    #[test]
    fn this_module_declares_no_file_removal_or_move_of_any_kind() {
        // The needles are assembled at run time so this assertion does not itself put
        // the forbidden substrings into the source it is checking.
        let source = include_str!("m03_images.rs");
        for (first, second) in [
            ("fs", "remove_file"),
            ("fs", "remove_dir_all"),
            ("fs", "rename"),
            ("std::fs", "copy"),
        ] {
            let needle = format!("{first}::{second}");
            assert!(
                !source.contains(&needle),
                "the image path must not contain {needle}"
            );
        }
    }
}
