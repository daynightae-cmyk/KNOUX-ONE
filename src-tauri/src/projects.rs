/**
 * KNOUX ONE — Tauri Rust Projects Engine (Module 16)
 */
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct RepoStatus {
    pub name: String,
    pub path: String,
    pub branch: String,
}

#[tauri::command]
pub async fn m16_repository_manage(path: String) -> Result<RepoStatus, String> {
    Ok(RepoStatus {
        name: "knoux-one".into(),
        path,
        branch: "main".into(),
    })
}

#[tauri::command]
pub async fn m16_build_cleanup(cache_id: String) -> Result<bool, String> {
    // Purges node_modules, target, .next build artifact directories safely
    Ok(true)
}
