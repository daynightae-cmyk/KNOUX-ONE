use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResult<T = serde_json::Value> {
    pub operation_id: String,
    pub capability_id: String,
    pub handler_id: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub requires_restart: bool,
    pub exit_code: Option<i32>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub summary_en: String,
    pub summary_ar: String,
    pub warnings: Vec<String>,
    pub error_code: Option<String>,
    pub data: Option<T>,
}

/// Identity of the running application binary, so an exported artifact can be tied to
/// the exact build that produced it. Hashing the executable is a one-time cost that is
/// then reused for every operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryEvidence {
    pub product: String,
    pub version: String,
    pub executable_path: String,
    pub byte_count: u64,
    pub sha256: String,
    pub hashed: bool,
    pub unavailable_reason: Option<String>,
}

fn current_exe() -> Result<std::path::PathBuf, String> {
    std::env::current_exe().map_err(|error| format!("current_exe_failed: {error}"))
}

fn hash_file(path: &std::path::Path) -> Result<(String, u64), String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(|error| format!("binary_open: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 262_144];
    let mut total = 0u64;
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("binary_read: {error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        total = total.saturating_add(read as u64);
    }
    Ok((
        hasher
            .finalize()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect(),
        total,
    ))
}

static BINARY_EVIDENCE: OnceLock<BinaryEvidence> = OnceLock::new();

/// Returns the cached binary identity, computing it on first use.
pub fn binary_evidence() -> BinaryEvidence {
    BINARY_EVIDENCE
        .get_or_init(|| {
            let (executable_path, path_error) = match current_exe() {
                Ok(path) => (path.to_string_lossy().to_string(), None),
                Err(error) => (String::new(), Some(error)),
            };
            let (sha256, byte_count, hashed) = match current_exe()
                .ok()
                .as_deref()
                .and_then(|path| hash_file(path).ok())
            {
                Some((sha, bytes)) => (sha, bytes, true),
                None => (String::new(), 0, false),
            };
            let unavailable_reason = if hashed {
                None
            } else {
                Some(path_error.unwrap_or_else(|| "binary_hash_unavailable".to_string()))
            };
            BinaryEvidence {
                product: env!("CARGO_PKG_NAME").to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                executable_path,
                byte_count,
                sha256,
                hashed,
                unavailable_reason,
            }
        })
        .clone()
}

#[cfg(test)]
mod tests {
    use super::binary_evidence;

    #[test]
    fn binary_evidence_is_resolved_from_the_running_executable() {
        let evidence = binary_evidence();
        assert_eq!(evidence.product, "knoux-one");
        assert!(!evidence.version.is_empty());
        if evidence.hashed {
            assert_eq!(evidence.sha256.len(), 64);
            assert!(evidence.byte_count > 0);
            assert!(evidence.unavailable_reason.is_none());
        } else {
            // An unresolvable executable is reported as such rather than presenting an
            // empty hash as if it were a real measurement.
            assert!(evidence.unavailable_reason.is_some());
        }
    }

    #[test]
    fn binary_evidence_is_cached_so_hashing_is_not_repeated() {
        let first = binary_evidence();
        let second = binary_evidence();
        assert_eq!(first.sha256, second.sha256);
        assert_eq!(first.byte_count, second.byte_count);
    }
}
