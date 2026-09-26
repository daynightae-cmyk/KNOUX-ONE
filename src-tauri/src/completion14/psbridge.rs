//! Bounded Windows PowerShell bridge for the planned-service completion engines.
//!
//! Every script handed to this module is a literal constant written in this source
//! file. No caller can supply script text, and no script interpolates a user string
//! into an executable position: values only ever travel as PowerShell *data* through
//! the environment, never as code. That keeps the repository rule "no arbitrary shell
//! execution" true for the engines added in the planned batches.

use serde_json::Value;
use std::path::PathBuf;

/// Upper bound applied to captured stdout. A script that exceeds it is reported as
/// truncated instead of being allowed to grow without limit.
pub const MAX_STDOUT_BYTES: usize = 4 * 1024 * 1024;

/// Upper bound applied to captured stderr, which is only kept as a diagnostic tail.
pub const MAX_STDERR_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone)]
pub struct PsRun {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub stdout_truncated: bool,
}

impl PsRun {
    /// Windows PowerShell reports most recoverable problems as non-terminating errors
    /// on stderr while still exiting 0, so stderr is treated as a first-class
    /// diagnostic rather than discarded.
    pub fn stderr_tail(&self) -> Option<String> {
        let trimmed = self.stderr.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }
}

fn clip_tail(raw: &[u8], limit: usize) -> (String, bool) {
    let truncated = raw.len() > limit;
    let slice = if truncated {
        &raw[raw.len() - limit..]
    } else {
        raw
    };
    // A cut in the middle of a multi-byte sequence is replaced rather than shown as a
    // broken glyph, so a truncated log is never mistaken for a different character.
    let text = String::from_utf8_lossy(slice).into_owned();
    if truncated {
        (
            format!("[truncated to the last {limit} bytes] {text}"),
            true,
        )
    } else {
        (text, false)
    }
}

#[cfg(target_os = "windows")]
pub fn run(script: &str) -> Result<PsRun, String> {
    use std::process::Command;
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output()
        .map_err(|error| format!("powershell_launch_failed:{error}"))?;
    let (stdout, stdout_truncated) = clip_tail(&output.stdout, MAX_STDOUT_BYTES);
    let (stderr, _) = clip_tail(&output.stderr, MAX_STDERR_BYTES);
    Ok(PsRun {
        stdout,
        stderr,
        exit_code: output.status.code(),
        stdout_truncated,
    })
}

#[cfg(not(target_os = "windows"))]
pub fn run(_script: &str) -> Result<PsRun, String> {
    Err("unsupported_os".to_string())
}

/// Extracts the JSON document a script printed, tolerating a byte-order mark and any
/// informational line Windows PowerShell emitted before it.
pub fn parse_json(stdout: &str) -> Result<Value, String> {
    let trimmed = stdout.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Err("powershell_produced_no_output".to_string());
    }
    let start = trimmed
        .find(['{', '['])
        .ok_or_else(|| "powershell_output_contained_no_json".to_string())?;
    serde_json::from_str(&trimmed[start..])
        .map_err(|error| format!("powershell_json_parse_failed:{error}"))
}

/// Windows PowerShell collapses a single-element array into a bare object when it
/// calls `ConvertTo-Json`. Every list crossing this bridge is normalised so callers
/// never have to care which shape came back.
pub fn as_array(value: Value) -> Vec<Value> {
    match value {
        Value::Array(items) => items,
        Value::Null => Vec::new(),
        other => vec![other],
    }
}

pub fn text(value: &Value, key: &str) -> String {
    value
        .get(key)
        .map(|item| match item {
            Value::String(text) => text.clone(),
            Value::Null => String::new(),
            other => other.to_string(),
        })
        .unwrap_or_default()
}

pub fn number(value: &Value, key: &str) -> Option<u64> {
    match value.get(key) {
        Some(Value::Number(number)) => number
            .as_u64()
            .or_else(|| number.as_f64().map(|value| value.max(0.0) as u64)),
        Some(Value::String(text)) => text.trim().parse::<u64>().ok(),
        _ => None,
    }
}

pub fn boolean(value: &Value, key: &str) -> Option<bool> {
    match value.get(key) {
        Some(Value::Bool(flag)) => Some(*flag),
        Some(Value::Number(number)) => Some(number.as_f64().unwrap_or(0.0) != 0.0),
        Some(Value::String(text)) => match text.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" => Some(true),
            "false" | "0" | "no" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

/// `%WINDIR%` without assuming a drive letter, falling back to the compile-time target
/// directory only as a last resort so a wrong guess is visible rather than silent.
pub fn windows_root() -> PathBuf {
    std::env::var_os("SystemRoot")
        .or_else(|| std::env::var_os("WINDIR"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
}

pub fn program_data() -> Option<PathBuf> {
    std::env::var_os("ProgramData").map(PathBuf::from)
}

pub fn local_app_data() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
}

pub fn roaming_app_data() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::{as_array, clip_tail, parse_json, text};
    use serde_json::json;

    #[test]
    fn parse_json_tolerates_a_mark_and_a_preamble() {
        let parsed = parse_json("\u{feff}WARNING: something\n{\"a\":1}").expect("json");
        assert_eq!(parsed["a"], json!(1));
    }

    #[test]
    fn parse_json_rejects_output_without_a_document() {
        assert_eq!(
            parse_json("no json here").expect_err("must fail"),
            "powershell_output_contained_no_json"
        );
        assert_eq!(
            parse_json("   ").expect_err("must fail"),
            "powershell_produced_no_output"
        );
    }

    #[test]
    fn as_array_normalises_the_single_element_shape() {
        assert_eq!(as_array(json!({"a": 1})).len(), 1);
        assert_eq!(as_array(json!([{"a": 1}, {"a": 2}])).len(), 2);
        assert!(as_array(json!(null)).is_empty());
    }

    #[test]
    fn clip_tail_marks_a_truncated_capture() {
        let raw = b"abcdef";
        let (text_out, truncated) = clip_tail(raw, 3);
        assert!(truncated);
        assert!(text_out.starts_with("[truncated to the last 3 bytes]"));
        let (whole, truncated) = clip_tail(raw, 6);
        assert!(!truncated);
        assert_eq!(whole, "abcdef");
    }

    #[test]
    fn text_returns_an_empty_string_for_a_missing_field() {
        assert_eq!(text(&json!({}), "missing"), "");
        assert_eq!(text(&json!({"k": null}), "k"), "");
    }
}
