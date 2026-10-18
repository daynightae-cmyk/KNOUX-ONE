use std::{collections::BTreeSet, fs, path::Path};

use super::{
    contracts::{DependencyAuditRequest, DependencyAuditResult, DependencyItem},
    safety::{redacted_path, validate_project_root},
};

fn pinned(version: &str) -> bool {
    let trimmed = version.trim();
    !trimmed.is_empty()
        && !trimmed.starts_with('^')
        && !trimmed.starts_with('~')
        && !trimmed.contains('*')
        && !trimmed.contains('>')
        && !trimmed.contains('<')
        && !trimmed.eq_ignore_ascii_case("latest")
        && !trimmed.starts_with("git+")
}

fn push_json_dependencies(
    manifest: &Path,
    content: &str,
    dependencies: &mut Vec<DependencyItem>,
    warnings: &mut Vec<String>,
) {
    let value = match serde_json::from_str::<serde_json::Value>(content) {
        Ok(value) => value,
        Err(error) => {
            warnings.push(format!("manifest_parse_failed: {}: {error}", redacted_path(manifest)));
            return;
        }
    };
    for (field, dep_type) in [("dependencies", "direct"), ("devDependencies", "development"), ("peerDependencies", "peer"), ("optionalDependencies", "optional")] {
        if let Some(entries) = value.get(field).and_then(|entry| entry.as_object()) {
            for (name, version) in entries {
                let version = version.as_str().unwrap_or("unknown").to_string();
                dependencies.push(DependencyItem {
                    name: name.clone(),
                    is_pinned: pinned(&version),
                    version,
                    dep_type: dep_type.into(),
                    source_manifest: redacted_path(manifest),
                });
            }
        }
    }
}

fn push_requirements(
    manifest: &Path,
    content: &str,
    dependencies: &mut Vec<DependencyItem>,
) {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('-') {
            continue;
        }
        let (name, version) = if let Some((name, version)) = trimmed.split_once("==") {
            (name.trim(), version.trim())
        } else if let Some((name, version)) = trimmed.split_once(">=") {
            (name.trim(), version.trim())
        } else {
            (trimmed, "unbounded")
        };
        dependencies.push(DependencyItem {
            name: name.into(),
            version: version.into(),
            dep_type: "direct".into(),
            is_pinned: trimmed.contains("=="),
            source_manifest: redacted_path(manifest),
        });
    }
}

fn push_cargo_dependencies(
    manifest: &Path,
    content: &str,
    dependencies: &mut Vec<DependencyItem>,
) {
    let mut section = String::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            section = trimmed.trim_matches(&['[', ']'][..]).to_string();
            continue;
        }
        if !matches!(section.as_str(), "dependencies" | "dev-dependencies" | "build-dependencies")
            || trimmed.is_empty()
            || trimmed.starts_with('#')
        {
            continue;
        }
        let Some((name, raw)) = trimmed.split_once('=') else { continue };
        let raw = raw.trim();
        let version = if raw.starts_with('{') {
            raw.split("version")
                .nth(1)
                .and_then(|value| value.split('=').nth(1))
                .map(|value| value.trim().trim_matches(&['"', '\'', ',', '}', ' '][..]).to_string())
                .unwrap_or_else(|| "path-or-git".into())
        } else {
            raw.trim_matches(&['"', '\'', ' '][..]).to_string()
        };
        dependencies.push(DependencyItem {
            name: name.trim().into(),
            is_pinned: pinned(&version),
            version,
            dep_type: if section == "dev-dependencies" { "development" } else { "direct" }.into(),
            source_manifest: redacted_path(manifest),
        });
    }
}

pub fn audit_dependencies(request: DependencyAuditRequest) -> DependencyAuditResult {
    let root = match validate_project_root(&request.project_path) {
        Ok(path) => path,
        Err(error) => {
            return DependencyAuditResult {
                ecosystems: Vec::new(), manifests: Vec::new(), lockfiles: Vec::new(),
                lockfile_status: "unavailable".into(), dependencies: Vec::new(), unpinned_count: 0,
                risk_findings: Vec::new(), audit_commands: Vec::new(), warnings: vec![error.to_string()],
            }
        }
    };

    let mut ecosystems = BTreeSet::new();
    let mut manifests = Vec::new();
    let mut lockfiles = Vec::new();
    let mut dependencies = Vec::new();
    let mut warnings = Vec::new();
    let mut audit_commands = Vec::new();

    for (file, ecosystem) in [
        ("package.json", "node"), ("Cargo.toml", "rust"), ("requirements.txt", "python"),
        ("pyproject.toml", "python"), ("go.mod", "go"), ("pom.xml", "maven"),
        ("build.gradle", "gradle"), ("build.gradle.kts", "gradle"), ("composer.json", "composer"),
    ] {
        let path = root.join(file);
        if !path.exists() { continue; }
        ecosystems.insert(ecosystem.to_string());
        manifests.push(redacted_path(&path));
        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(error) => { warnings.push(format!("manifest_read_failed: {}: {error}", redacted_path(&path))); continue; }
        };
        match file {
            "package.json" | "composer.json" => push_json_dependencies(&path, &content, &mut dependencies, &mut warnings),
            "Cargo.toml" => push_cargo_dependencies(&path, &content, &mut dependencies),
            "requirements.txt" => push_requirements(&path, &content, &mut dependencies),
            "go.mod" => {
                for line in content.lines().map(str::trim) {
                    if line.starts_with("require ") {
                        let parts = line.trim_start_matches("require ").split_whitespace().collect::<Vec<_>>();
                        if parts.len() >= 2 {
                            dependencies.push(DependencyItem { name: parts[0].into(), version: parts[1].into(), dep_type: "direct".into(), is_pinned: true, source_manifest: redacted_path(&path) });
                        }
                    }
                }
            }
            _ => warnings.push(format!("dependency_parser_partial: {file}")),
        }
    }

    for file in [
        "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "Cargo.lock",
        "poetry.lock", "Pipfile.lock", "uv.lock", "go.sum", "packages.lock.json", "composer.lock",
    ] {
        let path = root.join(file);
        if path.exists() { lockfiles.push(redacted_path(&path)); }
    }

    if ecosystems.contains("node") { audit_commands.extend(["npm audit --json".into(), "npm outdated --json".into()]); }
    if ecosystems.contains("rust") { audit_commands.extend(["cargo audit (optional tool)".into(), "cargo outdated (optional tool)".into()]); }
    if ecosystems.contains("python") { audit_commands.push("python -m pip list --outdated --format=json".into()); }
    if ecosystems.contains("go") { audit_commands.push("go list -m -u all".into()); }

    let node_lock_count = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"]
        .iter().filter(|file| root.join(file).exists()).count();
    let mut risk_findings = Vec::new();
    let lockfile_status = if node_lock_count > 1 {
        risk_findings.push("Multiple conflicting Node package-manager lockfiles were detected.".into());
        "conflict"
    } else if lockfiles.is_empty() && !manifests.is_empty() {
        risk_findings.push("No supported dependency lockfile was found.".into());
        "missing"
    } else if manifests.is_empty() {
        "not_applicable"
    } else {
        "verified"
    };
    let unpinned_count = dependencies.iter().filter(|dependency| !dependency.is_pinned).count();
    if unpinned_count > 0 { risk_findings.push(format!("{unpinned_count} dependencies use loose or non-registry version references.")); }

    DependencyAuditResult {
        ecosystems: ecosystems.into_iter().collect(), manifests, lockfiles,
        lockfile_status: lockfile_status.into(), dependencies, unpinned_count,
        risk_findings, audit_commands, warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::audit_dependencies;
    use crate::projects::contracts::DependencyAuditRequest;
    use std::fs;

    #[test]
    fn parses_node_dependencies_and_detects_lockfile_conflicts() {
        let directory = tempfile::tempdir().unwrap();
        fs::write(directory.path().join("package.json"), r#"{"dependencies":{"react":"^19.0.0"},"devDependencies":{"vitest":"4.1.10"}}"#).unwrap();
        fs::write(directory.path().join("package-lock.json"), "{}").unwrap();
        fs::write(directory.path().join("yarn.lock"), "").unwrap();
        let result = audit_dependencies(DependencyAuditRequest { project_path: directory.path().to_string_lossy().to_string() });
        assert_eq!(result.dependencies.len(), 2);
        assert_eq!(result.lockfile_status, "conflict");
        assert_eq!(result.unpinned_count, 1);
    }
}
