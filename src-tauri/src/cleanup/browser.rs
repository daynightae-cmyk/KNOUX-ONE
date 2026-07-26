use std::{env, fs, path::PathBuf};

fn push_existing(roots: &mut Vec<PathBuf>, path: PathBuf) {
    if path.is_dir() {
        roots.push(path);
    }
}

fn chromium_profiles(user_data: PathBuf, roots: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(&user_data) else {
        return;
    };

    for entry in entries.flatten() {
        let profile = entry.path();
        if !profile.is_dir() {
            continue;
        }

        let name = profile
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if name != "Default" && !name.starts_with("Profile ") && name != "Guest Profile" {
            continue;
        }

        push_existing(roots, profile.join("Cache").join("Cache_Data"));
        push_existing(roots, profile.join("Code Cache"));
        push_existing(roots, profile.join("GPUCache"));
    }
}

pub fn browser_cache_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Some(local_app_data) = env::var_os("LOCALAPPDATA").map(PathBuf::from) {
        chromium_profiles(local_app_data.join("Google/Chrome/User Data"), &mut roots);
        chromium_profiles(local_app_data.join("Microsoft/Edge/User Data"), &mut roots);
        chromium_profiles(local_app_data.join("BraveSoftware/Brave-Browser/User Data"), &mut roots);
    }

    if let Some(app_data) = env::var_os("APPDATA").map(PathBuf::from) {
        let profiles_root = app_data.join("Mozilla/Firefox/Profiles");
        if let Ok(entries) = fs::read_dir(profiles_root) {
            for entry in entries.flatten() {
                push_existing(&mut roots, entry.path().join("cache2"));
            }
        }
    }

    roots.sort();
    roots.dedup();
    roots
}
