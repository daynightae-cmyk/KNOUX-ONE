from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src-tauri/src/network_optimizer/mod.rs"
text = path.read_text(encoding="utf-8")

text = text.replace("        Some(message),\n", "        Some(message.clone()),\n", 1)

old = '''    let log_path = match app_root(&app) {
        Ok(root) => root
            .join("reset-logs")
            .join(format!("ip-reset-{}.log", Uuid::new_v4())),
        Err(error) => {
'''
new = '''    let log_path = match app_root(&app).and_then(|root| {
        let directory = root.join("reset-logs");
        fs::create_dir_all(&directory)
            .map_err(|error| format!("reset_log_directory_failed:{error}"))?;
        Ok(directory.join(format!("ip-reset-{}.log", Uuid::new_v4())))
    }) {
        Ok(path) => path,
        Err(error) => {
'''

if old in text:
    text = text.replace(old, new, 1)
elif "reset_log_directory_failed" not in text:
    raise SystemExit("stack reset log block not found")

if "Some(message.clone())" not in text:
    raise SystemExit("message ownership fix not applied")

path.write_text(text, encoding="utf-8")
