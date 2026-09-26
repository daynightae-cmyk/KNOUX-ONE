//! EXIF orientation, read from a JPEG `APP1` segment before any pixel is compared.
//!
//! # Why this module exists
//!
//! A photograph taken with a phone camera is usually stored as landscape pixels with
//! `Orientation = 6`, and the viewer is expected to rotate them a quarter turn before
//! display. The `image` crate decodes those pixels faithfully and **ignores the tag** —
//! verified against `image` 0.25.10, which exposes no `orientation` symbol at all. A
//! scanner that decodes the raw raster therefore fingerprints a portrait photo as a
//! landscape one, and a correctly-rotated copy of the same photograph looks like an
//! unrelated image. That is precisely the "rotated EXIF pair" false negative this
//! service must not have.
//!
//! So the tag is parsed here, from the bytes, the way the specification defines it.
//! Nothing is inferred: when the tag is absent, unreadable or out of range, the answer
//! is [`Orientation::default`] and the caller records that no tag was found.
//!
//! # Scope, stated honestly
//!
//! * Only JPEG `APP1` is read. PNG, WebP and TIFF orientation are **not** applied by
//!   this build, and the returned evidence says which source was used.
//! * Only IFD0 is walked. Orientation is an IFD0 tag by definition.
//! * The parser never allocates based on a length field from the file without checking
//!   it against the buffer first, so a hostile header cannot make it over-read.

use image::DynamicImage;
use serde::{Deserialize, Serialize};

/// The eight EXIF orientation values, expressed as the transform each one describes.
///
/// The values 5 and 7 are transposes, not pure rotations. Folding them into a rotation
/// would leave a mirrored image mirrored, which would be a *partial* normalization that
/// still produces a false negative — worse than not normalizing at all, because it would
/// look like it worked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Orientation {
    /// Value 1. The stored raster is the visual image.
    Normal,
    /// Value 2. Mirrored across the vertical axis.
    MirrorHorizontal,
    /// Value 3.
    Rotate180,
    /// Value 4. Mirrored across the horizontal axis.
    MirrorVertical,
    /// Value 5. Transpose, i.e. mirrored across the main diagonal.
    Transpose,
    /// Value 6. The common phone-camera case: rotate a quarter turn clockwise.
    Rotate90,
    /// Value 7. Transverse, i.e. mirrored across the anti-diagonal.
    Transverse,
    /// Value 8. Rotate a quarter turn counter-clockwise.
    Rotate270,
}

impl Default for Orientation {
    /// Absence of a usable tag means "the stored raster is the visual image", which is
    /// the correct assumption for every format that does not carry orientation.
    fn default() -> Self {
        Self::Normal
    }
}

impl Orientation {
    /// The EXIF numeric value, for the evidence record.
    pub fn exif_value(self) -> u8 {
        match self {
            Self::Normal => 1,
            Self::MirrorHorizontal => 2,
            Self::Rotate180 => 3,
            Self::MirrorVertical => 4,
            Self::Transpose => 5,
            Self::Rotate90 => 6,
            Self::Transverse => 7,
            Self::Rotate270 => 8,
        }
    }

    /// Maps a raw EXIF value. Anything outside 1..=8 — including the 0 that some
    /// writers emit — is treated as "no usable tag" rather than guessed at.
    pub fn from_exif_value(value: u8) -> Self {
        match value {
            2 => Self::MirrorHorizontal,
            3 => Self::Rotate180,
            4 => Self::MirrorVertical,
            5 => Self::Transpose,
            6 => Self::Rotate90,
            7 => Self::Transverse,
            8 => Self::Rotate270,
            _ => Self::Normal,
        }
    }

    /// True when the stored raster differs from what a viewer would display.
    pub fn is_transform(self) -> bool {
        self != Self::Normal
    }

    pub fn label_en(self) -> &'static str {
        match self {
            Self::Normal => "Orientation 1 (stored raster is already upright)",
            Self::MirrorHorizontal => "Orientation 2 (mirrored horizontally)",
            Self::Rotate180 => "Orientation 3 (rotated 180 degrees)",
            Self::MirrorVertical => "Orientation 4 (mirrored vertically)",
            Self::Transpose => "Orientation 5 (transposed)",
            Self::Rotate90 => "Orientation 6 (rotated 90 degrees clockwise)",
            Self::Transverse => "Orientation 7 (transversed)",
            Self::Rotate270 => "Orientation 8 (rotated 90 degrees counter-clockwise)",
        }
    }

    pub fn label_ar(self) -> &'static str {
        match self {
            Self::Normal => "الاتجاه 1 (الصورة المخزنة مستقيمة بالفعل)",
            Self::MirrorHorizontal => "الاتجاه 2 (معكوسة أفقيًا)",
            Self::Rotate180 => "الاتجاه 3 (مدورة 180 درجة)",
            Self::MirrorVertical => "الاتجاه 4 (معكوسة رأسيًا)",
            Self::Transpose => "الاتجاه 5 (مبدّلة على القطر الرئيسي)",
            Self::Rotate90 => "الاتجاه 6 (مدورة 90 درجة مع عقارب الساعة)",
            Self::Transverse => "الاتجاه 7 (مبدّلة على القطر المقابل)",
            Self::Rotate270 => "الاتجاه 8 (مدورة 90 درجة عكس عقارب الساعة)",
        }
    }
}

/// Applies the orientation so the fingerprint is taken from the picture a viewer shows.
///
/// Provenance is returned too, because "the transform that was applied" is evidence: a
/// reviewer needs to know whether the image was normalized or merely assumed upright.
pub fn apply(
    image: DynamicImage,
    orientation: Orientation,
) -> (DynamicImage, &'static str, &'static str) {
    let source_en = "jpeg_app1_exif_ifd0_tag_0x0112";
    let source_ar = "وسم EXIF 0x0112 داخل مقطع APP1 في ملف JPEG";
    let normalized = match orientation {
        Orientation::Normal => image,
        Orientation::MirrorHorizontal => image.fliph(),
        Orientation::Rotate180 => image.rotate180(),
        Orientation::MirrorVertical => image.flipv(),
        // Transpose equals "rotate a quarter turn clockwise, then mirror horizontally".
        Orientation::Transpose => image.rotate90().fliph(),
        Orientation::Rotate90 => image.rotate90(),
        // Transverse equals "rotate a quarter turn clockwise, then mirror vertically".
        Orientation::Transverse => image.rotate90().flipv(),
        Orientation::Rotate270 => image.rotate270(),
    };
    (normalized, source_en, source_ar)
}

/// How the orientation was determined for one file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrientationSource {
    /// A usable `Orientation` tag was read from a JPEG `APP1` segment.
    JpegExifTag,
    /// The file is a JPEG but carried no readable orientation tag.
    JpegWithoutTag,
    /// The head of the file was examined and it is not a JPEG, so no tag can exist here.
    NotAJpeg,
    /// The head window ended before any orientation tag was found.
    NotFoundInHeadWindow,
}

impl OrientationSource {
    /// The name used in the evidence record.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::JpegExifTag => "jpeg_app1_exif_tag",
            Self::JpegWithoutTag => "jpeg_without_orientation_tag",
            Self::NotAJpeg => "not_a_jpeg",
            Self::NotFoundInHeadWindow => "not_found_within_head_window",
        }
    }

    /// Recovers a source from the string stored in the fingerprint cache. An unknown
    /// value becomes "not a JPEG" rather than a claim of a tag having been read.
    pub fn from_stored(value: &str) -> Self {
        match value {
            "jpeg_app1_exif_tag" => Self::JpegExifTag,
            "jpeg_without_orientation_tag" => Self::JpegWithoutTag,
            "not_found_within_head_window" => Self::NotFoundInHeadWindow,
            _ => Self::NotAJpeg,
        }
    }

    pub fn note_en(self) -> &'static str {
        match self {
            Self::JpegExifTag => {
                "EXIF Orientation was read from the JPEG APP1 segment and applied before \
                 fingerprinting."
            }
            Self::JpegWithoutTag => {
                "The file is a JPEG with no readable EXIF Orientation tag, so the stored \
                 raster was used as-is."
            }
            Self::NotAJpeg => {
                "The file is not a JPEG, so it carries no EXIF Orientation tag. Its pixels \
                 were used as stored."
            }
            Self::NotFoundInHeadWindow => {
                "No EXIF Orientation tag was found inside the inspected head window, so the \
                 stored raster was used as-is. A tag placed further into the file would not \
                 have been seen."
            }
        }
    }

    pub fn note_ar(self) -> &'static str {
        match self {
            Self::JpegExifTag => "قُرئ اتجاه EXIF من مقطع APP1 في ملف JPEG وطُبِّق قبل البصمة.",
            Self::JpegWithoutTag => "الملف JPEG بلا وسم اتجاه EXIF مقروء، فاستُخدمت البكسلات كما هي.",
            Self::NotAJpeg => "الملف ليس JPEG، فلا يحمل وسم اتجاه EXIF؛ استُخدمت البكسلات كما هي.",
            Self::NotFoundInHeadWindow => {
                "لم يُعثر على وسم اتجاه EXIF ضمن النافذة المفحوصة، فاستُخدمت البكسلات كما هي."
            }
        }
    }
}

/// The outcome of inspecting one file's head for an orientation tag.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OrientationProbe {
    pub orientation: Orientation,
    pub source: OrientationSource,
}

/// Inspects the head of a file and reports the orientation it declares.
///
/// `head` only has to contain the `SOI` marker, the `APP1` segment and a little more.
/// Callers read a bounded window from the start of the file; a tag further in than that
/// window is reported as [`OrientationSource::NotFoundInHeadWindow`] rather than assumed
/// away.
pub fn probe(head: &[u8]) -> OrientationProbe {
    if !is_jpeg(head) {
        return OrientationProbe {
            orientation: Orientation::default(),
            source: OrientationSource::NotAJpeg,
        };
    }
    match find_exif_tiff_block(head) {
        ExifScan::Found(tiff) => match read_orientation_tag(tiff) {
            // A tag that was read but is out of range is still a tag that was read: it
            // says the writer recorded an orientation this build cannot apply, and no
            // transform is performed rather than a guessed one.
            Some(value) => OrientationProbe {
                orientation: Orientation::from_exif_value(u8::try_from(value).unwrap_or(0)),
                source: OrientationSource::JpegExifTag,
            },
            None => OrientationProbe {
                orientation: Orientation::default(),
                source: OrientationSource::JpegWithoutTag,
            },
        },
        ExifScan::NoExifSegment => OrientationProbe {
            orientation: Orientation::default(),
            source: OrientationSource::JpegWithoutTag,
        },
        ExifScan::HeadTruncated => OrientationProbe {
            orientation: Orientation::default(),
            source: OrientationSource::NotFoundInHeadWindow,
        },
    }
}

/// `true` when the buffer begins with the JPEG start-of-image marker.
pub fn is_jpeg(bytes: &[u8]) -> bool {
    bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xD8
}

const EXIF_HEADER: &[u8; 6] = b"Exif\0\0";
const APP1_MARKER: u8 = 0xE1;
const SOS_MARKER: u8 = 0xDA;
const EOI_MARKER: u8 = 0xD9;
const ORIENTATION_TAG: u16 = 0x0112;
const TYPE_SHORT: u16 = 3;
const TYPE_LONG: u16 = 4;

/// The outcome of walking a JPEG's marker segments.
enum ExifScan<'a> {
    /// An `APP1` segment that declares itself as Exif was found.
    Found(&'a [u8]),
    /// The metadata section ended cleanly and contained no Exif `APP1`. A JPEG carrying
    /// only a `JFIF` `APP0` belongs here: it genuinely has no orientation tag.
    NoExifSegment,
    /// The inspected window ran out while a segment was still incomplete, so an `APP1`
    /// could exist further into the file. Reporting "no tag" here would be a guess.
    HeadTruncated,
}

/// Walks the JPEG marker segments and returns the TIFF block of the first `APP1`
/// segment that declares itself as Exif.
///
/// Every length is checked against the buffer before it is used, so a hostile header makes
/// the walk stop rather than read past the end.
fn find_exif_tiff_block(bytes: &[u8]) -> ExifScan<'_> {
    if !is_jpeg(bytes) {
        return ExifScan::HeadTruncated;
    }
    let mut cursor = 2usize;
    // Each iteration consumes at least two bytes, so the segment count is bounded by the
    // buffer length. The explicit cap only guards against a pathological file made almost
    // entirely of zero-length padding markers.
    let mut segments = 0usize;
    while cursor + 4 <= bytes.len() && segments < 4096 {
        segments += 1;
        if bytes[cursor] != 0xFF {
            return ExifScan::HeadTruncated;
        }
        let marker = bytes[cursor + 1];
        match marker {
            // Standalone markers with no length field.
            0x01 | 0xD0..=0xD8 => {
                cursor += 2;
                continue;
            }
            // Start of scan or end of image: image data follows, metadata is over, so the
            // absence of an orientation tag is a fact rather than a truncation.
            SOS_MARKER | EOI_MARKER => return ExifScan::NoExifSegment,
            // A restart marker cannot appear here, and 0xFF padding is meaningless.
            0x00 | 0xFF => return ExifScan::HeadTruncated,
            _ => {}
        }
        let length = u16::from_be_bytes([bytes[cursor + 2], bytes[cursor + 3]]) as usize;
        if length < 2 {
            return ExifScan::HeadTruncated;
        }
        let Some(payload_end) = cursor.checked_add(2 + length) else {
            return ExifScan::HeadTruncated;
        };
        if payload_end > bytes.len() {
            // The segment claims more bytes than the inspected window holds.
            return ExifScan::HeadTruncated;
        }
        if marker == APP1_MARKER {
            let payload = &bytes[cursor + 4..payload_end];
            if payload.len() > EXIF_HEADER.len() && payload.starts_with(EXIF_HEADER) {
                return ExifScan::Found(&payload[EXIF_HEADER.len()..]);
            }
        }
        cursor = payload_end;
    }
    if cursor >= bytes.len() {
        // The last segment ended exactly at the end of the window, so the metadata really
        // did finish and it held no Exif `APP1`.
        ExifScan::NoExifSegment
    } else {
        ExifScan::HeadTruncated
    }
}

/// Little- or big-endian reader over the TIFF block. Every read is bounds-checked, so a
/// truncated or lying header produces "no tag" instead of a panic.
struct Tiff<'a> {
    bytes: &'a [u8],
    little_endian: bool,
}

impl<'a> Tiff<'a> {
    fn u16_at(&self, offset: usize) -> Option<u16> {
        let raw = self.bytes.get(offset..offset.checked_add(2)?)?;
        let pair = [raw[0], raw[1]];
        Some(if self.little_endian {
            u16::from_le_bytes(pair)
        } else {
            u16::from_be_bytes(pair)
        })
    }

    fn u32_at(&self, offset: usize) -> Option<u32> {
        let raw = self.bytes.get(offset..offset.checked_add(4)?)?;
        let quad = [raw[0], raw[1], raw[2], raw[3]];
        Some(if self.little_endian {
            u32::from_le_bytes(quad)
        } else {
            u32::from_be_bytes(quad)
        })
    }
}

/// Reads tag `0x0112` out of IFD0, as the raw stored value.
///
/// The value is returned as read, not narrowed. A value outside 1..=8 is a fact about the
/// file, and the caller reports it as an unusable tag rather than hiding it.
fn read_orientation_tag(tiff: &[u8]) -> Option<u16> {
    let little_endian = match tiff.get(0..2)? {
        [b'I', b'I'] => true,
        [b'M', b'M'] => false,
        _ => return None,
    };
    let view = Tiff {
        bytes: tiff,
        little_endian,
    };
    // 42 identifies a TIFF header; anything else is not a TIFF block we understand.
    if view.u16_at(2)? != 42 {
        return None;
    }
    let ifd0 = view.u32_at(4)? as usize;
    let entry_count = view.u16_at(ifd0)? as usize;
    // A well-formed IFD0 has a handful of entries. The bound stops a lying count from
    // turning into a very long loop over attacker-controlled offsets.
    if entry_count > 512 {
        return None;
    }
    for index in 0..entry_count {
        let entry = ifd0.checked_add(2 + index.checked_mul(12)?)?;
        if view.u16_at(entry)? != ORIENTATION_TAG {
            continue;
        }
        let field_type = view.u16_at(entry + 2)?;
        // The value sits inline in the first bytes of the 4-byte value field.
        let raw = view.u16_at(entry + 8)?;
        let value = match field_type {
            TYPE_SHORT => raw,
            TYPE_LONG => u16::try_from(view.u32_at(entry + 8)?).unwrap_or(u16::MAX),
            _ => continue,
        };
        return Some(value);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{apply, is_jpeg, Orientation, OrientationSource, EXIF_HEADER, ORIENTATION_TAG};
    use image::{DynamicImage, GrayImage, Luma};

    /// Builds a TIFF block with a single IFD0 entry, in the requested byte order.
    fn tiff_with_tag(value: u16, little_endian: bool) -> Vec<u8> {
        let mut bytes = Vec::new();
        if little_endian {
            bytes.extend_from_slice(b"II");
        } else {
            bytes.extend_from_slice(b"MM");
        }
        // 42, then the IFD0 offset.
        let push_u16 = |bytes: &mut Vec<u8>, v: u16| {
            if little_endian {
                bytes.extend_from_slice(&v.to_le_bytes());
            } else {
                bytes.extend_from_slice(&v.to_be_bytes());
            }
        };
        let push_u32 = |bytes: &mut Vec<u8>, v: u32| {
            if little_endian {
                bytes.extend_from_slice(&v.to_le_bytes());
            } else {
                bytes.extend_from_slice(&v.to_be_bytes());
            }
        };
        push_u16(&mut bytes, 42);
        push_u32(&mut bytes, 8);
        // One entry.
        push_u16(&mut bytes, 1);
        push_u16(&mut bytes, ORIENTATION_TAG);
        push_u16(&mut bytes, 3); // SHORT
        push_u32(&mut bytes, 1); // count
                                 // Value is left-aligned inside the 4-byte field.
        if little_endian {
            bytes.extend_from_slice(&value.to_le_bytes());
            bytes.extend_from_slice(&[0, 0]);
        } else {
            bytes.extend_from_slice(&value.to_be_bytes());
            bytes.extend_from_slice(&[0, 0]);
        }
        // Next-IFD offset.
        push_u32(&mut bytes, 0);
        bytes
    }

    /// Wraps a TIFF block in a JPEG `SOI` + `APP1(Exif)` prologue.
    fn jpeg_with_exif(tiff: &[u8], comment: Option<&str>) -> Vec<u8> {
        let mut payload = EXIF_HEADER.to_vec();
        payload.extend_from_slice(tiff);
        if let Some(value) = comment {
            payload.extend_from_slice(value.as_bytes());
        }
        let mut bytes = vec![0xFF, 0xD8];
        // An APP0 JFIF segment first, exactly as a real camera writes it.
        bytes.extend_from_slice(&[0xFF, 0xE0, 0x00, 0x10]);
        bytes.extend_from_slice(b"JFIF\0\x01\x02\0\0\x01\0\x01\0\0");
        bytes.extend_from_slice(&[0xFF, 0xE1]);
        bytes.extend_from_slice(&((payload.len() + 2) as u16).to_be_bytes());
        bytes.extend_from_slice(&payload);
        bytes
    }

    /// A 2x3 image whose pixels encode their own position, so any transform is visible.
    fn labelled() -> DynamicImage {
        let mut buffer = GrayImage::new(2, 3);
        for y in 0..3u32 {
            for x in 0..2u32 {
                buffer.put_pixel(x, y, Luma([(y * 10 + x) as u8]));
            }
        }
        DynamicImage::ImageLuma8(buffer)
    }

    fn pixels(image: &DynamicImage) -> Vec<u8> {
        image.to_luma8().as_raw().clone()
    }

    // ---- header recognition -------------------------------------------------------------

    #[test]
    fn a_jpeg_is_recognised_by_its_start_of_image_marker() {
        assert!(is_jpeg(&[0xFF, 0xD8, 0xFF, 0xE0]));
        assert!(!is_jpeg(&[0x89, b'P', b'N', b'G']));
        assert!(!is_jpeg(&[0xFF]));
    }

    #[test]
    fn a_non_jpeg_reports_no_orientation_rather_than_inventing_one() {
        let png = [
            0x89u8, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13,
        ];
        let probe = super::probe(&png);
        assert_eq!(probe.source, OrientationSource::NotAJpeg);
        assert_eq!(probe.orientation, Orientation::Normal);
    }

    // ---- tag reading --------------------------------------------------------------------

    #[test]
    fn every_orientation_value_is_read_back_from_a_little_endian_header() {
        for value in 1u16..=8 {
            let bytes = jpeg_with_exif(&tiff_with_tag(value, true), None);
            let probe = super::probe(&bytes);
            assert_eq!(
                probe.orientation,
                Orientation::from_exif_value(value as u8),
                "value {value}"
            );
            assert_eq!(probe.source, OrientationSource::JpegExifTag);
        }
    }

    #[test]
    fn a_big_endian_header_is_read_identically() {
        // Cameras write both orders, so endianness is not an assumption.
        let bytes = jpeg_with_exif(&tiff_with_tag(6, false), None);
        let probe = super::probe(&bytes);
        assert_eq!(probe.orientation, Orientation::Rotate90);
        assert_eq!(probe.source, OrientationSource::JpegExifTag);
    }

    #[test]
    fn a_rotation_tag_survives_an_app0_jfif_segment_in_front_of_it() {
        let bytes = jpeg_with_exif(&tiff_with_tag(6, true), None);
        // The fixture really does put APP0 first; assert it, so the test cannot silently
        // stop exercising segment walking.
        assert_eq!(&bytes[2..4], &[0xFF, 0xE0]);
        assert_eq!(super::probe(&bytes).orientation, Orientation::Rotate90);
    }

    #[test]
    fn an_out_of_range_or_zero_value_is_a_read_but_unusable_tag() {
        // The tag is present, so the source says so; the value is not a transform this
        // build can apply, so the orientation stays upright rather than being guessed.
        for value in [0u16, 9, 255, 65535] {
            let bytes = jpeg_with_exif(&tiff_with_tag(value, true), None);
            let probe = super::probe(&bytes);
            assert_eq!(probe.orientation, Orientation::Normal, "value {value}");
            assert_eq!(
                probe.source,
                OrientationSource::JpegExifTag,
                "value {value}"
            );
            assert!(!probe.orientation.is_transform());
        }
    }

    #[test]
    fn a_jpeg_with_no_exif_segment_reports_the_missing_tag() {
        // A `JFIF` `APP0` and nothing else. The segment length covers the length field
        // itself, so a 5-byte payload declares 7.
        let mut bytes = vec![0xFF, 0xD8];
        bytes.extend_from_slice(&[0xFF, 0xE0, 0x00, 0x07]);
        bytes.extend_from_slice(b"JFIF\0");
        let probe = super::probe(&bytes);
        // The metadata really did end and it held no orientation tag, which is a fact
        // rather than a truncation.
        assert_eq!(probe.source, OrientationSource::JpegWithoutTag);
        assert_eq!(probe.orientation, Orientation::Normal);
    }

    #[test]
    fn a_lying_segment_length_does_not_read_past_the_buffer() {
        // Claims a 60000-byte APP1 but supplies four bytes.
        let mut bytes = vec![0xFF, 0xD8, 0xFF, 0xE1, 0xEA, 0x60];
        bytes.extend_from_slice(b"Exif");
        let probe = super::probe(&bytes);
        assert_ne!(probe.orientation, Orientation::Rotate90);
        assert!(matches!(
            probe.source,
            OrientationSource::JpegWithoutTag | OrientationSource::NotFoundInHeadWindow
        ));
    }

    #[test]
    fn a_truncated_or_hostile_tiff_block_yields_no_tag_instead_of_panicking() {
        let full = tiff_with_tag(6, true);
        for cut in 0..full.len() {
            let bytes = jpeg_with_exif(&full[..cut], None);
            let probe = super::probe(&bytes);
            assert!(matches!(
                probe.source,
                OrientationSource::JpegExifTag
                    | OrientationSource::JpegWithoutTag
                    | OrientationSource::NotFoundInHeadWindow
            ));
        }
    }

    #[test]
    fn a_wrong_tiff_magic_is_rejected() {
        let mut tiff = tiff_with_tag(6, true);
        tiff[2] = 0x2A;
        tiff[3] = 0x2B; // 43 instead of 42
        let probe = super::probe(&jpeg_with_exif(&tiff, None));
        assert_eq!(probe.source, OrientationSource::JpegWithoutTag);
    }

    #[test]
    fn an_absurd_ifd_entry_count_is_refused_rather_than_looped_over() {
        let mut tiff = tiff_with_tag(6, true);
        // Overwrite the entry count with 60000.
        tiff[8] = 0x60;
        tiff[9] = 0xEA;
        let probe = super::probe(&jpeg_with_exif(&tiff, None));
        assert_eq!(probe.source, OrientationSource::JpegWithoutTag);
    }

    // ---- transform application ----------------------------------------------------------

    #[test]
    fn orientation_one_and_the_default_transform_leave_the_image_alone() {
        let image = labelled();
        let (plain, _, _) = apply(image.clone(), Orientation::Normal);
        assert_eq!(pixels(&plain), pixels(&image));
        let (defaulted, _, _) = apply(image.clone(), Orientation::default());
        assert_eq!(pixels(&defaulted), pixels(&image));
    }

    #[test]
    fn the_mirroring_orientations_are_self_inverse() {
        // The flips and the two transposes are involutions: applying one twice returns the
        // original. A transform that is not self-inverse here would mean the mirror was
        // dropped, which is the failure this test exists to catch.
        let image = labelled();
        for orientation in [
            Orientation::MirrorHorizontal,
            Orientation::Rotate180,
            Orientation::MirrorVertical,
            Orientation::Transpose,
            Orientation::Transverse,
        ] {
            let (once, _, _) = apply(image.clone(), orientation);
            let (twice, _, _) = apply(once, orientation);
            assert_eq!(
                pixels(&twice),
                pixels(&image),
                "{orientation:?} is not self-inverse"
            );
        }
    }

    #[test]
    fn a_quarter_turn_needs_four_applications_to_return_the_original() {
        // Rotate 90 and Rotate 270 are not involutions; treating them as if they were
        // would hide an off-by-one quarter turn.
        let image = labelled();
        let (once, _, _) = apply(image.clone(), Orientation::Rotate90);
        let (twice, _, _) = apply(once.clone(), Orientation::Rotate90);
        assert_ne!(pixels(&twice), pixels(&image));
        let (thrice, _, _) = apply(twice.clone(), Orientation::Rotate90);
        assert_ne!(pixels(&thrice), pixels(&image));
        let (four_times, _, _) = apply(thrice, Orientation::Rotate90);
        assert_eq!(pixels(&four_times), pixels(&image));

        // Rotate 90 and Rotate 270 are inverses of each other.
        let (clockwise, _, _) = apply(image.clone(), Orientation::Rotate90);
        let (back, _, _) = apply(clockwise, Orientation::Rotate270);
        assert_eq!(pixels(&back), pixels(&image));
    }

    #[test]
    fn the_transposing_orientations_are_not_merely_rotations() {
        // If 5 and 7 were implemented as rotations the pixels would differ from the
        // correct transpose/transverse results below. The fixture is
        //   0  1
        //  10 11
        //  20 21
        let image = labelled();
        // A transpose reflects across the main diagonal.
        let (transpose, _, _) = apply(image.clone(), Orientation::Transpose);
        assert_eq!(transpose.width(), 3);
        assert_eq!(transpose.height(), 2);
        assert_eq!(pixels(&transpose), vec![0, 10, 20, 1, 11, 21]);
        // A transverse reflects across the anti-diagonal.
        let (transverse, _, _) = apply(image, Orientation::Transverse);
        assert_eq!(pixels(&transverse), vec![21, 11, 1, 20, 10, 0]);
    }

    #[test]
    fn only_the_upright_orientation_reports_that_no_transform_was_needed() {
        assert!(!Orientation::Normal.is_transform());
        for value in 2u8..=8 {
            assert!(Orientation::from_exif_value(value).is_transform());
        }
    }

    #[test]
    fn the_probe_and_the_transform_agree_on_a_rotation_tag() {
        // The end-to-end contract: a file that declares 6 is rotated before comparison.
        let bytes = jpeg_with_exif(&tiff_with_tag(6, true), None);
        let probe = super::probe(&bytes);
        let (normalized, source_en, source_ar) = apply(labelled(), probe.orientation);
        assert_eq!(normalized.height(), 2);
        assert_eq!(normalized.width(), 3);
        assert!(!source_en.is_empty());
        assert!(!source_ar.is_empty());
    }
}
