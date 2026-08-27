use futures_util::StreamExt;
use reqwest::Url;
use serde_json::{json, Value};
use std::time::Duration;
use tauri::ipc::Channel;

use super::cancellation::RunRegistration;
use super::protocol::{AgentEvent, FunctionCall, ToolCall};
use super::tools::tool_definitions;
use crate::agent_completion::{error_message, http_client};

const RESPONSE_HEADER_TIMEOUT: Duration = Duration::from_secs(60);
const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_STREAM_ATTEMPTS: usize = 3;

#[derive(Default)]
pub(crate) struct StreamedCompletion {
    pub(crate) text: String,
    pub(crate) tool_calls: Vec<ToolCall>,
}

fn apply_stream_data(
    data: &str,
    completion: &mut StreamedCompletion,
    on_event: &Channel<AgentEvent>,
) {
    if data.trim() == "[DONE]" {
        return;
    }
    let Ok(value) = serde_json::from_str::<Value>(data) else {
        return;
    };
    let Some(delta) = value.pointer("/choices/0/delta") else {
        return;
    };
    if let Some(content) = delta.get("content").and_then(Value::as_str) {
        if !content.is_empty() {
            completion.text.push_str(content);
            let _ = on_event.send(AgentEvent::TextDelta {
                text: content.to_string(),
            });
        }
    }
    if let Some(tool_calls) = delta.get("tool_calls").and_then(Value::as_array) {
        for call in tool_calls {
            let index = call.get("index").and_then(Value::as_u64).unwrap_or(0) as usize;
            while completion.tool_calls.len() <= index {
                completion.tool_calls.push(ToolCall {
                    id: String::new(),
                    call_type: "function".to_string(),
                    function: FunctionCall {
                        name: String::new(),
                        arguments: String::new(),
                    },
                });
            }
            let entry = &mut completion.tool_calls[index];
            if let Some(id) = call.get("id").and_then(Value::as_str) {
                if !id.is_empty() {
                    entry.id = id.to_string();
                }
            }
            if let Some(function) = call.get("function") {
                if let Some(name) = function.get("name").and_then(Value::as_str) {
                    entry.function.name.push_str(name);
                }
                if let Some(arguments) = function.get("arguments").and_then(Value::as_str) {
                    entry.function.arguments.push_str(arguments);
                }
            }
        }
    }
}

fn find_sse_separator(buffer: &[u8]) -> Option<(usize, usize)> {
    let line_feed = buffer.windows(2).position(|window| window == b"\n\n");
    let crlf = buffer.windows(4).position(|window| window == b"\r\n\r\n");

    match (line_feed, crlf) {
        (Some(left), Some(right)) if left <= right => Some((left, 2)),
        (Some(_), Some(right)) => Some((right, 4)),
        (Some(index), None) => Some((index, 2)),
        (None, Some(index)) => Some((index, 4)),
        (None, None) => None,
    }
}

pub(crate) fn take_sse_block(buffer: &mut Vec<u8>) -> Result<Option<String>, String> {
    let Some((separator, separator_length)) = find_sse_separator(buffer) else {
        return Ok(None);
    };
    let block = buffer.drain(..separator).collect::<Vec<_>>();
    buffer.drain(..separator_length);
    String::from_utf8(block)
        .map(Some)
        .map_err(|error| format!("AI stream returned invalid UTF-8: {error}"))
}

pub(crate) async fn stream_completion(
    endpoint: &Url,
    api_key: &str,
    model: &str,
    thread: &[Value],
    on_event: &Channel<AgentEvent>,
    cancellation: &RunRegistration,
) -> Result<StreamedCompletion, String> {
    let client = http_client();
    let body = json!({
        "model": model,
        "messages": thread,
        "tools": tool_definitions(),
        "stream": true,
    });

    for attempt in 1..=MAX_STREAM_ATTEMPTS {
        if cancellation.cancelled() {
            return Err("cancelled".to_string());
        }

        let request = client
            .post(endpoint.clone())
            .bearer_auth(api_key)
            .json(&body);
        let response = tokio::time::timeout(RESPONSE_HEADER_TIMEOUT, request.send())
            .await
            .map_err(|_| {
                "AI request timed out while waiting for the response to start (60 seconds)."
                    .to_string()
            })?
            .map_err(|error| format!("AI request failed: {error}"))?;

        let status = response.status();
        if !status.is_success() {
            let response_body = response
                .text()
                .await
                .map_err(|error| format!("Failed to read the AI response: {error}"))?;
            return Err(format!(
                "AI request failed ({status}): {}",
                error_message(&response_body)
            ));
        }

        let mut completion = StreamedCompletion::default();
        let mut buffer = Vec::new();
        let mut received_bytes = false;
        let mut stream = response.bytes_stream();
        let stream_error = loop {
            if cancellation.cancelled() {
                return Err("cancelled".to_string());
            }
            let next = match tokio::time::timeout(STREAM_IDLE_TIMEOUT, stream.next()).await {
                Ok(next) => next,
                Err(_) => {
                    break Some(
                        "The AI response stream was idle for 180 seconds. The configured request address may have stopped sending data."
                            .to_string(),
                    )
                }
            };
            let Some(chunk) = next else {
                break None;
            };
            let chunk = match chunk {
                Ok(chunk) => chunk,
                Err(error) => {
                    break Some(format!(
                        "The AI response stream was interrupted by the configured request address: {error}"
                    ))
                }
            };
            received_bytes = true;
            buffer.extend_from_slice(&chunk);
            while let Some(block) = take_sse_block(&mut buffer)? {
                for line in block.lines() {
                    if let Some(data) = line.trim().strip_prefix("data:") {
                        apply_stream_data(data.trim(), &mut completion, on_event);
                    }
                }
            }
        };

        if let Some(error) = stream_error {
            if !received_bytes && attempt < MAX_STREAM_ATTEMPTS {
                tokio::time::sleep(Duration::from_millis(400 * attempt as u64)).await;
                continue;
            }
            return Err(error);
        }

        if !buffer.is_empty() {
            let remainder = String::from_utf8(buffer)
                .map_err(|error| format!("AI stream returned invalid UTF-8: {error}"))?;
            for line in remainder.lines() {
                if let Some(data) = line.trim().strip_prefix("data:") {
                    apply_stream_data(data.trim(), &mut completion, on_event);
                }
            }
        }
        return Ok(completion);
    }

    Err("The AI response stream could not be started after 3 attempts.".to_string())
}

pub(crate) fn tool_calls_value(tool_calls: &[ToolCall]) -> Value {
    tool_calls
        .iter()
        .map(|call| {
            json!({
                "id": call.id,
                "type": "function",
                "function": {
                    "name": call.function.name,
                    "arguments": call.function.arguments,
                }
            })
        })
        .collect()
}
