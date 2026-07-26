use crate::startup_services::contracts::{
    StartupAssessmentItem, StartupAssessmentResult, StartupInventory, StartupRecommendation,
    StartupRecommendationResult,
};
use chrono::Utc;

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

pub fn assess(inventory: &StartupInventory) -> StartupAssessmentResult {
    let items = inventory
        .items
        .iter()
        .map(|item| {
            let combined = format!(
                "{} {} {}",
                item.name,
                item.command,
                item.target_path.as_deref().unwrap_or_default()
            )
            .to_ascii_lowercase();
            let mut score = 0_u8;
            let mut reasons_en = Vec::new();
            let mut reasons_ar = Vec::new();

            if item.protected {
                reasons_en.push("Protected Windows-related startup component.".into());
                reasons_ar.push("مكوّن مرتبط بويندوز ومحمي من التعطيل.".into());
            } else {
                if item.target_exists == Some(false) {
                    score = score.saturating_add(60);
                    reasons_en.push("The resolved target file is missing.".into());
                    reasons_ar.push("ملف التشغيل الذي يشير إليه العنصر غير موجود.".into());
                }
                if contains_any(
                    &combined,
                    &["\\appdata\\", "\\temp\\", "\\downloads\\"],
                ) {
                    score = score.saturating_add(15);
                    reasons_en.push("The command runs from a user-writable location and merits review.".into());
                    reasons_ar.push("يعمل الأمر من موقع يمكن للمستخدم الكتابة داخله ويستحق المراجعة.".into());
                }
                if contains_any(
                    &combined,
                    &[" updater", "update.exe", "helper", "tray", "background"],
                ) {
                    score = score.saturating_add(10);
                    reasons_en.push("The name or command suggests a helper, updater, tray, or background process.".into());
                    reasons_ar.push("يشير الاسم أو الأمر إلى مساعد أو تحديث أو برنامج يعمل في الخلفية.".into());
                }
                if item.source_scope == "machine" {
                    score = score.saturating_add(5);
                    reasons_en.push("The entry applies to all users on this computer.".into());
                    reasons_ar.push("يتم تطبيق هذا العنصر على جميع مستخدمي الجهاز.".into());
                }
                if reasons_en.is_empty() {
                    reasons_en.push("No high-attention condition was detected from the available metadata.".into());
                    reasons_ar.push("لم يتم اكتشاف حالة مرتفعة الاهتمام من البيانات المتاحة.".into());
                }
            }

            let attention_level = if item.protected {
                "protected"
            } else if score >= 50 {
                "high"
            } else if score >= 20 {
                "medium"
            } else {
                "low"
            };
            let recommendation = if item.protected {
                "keep"
            } else if item.target_exists == Some(false) {
                "review_for_disable"
            } else {
                "manual_review"
            };

            StartupAssessmentItem {
                item_id: item.id.clone(),
                item_name: item.name.clone(),
                attention_level: attention_level.into(),
                attention_score: score.min(100),
                reasons_en,
                reasons_ar,
                measured_boot_delay_ms: None,
                recommendation: recommendation.into(),
            }
        })
        .collect();

    StartupAssessmentResult {
        scan_id: inventory.scan_id.clone(),
        items,
        methodology_en: "The attention score is a deterministic metadata review, not a measured boot-delay score. It considers missing targets, user-writable locations, helper/updater wording, machine scope, and protected Windows components.".into(),
        methodology_ar: "درجة الاهتمام مراجعة حتمية للبيانات وليست قياسًا لزمن تأخير الإقلاع. تعتمد على الهدف المفقود ومواقع المستخدم وأسماء برامج الخلفية ونطاق الجهاز ومكونات ويندوز المحمية.".into(),
        measured_at: Utc::now().to_rfc3339(),
        warnings: vec!["startup_boot_delay_not_measured_per_item".into()],
    }
}

pub fn recommendations(inventory: &StartupInventory) -> StartupRecommendationResult {
    let assessment = assess(inventory);
    let recommendations = inventory
        .items
        .iter()
        .map(|item| {
            let assessed = assessment.items.iter().find(|value| value.item_id == item.id);
            let (classification, action_available, reason_en, reason_ar) = if item.protected {
                (
                    "protected_keep",
                    false,
                    item.protection_reason_en
                        .clone()
                        .unwrap_or_else(|| "Protected Windows-related startup component.".into()),
                    item.protection_reason_ar
                        .clone()
                        .unwrap_or_else(|| "مكوّن بدء تشغيل محمي مرتبط بويندوز.".into()),
                )
            } else if item.target_exists == Some(false) {
                (
                    "missing_target_review",
                    true,
                    "The resolved target is missing. Review the entry before disabling it.".into(),
                    "الهدف المرتبط غير موجود. راجع العنصر قبل تعطيله.".into(),
                )
            } else if assessed
                .map(|value| value.attention_score >= 20)
                .unwrap_or(false)
            {
                (
                    "manual_review",
                    true,
                    "The available metadata merits manual review; KNOUX ONE does not claim the item is unnecessary.".into(),
                    "تستحق البيانات المتاحة مراجعة يدوية؛ لا يدّعي KNOUX ONE أن العنصر غير ضروري.".into(),
                )
            } else {
                (
                    "no_action_suggested",
                    true,
                    "No automatic recommendation is made from the available metadata.".into(),
                    "لا توجد توصية تلقائية اعتمادًا على البيانات المتاحة.".into(),
                )
            };
            StartupRecommendation {
                item_id: item.id.clone(),
                item_name: item.name.clone(),
                classification: classification.into(),
                action_available,
                reason_en,
                reason_ar,
            }
        })
        .collect();

    StartupRecommendationResult {
        scan_id: inventory.scan_id.clone(),
        recommendations,
        automatic_disable_performed: false,
        measured_at: Utc::now().to_rfc3339(),
        warnings: vec!["recommendations_are_review_only".into()],
    }
}
