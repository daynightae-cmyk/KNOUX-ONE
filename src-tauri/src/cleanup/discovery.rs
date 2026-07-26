use crate::cleanup::{browser, windows};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy)]
pub enum TargetFilter {
    AnyFile,
    ThumbnailDatabase,
    CrashDump,
    OldLog,
    OldInstaller,
}

#[derive(Debug, Clone)]
pub struct CleanupTarget {
    pub id: String,
    pub name_en: String,
    pub name_ar: String,
    pub roots: Vec<PathBuf>,
    pub requires_admin: bool,
    pub scan_only: bool,
    pub minimum_age_seconds: u64,
    pub filter: TargetFilter,
}

fn target(
    id: &str,
    name_en: &str,
    name_ar: &str,
    roots: Vec<PathBuf>,
    requires_admin: bool,
    scan_only: bool,
    minimum_age_seconds: u64,
    filter: TargetFilter,
) -> CleanupTarget {
    CleanupTarget {
        id: id.into(),
        name_en: name_en.into(),
        name_ar: name_ar.into(),
        roots,
        requires_admin,
        scan_only,
        minimum_age_seconds,
        filter,
    }
}

pub fn default_category_ids() -> Vec<String> {
    vec![
        "user_temp".into(),
        "browser_cache".into(),
        "thumbnail_cache".into(),
    ]
}

pub fn discover_targets(requested: &[String]) -> Vec<CleanupTarget> {
    let ids = if requested.is_empty() {
        default_category_ids()
    } else {
        requested.to_vec()
    };

    let mut targets = Vec::new();
    for id in ids {
        let value = match id.as_str() {
            "user_temp" => target(
                "user_temp",
                "User temporary files",
                "ملفات المستخدم المؤقتة",
                windows::user_temp_root().into_iter().collect(),
                false,
                false,
                600,
                TargetFilter::AnyFile,
            ),
            "windows_temp" => target(
                "windows_temp",
                "Windows temporary files",
                "ملفات ويندوز المؤقتة",
                windows::windows_temp_root().into_iter().collect(),
                true,
                false,
                600,
                TargetFilter::AnyFile,
            ),
            "browser_cache" => target(
                "browser_cache",
                "Browser cache",
                "ذاكرة المتصفحات المؤقتة",
                browser::browser_cache_roots(),
                false,
                false,
                600,
                TargetFilter::AnyFile,
            ),
            "thumbnail_cache" => target(
                "thumbnail_cache",
                "Thumbnail cache",
                "ذاكرة الصور المصغرة",
                windows::thumbnail_cache_roots(),
                false,
                false,
                600,
                TargetFilter::ThumbnailDatabase,
            ),
            "crash_dumps" => target(
                "crash_dumps",
                "Crash dumps",
                "تقارير انهيار البرامج",
                windows::crash_dump_roots(),
                true,
                false,
                600,
                TargetFilter::CrashDump,
            ),
            "application_logs" => target(
                "application_logs",
                "Old application logs",
                "سجلات التطبيقات القديمة",
                windows::user_temp_root().into_iter().collect(),
                false,
                false,
                14 * 24 * 60 * 60,
                TargetFilter::OldLog,
            ),
            "old_downloads" => target(
                "old_downloads",
                "Old installer downloads",
                "ملفات التثبيت القديمة في التنزيلات",
                windows::downloads_root().into_iter().collect(),
                false,
                true,
                30 * 24 * 60 * 60,
                TargetFilter::OldInstaller,
            ),
            _ => continue,
        };
        targets.push(value);
    }

    targets
}
