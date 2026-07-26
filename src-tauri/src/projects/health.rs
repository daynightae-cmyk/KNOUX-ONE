use std::{fs, path::Path};
use walkdir::WalkDir;

use super::{
    contracts::{HealthFinding, ProjectHealthRequest, ProjectHealthResult},
    safety::{redacted_path, validate_project_root},
};

fn push_finding(
    findings: &mut Vec<HealthFinding>,
    code: &str,
    severity: &str,
    title: impl Into<String>,
    evidence_path: Option<&Path>,
    line: Option<u64>,
    redacted_preview: Option<String>,
    weight: u8,
) {
    findings.push(HealthFinding {
        code: code.into(),
        severity: severity.into(),
        title: title.into(),
        evidence_path: evidence_path.map(redacted_path),
        line,
        redacted_preview,
        weight,
    });
}

fn looks_like_secret(line: &str) -> Option<&'static str> {
    let uppercase = line.to_ascii_uppercase();
    for (needle, category) in [
        ("PRIVATE_KEY", "private_key"),
        ("SECRET_KEY", "secret_key"),
        ("API_KEY", "api_key"),
        ("ACCESS_TOKEN", "access_token"),
        ("AUTH_TOKEN", "auth_token"),
        ("PASSWORD=", "password"),
        ("BEGIN RSA PRIVATE KEY", "private_key"),
        ("BEGIN OPENSSH PRIVATE KEY", "private_key"),
    ] {
        if uppercase.contains(needle) {
            return Some(category);
        }
    }
    None
}

fn redact_line(line: &str) -> String {
    if let Some((key, _)) = line.split_once('=') {
        return format!("{}=<redacted>", key.trim());
    }
    let trimmed = line.trim();
    if trimmed.len() > 24 {
        format!("{}…<redacted>", trimmed.chars().take(12).collect::<String>())
    } else {
        "<redacted>".into()
    }
}

pub fn audit_health(request: ProjectHealthRequest) -> ProjectHealthResult {
    let root = match validate_project_root(&request.project_path) {
        Ok(path) => path,
        Err(error) => {
            return ProjectHealthResult {
                health_score: 0,
                score_formula: "100 - sum(finding weights), clamped to 0..100".into(),
                findings: Vec::new(),
                checked_files: 0,
                warnings: vec![error.to_string()],
            }
        }
    };

    let mut findings = Vec::new();
    let mut warnings = Vec::new();
    let mut checked_files = 0u64;

    for (file, code, title, weight) in [
        ("README.md", "missing_readme", "README.md is missing", 5),
        (".gitignore", "missing_gitignore", ".gitignore is missing", 8),
        ("LICENSE", "missing_license", "No LICENSE file was found", 2),
    ] {
        if !root.join(file).exists() {
            push_finding(&mut findings, code, "warning", title, Some(&root.join(file)), None, None, weight);
        }
    }
    if !root.join(".git").exists() {
        push_finding(&mut findings, "missing_git_repository", "info", "The project is not a Git repository", Some(&root), None, None, 3);
    }
    if root.join(".env").exists() && !root.join(".env.example").exists() {
        push_finding(&mut findings, "missing_env_template", "warning", "A runtime .env exists without an .env.example template", Some(&root.join(".env")), None, None, 10);
    }

    let lockfiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"]
        .iter()
        .filter(|file| root.join(file).exists())
        .collect::<Vec<_>>();
    if lockfiles.len() > 1 {
        push_finding(
            &mut findings,
            "conflicting_node_lockfiles",
            "warning",
            format!("Multiple Node lockfiles were detected: {}", lockfiles.into_iter().copied().collect::<Vec<_>>().join(", ")),
            Some(&root),
            None,
            None,
            10,
        );
    }

    for entry in WalkDir::new(&root).max_depth(12).follow_links(false).into_iter() {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                warnings.push(format!("walk_error: {error}"));
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        checked_files += 1;
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(error) => {
                warnings.push(format!("metadata_failed: {}: {error}", redacted_path(entry.path())));
                continue;
            }
        };
        if metadata.len() > 5 * 1024 * 1024 && !entry.path().components().any(|part| matches!(part.as_os_str().to_string_lossy().as_ref(), "node_modules" | "target" | ".git")) {
            push_finding(&mut findings, "oversized_source_candidate", "info", format!("Large non-generated file: {} bytes", metadata.len()), Some(entry.path()), None, None, 1);
        }
        if metadata.len() > 2 * 1024 * 1024 {
            continue;
        }
        let extension = entry.path().extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase();
        if !matches!(extension.as_str(), "env" | "txt" | "md" | "json" | "yaml" | "yml" | "toml" | "ini" | "ts" | "tsx" | "js" | "jsx" | "rs" | "py" | "go" | "java" | "cs" | "php" | "rb")
            && !entry.file_name().to_string_lossy().starts_with(".env")
        {
            continue;
        }
        let content = match fs::read_to_string(entry.path()) {
            Ok(content) => content,
            Err(_) => continue,
        };
        for (index, line) in content.lines().enumerate() {
            if line.contains("<<<<<<<") || line.contains("=======") || line.contains(">>>>>>>") {
                push_finding(&mut findings, "merge_conflict_marker", "critical", "Unresolved merge-conflict marker", Some(entry.path()), Some((index + 1) as u64), Some(line.trim().chars().take(80).collect()), 25);
            }
            if let Some(category) = looks_like_secret(line) {
                push_finding(&mut findings, "secret_like_pattern", "critical", format!("Potential {category} value requires review"), Some(entry.path()), Some((index + 1) as u64), Some(redact_line(line)), 20);
            }
        }
    }

    let deduction = findings.iter().map(|finding| u16::from(finding.weight)).sum::<u16>().min(100);
    ProjectHealthResult {
        health_score: (100u16 - deduction) as u8,
        score_formula: format!("100 - {deduction} weighted finding points"),
        findings,
        checked_files,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::audit_health;
    use crate::projects::contracts::ProjectHealthRequest;
    use std::fs;

    #[test]
    fn redacts_secret_values_and_scores_real_findings() {
        let directory = tempfile::tempdir().unwrap();
        fs::write(directory.path().join(".env"), "API_KEY=very-secret-value\n").unwrap();
        let result = audit_health(ProjectHealthRequest { project_path: directory.path().to_string_lossy().to_string() });
        assert!(result.health_score < 100);
        let finding = result.findings.iter().find(|finding| finding.code == "secret_like_pattern").unwrap();
        assert!(!finding.redacted_preview.as_deref().unwrap_or_default().contains("very-secret-value"));
    }
}
