use serde::{Deserialize, Deserializer};

/// Reads an optional string that a native script may have reported in an
/// unexpected shape.
///
/// Windows PowerShell 5.1 serialises the result of
/// `Select-Object -First 1 -ExpandProperty Source` over an empty pipeline as
/// `{}` instead of `null`, and a map cannot be read as a path. One optional
/// scalar must not be able to fail an entire diagnosis, so a string is taken
/// as reported and every other shape is read as "not reported".
pub fn optional_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    match serde_json::Value::deserialize(deserializer)? {
        serde_json::Value::String(text) => Ok(Some(text)),
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::optional_string;
    use serde::Deserialize;

    #[derive(Debug, Deserialize)]
    struct Holder {
        #[serde(default, deserialize_with = "optional_string")]
        value: Option<String>,
    }

    #[test]
    fn keeps_a_reported_string() {
        let holder: Holder = serde_json::from_str(r#"{"value":"C:\\tools\\windbg.exe"}"#).unwrap();
        assert_eq!(holder.value.as_deref(), Some("C:\\tools\\windbg.exe"));
    }

    #[test]
    fn reads_null_as_not_reported() {
        let holder: Holder = serde_json::from_str(r#"{"value":null}"#).unwrap();
        assert!(holder.value.is_none());
    }

    #[test]
    fn reads_an_empty_object_as_not_reported() {
        let holder: Holder = serde_json::from_str(r#"{"value":{}}"#).unwrap();
        assert!(holder.value.is_none());
    }

    #[test]
    fn reads_a_missing_key_as_not_reported() {
        let holder: Holder = serde_json::from_str("{}").unwrap();
        assert!(holder.value.is_none());
    }
}
