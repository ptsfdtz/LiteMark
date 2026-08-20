use reqwest::{Client, Url};
use serde_json::{json, Value};
use std::{sync::OnceLock, time::Duration};

const SYSTEM_PROMPT: &str = "You are an inline completion engine for a Markdown editor. Continue at the cursor in the document's existing language, tone, and formatting. Return only the exact text to insert. Do not use code fences, quotes, labels, or explanations. Do not repeat text already before or after the cursor. Keep the completion concise: usually one sentence, list item, or short paragraph.";
static CLIENT: OnceLock<Client> = OnceLock::new();

pub(crate) fn http_client() -> &'static Client {
    CLIENT.get_or_init(Client::new)
}

pub(crate) fn validate_endpoint(endpoint: &str) -> Result<Url, String> {
    let mut url =
        Url::parse(endpoint.trim()).map_err(|_| "The request URL is invalid.".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("The request URL must use HTTP or HTTPS.".to_string());
    }

    let path = url.path().trim_end_matches('/');
    if path.is_empty() {
        url.set_path("/v1/chat/completions");
    } else if path.ends_with("/v1") {
        url.set_path(&format!("{path}/chat/completions"));
    }
    Ok(url)
}

fn text_from_content(content: &Value) -> Option<String> {
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }

    let parts = content.as_array()?;
    let text = parts
        .iter()
        .filter_map(|part| {
            part.get("text")
                .and_then(|value| value.as_str())
                .or_else(|| part.get("text")?.get("value")?.as_str())
        })
        .collect::<String>();
    (!text.is_empty()).then_some(text)
}

fn parse_completion(response: &Value) -> Option<String> {
    response
        .pointer("/choices/0/message/content")
        .and_then(text_from_content)
        .or_else(|| {
            response
                .pointer("/choices/0/text")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            response
                .get("output_text")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            response
                .pointer("/output/0/content/0/text")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .filter(|text| !text.is_empty())
}

pub(crate) fn error_message(body: &str) -> String {
    let parsed = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/error/message")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| body.chars().take(300).collect());

    if parsed.trim().is_empty() {
        "The service returned an empty error response.".to_string()
    } else {
        parsed
    }
}

#[tauri::command]
pub async fn request_agent_completion(
    endpoint: String,
    api_key: String,
    model: String,
    prefix: String,
    suffix: String,
) -> Result<String, String> {
    let endpoint = validate_endpoint(&endpoint)?;
    if api_key.trim().is_empty() {
        return Err("The API key is required.".to_string());
    }
    if model.trim().is_empty() {
        return Err("The model is required.".to_string());
    }

    let client = http_client();
    let body = json!({
        "model": model.trim(),
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            {
                "role": "user",
                "content": format!(
                    "<before_cursor>\n{prefix}\n</before_cursor>\n<after_cursor>\n{suffix}\n</after_cursor>"
                )
            }
        ],
        "max_tokens": 256,
        "stream": false
    });

    let response = client
        .post(endpoint)
        .timeout(Duration::from_secs(30))
        .bearer_auth(api_key.trim())
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("AI request failed: {error}"))?;
    let status = response.status();
    let response_body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read the AI response: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "AI request failed ({status}): {}",
            error_message(&response_body)
        ));
    }

    let response_json: Value = serde_json::from_str(&response_body)
        .map_err(|error| format!("The AI response is not valid JSON: {error}"))?;
    parse_completion(&response_json)
        .ok_or_else(|| "The AI response did not contain a completion.".to_string())
}

#[cfg(test)]
#[path = "../test/agent_completion.rs"]
mod tests;
