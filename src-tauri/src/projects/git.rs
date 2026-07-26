use std::{path::Path, process::Command};

use super::{
    contracts::{GitWorkspaceRequest, GitWorkspaceResult},
    safety::{redacted_path, validate_project_root},
};

fn git_output(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git").args(args).current_dir(root).output()
        .map_err(|error| format!("git_launch_failed: {error}"))?;
    if !output.status.success() {
        return Err(format!("git_command_failed: {}", String::from_utf8_lossy(&output.stderr).trim()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn redact_remote(remote: &str) -> String {
    if let Some((scheme, rest)) = remote.split_once("://") {
        if let Some((_, host_path)) = rest.rsplit_once('@') {
            return format!("{scheme}://{host_path}");
        }
    }
    remote.to_string()
}

pub fn workspace_status(request: GitWorkspaceRequest) -> GitWorkspaceResult {
    let root = match validate_project_root(&request.project_path) {
        Ok(path) => path,
        Err(error) => return GitWorkspaceResult { repository_root: None, branch: String::new(), detached: false, is_clean: false, staged: Vec::new(), modified: Vec::new(), untracked: Vec::new(), conflicted: Vec::new(), ahead: 0, behind: 0, remote: None, warnings: vec![error.to_string()] },
    };
    let repository_root = match git_output(&root, &["rev-parse", "--show-toplevel"]) {
        Ok(value) => value,
        Err(error) => return GitWorkspaceResult { repository_root: None, branch: String::new(), detached: false, is_clean: false, staged: Vec::new(), modified: Vec::new(), untracked: Vec::new(), conflicted: Vec::new(), ahead: 0, behind: 0, remote: None, warnings: vec![error] },
    };
    let branch = git_output(&root, &["branch", "--show-current"]).unwrap_or_default();
    let detached = branch.is_empty();
    let status = git_output(&root, &["status", "--porcelain=v1", "-z"]).unwrap_or_default();
    let mut staged = Vec::new();
    let mut modified = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicted = Vec::new();
    for row in status.split('\0').filter(|row| !row.is_empty()) {
        if row.len() < 3 { continue; }
        let bytes = row.as_bytes();
        let x = bytes[0] as char;
        let y = bytes[1] as char;
        let path = row[3..].to_string();
        if x == '?' && y == '?' { untracked.push(path); continue; }
        if matches!((x, y), ('U', _) | (_, 'U') | ('A', 'A') | ('D', 'D')) { conflicted.push(path.clone()); }
        if x != ' ' && x != '?' { staged.push(path.clone()); }
        if y != ' ' && y != '?' { modified.push(path); }
    }
    let (ahead, behind) = match git_output(&root, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]) {
        Ok(value) => {
            let parts = value.split_whitespace().collect::<Vec<_>>();
            if parts.len() == 2 { (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0)) } else { (0, 0) }
        }
        Err(_) => (0, 0),
    };
    let remote = git_output(&root, &["remote", "get-url", "origin"]).ok().map(|value| redact_remote(&value));
    GitWorkspaceResult {
        repository_root: Some(redacted_path(Path::new(&repository_root))),
        branch,
        detached,
        is_clean: staged.is_empty() && modified.is_empty() && untracked.is_empty() && conflicted.is_empty(),
        staged, modified, untracked, conflicted, ahead, behind, remote, warnings: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::redact_remote;
    #[test]
    fn removes_credentials_from_https_remote() {
        assert_eq!(redact_remote("https://token@example.com/org/repo.git"), "https://example.com/org/repo.git");
    }
}
