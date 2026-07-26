use std::{
    collections::{BTreeSet, HashSet},
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::UNIX_EPOCH,
};

use chrono::{DateTime, Utc};
use uuid::Uuid;
use walkdir::{DirEntry, WalkDir};

use super::{
    contracts::{ProjectDiscoverRequest, ProjectDiscoverResult, ProjectRecord},
    safety::{is_protected_windows_path, redacted_path},
};

const SKIP_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".venv",
    "venv",
    "vendor",
    "bin",
    "obj",
    ".gradle",
    ".cache",
];

fn is_hidden_generated(entry: &DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return false;
    }
    let name = entry.file_name().to_string_lossy();
    SKIP_DIRS.iter().any(|ignored| name.eq_ignore_ascii_case(ignored))
}

fn classify_manifest(file_name: &str) -> Option<(&'static str, Option<&'static str>)> {
    match file_name {
        "package.json" => Some(("node", None)),
        "Cargo.toml" => Some(("rust", None)),
        "pyproject.toml" | "requirements.txt" | "Pipfile" | "poetry.lock" => {
            Some(("python", None))
        }
        "go.mod" => Some(("go", None)),
        "pom.xml" => Some(("java", Some("maven"))),
        "build.gradle" | "build.gradle.kts" => Some(("java", Some("gradle"))),
        "composer.json" => Some(("php", Some("composer"))),
        "Gemfile" => Some(("ruby", Some("bundler"))),
        "pubspec.yaml" => Some(("dart", Some("flutter"))),
        "CMakeLists.txt" => Some(("cpp", Some("cmake"))),
        "Makefile" => Some(("native", Some("make"))),
        "Dockerfile" | "docker-compose.yml" | "compose.yaml" => {
            Some(("container", Some("docker")))
        }
        name if name.ends_with(".csproj") || name.ends_with(".sln") => {
            Some(("dotnet", Some("dotnet")))
        }
        _ => None,
    }
}

fn package_manager(project: &Path) -> Option<String> {
    for (file, manager) in [
        ("pnpm-lock.yaml", "pnpm"),
        ("yarn.lock", "yarn"),
        ("bun.lock", "bun"),
        ("bun.lockb", "bun"),
        ("package-lock.json", "npm"),
        ("Cargo.lock", "cargo"),
        ("poetry.lock", "poetry"),
        ("uv.lock", "uv"),
        ("Pipfile.lock", "pipenv"),
        ("go.sum", "go"),
        ("packages.lock.json", "nuget"),
    ] {
        if project.join(file).exists() {
            return Some(manager.into());
        }
    }
    None
}

fn frameworks(project: &Path) -> Vec<String> {
    let mut values = BTreeSet::new();
    let package_json = project.join("package.json");
    if let Ok(content) = fs::read_to_string(package_json) {
        for (needle, label) in [
            ("\"react\"", "React"),
            ("\"next\"", "Next.js"),
            ("\"vue\"", "Vue"),
            ("\"nuxt\"", "Nuxt"),
            ("\"svelte\"", "Svelte"),
            ("\"@angular/core\"", "Angular"),
            ("\"electron\"", "Electron"),
            ("\"@tauri-apps/api\"", "Tauri"),
            ("\"express\"", "Express"),
            ("\"nestjs\"", "NestJS"),
        ] {
            if content.contains(needle) {
                values.insert(label.to_string());
            }
        }
    }
    if project.join("manage.py").exists() {
        values.insert("Django".into());
    }
    if project.join("artisan").exists() {
        values.insert("Laravel".into());
    }
    values.into_iter().collect()
}

fn git_branch(project: &Path) -> Option<String> {
    if !project.join(".git").exists() {
        return None;
    }
    let output = Command::new("git")
        .args(["branch", "--show-current"])
        .current_dir(project)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!value.is_empty()).then_some(value)
}

fn is_source_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase().as_str(),
        "ts" | "tsx" | "js" | "jsx" | "mjs" | "cjs" | "rs" | "py" | "go" | "java" |
        "kt" | "kts" | "cs" | "cpp" | "cc" | "c" | "h" | "hpp" | "php" | "rb" | "dart" |
        "swift" | "vue" | "svelte"
    )
}

fn is_build_artifact(path: &Path) -> bool {
    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        matches!(name.as_ref(), "node_modules" | "target" | "dist" | "build" | "out" | ".next" | "bin" | "obj")
    })
}

fn compute_stats(project: &Path) -> (u64, u64, u64, u64, String, Vec<String>) {
    let mut file_count = 0u64;
    let mut source_count = 0u64;
    let mut total_bytes = 0u64;
    let mut artifact_bytes = 0u64;
    let mut latest = 0u64;
    let mut warnings = Vec::new();

    for entry in WalkDir::new(project).max_depth(12).follow_links(false).into_iter() {
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
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(error) => {
                warnings.push(format!("metadata_failed: {}: {error}", redacted_path(entry.path())));
                continue;
            }
        };
        file_count += 1;
        total_bytes = total_bytes.saturating_add(metadata.len());
        if is_source_file(entry.path()) {
            source_count += 1;
        }
        if is_build_artifact(entry.path()) {
            artifact_bytes = artifact_bytes.saturating_add(metadata.len());
        }
        if let Ok(modified) = metadata.modified().and_then(|value| value.duration_since(UNIX_EPOCH).map_err(std::io::Error::other)) {
            latest = latest.max(modified.as_secs());
        }
    }

    let modified = DateTime::<Utc>::from_timestamp(latest as i64, 0)
        .unwrap_or_else(Utc::now)
        .to_rfc3339();
    (file_count, source_count, total_bytes, artifact_bytes, modified, warnings)
}

pub fn discover_projects(request: ProjectDiscoverRequest) -> ProjectDiscoverResult {
    let mut projects = Vec::new();
    let mut warnings = Vec::new();
    let mut scanned_roots = Vec::new();
    let mut skipped_protected_roots = Vec::new();
    let mut project_manifests: std::collections::BTreeMap<PathBuf, Vec<(PathBuf, String)>> =
        std::collections::BTreeMap::new();

    for root in request.roots {
        let path = PathBuf::from(&root);
        if !path.exists() {
            warnings.push(format!("project_root_not_found: {root}"));
            continue;
        }
        let canonical = match dunce::canonicalize(&path) {
            Ok(path) => path,
            Err(error) => {
                warnings.push(format!("project_root_invalid: {root}: {error}"));
                continue;
            }
        };
        if is_protected_windows_path(&canonical) {
            skipped_protected_roots.push(redacted_path(&canonical));
            continue;
        }
        scanned_roots.push(redacted_path(&canonical));
        let depth = request.max_depth.clamp(1, 12);
        let walker = WalkDir::new(&canonical)
            .max_depth(depth)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| !is_hidden_generated(entry));

        for entry in walker {
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
            let file_name = entry.file_name().to_string_lossy();
            let Some((ecosystem, _)) = classify_manifest(&file_name) else {
                continue;
            };
            let Some(parent) = entry.path().parent() else { continue };
            let project_root = match dunce::canonicalize(parent) {
                Ok(path) => path,
                Err(_) => parent.to_path_buf(),
            };
            project_manifests
                .entry(project_root)
                .or_default()
                .push((entry.path().to_path_buf(), ecosystem.into()));
            if project_manifests.len() >= 300 {
                warnings.push("project_discovery_limit_reached: 300".into());
                break;
            }
        }
    }

    for (project_root, manifest_rows) in project_manifests {
        let mut ecosystems = BTreeSet::new();
        let mut manifests = Vec::new();
        for (manifest, ecosystem) in manifest_rows {
            ecosystems.insert(ecosystem);
            manifests.push(redacted_path(&manifest));
        }
        manifests.sort();
        manifests.dedup();
        let (file_count, source_file_count, size_bytes, build_artifact_bytes, last_modified, mut project_warnings) =
            compute_stats(&project_root);
        let name = project_root
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("project")
            .to_string();
        let confidence = (0.55 + (manifests.len().min(4) as f32 * 0.1) + if project_root.join(".git").exists() { 0.1 } else { 0.0 }).min(1.0);
        projects.push(ProjectRecord {
            id: Uuid::new_v4().to_string(),
            canonical_path: project_root.to_string_lossy().to_string(),
            name,
            ecosystems: ecosystems.into_iter().collect(),
            frameworks: frameworks(&project_root),
            manifests: manifests.clone(),
            package_manager: package_manager(&project_root),
            git_repository: project_root.join(".git").exists(),
            branch: git_branch(&project_root),
            file_count,
            source_file_count,
            manifest_count: manifests.len() as u64,
            size_bytes,
            build_artifact_bytes,
            last_modified,
            confidence,
            warnings: std::mem::take(&mut project_warnings),
        });
    }

    projects.sort_by(|left, right| right.last_modified.cmp(&left.last_modified));
    ProjectDiscoverResult { projects, scanned_roots, skipped_protected_roots, warnings }
}

#[cfg(test)]
mod tests {
    use super::discover_projects;
    use crate::projects::contracts::ProjectDiscoverRequest;
    use std::fs;

    #[test]
    fn discovers_real_manifest_without_following_generated_directories() {
        let directory = tempfile::tempdir().unwrap();
        let project = directory.path().join("alpha");
        fs::create_dir_all(project.join("src")).unwrap();
        fs::write(project.join("package.json"), r#"{"name":"alpha","dependencies":{"react":"19.0.0"}}"#).unwrap();
        fs::write(project.join("src/index.ts"), "export const alpha = true;").unwrap();
        let result = discover_projects(ProjectDiscoverRequest { roots: vec![directory.path().to_string_lossy().to_string()], max_depth: 5 });
        assert_eq!(result.projects.len(), 1);
        assert!(result.projects[0].ecosystems.contains(&"node".to_string()));
        assert!(result.projects[0].source_file_count >= 1);
    }
}
