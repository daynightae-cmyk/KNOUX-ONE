from pathlib import Path

path = Path("src-tauri/src/performance_center/mod.rs")
text = path.read_text(encoding="utf-8")
replacements = {
    '            "Power-plan operation completed and journaled.",\n            "اكتملت عملية خطة الطاقة وتم تسجيلها للاستعادة.",':
    '            "Power-plan operation completed and journaled.".into(),\n            "اكتملت عملية خطة الطاقة وتم تسجيلها للاستعادة.".into(),',
    '            "Performance profile operation completed.",\n            "اكتملت عملية بروفايل الأداء.",':
    '            "Performance profile operation completed.".into(),\n            "اكتملت عملية بروفايل الأداء.".into(),',
    '            "Completed a bounded CPU hash and temporary-disk throughput sample.",\n            "اكتملت عينة محدودة لبصمات المعالج وسرعة ملف مؤقت على القرص.",':
    '            "Completed a bounded CPU hash and temporary-disk throughput sample.".into(),\n            "اكتملت عينة محدودة لبصمات المعالج وسرعة ملف مؤقت على القرص.".into(),',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"expected block not found: {old[:48]}")
    text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
