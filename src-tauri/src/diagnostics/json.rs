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

/// Reads an array of strings that a native script may have written with a
/// missing entry.
///
/// In PowerShell, `$null | ForEach-Object { ... }` runs the block once with
/// `$_` set to `$null`, so an adapter without a gateway wrote `"gateways":
/// [null]`. A null is not a string, and one null entry made the whole result
/// unreadable, so a missing entry is dropped instead.
pub fn string_array<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let values = Option::<Vec<Option<String>>>::deserialize(deserializer)?;
    Ok(values
        .unwrap_or_default()
        .into_iter()
        .flatten()
        .filter(|value| !value.is_empty())
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{optional_string, string_array};
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

    #[derive(Debug, Deserialize)]
    struct List {
        #[serde(default, deserialize_with = "string_array")]
        values: Vec<String>,
    }

    #[test]
    fn drops_a_missing_entry_from_an_array() {
        let list: List = serde_json::from_str(r#"{"values":["a",null,"b"]}"#).unwrap();
        assert_eq!(list.values, vec!["a".to_string(), "b".to_string()]);
    }

    #[test]
    fn reads_a_null_array_as_empty() {
        let list: List = serde_json::from_str(r#"{"values":null}"#).unwrap();
        assert!(list.values.is_empty());
    }

    #[test]
    fn reads_a_missing_array_as_empty() {
        let list: List = serde_json::from_str("{}").unwrap();
        assert!(list.values.is_empty());
    }
}
