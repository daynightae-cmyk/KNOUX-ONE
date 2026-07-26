use std::{fs, path::Path, process::Command, time::Instant};

use super::{
    contracts::{CommandManageRequest, CommandManageResult, CommandRun, ProjectTask},
    safety::{contains_shell_metacharacters, validate_project_root},
};

fn risk_for_preview(preview: &str) -> (&'static str, bool) {
    let lowered = preview.to_ascii_lowercase();
    let risky = [" rm ", "rmdir", "del /", "format ", "diskpart", "reg delete", "curl |", "wget |", "invoke-expression", "encodedcommand"]
        .iter()
        .any(|needle| format!(" {lowered} ").contains(needle));
    if risky { ("high", true) } else if lowered.contains("deploy") || lowered.contains("publish") || lowered.contains("release") || lowered.contains("clean") { ("moderate", true) } else { ("safe", false) }
}

fn push_task(
    tasks: &mut Vec<ProjectTask>,
    id: &str,
    label: &str,
    program: &str,
    args: Vec<String>,
    preview: String,
    risk_source: &str,
) {
    let (risk, requires_confirmation) = risk_for_preview(&format!("{preview} {risk_source}"));
    tasks.push(ProjectTask {
        id: id.into(),
        label: label.into(),
        program: program.into(),
        args,
        preview,
        risk: risk.into(),
        requires_confirmation,
    });
}

fn node_manager(root: &Path) -> &'static str {
    if root.join("pnpm-lock.yaml").exists() { "pnpm" }
    else if root.join("yarn.lock").exists() { "yarn" }
    else if root.join("bun.lock").exists() || root.join("bun.lockb").exists() { "bun" }
    else { "npm" }
}

pub fn discover_tasks(root: &Path) -> (Vec<ProjectTask>, Vec<String>) {
    let mut tasks = Vec::new();
    let mut warnings = Vec::new();
    let package_json = root.join("package.json");
    if let Ok(content) = fs::read_to_string(&package_json) {
        match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(value) => {
                if let Some(scripts) = value.get("scripts").and_then(|value| value.as_object()) {
                    let manager = node_manager(root);
                    for (name, body) in scripts {
                        let body = body.as_str().unwrap_or_default();
                        if contains_shell_metacharacters(body) {
                            warnings.push(format!("script_requires_manual_review: {name}"));
                        }
                        let args = if manager == "yarn" || manager == "bun" { vec![name.clone()] } else { vec!["run".into(), name.clone()] };
                        let preview = format!("{manager} {}", if manager == "yarn" || manager == "bun" { name.clone() } else { format!("run {name}") });
                        push_task(&mut tasks, &format!("node:{name}"), name, manager, args, preview, body);
                    }
                }
            }
            Err(error) => warnings.push(format!("package_json_parse_failed: {error}")),
        }
    }
    if root.join("Cargo.toml").exists() {
        for (id, label, args) in [
            ("cargo:check", "Cargo check", vec!["check"]),
            ("cargo:test", "Cargo tests", vec!["test"]),
            ("cargo:clippy", "Cargo clippy", vec!["clippy", "--all-targets", "--all-features"]),
            ("cargo:build", "Cargo build", vec!["build"]),
        ] {
            let preview = format!("cargo {}", args.join(" "));
            push_task(&mut tasks, id, label, "cargo", args.iter().map(|value| value.to_string()).collect(), preview.clone(), &preview);
        }
    }
    if root.join("pyproject.toml").exists() || root.join("requirements.txt").exists() {
        push_task(&mut tasks, "python:pytest", "Python tests", "python", vec!["-m".into(), "pytest".into()], "python -m pytest".into(), "python -m pytest");
    }
    if root.join("go.mod").exists() {
        push_task(&mut tasks, "go:test", "Go tests", "go", vec!["test".into(), "./...".into()], "go test ./...".into(), "go test ./...");
        push_task(&mut tasks, "go:build", "Go build", "go", vec!["build".into(), "./...".into()], "go build ./...".into(), "go build ./...");
    }
    if fs::read_dir(root).ok().into_iter().flatten().filter_map(Result::ok).any(|entry| entry.path().extension().and_then(|value| value.to_str()).is_some_and(|extension| extension.eq_ignore_ascii_case("sln"))) {
        push_task(&mut tasks, "dotnet:build", ".NET build", "dotnet", vec!["build".into()], "dotnet build".into(), "dotnet build");
        push_task(&mut tasks, "dotnet:test", ".NET tests", "dotnet", vec!["test".into()], "dotnet test".into(), "dotnet test");
    }
    tasks.sort_by(|left, right| left.label.cmp(&right.label));
    (tasks, warnings)
}

pub fn manage_commands(request: CommandManageRequest) -> CommandManageResult {
    let project_path = match &request {
        CommandManageRequest::List { project_path } | CommandManageRequest::Execute { project_path, .. } => project_path,
    };
    let root = match validate_project_root(project_path) {
        Ok(path) => path,
        Err(error) => return CommandManageResult { tasks: Vec::new(), run: None, warnings: vec![error.to_string()] },
    };
    let (tasks, mut warnings) = discover_tasks(&root);
    match request {
        CommandManageRequest::List { .. } => CommandManageResult { tasks, run: None, warnings },
        CommandManageRequest::Execute { task_id, confirmation, .. } => {
            let Some(task) = tasks.iter().find(|task| task.id == task_id).cloned() else {
                warnings.push(format!("unsupported_project_task: {task_id}"));
                return CommandManageResult { tasks, run: None, warnings };
            };
            if task.requires_confirmation && confirmation.as_deref() != Some(&format!("RUN {}", task.id)) {
                warnings.push(format!("confirmation_required: type RUN {}", task.id));
                return CommandManageResult { tasks, run: None, warnings };
            }
            if contains_shell_metacharacters(&task.program) || task.args.iter().any(|arg| contains_shell_metacharacters(arg)) {
                warnings.push("blocked_shell_metacharacters".into());
                return CommandManageResult { tasks, run: None, warnings };
            }
            let started = Instant::now();
            let output = Command::new(&task.program).args(&task.args).current_dir(&root).output();
            let run = match output {
                Ok(output) => {
                    let exit_code = output.status.code().unwrap_or(-1);
                    if !output.status.success() {
                        warnings.push(format!("project_command_failed: task={} exit_code={exit_code}", task.id));
                    }
                    Some(CommandRun {
                        task_id: task.id.clone(),
                        command_preview: task.preview.clone(),
                        success: output.status.success(),
                        exit_code,
                        stdout: String::from_utf8_lossy(&output.stdout).chars().take(200_000).collect(),
                        stderr: String::from_utf8_lossy(&output.stderr).chars().take(100_000).collect(),
                        duration_ms: started.elapsed().as_millis() as u64,
                    })
                },
                Err(error) => {
                    warnings.push(format!("project_command_launch_failed: {error}"));
                    None
                }
            };
            CommandManageResult { tasks, run, warnings }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{discover_tasks, manage_commands};
    use crate::projects::contracts::CommandManageRequest;
    use std::fs;

    #[test]
    fn lists_manifest_tasks_and_rejects_unknown_task_ids() {
        let directory = tempfile::tempdir().unwrap();
        fs::write(directory.path().join("package.json"), r#"{"scripts":{"build":"vite build"}}"#).unwrap();
        let (tasks, _) = discover_tasks(directory.path());
        assert_eq!(tasks[0].id, "node:build");
        let result = manage_commands(CommandManageRequest::Execute { project_path: directory.path().to_string_lossy().to_string(), task_id: "custom:unknown".into(), confirmation: None });
        assert!(result.run.is_none());
        assert!(result.warnings.iter().any(|warning| warning.contains("unsupported_project_task")));
    }

    #[test]
    fn destructive_manifest_script_requires_typed_confirmation() {
        let directory = tempfile::tempdir().unwrap();
        fs::write(
            directory.path().join("package.json"),
            r#"{"scripts":{"clean":"rm -rf dist"}}"#,
        )
        .unwrap();
        let (tasks, _) = discover_tasks(directory.path());
        let task = tasks.iter().find(|task| task.id == "node:clean").unwrap();
        assert!(task.requires_confirmation);
        assert_eq!(task.risk, "high");
    }

}
