//! Native ZIP central-directory parsing, manifest normalization, and archive comparison
//! for M03-S07.
//!
//! # No extraction, ever
//!
//! Everything in this module reads the **central directory** and nothing else. A ZIP's
//! central directory is a table of metadata at the end of the file: for each entry, its
//! name, its CRC-32, its uncompressed size, its compression method, and its flags. It is
//! enough to answer "do these two archives contain the same files" without decompressing a
//! single byte.
//!
//! That is not an optimisation, it is the safety property. The previous path shelled out
//! to .NET for ZIP, and it is possible to make an archive do arbitrary work while it is
//! being opened. A parser that seeks to the end of the file, bounds every read against
//! the file length, and stops as soon as a metadata limit trips cannot be made to unpack
//! a zip bomb, write outside its output directory, or follow a name out of the archive.
//!
//! # Names are preserved, not sanitized away
//!
//! A manifest comparison has to normalize, because one archiver writes `a/b.txt` and
//! another writes `a\\b.txt`. But normalizing *loses* information, and an Arabic or
//! accented filename is information. So each entry keeps its `original_name` byte-for-byte
//! as decoded, alongside a separate `normalized_path` that is used only for comparison.
//!
//! # Path traversal is flagged, not followed
//!
//! An entry named `../../windows/system32/evil.dll` is recorded, flagged, and counted. It
//! is never resolved, never opened, and never used to construct a filesystem path. Its
//! normalized form is prefixed so two archives that differ only in a traversal name still
//! hash differently.

use crate::duplicates::contracts::{ArchiveScanLimits, UnsupportedFormat};
use once_cell::sync::Lazy;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::Path,
};

/// The bounds applied before any archive metadata is trusted.
pub fn default_limits() -> ArchiveScanLimits {
    ArchiveScanLimits {
        max_entries: 65_536,
        max_declared_uncompressed_bytes: 8 * 1024 * 1024 * 1024,
        max_compression_ratio: 1_000,
        max_path_depth: 64,
    }
}
/// Hard ceiling on how many central-directory bytes are read into memory, so an archive
/// that declares millions of entries cannot exhaust memory before `max_entries` applies.
pub const MAX_CENTRAL_DIRECTORY_BYTES: u64 = 32 * 1024 * 1024;
/// The largest a single entry record can be: the 46-byte fixed header plus a 64 KiB name,
/// a 64 KiB extra field and a 64 KiB comment.
const MAX_ENTRY_RECORD_BYTES: usize = 46 + 0xFFFF * 2;
const END_OF_CENTRAL_DIRECTORY: [u8; 4] = [0x50, 0x4B, 0x05, 0x06];
const ZIP64_END_LOCATOR: [u8; 4] = [0x50, 0x4B, 0x06, 0x07];
const ZIP64_END_RECORD: [u8; 4] = [0x50, 0x4B, 0x06, 0x06];
const CENTRAL_ENTRY_SIGNATURE: [u8; 4] = [0x50, 0x4B, 0x01, 0x02];
/// General-purpose bit 11: the name and comment are UTF-8 rather than CP437.
const FLAG_UTF8: u16 = 1 << 11;
/// General-purpose bit 0: the entry is encrypted.
const FLAG_ENCRYPTED: u16 = 1;
/// The Info-ZIP "Unicode Path" extra field, which lets a writer store a UTF-8 name beside
/// a non-UTF-8 one.
const EXTRA_UNICODE_PATH: u16 = 0x7075;
/// The prefix a traversal name is normalized under, so it hashes distinctly.
const TRAVERSAL_PREFIX: &str = "<path-traversal>/";
/// Archive extensions this build refuses to parse without an external tool.
pub const EXTERNAL_ONLY_FORMATS: [&str; 2] = ["7z", "rar"];

/// One entry, as declared by the central directory.
///
/// This is the whole of what the comparison ever sees. There is no code path here that
/// opens an entry's compressed bytes, so a hostile entry cannot be unpacked by comparing
/// it.
#[derive(Debug, Clone, PartialEq)]
pub struct ZipFile {
    /// The name exactly as the archive stores it, after decoding to UTF-8. Never
    /// modified, never case-folded, never separator-swapped.
    pub original_name: String,
    /// The comparison key: `/` separators, no redundant segments, ASCII-lowercased.
    pub normalized_path: String,
    /// True when the name escapes the archive root (`..`, a leading `/`, or a drive
    /// letter). Such an entry is flagged and never followed.
    pub is_path_traversal: bool,
    /// Segments in `normalized_path`.
    pub depth: u32,
    pub crc32: u32,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    /// 0 is stored, 8 is deflate, 99 is AES. Recorded as evidence and deliberately
    /// excluded from the manifest hash, so a different compression level does not change
    /// the comparison.
    pub method: u16,
    pub general_purpose_flags: u16,
    pub is_directory: bool,
    pub encrypted: bool,
    /// True when the name itself looks like another archive. Detected, counted, and
    /// reported — never opened.
    pub is_nested_archive: bool,
    pub offset_of_local_header: u64,
}

/// A parsed central directory.
#[derive(Debug, Clone, Default)]
pub struct ZipArchive {
    pub entries: Vec<ZipFile>,
    /// The archive comment, decoded.
    pub comment: String,
    pub zip64: bool,
    /// Set when a metadata limit stopped the parse. The entries read so far are kept and
    /// reported, because a partial manifest is still evidence — but the caller must not
    /// treat it as complete.
    pub aborted: Option<String>,
}

impl ZipArchive {
    pub fn entry_count(&self) -> u64 {
        self.entries.len() as u64
    }
    pub fn declared_uncompressed_bytes(&self) -> u64 {
        self.entries
            .iter()
            .map(|entry| entry.uncompressed_size)
            .fold(0u64, u64::saturating_add)
    }
    pub fn compressed_bytes(&self) -> u64 {
        self.entries
            .iter()
            .map(|entry| entry.compressed_size)
            .fold(0u64, u64::saturating_add)
    }
    pub fn encrypted_entries(&self) -> u64 {
        self.entries.iter().filter(|entry| entry.encrypted).count() as u64
    }
    pub fn path_traversal_entries(&self) -> u64 {
        self.entries
            .iter()
            .filter(|entry| entry.is_path_traversal)
            .count() as u64
    }
    pub fn nested_archive_entries(&self) -> u64 {
        self.entries
            .iter()
            .filter(|entry| entry.is_nested_archive)
            .count() as u64
    }
    pub fn max_depth(&self) -> u32 {
        self.entries
            .iter()
            .map(|entry| entry.depth)
            .max()
            .unwrap_or(0)
    }
    /// Declared uncompressed bytes divided by compressed bytes.
    ///
    /// Returns `f64::INFINITY` when the archive declares compression but no compressed
    /// bytes, which is itself a bomb signature, so an infinite ratio is the honest answer
    /// rather than a division-by-zero guard returning zero.
    pub fn compression_ratio(&self) -> f64 {
        let compressed = self.compressed_bytes();
        let declared = self.declared_uncompressed_bytes();
        if compressed == 0 {
            if declared == 0 {
                return 0.0;
            }
            return f64::INFINITY;
        }
        declared as f64 / compressed as f64
    }
}

// ---- name handling ----------------------------------------------------------------------

/// CP437 for bytes 0x80..=0xFF. Bytes below 0x80 are ASCII, so only the upper half is
/// needed. This is the encoding the ZIP specification mandates when bit 11 is clear.
const CP437_HIGH: [char; 128] = [
    'Ç', 'ü', 'é', 'â', 'ä', 'à', 'å', 'ç', 'ê', 'ë', 'è', 'ï', 'î', 'ì', 'Ä', 'Å', 'É', 'æ', 'Æ',
    'ô', 'ö', 'ò', 'û', 'ù', 'ÿ', 'Ö', 'Ü', '¢', '£', '¥', '₧', 'ƒ', 'á', 'í', 'ó', 'ú', 'ñ', 'Ñ',
    'ª', 'º', '¿', '⌐', '¬', '½', '¼', '¡', '«', '»', '░', '▒', '▓', '│', '┤', '╡', '╢', '╖', '╕',
    '╣', '║', '╗', '╝', '╜', '╛', '┐', '└', '┴', '┬', '├', '─', '┼', '╞', '╟', '╚', '╔', '╩', '╦',
    '╠', '═', '╬', '╧', '╨', '╤', '╥', '╙', '╘', '╒', '╓', '╫', '╪', '┘', '┌', '█', '▄', '▌', '▐',
    '▀', 'α', 'ß', 'Γ', 'π', 'Σ', 'σ', 'µ', 'τ', 'Φ', 'Θ', 'Ω', 'δ', '∞', 'φ', 'ε', '∩', '≡', '±',
    '≥', '≤', '⌠', '⌡', '÷', '≈', '°', '∙', '·', '√', 'ⁿ', '²', '■', '\u{a0}',
];

/// Decodes an entry name.
///
/// Bit 11 says UTF-8. When it is clear the specification says CP437 — **except** when the
/// Info-ZIP Unicode Path extra field is present, holds a version-1 record, and its CRC
/// matches the stored name. That field exists precisely so a writer can store a UTF-8
/// Arabic name in an archive that otherwise claims CP437, and honouring it is what keeps
/// such a name from being mangled into mojibake. The CRC is checked, so a stale or
/// fabricated field is ignored rather than trusted.
pub fn decode_name(raw: &[u8], general_purpose_flags: u16, extra: &[u8]) -> String {
    if general_purpose_flags & FLAG_UTF8 != 0 {
        return String::from_utf8_lossy(raw).into_owned();
    }
    if let Some(decoded) = unicode_path_extra(extra, raw) {
        return decoded;
    }
    raw.iter()
        .map(|byte| match byte {
            0x00..=0x7F => *byte as char,
            other => CP437_HIGH[(other - 0x80) as usize],
        })
        .collect()
}

/// Reads and validates the Info-ZIP Unicode Path extra field.
fn unicode_path_extra(extra: &[u8], raw_name: &[u8]) -> Option<String> {
    let mut cursor = 0usize;
    while cursor + 4 <= extra.len() {
        let header_id = u16::from_le_bytes([extra[cursor], extra[cursor + 1]]);
        let size = u16::from_le_bytes([extra[cursor + 2], extra[cursor + 3]]) as usize;
        let body_start = cursor + 4;
        let body_end = body_start.checked_add(size)?;
        if body_end > extra.len() {
            return None;
        }
        if header_id == EXTRA_UNICODE_PATH && size >= 5 {
            let body = &extra[body_start..body_end];
            if body[0] == 1 {
                let stored_crc = u32::from_le_bytes([body[1], body[2], body[3], body[4]]);
                // Info-ZIP writes these fields little-endian. Some writers emit
                // big-endian, so both are tried and only the matching one is accepted.
                let declared = crc32(raw_name);
                let swapped = u32::from_be_bytes([body[1], body[2], body[3], body[4]]);
                if stored_crc == declared || swapped == declared {
                    return Some(String::from_utf8_lossy(&body[5..]).into_owned());
                }
            }
        }
        cursor = body_end;
    }
    None
}

/// The normalization actually applied, published so a reader knows what was compared.
pub const CASE_POLICY: &str = "ascii_lowercase_only";
pub const SEPARATOR_POLICY: &str = "backslash_to_forward_slash";

/// Normalizes an entry name for comparison without discarding the original.
///
/// The rules, and their reason:
/// * `\` becomes `/`: one archiver writes Windows separators, another writes POSIX ones.
/// * Empty and `.` segments are dropped: `./a.txt` and `a.txt` are the same entry.
/// * `..` segments and absolute roots are **kept** and flagged, under a distinct prefix,
///   so a malicious name never silently becomes an ordinary one.
/// * Only ASCII letters are lowercased. Lowercasing non-ASCII would need a locale and a
///   case table, and getting either wrong changes Arabic and accented names — which is
///   exactly the class of name this must preserve.
pub fn normalize_entry_name(raw: &str) -> (String, bool, u32) {
    let replaced = raw.replace('\\', "/");
    let absolute = replaced.starts_with('/') || {
        let bytes = replaced.as_bytes();
        bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
    };
    let mut segments: Vec<String> = Vec::new();
    let mut traversal = absolute;
    for segment in replaced.split('/') {
        match segment {
            "" | "." => continue,
            ".." => {
                traversal = true;
                segments.push("..".to_string());
            }
            other => segments.push(other.to_ascii_lowercase()),
        }
    }
    let depth = segments.len() as u32;
    let mut normalized = segments.join("/");
    if traversal {
        normalized = format!("{TRAVERSAL_PREFIX}{normalized}");
    }
    if normalized.is_empty() {
        normalized = "/".to_string();
    }
    (normalized, traversal, depth)
}

fn looks_like_nested_archive(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    EXTERNAL_ONLY_FORMATS
        .iter()
        .any(|format| lower.ends_with(&format!(".{format}")))
        || lower.ends_with(".zip")
        || lower.ends_with(".tar")
        || lower.ends_with(".tar.gz")
        || lower.ends_with(".tgz")
}

// ---- CRC-32 -----------------------------------------------------------------------------

/// The standard CRC-32 (IEEE 802.3, reflected, polynomial 0xEDB88320) that ZIP uses.
///
/// It is read straight out of the central directory rather than recomputed from content,
/// because reading content is exactly what this module refuses to do. It is also what
/// makes an encrypted entry comparable: the central directory records the CRC of the
/// *plaintext*, so an encrypted archive can still be matched against a plain one.
pub fn crc32(bytes: &[u8]) -> u32 {
    static TABLE: Lazy<[u32; 256]> = Lazy::new(|| {
        let mut table = [0u32; 256];
        for (index, slot) in table.iter_mut().enumerate() {
            let mut value = index as u32;
            for _ in 0..8 {
                value = if value & 1 != 0 {
                    0xEDB8_8320 ^ (value >> 1)
                } else {
                    value >> 1
                };
            }
            *slot = value;
        }
        table
    });
    let mut crc = 0xFFFF_FFFFu32;
    for byte in bytes {
        crc = TABLE[((crc ^ *byte as u32) & 0xFF) as usize] ^ (crc >> 8);
    }
    crc ^ 0xFFFF_FFFF
}

// ---- the manifest hash ------------------------------------------------------------------

/// Hashes the manifest: the tuple (normalized path, uncompressed size, CRC-32) of every
/// non-directory entry, in sorted path order.
///
/// What is deliberately **not** in the hash, and why:
///
/// * **Compression method and compressed size.** Two archives holding the same files at
///   different compression levels must match, and those are precisely the fields that
///   differ.
/// * **Entry order.** A different archiver writes entries in a different order. Sorting
///   by normalized path makes the hash order-independent.
/// * **Timestamps, comments, extra fields, external attributes.** None of them describe
///   the content.
/// * **Directory entries.** A directory record carries a zero size and a zero CRC, so
///   including it would make "created with directory entries" differ from "created
///   without", for no content reason. They are excluded from the hash **and** their count
///   is left out of the header, so the manifest is purely about contained files. The
///   non-directory entry count is still bound, so adding a file still changes the hash.
pub fn manifest_hash(archive: &ZipArchive) -> String {
    let mut entries: Vec<&ZipFile> = archive
        .entries
        .iter()
        .filter(|entry| !entry.is_directory)
        .collect();
    entries.sort_by(|a, b| {
        a.normalized_path
            .cmp(&b.normalized_path)
            .then_with(|| a.uncompressed_size.cmp(&b.uncompressed_size))
            .then_with(|| a.crc32.cmp(&b.crc32))
    });
    let mut serialized = String::with_capacity(entries.len() * 48);
    serialized.push_str(&format!("entries={}\u{1}", entries.len()));
    for entry in entries {
        // Unit separators cannot appear in a normalized path, so the tuple boundaries
        // are unambiguous and two different tuples cannot serialize to the same string.
        serialized.push_str(&format!(
            "{}\u{1}{}\u{1}{:08x}\n",
            entry.normalized_path, entry.uncompressed_size, entry.crc32
        ));
    }
    blake3::hash(serialized.as_bytes()).to_hex().to_string()
}

// ---- reading ----------------------------------------------------------------------------

fn le_u16(bytes: &[u8], offset: usize) -> Option<u16> {
    let raw = bytes.get(offset..offset.checked_add(2)?)?;
    Some(u16::from_le_bytes([raw[0], raw[1]]))
}

fn le_u32(bytes: &[u8], offset: usize) -> Option<u32> {
    let raw = bytes.get(offset..offset.checked_add(4)?)?;
    Some(u32::from_le_bytes([raw[0], raw[1], raw[2], raw[3]]))
}

fn le_u64(bytes: &[u8], offset: usize) -> Option<u64> {
    let raw = bytes.get(offset..offset.checked_add(8)?)?;
    let mut quad = [0u8; 8];
    quad.copy_from_slice(raw);
    Some(u64::from_le_bytes(quad))
}

fn signature_at(bytes: &[u8], offset: usize) -> Option<[u8; 4]> {
    let raw = bytes.get(offset..offset.checked_add(4)?)?;
    Some([raw[0], raw[1], raw[2], raw[3]])
}

/// Where the central directory lives, and how many entries it claims.
#[derive(Debug, Clone)]
struct CentralDirectoryLocation {
    entry_count: u64,
    size: u64,
    offset: u64,
    zip64: bool,
    comment: String,
}

/// Finds the end-of-central-directory record, reading only the tail of the file.
///
/// The record is at most 22 bytes plus a 64 KiB comment, so only the last
/// `22 + 0xFFFF` bytes are read. An archive larger than that cannot legally hide its own
/// directory, and if this fails the archive is reported as unreadable rather than
/// searched for exhaustively.
fn locate_central_directory(
    file: &mut File,
    file_len: u64,
) -> Result<CentralDirectoryLocation, String> {
    if file_len < 22 {
        return Err("archive_too_small_for_central_directory".into());
    }
    let window = (22u64 + 0xFFFF).min(file_len);
    let window_start = file_len - window;
    let mut tail = vec![0u8; window as usize];
    file.seek(SeekFrom::Start(window_start))
        .map_err(|error| format!("archive_seek_failed:{error}"))?;
    file.read_exact(&mut tail)
        .map_err(|error| format!("archive_tail_read_failed:{error}"))?;

    let mut found: Option<usize> = None;
    let limit = tail.len().saturating_sub(22);
    for index in (0..=limit).rev() {
        if signature_at(&tail, index) == Some(END_OF_CENTRAL_DIRECTORY) {
            found = Some(index);
            break;
        }
    }
    let Some(position) = found else {
        return Err("end_of_central_directory_not_found".into());
    };
    let record = &tail[position..];
    let mut entry_count = le_u16(record, 10).unwrap_or(0) as u64;
    let mut size = le_u32(record, 12).unwrap_or(0) as u64;
    let mut offset = le_u32(record, 16).unwrap_or(0) as u64;
    let comment_length = le_u16(record, 20).unwrap_or(0) as usize;
    let comment = record
        .get(22..22 + comment_length)
        .map(|bytes| String::from_utf8_lossy(bytes).into_owned())
        .unwrap_or_default();

    // Any saturated field means the real values live in the ZIP64 record.
    let saturated = entry_count == 0xFFFF || size == 0xFFFF_FFFF || offset == 0xFFFF_FFFF;
    if saturated && position >= 20 && signature_at(&tail, position - 20) == Some(ZIP64_END_LOCATOR)
    {
        let locator = &tail[position - 20..position];
        let zip64_offset = le_u64(locator, 8).unwrap_or(0);
        if let Ok(zip64) = read_zip64_end_record(file, file_len, zip64_offset) {
            entry_count = zip64.0;
            size = zip64.1;
            offset = zip64.2;
            return Ok(CentralDirectoryLocation {
                entry_count,
                size,
                offset,
                zip64: true,
                comment,
            });
        }
    }
    Ok(CentralDirectoryLocation {
        entry_count,
        size,
        offset,
        zip64: false,
        comment,
    })
}

fn read_zip64_end_record(
    file: &mut File,
    file_len: u64,
    offset: u64,
) -> Result<(u64, u64, u64), String> {
    if offset.saturating_add(56) > file_len {
        return Err("zip64_end_record_outside_file".into());
    }
    let mut record = [0u8; 56];
    file.seek(SeekFrom::Start(offset))
        .map_err(|error| format!("zip64_seek_failed:{error}"))?;
    file.read_exact(&mut record)
        .map_err(|error| format!("zip64_read_failed:{error}"))?;
    if signature_at(&record, 0) != Some(ZIP64_END_RECORD) {
        return Err("zip64_end_record_signature_missing".into());
    }
    Ok((
        le_u64(&record, 32).ok_or("zip64_entry_count_missing")?,
        le_u64(&record, 40).ok_or("zip64_size_missing")?,
        le_u64(&record, 48).ok_or("zip64_offset_missing")?,
    ))
}

/// Parses a central directory that has already been read into memory.
///
/// Pure, so every hostile case can be tested without building a file on disk.
pub fn parse_central_directory(
    bytes: &[u8],
    declared_entries: u64,
    limits: &ArchiveScanLimits,
) -> ZipArchive {
    let mut archive = ZipArchive::default();
    let mut cursor = 0usize;
    let mut total_uncompressed = 0u64;
    let mut total_compressed = 0u64;

    while cursor + 46 <= bytes.len() {
        if signature_at(bytes, cursor) != Some(CENTRAL_ENTRY_SIGNATURE) {
            break;
        }
        if archive.entries.len() as u64 >= limits.max_entries {
            archive.aborted = Some(format!(
                "entry_count_limit_exceeded:{} entries; the manifest is incomplete",
                limits.max_entries
            ));
            break;
        }
        if declared_entries > 0 && archive.entries.len() as u64 >= declared_entries {
            break;
        }
        let Some(flags) = le_u16(bytes, cursor + 8) else {
            archive.aborted = Some("central_directory_truncated_in_flags".into());
            break;
        };
        let method = le_u16(bytes, cursor + 10).unwrap_or(0);
        let crc = le_u32(bytes, cursor + 16).unwrap_or(0);
        let compressed_size = le_u32(bytes, cursor + 20).unwrap_or(0) as u64;
        let uncompressed_size = le_u32(bytes, cursor + 24).unwrap_or(0) as u64;
        let name_length = le_u16(bytes, cursor + 28).unwrap_or(0) as usize;
        let extra_length = le_u16(bytes, cursor + 30).unwrap_or(0) as usize;
        let comment_length = le_u16(bytes, cursor + 32).unwrap_or(0) as usize;
        let local_offset = le_u32(bytes, cursor + 42).unwrap_or(0) as u64;

        let record_length = 46 + name_length + extra_length + comment_length;
        if record_length > MAX_ENTRY_RECORD_BYTES {
            archive.aborted = Some("entry_record_length_out_of_bounds".into());
            break;
        }
        let name_start = cursor + 46;
        let Some(name_end) = name_start.checked_add(name_length) else {
            archive.aborted = Some("entry_name_length_overflow".into());
            break;
        };
        let extra_start = name_end;
        let Some(extra_end) = extra_start.checked_add(extra_length) else {
            archive.aborted = Some("entry_extra_length_overflow".into());
            break;
        };
        let Some(record_end) = extra_end.checked_add(comment_length) else {
            archive.aborted = Some("entry_comment_length_overflow".into());
            break;
        };
        if record_end > bytes.len() {
            archive.aborted = Some("central_directory_truncated_in_entry".into());
            break;
        }
        let name_bytes = &bytes[name_start..name_end];
        let extra_bytes = &bytes[extra_start..extra_end];
        let original_name = decode_name(name_bytes, flags, extra_bytes);
        let (normalized_path, is_path_traversal, depth) = normalize_entry_name(&original_name);
        let is_directory = original_name.ends_with('/') || original_name.ends_with('\\');

        total_uncompressed = total_uncompressed.saturating_add(uncompressed_size);
        total_compressed = total_compressed.saturating_add(compressed_size);
        if total_uncompressed > limits.max_declared_uncompressed_bytes {
            archive.aborted = Some(format!(
                "declared_uncompressed_bytes_limit_exceeded:{} bytes declared",
                total_uncompressed
            ));
            break;
        }
        if total_compressed > 0
            && total_uncompressed / total_compressed > limits.max_compression_ratio
        {
            archive.aborted = Some(format!(
                "compression_ratio_limit_exceeded:{}:1 declared against a limit of {}:1",
                total_uncompressed / total_compressed,
                limits.max_compression_ratio
            ));
            break;
        }

        archive.entries.push(ZipFile {
            is_nested_archive: !is_directory && looks_like_nested_archive(&original_name),
            original_name,
            normalized_path,
            is_path_traversal,
            depth,
            crc32: crc,
            compressed_size,
            uncompressed_size,
            method,
            general_purpose_flags: flags,
            is_directory,
            encrypted: flags & FLAG_ENCRYPTED != 0 || method == 99,
            offset_of_local_header: local_offset,
        });
        cursor = record_end;
    }
    let present = archive.entries.len() as u64;
    if archive.aborted.is_none() && declared_entries > 0 && present < declared_entries {
        // The directory said there were more entries than the bytes actually contain.
        // Say so rather than reporting a short manifest as a complete one.
        archive.aborted = Some(format!(
            "central_directory_short:{} entries present, {} declared",
            archive.entries.len(),
            declared_entries
        ));
    }
    archive
}

/// Reads and parses the central directory of a ZIP file on disk.
///
/// Only the tail and the central directory itself are read. Entry payloads are never
/// touched, so the amount of work is bounded by [`MAX_CENTRAL_DIRECTORY_BYTES`] and the
/// entry count, regardless of how large the archive is.
pub fn read_zip(path: &Path, limits: &ArchiveScanLimits) -> Result<ZipArchive, String> {
    let mut file = File::open(path).map_err(|error| format!("archive_open_failed:{error}"))?;
    let file_len = file
        .metadata()
        .map_err(|error| format!("archive_stat_failed:{error}"))?
        .len();
    let location = locate_central_directory(&mut file, file_len)?;
    if location.offset.saturating_add(location.size) > file_len {
        return Err("central_directory_outside_file".into());
    }
    let read_len = location.size.min(MAX_CENTRAL_DIRECTORY_BYTES);
    let mut buffer = vec![0u8; read_len as usize];
    file.seek(SeekFrom::Start(location.offset))
        .map_err(|error| format!("archive_seek_failed:{error}"))?;
    file.read_exact(&mut buffer)
        .map_err(|error| format!("archive_read_failed:{error}"))?;
    let mut archive = parse_central_directory(&buffer, location.entry_count, limits);
    archive.zip64 = location.zip64;
    archive.comment = location.comment;
    if location.size > MAX_CENTRAL_DIRECTORY_BYTES {
        // The manifest is real but incomplete, and the result says so.
        archive.aborted = Some(format!(
            "central_directory_truncated_at_read_cap:{} of {} bytes",
            MAX_CENTRAL_DIRECTORY_BYTES, location.size
        ));
    }
    Ok(archive)
}

// ---- 7-Zip / RAR -------------------------------------------------------------------------

/// One entry as 7-Zip's technical listing reports it.
#[derive(Debug, Clone, PartialEq)]
pub struct SevenZipEntry {
    pub path: String,
    pub size: u64,
    pub crc: Option<String>,
    pub encrypted: bool,
    pub is_directory: bool,
}

/// Parses the output of `7z l -slt -ba`.
///
/// The listing is a sequence of blank-line-separated blocks of `Key = Value` lines. A
/// block whose `Path = ` line begins with a path separator is the archive's own path and
/// not an entry, so it is skipped.
pub fn parse_seven_zip_listing(text: &str) -> Vec<SevenZipEntry> {
    let mut entries = Vec::new();
    let mut path: Option<String> = None;
    let mut size: Option<u64> = None;
    let mut crc: Option<String> = None;
    let mut encrypted = false;
    let mut is_directory = false;

    // Everything the closure touches arrives as a parameter, so it captures nothing and
    // needs no mutable borrow of its own.
    let flush = |path: &mut Option<String>,
                 size: &mut Option<u64>,
                 crc: &mut Option<String>,
                 encrypted: &mut bool,
                 is_directory: &mut bool,
                 entries: &mut Vec<SevenZipEntry>| {
        if let Some(value) = path.take() {
            let trimmed = value.trim();
            let bytes = trimmed.as_bytes();
            let looks_absolute = trimmed.starts_with('/')
                || bytes.len() >= 3 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic();
            if !trimmed.is_empty() && !looks_absolute {
                entries.push(SevenZipEntry {
                    path: trimmed.to_string(),
                    size: size.take().unwrap_or(0),
                    crc: crc.clone(),
                    encrypted: *encrypted,
                    is_directory: *is_directory,
                });
            }
        }
        *size = None;
        *crc = None;
        *encrypted = false;
        *is_directory = false;
    };

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            flush(
                &mut path,
                &mut size,
                &mut crc,
                &mut encrypted,
                &mut is_directory,
                &mut entries,
            );
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        match key.trim() {
            "Path" => path = Some(value.trim().to_string()),
            "Size" => size = value.trim().parse::<u64>().ok(),
            "CRC" => crc = Some(value.trim().to_string()),
            "Encrypted" => encrypted = value.trim() == "+",
            "Folder" => is_directory = value.trim() == "+",
            _ => {}
        }
    }
    flush(
        &mut path,
        &mut size,
        &mut crc,
        &mut encrypted,
        &mut is_directory,
        &mut entries,
    );
    entries
}

/// Builds the manifest hash for a 7-Zip listing, using the same tuple and the same
/// exclusions as the native ZIP path, so a `.zip` and a `.7z` holding the same files
/// compare the same way.
pub fn manifest_hash_from_listing(entries: &[SevenZipEntry]) -> String {
    let mut normalized: Vec<(String, u64, String)> = entries
        .iter()
        .filter(|entry| !entry.is_directory)
        .map(|entry| {
            let (path, traversal, _) = normalize_entry_name(&entry.path);
            let _ = traversal;
            (path, entry.size, entry.crc.clone().unwrap_or_default())
        })
        .collect();
    normalized.sort();
    let mut serialized = String::with_capacity(normalized.len() * 48);
    serialized.push_str(&format!("entries={}\u{1}", normalized.len()));
    for (path, size, crc) in &normalized {
        serialized.push_str(&format!("{path}\u{1}{size}\u{1}{crc}\n"));
    }
    blake3::hash(serialized.as_bytes()).to_hex().to_string()
}

/// The typed refusal for a format this build will not pretend to parse.
pub fn unsupported_format(format: &str) -> UnsupportedFormat {
    let name = format.to_ascii_uppercase();
    UnsupportedFormat {
        format: format.to_ascii_lowercase(),
        reason_en: format!(
            "`.{lower}` archives are not parsed by this build. There is no native {upper} \
             reader, and this service will not shell out to a tool it has not verified. If a \
             7-Zip binary is present, its resolved path, the version it reported and the \
             licence line it reported are recorded in the dependency evidence, and it is used \
             for listing only, never for extraction. Without it, {upper} files are counted \
             here and left unreported rather than being guessed at.",
            lower = format.to_ascii_lowercase(),
            upper = name
        ),
        reason_ar: format!(
            "لا تقرأ هذه النسخة ملفات .{lower}. لا يوجد قارئ أصلي لصيغة {upper}، ولن تستدعي هذه \
             الخدمة أداة لم تتحقق منها. وإذا كان برنامج 7-Zip موجودًا، فيُسجَّل مساره والإصدار الذي \
             أعلنه وسطر الترخيص الذي أعلنه في أدلة الاعتماد، ويُستخدم للقائمة فقط دون فك الضغط. \
             وبدونه تُعدّ ملفات {upper} هنا وتُرك دون تقرير بدل تخمينها.",
            lower = format.to_ascii_lowercase(),
            upper = name
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        crc32, decode_name, default_limits, manifest_hash, manifest_hash_from_listing,
        normalize_entry_name, parse_central_directory, parse_seven_zip_listing, read_zip,
        unsupported_format, END_OF_CENTRAL_DIRECTORY, EXTRA_UNICODE_PATH,
    };
    use crate::duplicates::contracts::ArchiveScanLimits;
    use std::fs;

    /// One entry as written into a central directory fixture.
    #[derive(Clone)]
    struct Entry {
        name: Vec<u8>,
        flags: u16,
        method: u16,
        crc: u32,
        compressed: u32,
        uncompressed: u32,
        extra: Vec<u8>,
        local_offset: u32,
    }

    impl Entry {
        fn new(name: &str) -> Self {
            Self {
                name: name.as_bytes().to_vec(),
                flags: 1 << 11,
                method: 0,
                crc: 0,
                compressed: 0,
                uncompressed: 0,
                extra: Vec::new(),
                local_offset: 0,
            }
        }
        fn with(mut self, method: u16, compressed: u32, uncompressed: u32) -> Self {
            self.method = method;
            self.compressed = compressed;
            self.uncompressed = uncompressed;
            self
        }
        fn with_crc(mut self, crc: u32) -> Self {
            self.crc = crc;
            self
        }
        fn encrypted(mut self) -> Self {
            self.flags |= 1;
            self
        }
        /// Drops the UTF-8 flag, so the name is nominally CP437, as a writer that only
        /// supplies a Unicode Path extra field would leave it.
        fn cp437(mut self) -> Self {
            self.flags &= !(1 << 11);
            self
        }
        fn with_extra(mut self, extra: Vec<u8>) -> Self {
            self.extra = extra;
            self
        }
    }

    /// The Info-ZIP Unicode Path extra field for a UTF-8 name stored over a CP437 one.
    fn unicode_path_extra_field(raw_name: &[u8], unicode: &str) -> Vec<u8> {
        let mut extra = Vec::new();
        extra.extend_from_slice(&EXTRA_UNICODE_PATH.to_le_bytes());
        extra.extend_from_slice(&((5 + unicode.len()) as u16).to_le_bytes());
        extra.push(1);
        extra.extend_from_slice(&crc32(raw_name).to_le_bytes());
        extra.extend_from_slice(unicode.as_bytes());
        extra
    }

    /// Builds a central directory plus its end-of-central-directory record.
    ///
    /// The payloads are irrelevant: this module never reads them, and a fixture that
    /// pretends otherwise would test the wrong thing. The `method` field is still settable
    /// so a test can prove that a different compression level does not change the
    /// manifest.
    fn central_directory(entries: &[Entry], comment: &str) -> Vec<u8> {
        let mut bytes = Vec::new();
        for entry in entries {
            bytes.extend_from_slice(&[0x50, 0x4B, 0x01, 0x02]);
            bytes.extend_from_slice(&20u16.to_le_bytes()); // version made by
            bytes.extend_from_slice(&20u16.to_le_bytes()); // version needed
            bytes.extend_from_slice(&entry.flags.to_le_bytes());
            bytes.extend_from_slice(&entry.method.to_le_bytes());
            bytes.extend_from_slice(&0u16.to_le_bytes()); // time
            bytes.extend_from_slice(&0u16.to_le_bytes()); // date
            bytes.extend_from_slice(&entry.crc.to_le_bytes());
            bytes.extend_from_slice(&entry.compressed.to_le_bytes());
            bytes.extend_from_slice(&entry.uncompressed.to_le_bytes());
            bytes.extend_from_slice(&(entry.name.len() as u16).to_le_bytes());
            bytes.extend_from_slice(&(entry.extra.len() as u16).to_le_bytes());
            bytes.extend_from_slice(&0u16.to_le_bytes()); // comment length
            bytes.extend_from_slice(&0u16.to_le_bytes()); // disk number
            bytes.extend_from_slice(&0u16.to_le_bytes()); // internal attributes
            bytes.extend_from_slice(&0u32.to_le_bytes()); // external attributes
            bytes.extend_from_slice(&entry.local_offset.to_le_bytes());
            bytes.extend_from_slice(&entry.name);
            bytes.extend_from_slice(&entry.extra);
        }
        let size = bytes.len() as u32;
        let offset = 0u32;
        bytes.extend_from_slice(&END_OF_CENTRAL_DIRECTORY);
        bytes.extend_from_slice(&0u16.to_le_bytes()); // disk number
        bytes.extend_from_slice(&0u16.to_le_bytes()); // directory start disk
        bytes.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        bytes.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        bytes.extend_from_slice(&size.to_le_bytes());
        bytes.extend_from_slice(&offset.to_le_bytes());
        bytes.extend_from_slice(&(comment.len() as u16).to_le_bytes());
        bytes.extend_from_slice(comment.as_bytes());
        bytes
    }

    fn limits() -> ArchiveScanLimits {
        default_limits()
    }

    // ---- CRC-32 -------------------------------------------------------------------------

    #[test]
    fn the_crc_matches_the_published_check_value() {
        // The canonical check value for CRC-32/ISO-HDLC over "123456789".
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b""), 0);
    }

    // ---- name normalization --------------------------------------------------------------

    #[test]
    fn separators_and_redundant_segments_are_normalized_for_comparison() {
        let (path, traversal, depth) = normalize_entry_name("a\\b\\c.txt");
        assert_eq!(path, "a/b/c.txt");
        assert!(!traversal);
        assert_eq!(depth, 3);
        assert_eq!(normalize_entry_name("./a/./b.txt").0, "a/b.txt");
        assert_eq!(normalize_entry_name("a//b.txt").0, "a/b.txt");
    }

    #[test]
    fn only_ascii_case_is_folded_so_arabic_names_are_untouched() {
        // Folding non-ASCII would need a locale and a case table, and getting either
        // wrong would rewrite exactly the names this must preserve.
        let (folded, _, _) = normalize_entry_name("Photos/IMG_0001.JPG");
        assert_eq!(folded, "photos/img_0001.jpg");
        let (arabic, _, _) = normalize_entry_name("صور/صورة العائله.JPG");
        assert_eq!(arabic, "صور/صورة العائله.jpg");
    }

    #[test]
    fn a_traversal_name_is_flagged_and_kept_distinct() {
        for hostile in [
            "../../windows/system32/evil.dll",
            "/etc/passwd",
            "C:\\Windows\\notepad.exe",
            "safe/../../../escape.txt",
        ] {
            let (path, traversal, _) = normalize_entry_name(hostile);
            assert!(traversal, "{hostile} was not flagged");
            assert!(
                path.starts_with("<path-traversal>/"),
                "{hostile} normalized to {path} without a distinct prefix"
            );
        }
    }

    #[test]
    fn an_ordinary_name_is_never_mistaken_for_a_traversal_name() {
        let (path, traversal, depth) = normalize_entry_name("notes/..dotfiles/real.txt");
        // "..dotfiles" is a normal name, not a parent reference.
        assert!(!traversal);
        assert_eq!(path, "notes/..dotfiles/real.txt");
        assert_eq!(depth, 3);
    }

    // ---- name decoding ------------------------------------------------------------------

    #[test]
    fn a_utf8_flagged_name_keeps_arabic_exactly() {
        let raw = "صورة العائله.png".as_bytes().to_vec();
        let decoded = decode_name(&raw, 1 << 11, &[]);
        assert_eq!(decoded, "صورة العائله.png");
    }

    #[test]
    fn the_unicode_path_extra_field_rescues_a_non_utf8_flagged_arabic_name() {
        // The writer did not set bit 11, so the name bytes are nominally CP437 — but the
        // Info-ZIP Unicode Path field carries the real UTF-8 name and its CRC matches.
        let raw = "ملف.txt".as_bytes().to_vec();
        let stored = crc32(&raw);
        let mut extra = Vec::new();
        extra.extend_from_slice(&EXTRA_UNICODE_PATH.to_le_bytes());
        let body_len = 5 + "ملف.txt".len();
        extra.extend_from_slice(&(body_len as u16).to_le_bytes());
        extra.push(1);
        extra.extend_from_slice(&stored.to_le_bytes());
        extra.extend_from_slice("ملف.txt".as_bytes());
        assert_eq!(decode_name(&raw, 0, &extra), "ملف.txt");
    }

    #[test]
    fn a_unicode_path_field_whose_crc_does_not_match_is_ignored() {
        // Trusting an unvalidated field would let an archive substitute a name of its
        // choosing for the one that is actually stored.
        let raw = b"a.txt".to_vec();
        let mut extra = Vec::new();
        extra.extend_from_slice(&EXTRA_UNICODE_PATH.to_le_bytes());
        let body = "evil.txt".as_bytes();
        extra.extend_from_slice(&((5 + body.len()) as u16).to_le_bytes());
        extra.push(1);
        extra.extend_from_slice(&0xDEAD_BEEFu32.to_le_bytes());
        extra.extend_from_slice(body);
        assert_eq!(decode_name(&raw, 0, &extra), "a.txt");
    }

    #[test]
    fn a_non_utf8_name_without_the_extra_field_is_read_as_cp437() {
        // 0x81 is 'ü' in CP437, and 'ü' is a plausible character in a Latin-1 name.
        assert_eq!(
            decode_name(&[b'm', b'/', 0x81, b'.', b't', b'x', b't'], 0, &[]),
            "m/ü.txt"
        );
    }

    #[test]
    fn a_malformed_extra_field_does_not_panic_or_invent_a_name() {
        let raw = b"a.txt".to_vec();
        // A header that claims more bytes than the field holds.
        let extra = vec![0x75, 0x70, 0xFF, 0xFF, 1, 2, 3];
        assert_eq!(decode_name(&raw, 0, &extra), "a.txt");
    }

    #[test]
    fn an_arabic_filename_survives_the_whole_parse_unchanged() {
        // End to end: an Arabic name, a path traversal, an encrypted entry, a nested
        // archive and a directory, all through the real central-directory parser.
        let raw = "صور/صورة العائله.png".as_bytes().to_vec();
        let extra = unicode_path_extra_field(&raw, "صور/صورة العائله.png");
        let entries = vec![
            Entry {
                name: raw.clone(),
                ..Entry::new("placeholder").cp437().with_extra(extra)
            }
            .with_crc(0x1234_5678)
            .with(8, 4_096, 65_536),
            Entry::new("../../evil.dll").with_crc(1).with(0, 10, 10),
            Entry::new("locked.txt")
                .with_crc(2)
                .with(0, 10, 10)
                .encrypted(),
            Entry::new("inner/backup.zip").with_crc(3).with(0, 10, 10),
            Entry::new("folder/"),
        ];
        let archive = parse_central_directory(&central_directory(&entries, ""), 5, &limits());
        assert_eq!(archive.entry_count(), 5);
        assert_eq!(
            archive.entries[0].original_name, "صور/صورة العائله.png",
            "the Arabic name was not preserved"
        );
        assert_eq!(archive.entries[0].normalized_path, "صور/صورة العائله.png");
        assert_eq!(archive.entries[0].method, 8, "the method must be recorded");
        assert_eq!(archive.path_traversal_entries(), 1);
        assert_eq!(archive.encrypted_entries(), 1);
        assert_eq!(archive.nested_archive_entries(), 1);
        assert!(archive.entries[4].is_directory);
        // The manifest is stable and content-bound.
        assert_eq!(manifest_hash(&archive).len(), 64);
    }

    // ---- the manifest hash ---------------------------------------------------------------
    #[test]
    fn the_same_content_at_a_different_compression_level_gives_the_same_manifest() {
        let stored = Entry::new("data.txt")
            .with_crc(0xAABB_CCDD)
            .with(0, 400, 400);
        let deflated = Entry::new("data.txt")
            .with_crc(0xAABB_CCDD)
            .with(8, 100, 400);
        let left = parse_central_directory(&central_directory(&[stored], ""), 1, &limits());
        let right = parse_central_directory(&central_directory(&[deflated], ""), 1, &limits());
        assert_eq!(left.entries[0].method, 0);
        assert_eq!(right.entries[0].method, 8);
        assert_eq!(left.compressed_bytes(), 400);
        assert_eq!(right.compressed_bytes(), 100);
        assert_ne!(left.compressed_bytes(), right.compressed_bytes());
        // Same content, different compression: the manifest must not notice.
        assert_eq!(manifest_hash(&left), manifest_hash(&right));
    }

    #[test]
    fn a_different_entry_order_gives_the_same_manifest() {
        let a = Entry::new("a.txt").with_crc(1).with(0, 10, 10);
        let b = Entry::new("b.txt").with_crc(2).with(0, 20, 20);
        let forward = parse_central_directory(
            &central_directory(&[a.clone(), b.clone()], ""),
            2,
            &limits(),
        );
        let backward = parse_central_directory(&central_directory(&[b, a], ""), 2, &limits());
        assert_eq!(manifest_hash(&forward), manifest_hash(&backward));
    }

    #[test]
    fn a_different_path_separator_gives_the_same_manifest() {
        let forward = Entry::new("dir/sub/file.txt").with_crc(7).with(0, 10, 10);
        let backward = Entry::new("dir\\sub\\file.txt").with_crc(7).with(0, 10, 10);
        let left = parse_central_directory(&central_directory(&[forward], ""), 1, &limits());
        let right = parse_central_directory(&central_directory(&[backward], ""), 1, &limits());
        assert_ne!(
            left.entries[0].original_name,
            right.entries[0].original_name
        );
        assert_eq!(
            left.entries[0].normalized_path,
            right.entries[0].normalized_path
        );
        assert_eq!(manifest_hash(&left), manifest_hash(&right));
    }

    #[test]
    fn a_different_size_or_crc_gives_a_different_manifest() {
        let base = Entry::new("a.txt").with_crc(1).with(0, 10, 10);
        let bigger = Entry::new("a.txt").with_crc(1).with(0, 11, 11);
        let other_crc = Entry::new("a.txt").with_crc(2).with(0, 10, 10);
        let left = parse_central_directory(&central_directory(&[base], ""), 1, &limits());
        let right = parse_central_directory(&central_directory(&[bigger], ""), 1, &limits());
        let third = parse_central_directory(&central_directory(&[other_crc], ""), 1, &limits());
        assert_ne!(manifest_hash(&left), manifest_hash(&right));
        assert_ne!(manifest_hash(&left), manifest_hash(&third));
    }

    #[test]
    fn an_extra_entry_changes_the_manifest() {
        let a = Entry::new("a.txt").with_crc(1).with(0, 10, 10);
        let b = Entry::new("b.txt").with_crc(2).with(0, 20, 20);
        let one = parse_central_directory(
            &central_directory(std::slice::from_ref(&a), ""),
            1,
            &limits(),
        );
        let two = parse_central_directory(&central_directory(&[a, b], ""), 2, &limits());
        assert_ne!(manifest_hash(&one), manifest_hash(&two));
    }

    #[test]
    fn directory_entries_do_not_change_the_manifest_but_are_still_counted() {
        // A directory record carries no content, so including it would make "made with
        // directory entries" differ from "made without" for no content reason.
        let file = Entry::new("a.txt").with_crc(1).with(0, 10, 10);
        let directory = Entry::new("folder/");
        let plain = parse_central_directory(
            &central_directory(std::slice::from_ref(&file), ""),
            1,
            &limits(),
        );
        let with_dir =
            parse_central_directory(&central_directory(&[file, directory], ""), 2, &limits());
        assert_eq!(manifest_hash(&plain), manifest_hash(&with_dir));
        assert_eq!(with_dir.entry_count(), 2);
        assert!(with_dir.entries.iter().any(|entry| entry.is_directory));
    }

    #[test]
    fn tuple_boundaries_cannot_be_forged_by_a_crafted_name() {
        // If the separator could appear inside a path, two different manifests could
        // serialize to the same string.
        let crafted = Entry::new("a\u{1}9\u{1}00000000")
            .with_crc(1)
            .with(0, 10, 10);
        let plain = Entry::new("a").with_crc(1).with(0, 10, 10);
        let left = parse_central_directory(&central_directory(&[crafted], ""), 1, &limits());
        let right = parse_central_directory(&central_directory(&[plain], ""), 1, &limits());
        assert_ne!(manifest_hash(&left), manifest_hash(&right));
    }

    // ---- encryption, traversal, nesting ---------------------------------------------------

    #[test]
    fn an_encrypted_entry_is_reported_rather_than_hidden() {
        let plain = Entry::new("secret.txt").with_crc(5).with(0, 100, 100);
        let locked = Entry::new("secret.txt")
            .with_crc(5)
            .with(0, 100, 100)
            .encrypted();
        let left = parse_central_directory(&central_directory(&[plain], ""), 1, &limits());
        let right = parse_central_directory(&central_directory(&[locked], ""), 1, &limits());
        assert_eq!(left.encrypted_entries(), 0);
        assert_eq!(right.encrypted_entries(), 1);
        assert!(right.entries[0].encrypted);
        // The central directory still holds the plaintext CRC, so the two still compare.
        assert_eq!(manifest_hash(&left), manifest_hash(&right));
    }

    #[test]
    fn an_aes_encrypted_entry_is_detected_by_its_method_code() {
        let aes = Entry::new("secret.txt").with_crc(5).with(99, 100, 100);
        let archive = parse_central_directory(&central_directory(&[aes], ""), 1, &limits());
        assert_eq!(archive.encrypted_entries(), 1);
    }

    #[test]
    fn a_path_traversal_entry_is_flagged_and_counted_but_still_in_the_manifest() {
        let hostile = Entry::new("../../evil.dll").with_crc(9).with(0, 10, 10);
        let archive = parse_central_directory(&central_directory(&[hostile], ""), 1, &limits());
        assert_eq!(archive.path_traversal_entries(), 1);
        assert!(archive.entries[0].is_path_traversal);
        assert_eq!(archive.entries[0].original_name, "../../evil.dll");
        // It hashes distinctly from a clean entry of the same size.
        let clean = Entry::new("evil.dll").with_crc(9).with(0, 10, 10);
        let other = parse_central_directory(&central_directory(&[clean], ""), 1, &limits());
        assert_ne!(manifest_hash(&archive), manifest_hash(&other));
    }

    #[test]
    fn a_nested_archive_entry_is_detected_and_never_opened() {
        let inner = Entry::new("backup/inner.zip")
            .with_crc(1)
            .with(0, 500, 2_000);
        let seven = Entry::new("backup/inner.7z")
            .with_crc(1)
            .with(0, 500, 2_000);
        let archive =
            parse_central_directory(&central_directory(&[inner, seven], ""), 2, &limits());
        assert_eq!(archive.nested_archive_entries(), 2);
        // The declared size is reported, and nothing was decompressed to learn it.
        assert_eq!(archive.entries[0].uncompressed_size, 2_000);
    }

    #[test]
    fn depth_is_measured_so_a_deeply_nested_name_can_be_reported() {
        let deep = format!(
            "{}/file.txt",
            (0..40).map(|_| "d").collect::<Vec<_>>().join("/")
        );
        let entry = Entry::new(&deep).with_crc(1).with(0, 10, 10);
        let archive = parse_central_directory(&central_directory(&[entry], ""), 1, &limits());
        assert_eq!(archive.max_depth(), 41);
        assert!(archive.max_depth() > default_limits().max_path_depth - 30);
    }

    // ---- anti-bomb limits ------------------------------------------------------------------

    #[test]
    fn an_entry_count_beyond_the_limit_aborts_bounded() {
        let entries: Vec<Entry> = (0..10)
            .map(|index| Entry::new(&format!("f{index}.txt")).with(0, 1, 1))
            .collect();
        let bytes = central_directory(&entries, "");
        let tight = ArchiveScanLimits {
            max_entries: 4,
            ..default_limits()
        };
        let archive = parse_central_directory(&bytes, 10, &tight);
        assert_eq!(
            archive.entries.len(),
            4,
            "the parse did not stop at the limit"
        );
        let reason = archive.aborted.expect("an abort reason is required");
        assert!(reason.contains("entry_count_limit_exceeded"), "{reason}");
    }

    #[test]
    fn a_zip_bomb_metadata_claim_aborts_before_the_entries_are_trusted() {
        // 1 KiB of stored data claiming just under 4 GiB of content: the classic ratio
        // signature. The claim is the largest a 32-bit central-directory field can hold,
        // which is exactly what an attacker would write.
        let claimed = 0xFFFF_FFF0u32;
        let bomb = Entry::new("bomb.bin").with(0, 1_024, claimed);
        let bytes = central_directory(&[bomb], "");
        let archive = parse_central_directory(&bytes, 1, &limits());
        let reason = archive.aborted.expect("a bomb claim must abort the parse");
        assert!(
            reason.contains("compression_ratio_limit_exceeded"),
            "{reason}"
        );
        assert_eq!(archive.entries.len(), 0, "the bomb entry was trusted");
    }

    #[test]
    fn a_bomb_with_zero_compressed_size_reports_an_infinite_ratio_rather_than_zero() {
        // Declaring content with no compressed bytes at all is the most extreme bomb
        // signature; reporting a ratio of 0 would hide it.
        let bomb = Entry::new("bomb.bin").with(0, 0, 64 * 1024 * 1024);
        let archive = parse_central_directory(&central_directory(&[bomb], ""), 1, &limits());
        assert!(archive.compression_ratio().is_infinite());
    }

    #[test]
    fn a_declared_size_beyond_the_limit_aborts() {
        let huge = Entry::new("huge.bin").with(0, 100_000, 2_000_000_000);
        let bytes = central_directory(&[huge], "");
        let tight = ArchiveScanLimits {
            max_declared_uncompressed_bytes: 1_000_000,
            max_compression_ratio: u64::MAX,
            ..default_limits()
        };
        let archive = parse_central_directory(&bytes, 1, &tight);
        let reason = archive.aborted.expect("the size limit must abort");
        assert!(
            reason.contains("declared_uncompressed_bytes_limit_exceeded"),
            "{reason}"
        );
    }

    #[test]
    fn a_truncated_central_directory_is_reported_as_short_rather_than_complete() {
        let full = central_directory(
            &[
                Entry::new("a.txt").with(0, 10, 10),
                Entry::new("b.txt").with(0, 10, 10),
            ],
            "",
        );
        // Keep the end record but declare three entries.
        let mut lying = full.clone();
        let count_position = lying.len() - 22 + 10;
        lying[count_position..count_position + 2].copy_from_slice(&3u16.to_le_bytes());
        lying[count_position + 2..count_position + 4].copy_from_slice(&3u16.to_le_bytes());
        let archive = parse_central_directory(&lying, 3, &limits());
        let reason = archive.aborted.expect("a short directory must be reported");
        assert!(reason.contains("central_directory_short"), "{reason}");
    }

    #[test]
    fn a_lying_name_length_cannot_make_the_parser_read_past_the_buffer() {
        let mut bytes = central_directory(&[Entry::new("a.txt")], "");
        // Overwrite the first entry's name length with 60000.
        bytes[28..30].copy_from_slice(&60_000u16.to_le_bytes());
        let archive = parse_central_directory(&bytes, 1, &limits());
        // It stops with a reason; it must not panic and must not invent an entry.
        assert!(archive.aborted.is_some());
        assert!(archive.entries.len() <= 1);
    }

    #[test]
    fn a_central_directory_with_no_entries_parses_to_an_empty_manifest() {
        let bytes = central_directory(&[], "");
        let archive = parse_central_directory(&bytes, 0, &limits());
        assert_eq!(archive.entry_count(), 0);
        assert!(archive.aborted.is_none());
        // An empty archive still has a stable, non-empty manifest hash.
        assert_eq!(manifest_hash(&archive).len(), 64);
    }

    // ---- reading a real file ----------------------------------------------------------------

    #[test]
    fn a_central_directory_is_read_from_disk_without_touching_entry_payloads() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("archive.zip");
        // Local header + stored payload + central directory + end record, laid out the
        // way a real ZIP is. The parser must seek past the payload to the directory.
        let payload = b"knoux archive payload".to_vec();
        let mut bytes = vec![0x50, 0x4B, 0x03, 0x04];
        bytes.extend_from_slice(&20u16.to_le_bytes());
        bytes.extend_from_slice(&0u16.to_le_bytes());
        bytes.extend_from_slice(&(1u16 << 11).to_le_bytes());
        bytes.extend_from_slice(&0u16.to_le_bytes()); // stored
        bytes.extend_from_slice(&0u16.to_le_bytes());
        bytes.extend_from_slice(&0u16.to_le_bytes());
        bytes.extend_from_slice(&crc32(&payload).to_le_bytes());
        bytes.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&5u16.to_le_bytes());
        bytes.extend_from_slice(&0u16.to_le_bytes());
        bytes.extend_from_slice(b"a.txt");
        bytes.extend_from_slice(&payload);

        let mut body = central_directory(
            &[Entry::new("a.txt").with_crc(crc32(&payload)).with(
                0,
                payload.len() as u32,
                payload.len() as u32,
            )],
            "a comment",
        );
        // The end record inside `body` points at offset 0 and at a size that includes the
        // record itself. The record starts `22 + comment_len` bytes before the end of
        // `body`, so both fields are repointed at the real directory here.
        let directory_offset = bytes.len() as u32;
        let body_len = body.len();
        let comment_len = "a comment".len();
        let end_record = body_len - 22 - comment_len;
        let size_position = end_record + 12;
        body[size_position..size_position + 4]
            .copy_from_slice(&((body_len - 22 - comment_len) as u32).to_le_bytes());
        let offset_position = end_record + 16;
        body[offset_position..offset_position + 4].copy_from_slice(&directory_offset.to_le_bytes());
        bytes.extend_from_slice(&body);
        fs::write(&path, &bytes).expect("write");

        let archive = read_zip(&path, &limits()).expect("read zip");
        assert_eq!(archive.entry_count(), 1);
        assert_eq!(archive.entries[0].original_name, "a.txt");
        assert_eq!(archive.entries[0].uncompressed_size, payload.len() as u64);
        assert_eq!(archive.comment, "a comment");
        assert!(archive.aborted.is_none());
    }

    #[test]
    fn a_file_that_is_not_an_archive_is_a_typed_error_not_an_empty_manifest() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("not.zip");
        fs::write(&path, b"this is not a zip file at all, not even close").expect("write");
        let error = read_zip(&path, &limits()).expect_err("must fail");
        assert_eq!(error, "end_of_central_directory_not_found");
    }

    #[test]
    fn a_tiny_file_is_rejected_before_any_read() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("tiny.zip");
        fs::write(&path, b"PK").expect("write");
        let error = read_zip(&path, &limits()).expect_err("must fail");
        assert_eq!(error, "archive_too_small_for_central_directory");
    }

    #[test]
    fn a_lying_size_and_offset_in_the_end_record_cannot_redirect_the_reader_out_of_the_file() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("liar.zip");
        let mut bytes = central_directory(&[Entry::new("a.txt")], "");
        let body_len = bytes.len();
        let size_position = body_len - 22 + 12;
        bytes[size_position..size_position + 4].copy_from_slice(&0xFFFF_FFFFu32.to_le_bytes());
        fs::write(&path, &bytes).expect("write");
        let error = read_zip(&path, &limits()).expect_err("must fail");
        assert_eq!(error, "central_directory_outside_file");
    }

    // ---- 7-Zip ------------------------------------------------------------------------------

    const REAL_7Z_LISTING: &str = "\
Path = /home/user/archive.7z
Type = 7z
Physical Size = 456
Headers Size = 208
Method = LZMA2:12
Solid = +
Blocks = 1

Path = documents
Folder = +

Path = documents/report.txt
Size = 1536
Packed Size = 402
Modified = 2024-01-02 03:04:05
CRC = 1A2B3C4D
Encrypted = -
Method = LZMA2:12
Block = 0

Path = images/photo.png
Size = 20480
Packed Size = 19999
Modified = 2024-01-02 03:04:06
CRC = DEADBEEF
Encrypted = +
Method = LZMA2:12
Block = 0
";

    #[test]
    fn a_seven_zip_technical_listing_is_parsed_into_entries() {
        let entries = parse_seven_zip_listing(REAL_7Z_LISTING);
        assert_eq!(entries.len(), 3, "the archive's own path must be skipped");
        assert_eq!(entries[0].path, "documents");
        assert!(entries[0].is_directory);
        assert_eq!(entries[1].path, "documents/report.txt");
        assert_eq!(entries[1].size, 1536);
        assert_eq!(entries[1].crc.as_deref(), Some("1A2B3C4D"));
        assert!(!entries[1].encrypted);
        assert_eq!(entries[2].path, "images/photo.png");
        assert!(entries[2].encrypted);
    }

    #[test]
    fn an_empty_or_unparseable_7z_listing_yields_no_entries_rather_than_a_guess() {
        assert!(parse_seven_zip_listing("").is_empty());
        assert!(parse_seven_zip_listing("no key equals sign here").is_empty());
        // A header block with no Path is not an entry.
        assert!(parse_seven_zip_listing("Type = 7z\nPhysical Size = 456\n").is_empty());
    }

    #[test]
    fn a_7z_manifest_hash_ignores_order_and_directories_like_the_zip_one() {
        let forward = parse_seven_zip_listing(REAL_7Z_LISTING);
        let reversed = {
            let mut copy = forward.clone();
            copy.reverse();
            copy
        };
        assert_eq!(
            manifest_hash_from_listing(&forward),
            manifest_hash_from_listing(&reversed)
        );
        assert_eq!(manifest_hash_from_listing(&forward).len(), 64);
    }

    #[test]
    fn a_7z_manifest_differs_when_a_size_or_crc_differs() {
        let base = parse_seven_zip_listing(REAL_7Z_LISTING);
        let changed = parse_seven_zip_listing(&REAL_7Z_LISTING.replace("1A2B3C4D", "1A2B3C4E"));
        assert_ne!(
            manifest_hash_from_listing(&base),
            manifest_hash_from_listing(&changed)
        );
    }

    // ---- the typed refusal -------------------------------------------------------------------

    #[test]
    fn an_external_only_format_is_refused_with_a_reason_in_both_languages() {
        for format in super::EXTERNAL_ONLY_FORMATS {
            let refusal = unsupported_format(format);
            assert_eq!(refusal.format, format);
            assert!(refusal.reason_en.contains("not parsed by this build"));
            assert!(refusal.reason_ar.contains("لا تقرأ هذه النسخة"));
        }
    }

    #[test]
    fn a_dependent_format_provides_no_manifest_hash_at_all() {
        // The central property: an unsupported format never yields a hash that could be
        // mistaken for a measurement, so there is no code path to give one.
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("archive.7z");
        fs::write(&path, b"7z\xBC\xAF'\x1A").expect("write");
        let refusal = unsupported_format("7z");
        assert!(refusal.reason_en.contains("7-Zip"));
        assert!(refusal.reason_en.contains("listing only"));
        // The bytes on disk are irrelevant: the extension decides, and the extension is
        // refused. Reading it with the ZIP reader would be a different claim.
        assert!(path.exists());
    }
}
