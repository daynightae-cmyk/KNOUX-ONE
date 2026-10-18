use std::{collections::{BTreeMap, BTreeSet}, fs, path::Path};

use super::{
    contracts::{EnvironmentAuditRequest, EnvironmentAuditResult, EnvironmentKeyFinding},
    safety::{redacted_path, validate_project_root},
};

fn parse_env_file(path: &Path) -> (BTreeMap<String, Vec<(bool, usize)>>, Vec<String>) {
    let mut keys: BTreeMap<String, Vec<(bool, usize)>> = BTreeMap::new();
    let mut malformed = Vec::new();
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) => {
            malformed.push(format!("{}: read_failed: {error}", redacted_path(path)));
            return (keys, malformed);
        }
    };
    for (index, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some((raw_key, raw_value)) = trimmed.split_once('=') else {
            malformed.push(format!("{}:{}: malformed_line", redacted_path(path), index + 1));
            continue;
        };
        let key = raw_key.trim();
        if key.is_empty() || !key.chars().all(|character| character.is_ascii_alphanumeric() || character == '_') {
            malformed.push(format!("{}:{}: invalid_key", redacted_path(path), index + 1));
            continue;
        }
        keys.entry(key.to_string())
            .or_default()
            .push((raw_value.trim().is_empty(), index + 1));
    }
    (keys, malformed)
}

pub fn audit_environment(request: EnvironmentAuditRequest) -> EnvironmentAuditResult {
    let root = match validate_project_root(&request.project_path) {
        Ok(path) => path,
        Err(error) => {
            return EnvironmentAuditResult {
                runtime_files: Vec::new(), template_files: Vec::new(), keys: Vec::new(),
                missing_keys: Vec::new(), obsolete_keys: Vec::new(), malformed_lines: Vec::new(),
                runtime_versions: Vec::new(), warnings: vec![error.to_string()],
            }
        }
    };

    let runtime_names = [".env", ".env.local", ".env.development", ".env.production", ".env.test"];
    let template_names = [".env.example", ".env.sample", ".env.template"];
    let mut runtime_files = Vec::new();
    let mut template_files = Vec::new();
    let mut runtime_map: BTreeMap<String, Vec<(bool, usize)>> = BTreeMap::new();
    let mut template_map: BTreeMap<String, Vec<(bool, usize)>> = BTreeMap::new();
    let mut malformed_lines = Vec::new();

    for name in runtime_names {
        let path = root.join(name);
        if !path.exists() { continue; }
        runtime_files.push(redacted_path(&path));
        let (keys, malformed) = parse_env_file(&path);
        malformed_lines.extend(malformed);
        for (key, rows) in keys { runtime_map.entry(key).or_default().extend(rows); }
    }
    for name in template_names {
        let path = root.join(name);
        if !path.exists() { continue; }
        template_files.push(redacted_path(&path));
        let (keys, malformed) = parse_env_file(&path);
        malformed_lines.extend(malformed);
        for (key, rows) in keys { template_map.entry(key).or_default().extend(rows); }
    }

    let all_keys = runtime_map.keys().chain(template_map.keys()).cloned().collect::<BTreeSet<_>>();
    let mut keys = Vec::new();
    let mut missing_keys = Vec::new();
    let mut obsolete_keys = Vec::new();
    for key in all_keys {
        let runtime = runtime_map.get(&key);
        let template = template_map.get(&key);
        if runtime.is_none() && template.is_some() { missing_keys.push(key.clone()); }
        if runtime.is_some() && template.is_none() { obsolete_keys.push(key.clone()); }
        keys.push(EnvironmentKeyFinding {
            key,
            present_in_runtime_file: runtime.is_some(),
            present_in_template: template.is_some(),
            empty_value: runtime.map(|rows| rows.iter().any(|(empty, _)| *empty)).unwrap_or(false),
            duplicate_count: runtime.map(|rows| rows.len().saturating_sub(1) as u32).unwrap_or(0),
        });
    }

    let mut runtime_versions = Vec::new();
    for file in [".nvmrc", ".node-version", ".python-version", "rust-toolchain.toml", "global.json", ".tool-versions"] {
        let path = root.join(file);
        if !path.exists() { continue; }
        match fs::read_to_string(&path) {
            Ok(content) => runtime_versions.push(format!("{}: {}", redacted_path(&path), content.trim().chars().take(160).collect::<String>())),
            Err(error) => runtime_versions.push(format!("{}: read_failed: {error}", redacted_path(&path))),
        }
    }

    let mut warnings = Vec::new();
    if runtime_files.is_empty() { warnings.push("no_runtime_environment_files".into()); }
    if !runtime_files.is_empty() && template_files.is_empty() { warnings.push("environment_template_missing".into()); }

    EnvironmentAuditResult {
        runtime_files, template_files, keys, missing_keys, obsolete_keys,
        malformed_lines, runtime_versions, warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::audit_environment;
    use crate::projects::contracts::EnvironmentAuditRequest;
    use std::fs;

    #[test]
    fn compares_keys_without_exposing_values() {
        let directory = tempfile::tempdir().unwrap();
        fs::write(directory.path().join(".env"), "API_KEY=super-secret\nEMPTY=\n").unwrap();
        fs::write(directory.path().join(".env.example"), "API_KEY=\nMISSING=\n").unwrap();
        let result = audit_environment(EnvironmentAuditRequest { project_path: directory.path().to_string_lossy().to_string() });
        assert!(result.missing_keys.contains(&"MISSING".into()));
        assert!(result.obsolete_keys.contains(&"EMPTY".into()));
        let serialized = serde_json::to_string(&result).unwrap();
        assert!(!serialized.contains("super-secret"));
    }
}
