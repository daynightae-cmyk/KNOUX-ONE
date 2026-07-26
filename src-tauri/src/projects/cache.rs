use std::{collections::BTreeMap, fs, path::{Path, PathBuf}};
use uuid::Uuid;
use walkdir::WalkDir;

use super::{
    contracts::{CacheManageRequest, CacheManageResult, CacheTarget},
    safety::{redacted_path, validate_inside_root, validate_project_root},
};

const SAFE_NAMES: &[(&str, &str)] = &[
    ("node_modules", "dependencies"), ("target", "rust_build"), ("dist", "build_output"),
    ("build", "build_output"), ("out", "build_output"), (".next", "framework_cache"),
    (".nuxt", "framework_cache"), (".turbo", "build_cache"), (".cache", "cache"),
    (".vite", "build_cache"), (".parcel-cache", "build_cache"), (".gradle", "build_cache"),
    ("bin", "dotnet_build"), ("obj", "dotnet_build"), (".pytest_cache", "python_cache"),
    ("__pycache__", "python_cache"), (".mypy_cache", "python_cache"), (".ruff_cache", "python_cache"),
    (".tox", "python_cache"), ("coverage", "test_output"), (".coverage", "test_output"),
];

fn safe_category(name: &str) -> Option<&'static str> {
    SAFE_NAMES.iter().find(|(candidate, _)| candidate.eq_ignore_ascii_case(name)).map(|(_, category)| *category)
}

fn directory_size(path: &Path) -> u64 {
    WalkDir::new(path).follow_links(false).into_iter().filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| entry.metadata().ok().map(|metadata| metadata.len()))
        .fold(0u64, u64::saturating_add)
}

fn inspect(root: &Path) -> (Vec<CacheTarget>, Vec<String>) {
    let mut targets_by_path: BTreeMap<PathBuf, CacheTarget> = BTreeMap::new();
    let mut warnings = Vec::new();
    for entry in WalkDir::new(root).max_depth(5).follow_links(false).into_iter() {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => { warnings.push(format!("cache_walk_error: {error}")); continue; }
        };
        if !entry.file_type().is_dir() { continue; }
        let name = entry.file_name().to_string_lossy();
        let Some(category) = safe_category(&name) else { continue };
        let canonical = match validate_inside_root(root, entry.path()) {
            Ok(path) => path,
            Err(error) => { warnings.push(error.to_string()); continue; }
        };
        let relative = canonical.strip_prefix(root).unwrap_or(&canonical).to_string_lossy().to_string();
        targets_by_path.entry(canonical.clone()).or_insert_with(|| CacheTarget {
            id: Uuid::new_v4().to_string(),
            path: canonical.to_string_lossy().to_string(),
            relative_path: relative,
            category: category.into(),
            size_bytes: directory_size(&canonical),
            safe_to_clean: true,
        });
    }
    (targets_by_path.into_values().collect(), warnings)
}

pub fn manage_cache(request: CacheManageRequest) -> CacheManageResult {
    match request {
        CacheManageRequest::Inspect { project_path } => {
            let root = match validate_project_root(&project_path) {
                Ok(path) => path,
                Err(error) => return CacheManageResult { targets: Vec::new(), reclaimed_bytes: 0, cleaned_paths: Vec::new(), warnings: vec![error.to_string()] },
            };
            let (targets, warnings) = inspect(&root);
            CacheManageResult { targets, reclaimed_bytes: 0, cleaned_paths: Vec::new(), warnings }
        }
        CacheManageRequest::Clean { project_path, paths, confirmation } => {
            let root = match validate_project_root(&project_path) {
                Ok(path) => path,
                Err(error) => return CacheManageResult { targets: Vec::new(), reclaimed_bytes: 0, cleaned_paths: Vec::new(), warnings: vec![error.to_string()] },
            };
            if confirmation != "CLEAN" {
                return CacheManageResult { targets: inspect(&root).0, reclaimed_bytes: 0, cleaned_paths: Vec::new(), warnings: vec!["confirmation_required: type CLEAN".into()] };
            }
            let (known_targets, mut warnings) = inspect(&root);
            let known = known_targets.iter().map(|target| (target.path.clone(), target.size_bytes)).collect::<BTreeMap<_, _>>();
            let mut reclaimed_bytes = 0u64;
            let mut cleaned_paths = Vec::new();
            for raw in paths {
                let path = PathBuf::from(&raw);
                let canonical = match validate_inside_root(&root, &path) {
                    Ok(path) => path,
                    Err(error) => { warnings.push(error.to_string()); continue; }
                };
                let name = canonical.file_name().and_then(|value| value.to_str()).unwrap_or_default();
                if safe_category(name).is_none() || !known.contains_key(&canonical.to_string_lossy().to_string()) {
                    warnings.push(format!("cache_target_not_allowlisted: {}", redacted_path(&canonical)));
                    continue;
                }
                let size = known.get(&canonical.to_string_lossy().to_string()).copied().unwrap_or_else(|| directory_size(&canonical));
                match fs::remove_dir_all(&canonical) {
                    Ok(()) if !canonical.exists() => {
                        reclaimed_bytes = reclaimed_bytes.saturating_add(size);
                        cleaned_paths.push(redacted_path(&canonical));
                    }
                    Ok(()) => warnings.push(format!("cache_delete_verification_failed: {}", redacted_path(&canonical))),
                    Err(error) => warnings.push(format!("cache_delete_failed: {}: {error}", redacted_path(&canonical))),
                }
            }
            let (targets, inspect_warnings) = inspect(&root);
            warnings.extend(inspect_warnings);
            CacheManageResult { targets, reclaimed_bytes, cleaned_paths, warnings }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::manage_cache;
    use crate::projects::contracts::CacheManageRequest;
    use std::fs;

    #[test]
    fn cleans_only_allowlisted_directory_after_exact_confirmation() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("dist");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("bundle.js"), vec![1u8; 32]).unwrap();
        let inspect = manage_cache(CacheManageRequest::Inspect { project_path: directory.path().to_string_lossy().to_string() });
        assert_eq!(inspect.targets.len(), 1);
        let blocked = manage_cache(CacheManageRequest::Clean { project_path: directory.path().to_string_lossy().to_string(), paths: vec![target.to_string_lossy().to_string()], confirmation: "wrong".into() });
        assert!(target.exists());
        assert_eq!(blocked.reclaimed_bytes, 0);
        let cleaned = manage_cache(CacheManageRequest::Clean { project_path: directory.path().to_string_lossy().to_string(), paths: vec![target.to_string_lossy().to_string()], confirmation: "CLEAN".into() });
        assert!(!target.exists());
        assert_eq!(cleaned.reclaimed_bytes, 32);
    }
}
