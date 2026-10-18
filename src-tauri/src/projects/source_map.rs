use std::{collections::BTreeMap, fs};
use walkdir::WalkDir;

use super::{
    contracts::{SourceAnalyzeRequest, SourceAnalyzeResult, SourceFileMetric, SourceMetric},
    safety::{redacted_path, validate_project_root},
};

fn language_for_extension(extension: &str) -> Option<&'static str> {
    match extension {
        "ts" | "tsx" => Some("TypeScript"),
        "js" | "jsx" | "mjs" | "cjs" => Some("JavaScript"),
        "rs" => Some("Rust"),
        "py" => Some("Python"),
        "go" => Some("Go"),
        "java" | "kt" | "kts" => Some("JVM"),
        "cs" => Some("C#"),
        "c" | "h" | "cpp" | "cc" | "hpp" => Some("C/C++"),
        "php" => Some("PHP"),
        "rb" => Some("Ruby"),
        "dart" => Some("Dart"),
        "swift" => Some("Swift"),
        "vue" => Some("Vue"),
        "svelte" => Some("Svelte"),
        "html" | "css" | "scss" | "sass" => Some("Web Markup"),
        _ => None,
    }
}

fn is_generated_component(name: &str) -> bool {
    matches!(name, ".git" | "node_modules" | "target" | "dist" | "build" | "out" | ".next" | ".nuxt" | "vendor" | "bin" | "obj" | ".venv" | "venv")
}

pub fn analyze_source(request: SourceAnalyzeRequest) -> SourceAnalyzeResult {
    let root = match validate_project_root(&request.project_path) {
        Ok(path) => path,
        Err(error) => {
            return SourceAnalyzeResult {
                file_count: 0, source_file_count: 0, test_file_count: 0, config_file_count: 0,
                todo_count: 0, merge_conflict_count: 0, languages: Vec::new(),
                largest_files: Vec::new(), warnings: vec![error.to_string()],
            }
        }
    };

    let mut file_count = 0u64;
    let mut source_file_count = 0u64;
    let mut test_file_count = 0u64;
    let mut config_file_count = 0u64;
    let mut todo_count = 0u64;
    let mut merge_conflict_count = 0u64;
    let mut language_map: BTreeMap<String, (u64, u64)> = BTreeMap::new();
    let mut largest_files = Vec::new();
    let mut warnings = Vec::new();

    let walker = WalkDir::new(&root)
        .max_depth(20)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            !entry.file_type().is_dir()
                || !is_generated_component(&entry.file_name().to_string_lossy())
        });

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => { warnings.push(format!("walk_error: {error}")); continue; }
        };
        if !entry.file_type().is_file() { continue; }
        file_count += 1;
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(error) => { warnings.push(format!("metadata_failed: {}: {error}", redacted_path(entry.path()))); continue; }
        };
        largest_files.push(SourceFileMetric { path: redacted_path(entry.path()), size_bytes: metadata.len() });
        let extension = entry.path().extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase();
        let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
        if let Some(language) = language_for_extension(&extension) {
            source_file_count += 1;
            let value = language_map.entry(language.into()).or_default();
            value.0 += 1;
            value.1 = value.1.saturating_add(metadata.len());
            if name.contains("test") || name.contains("spec") || entry.path().components().any(|part| matches!(part.as_os_str().to_string_lossy().as_ref(), "test" | "tests" | "__tests__")) {
                test_file_count += 1;
            }
        }
        if matches!(extension.as_str(), "json" | "yaml" | "yml" | "toml" | "ini" | "xml") || name.starts_with('.') {
            config_file_count += 1;
        }
        if metadata.len() <= 2 * 1024 * 1024 {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                for line in content.lines() {
                    let uppercase = line.to_ascii_uppercase();
                    if uppercase.contains("TODO") || uppercase.contains("FIXME") || uppercase.contains("HACK") { todo_count += 1; }
                    if line.contains("<<<<<<<") || line.contains("=======") || line.contains(">>>>>>>") { merge_conflict_count += 1; }
                }
            }
        }
    }

    largest_files.sort_by(|left, right| right.size_bytes.cmp(&left.size_bytes));
    largest_files.truncate(20);
    let languages = language_map.into_iter().map(|(language, (files, bytes))| SourceMetric { language, files, bytes }).collect();
    SourceAnalyzeResult {
        file_count, source_file_count, test_file_count, config_file_count, todo_count,
        merge_conflict_count, languages, largest_files, warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::analyze_source;
    use crate::projects::contracts::SourceAnalyzeRequest;
    use std::fs;

    #[test]
    fn reports_language_and_quality_signals() {
        let directory = tempfile::tempdir().unwrap();
        fs::create_dir_all(directory.path().join("src")).unwrap();
        fs::write(directory.path().join("src/app.ts"), "// TODO: improve\nexport const x = 1;").unwrap();
        let result = analyze_source(SourceAnalyzeRequest { project_path: directory.path().to_string_lossy().to_string() });
        assert_eq!(result.source_file_count, 1);
        assert_eq!(result.todo_count, 1);
        assert_eq!(result.languages[0].language, "TypeScript");
    }
}
