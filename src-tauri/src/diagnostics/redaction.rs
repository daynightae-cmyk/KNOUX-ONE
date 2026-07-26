use serde_json::Value;

const SECRET_LABELS: &[&str] = &["password", "passwd", "pwd", "token", "secret", "api_key", "apikey", "authorization", "cookie", "credential"];

pub fn redact_text(input: &str) -> (String, usize) {
    let mut count = 0usize;
    let username = std::env::var("USERNAME").ok().filter(|value| !value.is_empty());
    let userprofile = std::env::var("USERPROFILE").ok().filter(|value| !value.is_empty());
    let mut output = input.to_string();
    if let Some(profile) = userprofile {
        let replaced = output.matches(&profile).count();
        if replaced > 0 { output = output.replace(&profile, "%USERPROFILE%"); count += replaced; }
    }
    if let Some(name) = username {
        let needle = format!("\\Users\\{name}\\");
        let replaced = output.to_lowercase().matches(&needle.to_lowercase()).count();
        if replaced > 0 {
            output = replace_case_insensitive(&output, &needle, "\\Users\\<USER>\\");
            count += replaced;
        }
    }
    for line in output.lines().map(str::to_string).collect::<Vec<_>>() {
        let lower = line.to_lowercase();
        if SECRET_LABELS.iter().any(|label| lower.contains(label)) && (line.contains('=') || line.contains(':')) {
            let redacted = if let Some(index) = line.find('=') { format!("{}=<REDACTED>", &line[..index]) }
                else if let Some(index) = line.find(':') { format!("{}: <REDACTED>", &line[..index]) }
                else { line.clone() };
            if redacted != line { output = output.replace(&line, &redacted); count += 1; }
        }
    }
    (output, count)
}

fn replace_case_insensitive(source: &str, needle: &str, replacement: &str) -> String {
    let lower_source = source.to_lowercase();
    let lower_needle = needle.to_lowercase();
    let mut result = String::new();
    let mut cursor = 0usize;
    while let Some(relative) = lower_source[cursor..].find(&lower_needle) {
        let start = cursor + relative;
        result.push_str(&source[cursor..start]);
        result.push_str(replacement);
        cursor = start + needle.len();
    }
    result.push_str(&source[cursor..]);
    result
}

pub fn redact_json(value: &Value) -> (Value, usize) {
    fn visit(value: &Value, count: &mut usize) -> Value {
        match value {
            Value::String(text) => { let (redacted, hits) = redact_text(text); *count += hits; Value::String(redacted) }
            Value::Array(items) => Value::Array(items.iter().map(|item| visit(item, count)).collect()),
            Value::Object(map) => {
                let mut output = serde_json::Map::new();
                for (key, item) in map {
                    if SECRET_LABELS.iter().any(|label| key.to_lowercase().contains(label)) {
                        output.insert(key.clone(), Value::String("<REDACTED>".into())); *count += 1;
                    } else { output.insert(key.clone(), visit(item, count)); }
                }
                Value::Object(output)
            }
            other => other.clone(),
        }
    }
    let mut count = 0usize;
    let result = visit(value, &mut count);
    (result, count)
}

#[cfg(test)]
mod tests {
    use super::{redact_json, redact_text};
    use serde_json::json;

    #[test]
    fn redacts_secret_values() {
        let (text, count) = redact_text("token=abc123\nnormal=value");
        assert!(text.contains("token=<REDACTED>"));
        assert!(count >= 1);
    }

    #[test]
    fn redacts_secret_json_keys() {
        let (value, count) = redact_json(&json!({"apiKey":"abc", "safe":"ok"}));
        assert_eq!(value["apiKey"], "<REDACTED>");
        assert_eq!(count, 1);
    }
}
