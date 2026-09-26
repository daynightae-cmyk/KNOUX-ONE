//! Dependency discovery for the services that decode media or list archives.
//!
//! Every service in this family can reach a point where the work is impossible without
//! an external program. The previous behaviour was to resolve the program, fail with a
//! bare string, and let the caller see an error with no way to tell *which* dependency
//! was missing, from where it was found, or what it claimed to be. A user staring at
//! `required_tool_missing:ffprobe` cannot act on that, and a service that returns an
//! empty but successful scan when a decoder is absent is simply lying.
//!
//! So resolution is done once, recorded, and carried in the result:
//!
//! * the resolved **absolute path**,
//! * the **version line the program printed about itself**, kept verbatim,
//! * the **licence line**, when the program prints one, also verbatim — this is the
//!   evidence the closure specification asks for before any bundled tool is relied on,
//! * and, when the program is absent, a **typed reason in both languages**.
//!
//! Nothing here fabricates a version, a path, or a result.

use crate::duplicates::contracts::ToolEvidence;
use once_cell::sync::Lazy;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};

/// How a program is asked to identify itself. Some tools need no flag, some need a
/// subcommand, and getting this wrong is how a "version" turns into an error message.
fn version_args(tool: &str) -> &'static [&'static str] {
    match tool {
        // 7-Zip prints its banner and licence block for the `i` (info) subcommand; with
        // no arguments it prints usage and exits non-zero.
        "7z" | "7za" | "7zr" => &["i"],
        _ => &["-version"],
    }
}

/// Looks a program up on `PATH` without going through a shell.
pub fn resolve_tool(name: &str) -> Result<PathBuf, String> {
    let output = Command::new(if cfg!(target_os = "windows") {
        "where.exe"
    } else {
        "which"
    })
    .arg(name)
    .output()
    .map_err(|error| format!("tool_lookup_failed:{name}:{error}"))?;
    if !output.status.success() {
        return Err(format!("required_tool_missing:{name}"));
    }
    let path = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or_default()
        .trim()
        .to_string();
    if path.is_empty() {
        Err(format!("required_tool_missing:{name}"))
    } else {
        Ok(PathBuf::from(path))
    }
}

/// Extracts the first non-empty line, which is the banner a tool prints about itself.
pub fn first_line(text: &str) -> Option<String> {
    let line = text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.contains("could not be found"))?;
    Some(line.chars().take(200).collect())
}

/// Extracts the first line that talks about licensing, verbatim.
///
/// This exists so a licence claim in the result is the program's own words rather than
/// this repository's recollection of them.
pub fn license_line(text: &str) -> Option<String> {
    let line = text
        .lines()
        .map(str::trim)
        .find(|line| line.to_ascii_lowercase().contains("license"))?;
    Some(line.chars().take(200).collect())
}

fn absent(name: &str, reason_en: String, reason_ar: String) -> ToolEvidence {
    ToolEvidence {
        tool: name.to_string(),
        required: true,
        status: "absent".into(),
        resolved_path: None,
        version: None,
        license_evidence: None,
        reason_en,
        reason_ar,
    }
}

/// Runs the tool's own identification command and records what it said.
pub fn probe_tool(path: &Path, name: &str) -> ToolEvidence {
    let output = Command::new(path).args(version_args(name)).output();
    let output = match output {
        Ok(value) => value,
        Err(error) => {
            return absent(
                name,
                format!(
                    "The program at {} could not be started: {error}. The path resolved but \
                     nothing ran, so its version is unknown.",
                    path.display()
                ),
                format!(
                    "تعذّر تشغيل البرنامج في {}: {error}. تم تحديد المسار لكن لم يعمل البرنامج، \
                     لذلك إصداره غير معروف.",
                    path.display()
                ),
            )
        }
    };
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let version = first_line(&stdout).or_else(|| first_line(&stderr));
    match version {
        Some(version) => {
            let lowered = version.to_ascii_lowercase();
            let identified = lowered.contains(&name.to_ascii_lowercase())
                || version.split_whitespace().any(|word| {
                    word.chars()
                        .next()
                        .is_some_and(|first| first.is_ascii_digit())
                });
            ToolEvidence {
                tool: name.to_string(),
                required: true,
                status: if identified {
                    "resolved".into()
                } else {
                    "present_version_unknown".into()
                },
                resolved_path: Some(path.to_string_lossy().to_string()),
                license_evidence: license_line(&stdout),
                version: Some(version.clone()),
                reason_en: if identified {
                    format!(
                        "Resolved to {} and it reported: {}",
                        path.display(),
                        version
                    )
                } else {
                    format!(
                        "Resolved to {}, but its output did not look like a version banner \
                         ({}). Treat its version as unconfirmed.",
                        path.display(),
                        version
                    )
                },
                reason_ar: if identified {
                    format!("تم تحديد {} وأعلن: {}", path.display(), version)
                } else {
                    format!(
                        "تم تحديد {} لكن ناتجه لا يشبه لافتة إصدار ({}). اعتبر إصداره غير مؤكد.",
                        path.display(),
                        version
                    )
                },
            }
        }
        None => absent(
            name,
            format!(
                "The program at {} ran but printed no identification line, so its version \
                 cannot be confirmed.",
                path.display()
            ),
            format!(
                "عمل البرنامج في {} لكنه لم يطبع أي سطر تعريف، لذلك لا يمكن تأكيد إصداره.",
                path.display()
            ),
        ),
    }
}

static CACHE: Lazy<Mutex<HashMap<String, ToolEvidence>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// Resolves a program once per process and reuses the recorded answer.
///
/// Re-probing per file would spawn thousands of processes for a large folder and could
/// report two different answers for the same binary.
pub fn tool_evidence(name: &str) -> ToolEvidence {
    if let Ok(cache) = CACHE.lock() {
        if let Some(cached) = cache.get(name) {
            return cached.clone();
        }
    }
    let value = match resolve_tool(name) {
        Ok(path) => probe_tool(&path, name),
        Err(error) => absent(
            name,
            format!(
                "`{name}` was not found on PATH ({error}). Decoding real media with it is \
                 impossible, so this service reports that instead of returning a result it \
                 did not measure."
            ),
            format!(
                "لم يُعثر على `{name}` في PATH ({error}). يستحيل فك ترميز الوسائط الحقيقية به، \
                 لذلك تبلّغ هذه الخدمة عن ذلك بدل إرجاع نتيجة لم تقِسها."
            ),
        ),
    };
    if let Ok(mut cache) = CACHE.lock() {
        cache.insert(name.to_string(), value.clone());
    }
    value
}

/// True only when the tool was both found and made to identify itself.
pub fn is_usable(evidence: &ToolEvidence) -> bool {
    evidence.status == "resolved"
}

/// Renders the dependency list into a warning line so a failure is legible even in a
/// client that only shows the warning list.
pub fn dependency_warning(evidence: &ToolEvidence) -> String {
    format!(
        "dependency:{} status={} path={} version={} reason={}",
        evidence.tool,
        evidence.status,
        evidence.resolved_path.as_deref().unwrap_or("-"),
        evidence.version.as_deref().unwrap_or("-"),
        evidence.reason_en
    )
}

#[cfg(test)]
mod tests {
    use super::{dependency_warning, first_line, license_line, resolve_tool, tool_evidence};

    #[test]
    fn a_missing_program_is_reported_as_absent_with_a_reason_in_both_languages() {
        let evidence = tool_evidence("knoux-no-such-program-zzz");
        assert_eq!(evidence.status, "absent");
        assert!(evidence.resolved_path.is_none());
        assert!(evidence.version.is_none());
        // A bare "not found" with no explanation would leave the user stuck.
        assert!(evidence.reason_en.contains("PATH"));
        assert!(!evidence.reason_ar.is_empty());
        assert!(!evidence.reason_en.is_empty());
    }

    #[test]
    fn the_same_program_reports_the_same_evidence_twice() {
        let first = tool_evidence("knoux-no-such-program-zzz");
        let second = tool_evidence("knoux-no-such-program-zzz");
        assert_eq!(first, second);
    }

    #[test]
    fn a_missing_program_uses_a_typed_reason_rather_than_an_empty_success() {
        let error = resolve_tool("knoux-no-such-program-zzz").expect_err("must fail");
        assert_eq!(error, "required_tool_missing:knoux-no-such-program-zzz");
    }

    #[test]
    fn the_version_banner_is_the_first_line_the_program_printed() {
        let banner = "ffprobe version 6.1.1-full_build-www.gyan.dev\nbuilt with gcc 13\n";
        assert_eq!(
            first_line(banner).as_deref(),
            Some("ffprobe version 6.1.1-full_build-www.gyan.dev")
        );
    }

    #[test]
    fn an_empty_or_shell_error_output_yields_no_version_rather_than_garbage() {
        assert_eq!(first_line(""), None);
        assert_eq!(first_line("   \n\n  \n"), None);
        // A launcher that prints "not found" must not be mistaken for a version.
        assert_eq!(
            first_line("INFO: could not be found in any of the following paths"),
            None
        );
    }

    #[test]
    fn a_licence_claim_is_quoted_from_the_program_not_from_memory() {
        let listing = "7-Zip [64] : 23.01\nFormats: 7z\nLicense: GNU LGPL v2.1\n";
        assert_eq!(
            license_line(listing).as_deref(),
            Some("License: GNU LGPL v2.1")
        );
        assert_eq!(license_line("no licence talk here"), None);
    }

    #[test]
    fn the_dependency_warning_carries_the_path_and_version_a_reader_needs() {
        let evidence = tool_evidence("knoux-no-such-program-zzz");
        let warning = dependency_warning(&evidence);
        assert!(warning.contains("knoux-no-such-program-zzz"));
        assert!(warning.contains("status=absent"));
    }
}
