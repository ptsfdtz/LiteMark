use serde::Deserialize;

use super::MAX_READ_CHARS;

#[derive(Deserialize)]
struct RewriteArgs {
    content: String,
}

#[derive(Deserialize)]
struct ReplaceArgs {
    old_string: String,
    new_string: String,
}

pub(super) fn read(document: &str) -> String {
    let truncated = document.chars().count() > MAX_READ_CHARS;
    let mut content: String = document.chars().take(MAX_READ_CHARS).collect();
    if truncated {
        content.push_str("\n\n[document truncated]");
    }
    content
}

pub(super) fn rewrite(arguments: &str, document: &mut String) -> Result<String, String> {
    let args: RewriteArgs =
        serde_json::from_str(arguments).map_err(|error| format!("invalid arguments: {error}"))?;
    *document = args.content.clone();
    Ok(format!(
        "Document rewritten ({} characters).",
        args.content.chars().count()
    ))
}

pub(super) fn replace(arguments: &str, document: &mut String) -> Result<String, String> {
    let args: ReplaceArgs =
        serde_json::from_str(arguments).map_err(|error| format!("invalid arguments: {error}"))?;
    if args.old_string.is_empty() {
        return Err("old_string must not be empty.".to_string());
    }
    let occurrences = document.matches(&args.old_string).count();
    if occurrences == 0 {
        return Err("old_string was not found in the document.".to_string());
    }
    if occurrences > 1 {
        return Err(
            "old_string appears multiple times; include more surrounding context to make it unique."
                .to_string(),
        );
    }
    *document = document.replacen(&args.old_string, &args.new_string, 1);
    Ok("Replaced 1 occurrence.".to_string())
}
