from pathlib import Path

rust_path = Path("src-tauri/src/startup_services/mod.rs")
text = rust_path.read_text(encoding="utf-8")
text = text.replace("collections::{HashMap, HashSet},", "collections::HashSet,")
text = text.replace("value.replace(''', \"''\")", "value.replace('\\'', \"''\")")
text = text.replace(
    '''    let temporary = path.with_extension("tmp");
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| format!("json_encode_failed:{error}"))?;
    fs::write(&temporary, bytes).map_err(|error| format!("write_failed:{}:{error}", temporary.display()))?;
    fs::rename(&temporary, path).map_err(|error| format!("replace_failed:{}:{error}", path.display()))''',
    '''    let bytes = serde_json::to_vec_pretty(value).map_err(|error| format!("json_encode_failed:{error}"))?;
    fs::write(path, bytes).map_err(|error| format!("write_failed:{}:{error}", path.display()))''',
)
text = text.replace(
    ".eq_ignore_ascii_case(&startup.to_string_lossy())",
    ".eq_ignore_ascii_case(startup.to_string_lossy().as_ref())",
)
text = text.replace(
    'format!("\\KNOUX ONE\\Delayed\\{}", item.id)',
    'format!("KNOUX_ONE_Delayed_{}", item.id)',
)
rust_path.write_text(text, encoding="utf-8")

ui_path = Path("src/features/startup/StartupServicesWorkspace.tsx")
ui = ui_path.read_text(encoding="utf-8")
ui = ui.replace(
    "if (!runtime.available || busy) return;",
    "if (!runtime.available) return;",
)
ui_path.write_text(ui, encoding="utf-8")
