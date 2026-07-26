from pathlib import Path

path = Path("src-tauri/src/startup_services/mod.rs")
text = path.read_text(encoding="utf-8")
old = '''    let publisher = raw.publisher.unwrap_or_default();
    let signature_status = raw
        .signature_status
        .unwrap_or_else(|| "NotChecked".into());
    let (impact_score, impact_label, impact_basis) = impact(&raw);'''
new = '''    let (impact_score, impact_label, impact_basis) = impact(&raw);
    let publisher = raw.publisher.unwrap_or_default();
    let signature_status = raw
        .signature_status
        .unwrap_or_else(|| "NotChecked".into());'''
if old not in text:
    raise SystemExit("expected ownership block not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
