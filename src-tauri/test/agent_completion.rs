use super::{error_message, parse_completion, validate_endpoint};
use serde_json::json;

#[test]
fn accepts_http_endpoints_only() {
    assert_eq!(
        validate_endpoint("https://api.example.com/v1/chat/completions")
            .unwrap()
            .as_str(),
        "https://api.example.com/v1/chat/completions"
    );
    assert_eq!(
        validate_endpoint("http://127.0.0.1:11434/v1/")
            .unwrap()
            .as_str(),
        "http://127.0.0.1:11434/v1/chat/completions"
    );
    assert_eq!(
        validate_endpoint("https://api.example.com")
            .unwrap()
            .as_str(),
        "https://api.example.com/v1/chat/completions"
    );
    assert!(validate_endpoint("file:///tmp/completions").is_err());
    assert!(validate_endpoint("not a URL").is_err());
}

#[test]
fn parses_chat_completion_text() {
    let response = json!({
        "choices": [{ "message": { "content": "continued text" } }]
    });
    assert_eq!(
        parse_completion(&response).as_deref(),
        Some("continued text")
    );
}

#[test]
fn parses_segmented_and_legacy_text() {
    let segmented = json!({
        "choices": [{
            "message": { "content": [{ "type": "text", "text": "part one" }, { "type": "text", "text": " part two" }] }
        }]
    });
    let legacy = json!({ "choices": [{ "text": "legacy" }] });

    assert_eq!(
        parse_completion(&segmented).as_deref(),
        Some("part one part two")
    );
    assert_eq!(parse_completion(&legacy).as_deref(), Some("legacy"));
}

#[test]
fn extracts_a_bounded_service_error() {
    assert_eq!(
        error_message(r#"{"error":{"message":"bad key"}}"#),
        "bad key"
    );
    assert_eq!(error_message("plain failure"), "plain failure");
}
