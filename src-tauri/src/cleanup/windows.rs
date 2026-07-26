use std::{env, path::PathBuf};

fn existing(path: PathBuf) -> Option<PathBuf> {
    path.exists().then_some(path)
}

pub fn user_temp_root() -> Option<PathBuf> {
    let path = env::temp_dir();
    path.exists().then_some(path)
}

pub fn windows_temp_root() -> Option<PathBuf> {
    env::var_os("WINDIR")
        .or_else(|| env::var_os("SystemRoot"))
        .map(PathBuf::from)
        .and_then(|root| existing(root.join("Temp")))
}

pub fn thumbnail_cache_roots() -> Vec<PathBuf> {
    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .and_then(|root| existing(root.join("Microsoft/Windows/Explorer")))
        .into_iter()
        .collect()
}

pub fn crash_dump_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Some(local) = env::var_os("LOCALAPPDATA").map(PathBuf::from) {
        if let Some(path) = existing(local.join("CrashDumps")) {
            roots.push(path);
        }
    }

    if let Some(program_data) = env::var_os("PROGRAMDATA").map(PathBuf::from) {
        for child in [
            "Microsoft/Windows/WER/ReportArchive",
            "Microsoft/Windows/WER/ReportQueue",
        ] {
            if let Some(path) = existing(program_data.join(child)) {
                roots.push(path);
            }
        }
    }

    if let Some(windows) = env::var_os("WINDIR")
        .or_else(|| env::var_os("SystemRoot"))
        .map(PathBuf::from)
    {
        if let Some(path) = existing(windows.join("Minidump")) {
            roots.push(path);
        }
    }

    roots.sort();
    roots.dedup();
    roots
}

pub fn downloads_root() -> Option<PathBuf> {
    env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .and_then(|root| existing(root.join("Downloads")))
}
