# License Matrix

## Mandatory release review

- **FFmpeg**: determine the exact configured build. FFmpeg is primarily LGPL, but enabling GPL components changes obligations. Do not bundle an unknown third-party binary. Source: https://ffmpeg.org/legal.html
- **Chromaprint**: the library is a plausible audio fingerprint engine, but verify the exact backend. Avoid accidentally pulling GPL-only FFT dependencies into a proprietary distribution. Source: https://github.com/acoustid/chromaprint
- **7-Zip**: license set is mixed; RAR-related source has additional restrictions. Prefer runtime detection of a user-installed binary until redistribution is approved. Source: https://www.7-zip.org/license.txt
- **BLAKE3**: permissive multi-license project; keep attribution/license records for exact crate version. Source: https://github.com/BLAKE3-team/BLAKE3
- **SQLite**: public domain core; the repository already uses bundled SQLite through rusqlite. Source: https://www.sqlite.org/copyright.html
- **Windows APIs/commands**: APIs are platform interfaces, not redistributable binaries. Never redistribute Windows system binaries.
