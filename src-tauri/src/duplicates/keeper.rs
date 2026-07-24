use crate::duplicates::{contracts::{KeeperGroupPlan, KeeperPlanRequest, KeeperPlanResult}, traversal::normalize_path};
use std::path::Path;

pub fn build_plan(request: KeeperPlanRequest) -> KeeperPlanResult {
    let mut plans = Vec::new();
    let mut blocked_group_ids = Vec::new();
    let configured_protected = request.rules.protected_paths.iter().map(|path| normalize_path(Path::new(path))).collect::<Vec<_>>();

    for group in request.groups {
        let mut eligible = group.files.iter().filter(|file| {
            if file.protected_path { return false; }
            let normalized = normalize_path(Path::new(&file.canonical_path));
            !configured_protected.iter().any(|protected| normalized.starts_with(protected))
        }).collect::<Vec<_>>();

        if eligible.is_empty() {
            blocked_group_ids.push(group.group_id.clone());
            plans.push(KeeperGroupPlan { group_id: group.group_id, keeper_file_id: String::new(), selected_file_ids: Vec::new(), reason: "No eligible keeper exists outside protected paths.".into(), blocked: true, warnings: vec!["keeper_missing".into()] });
            continue;
        }

        eligible.sort_by(|left, right| {
            if let Some(preferred) = &request.rules.preferred_directory {
                let normalized = normalize_path(Path::new(preferred));
                let left_preferred = normalize_path(Path::new(&left.canonical_path)).starts_with(&normalized);
                let right_preferred = normalize_path(Path::new(&right.canonical_path)).starts_with(&normalized);
                if left_preferred != right_preferred { return right_preferred.cmp(&left_preferred); }
            }
            match request.rules.prefer_date.as_deref() {
                Some("newest") => right.modified_time.cmp(&left.modified_time),
                Some("oldest") => left.created_time.cmp(&right.created_time),
                _ => match request.rules.prefer_path.as_deref() {
                    Some("longest") => right.canonical_path.len().cmp(&left.canonical_path.len()),
                    _ => left.canonical_path.len().cmp(&right.canonical_path.len()),
                },
            }
        });

        let keeper = eligible[0];
        let selected = if request.rules.auto_select_non_keepers && group.actionable {
            group.files.iter().filter(|file| file.id != keeper.id && !file.protected_path && !file.is_hard_link_alias && !configured_protected.iter().any(|protected| normalize_path(Path::new(&file.canonical_path)).starts_with(protected))).map(|file| file.id.clone()).collect()
        } else { Vec::new() };

        plans.push(KeeperGroupPlan { group_id: group.group_id, keeper_file_id: keeper.id.clone(), selected_file_ids: selected, reason: format!("Keeper selected using date={:?}, path={:?}, preferredDirectory={:?}.", request.rules.prefer_date, request.rules.prefer_path, request.rules.preferred_directory), blocked: false, warnings: Vec::new() });
    }
    KeeperPlanResult { plans, blocked_group_ids }
}
