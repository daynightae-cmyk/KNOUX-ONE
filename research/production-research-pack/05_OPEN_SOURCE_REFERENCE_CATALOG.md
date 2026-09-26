# Open Source Reference Catalog

| Project | Role | Reuse posture | License / caveat |
|---|---|---|---|
| BLAKE3 | Fast streaming fingerprints | Suitable candidate; already used in repo | Multi-license; verify exact crate package metadata before release. https://github.com/BLAKE3-team/BLAKE3 |
| FFmpeg/ffprobe | Media decode/probe | Prefer external or carefully built distributable profile | Mostly LGPL, but enabled components can make a build GPL. No “commercial license” shortcut. https://ffmpeg.org/legal.html |
| Chromaprint | Audio acoustic fingerprint candidate | Prototype before adoption | Project source is permissive, but build backends/dependencies must be checked. https://github.com/acoustid/chromaprint |
| 7-Zip | 7z/RAR manifest/listing candidate | External detection is simplest until bundling plan is approved | Mixed licensing including LGPL plus restricted unRAR components. https://www.7-zip.org/license.txt |
| SQLite | Local persistence | Strong fit; repository already uses rusqlite bundled | SQLite core is public domain. https://www.sqlite.org/copyright.html |
| Microsoft Windows classic samples | API usage reference | Reference/adapt selectively, inspect file-specific terms | https://github.com/microsoft/Windows-classic-samples |

Do not copy code merely because a GitHub repository is public. Record the exact tag/commit and file-specific license before reuse.
