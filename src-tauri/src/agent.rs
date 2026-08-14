use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use futures_util::StreamExt;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::ipc::Channel;
use tokio::sync::oneshot;

use crate::agent_completion::{error_message, http_client, validate_endpoint};

const AGENT_SYSTEM_PROMPT: &str = "\
You are an editing agent inside LiteMark, a Markdown editor. You help the user by reading and \
editing the current document.

You have the following tools:
- read_document: return the current full text of the document.
- rewrite_document: replace the entire document with new content.
- replace_in_document: replace one exact substring of the document with another.
- list_documents: list the Markdown/text documents in the working directory.
- read_file: read a Markdown/text file from the working directory.

Guidelines:
- Reply in the same language the user writes in.
- Read the document before editing if you are not already certain of its current content.
- Prefer replace_in_document for small, targeted edits; use rewrite_document for large rewrites.
- When replace_in_document fails because the target appears multiple times or is not found, \
read the document and retry with more surrounding context.
- You may read other documents in the working directory for context, but only the current \
document is edited.
- After editing, briefly summarize what you changed. Do not output the full document unless asked.";

static CANCEL_FLAG: OnceLock<Arc<AtomicBool>> = OnceLock::new();
const MAX_READ_CHARS: usize = 50_000;

fn cancellation_requested() -> bool {
    CANCEL_FLAG
        .get()
        .map(|flag| flag.load(Ordering::SeqCst))
        .unwrap_or(false)
}

#[derive(Clone, Copy)]
struct PermissionDecision {
    allow: bool,
}

static PERMISSION_REQUESTS: OnceLock<
    Arc<Mutex<HashMap<u64, oneshot::Sender<PermissionDecision>>>>,
> = OnceLock::new();

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

fn permission_registry() -> Arc<Mutex<HashMap<u64, oneshot::Sender<PermissionDecision>>>> {
    PERMISSION_REQUESTS
        .get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
        .clone()
}

fn register_permission_request() -> (u64, oneshot::Receiver<PermissionDecision>) {
    let id = NEXT_REQUEST_ID.fetch_add(1, Ordering::SeqCst);
    let (sender, receiver) = oneshot::channel();
    permission_registry()
        .lock()
        .expect("permission registry poisoned")
        .insert(id, sender);
    (id, receiver)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "role", rename_all = "lowercase")]
pub enum ChatMessage {
    System {
        content: String,
    },
    User {
        content: String,
    },
    Assistant {
        #[serde(default)]
        content: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        tool_calls: Option<Vec<ToolCall>>,
    },
    Tool {
        tool_call_id: String,
        #[serde(default)]
        name: Option<String>,
        content: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: FunctionCall,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    TextDelta {
        text: String,
    },
    ToolCallStart {
        id: String,
        name: String,
    },
    ToolCallEnd {
        id: String,
        name: String,
        result: String,
    },
    ToolCallError {
        id: String,
        name: String,
        error: String,
    },
    PermissionRequest {
        id: u64,
        name: String,
        arguments: String,
    },
    AssistantMessage {
        content: String,
        tool_calls: Vec<ToolCall>,
    },
    Edit {
        content: String,
    },
    Done,
}

#[derive(Deserialize)]
struct RewriteArgs {
    content: String,
}

#[derive(Deserialize)]
struct ReplaceArgs {
    old_string: String,
    new_string: String,
}

#[derive(Deserialize)]
struct ReadFileArgs {
    path: String,
}

fn tool_definitions() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "read_document",
                "description": "Return the current full text of the document.",
                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "rewrite_document",
                "description": "Replace the entire document with new content.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": { "type": "string", "description": "The complete new document text." }
                    },
                    "required": ["content"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "replace_in_document",
                "description": "Replace one exact substring of the document with another.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "old_string": { "type": "string", "description": "The exact text to replace." },
                        "new_string": { "type": "string", "description": "The replacement text." }
                    },
                    "required": ["old_string", "new_string"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_documents",
                "description": "List the Markdown/text documents in the working directory.",
                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read a Markdown/text file from the working directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "The file name or relative path within the working directory." }
                    },
                    "required": ["path"],
                    "additionalProperties": false
                }
            }
        }
    ])
}

fn resolve_work_path(work_dir: &Path, requested: &str) -> Result<PathBuf, String> {
    if requested.trim().is_empty() {
        return Err("path must not be empty.".to_string());
    }
    let requested_path = Path::new(requested);
    let candidate = if requested_path.is_absolute() {
        requested_path.to_path_buf()
    } else {
        work_dir.join(requested_path)
    };
    let canonical_work = work_dir
        .canonicalize()
        .map_err(|error| format!("cannot resolve the working directory: {error}"))?;
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|_| format!("file not found: {requested}"))?;
    if !canonical_candidate.starts_with(&canonical_work) {
        return Err("path is outside the working directory.".to_string());
    }
    if !crate::document_storage::is_text_extension(&canonical_candidate) {
        return Err("only text files (.md, .markdown, .txt) can be read.".to_string());
    }
    Ok(canonical_candidate)
}

fn execute_tool(
    name: &str,
    arguments: &str,
    document: &mut String,
    work_dir: Option<&Path>,
) -> Result<String, String> {
    match name {
        "read_document" => {
            let truncated = document.chars().count() > MAX_READ_CHARS;
            let mut content: String = document.chars().take(MAX_READ_CHARS).collect();
            if truncated {
                content.push_str("\n\n[document truncated]");
            }
            Ok(content)
        }
        "rewrite_document" => {
            let args: RewriteArgs = serde_json::from_str(arguments)
                .map_err(|error| format!("invalid arguments: {error}"))?;
            *document = args.content.clone();
            Ok(format!(
                "Document rewritten ({} characters).",
                args.content.chars().count()
            ))
        }
        "replace_in_document" => {
            let args: ReplaceArgs = serde_json::from_str(arguments)
                .map_err(|error| format!("invalid arguments: {error}"))?;
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
        "list_documents" => {
            let directory = work_dir.ok_or("no working directory is set.".to_string())?;
            let files = crate::document_storage::list_text_files(directory)
                .map_err(|error| error.to_string())?;
            if files.is_empty() {
                return Ok("No documents found in the working directory.".to_string());
            }
            Ok(files
                .iter()
                .map(|file| format!("- {}", file.name))
                .collect::<Vec<_>>()
                .join("\n"))
        }
        "read_file" => {
            let args: ReadFileArgs = serde_json::from_str(arguments)
                .map_err(|error| format!("invalid arguments: {error}"))?;
            let directory = work_dir.ok_or("no working directory is set.".to_string())?;
            let path = resolve_work_path(directory, &args.path)?;
            crate::document_storage::read_text_file(&path).map_err(|error| error.to_string())
        }
        _ => Err(format!("unknown tool: {name}")),
    }
}

#[derive(Default)]
struct StreamedCompletion {
    text: String,
    tool_calls: Vec<ToolCall>,
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

async fn stream_completion(
    endpoint: &Url,
    api_key: &str,
    model: &str,
    thread: &[Value],
    on_event: &Channel<AgentEvent>,
) -> Result<StreamedCompletion, String> {
    let client = http_client();
    let body = json!({
        "model": model,
        "messages": thread,
        "tools": tool_definitions(),
        "stream": true,
    });

    let response = client
        .post(endpoint.clone())
        .timeout(Duration::from_secs(120))
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
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
    let mut buffer = String::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if cancellation_requested() {
            return Err("cancelled".to_string());
        }
        let chunk = chunk.map_err(|error| format!("Failed to read the AI stream: {error}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(separator) = buffer.find("\n\n") {
            let block = buffer[..separator].to_string();
            buffer.drain(..separator + 2);
            for line in block.lines() {
                if let Some(data) = line.trim().strip_prefix("data:") {
                    apply_stream_data(data.trim(), &mut completion, on_event);
                }
            }
        }
    }
    if !buffer.trim().is_empty() {
        for line in buffer.lines() {
            if let Some(data) = line.trim().strip_prefix("data:") {
                apply_stream_data(data.trim(), &mut completion, on_event);
            }
        }
    }

    Ok(completion)
}

fn tool_calls_value(tool_calls: &[ToolCall]) -> Value {
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

#[tauri::command]
pub async fn run_agent_turn(
    endpoint: String,
    api_key: String,
    model: String,
    document: String,
    messages: Vec<ChatMessage>,
    instructions: Option<String>,
    max_steps: Option<u32>,
    work_dir: Option<String>,
    confirm_writes: bool,
    on_event: Channel<AgentEvent>,
) -> Result<(), String> {
    let endpoint = validate_endpoint(&endpoint)?;
    if api_key.trim().is_empty() {
        return Err("The API key is required.".to_string());
    }
    if model.trim().is_empty() {
        return Err("The model is required.".to_string());
    }

    let flag = CANCEL_FLAG.get_or_init(|| Arc::new(AtomicBool::new(false)));
    flag.store(false, Ordering::SeqCst);

    let max_steps = max_steps.unwrap_or(8).clamp(1, 32);
    let system_prompt = instructions
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| AGENT_SYSTEM_PROMPT.to_string());

    let mut thread: Vec<Value> = vec![json!({ "role": "system", "content": system_prompt })];
    for message in &messages {
        thread
            .push(serde_json::to_value(message).map_err(|error| format!("bad message: {error}"))?);
    }

    let original_document = document;
    let mut document = original_document.clone();
    let work_dir_path = work_dir
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);

    for _ in 0..max_steps {
        if cancellation_requested() {
            return Err("cancelled".to_string());
        }
        let completion =
            stream_completion(&endpoint, api_key.trim(), model.trim(), &thread, &on_event).await?;

        on_event
            .send(AgentEvent::AssistantMessage {
                content: completion.text.clone(),
                tool_calls: completion.tool_calls.clone(),
            })
            .map_err(|error| error.to_string())?;

        if completion.tool_calls.is_empty() {
            break;
        }

        thread.push(json!({
            "role": "assistant",
            "content": completion.text,
            "tool_calls": tool_calls_value(&completion.tool_calls),
        }));

        for call in &completion.tool_calls {
            let requires_approval = confirm_writes
                && matches!(
                    call.function.name.as_str(),
                    "rewrite_document" | "replace_in_document"
                );
            if requires_approval {
                let (request_id, receiver) = register_permission_request();
                on_event
                    .send(AgentEvent::PermissionRequest {
                        id: request_id,
                        name: call.function.name.clone(),
                        arguments: call.function.arguments.clone(),
                    })
                    .map_err(|error| error.to_string())?;
                let allowed = match tokio::time::timeout(Duration::from_secs(120), receiver).await {
                    Ok(Ok(decision)) => decision.allow,
                    _ => false,
                };
                if !allowed {
                    let denied = "Denied by user.".to_string();
                    on_event
                        .send(AgentEvent::ToolCallStart {
                            id: call.id.clone(),
                            name: call.function.name.clone(),
                        })
                        .map_err(|error| error.to_string())?;
                    on_event
                        .send(AgentEvent::ToolCallEnd {
                            id: call.id.clone(),
                            name: call.function.name.clone(),
                            result: denied.clone(),
                        })
                        .map_err(|error| error.to_string())?;
                    thread.push(json!({
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": denied,
                    }));
                    continue;
                }
            }

            on_event
                .send(AgentEvent::ToolCallStart {
                    id: call.id.clone(),
                    name: call.function.name.clone(),
                })
                .map_err(|error| error.to_string())?;

            match execute_tool(
                &call.function.name,
                &call.function.arguments,
                &mut document,
                work_dir_path.as_deref(),
            ) {
                Ok(result) => {
                    on_event
                        .send(AgentEvent::ToolCallEnd {
                            id: call.id.clone(),
                            name: call.function.name.clone(),
                            result: result.clone(),
                        })
                        .map_err(|error| error.to_string())?;
                    thread.push(json!({
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": result,
                    }));
                }
                Err(error) => {
                    on_event
                        .send(AgentEvent::ToolCallError {
                            id: call.id.clone(),
                            name: call.function.name.clone(),
                            error: error.clone(),
                        })
                        .map_err(|error| error.to_string())?;
                    thread.push(json!({
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": format!("Error: {error}"),
                    }));
                }
            }
        }
    }

    on_event
        .send(AgentEvent::Done)
        .map_err(|error| error.to_string())?;
    if document != original_document {
        on_event
            .send(AgentEvent::Edit { content: document })
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_agent_turn() {
    if let Some(flag) = CANCEL_FLAG.get() {
        flag.store(true, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn resolve_agent_permission(request_id: u64, allow: bool) -> Result<(), String> {
    let sender = permission_registry()
        .lock()
        .expect("permission registry poisoned")
        .remove(&request_id)
        .ok_or_else(|| "permission request not found.".to_string())?;
    sender
        .send(PermissionDecision { allow })
        .map_err(|_| "permission request already resolved.".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        execute_tool, register_permission_request, resolve_agent_permission, ChatMessage,
        FunctionCall, ToolCall, MAX_READ_CHARS,
    };
    use serde_json::json;
    use std::fs;

    #[test]
    fn rewrites_the_document() {
        let mut document = String::from("old");
        let result = execute_tool(
            "rewrite_document",
            r#"{"content":"new"}"#,
            &mut document,
            None,
        );
        assert_eq!(result.as_deref(), Ok("Document rewritten (3 characters)."));
        assert_eq!(document, "new");
    }

    #[test]
    fn replaces_a_unique_occurrence() {
        let mut document = String::from("hello world");
        let result = execute_tool(
            "replace_in_document",
            r#"{"old_string":"world","new_string":"there"}"#,
            &mut document,
            None,
        );
        assert_eq!(result.as_deref(), Ok("Replaced 1 occurrence."));
        assert_eq!(document, "hello there");
    }

    #[test]
    fn rejects_ambiguous_replacements() {
        let mut document = String::from("a a a");
        let result = execute_tool(
            "replace_in_document",
            r#"{"old_string":"a","new_string":"b"}"#,
            &mut document,
            None,
        );
        assert!(result.is_err());
        assert_eq!(document, "a a a");
    }

    #[test]
    fn rejects_missing_old_string() {
        let mut document = String::from("hello");
        let result = execute_tool(
            "replace_in_document",
            r#"{"old_string":"nope","new_string":"x"}"#,
            &mut document,
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn reads_the_current_document() {
        let mut document = String::from("content");
        let result = execute_tool("read_document", "{}", &mut document, None);
        assert_eq!(result.as_deref(), Ok("content"));
    }

    #[test]
    fn caps_read_document_output() {
        let mut document = "x".repeat(MAX_READ_CHARS + 100);
        let result =
            execute_tool("read_document", "{}", &mut document, None).expect("read document");
        assert!(result.ends_with("[document truncated]"));
        assert_eq!(
            result.chars().count(),
            MAX_READ_CHARS + "\n\n[document truncated]".len()
        );
    }

    #[test]
    fn lists_documents_in_the_working_directory() {
        let directory = tempfile::tempdir().expect("temporary directory");
        fs::write(directory.path().join("a.md"), "a").expect("seed a.md");
        fs::write(directory.path().join("b.txt"), "b").expect("seed b.txt");
        fs::write(directory.path().join("ignore.bin"), "binary").expect("seed ignore.bin");

        let mut document = String::new();
        let result = execute_tool(
            "list_documents",
            "{}",
            &mut document,
            Some(directory.path()),
        );

        let listing = result.expect("list documents");
        assert!(listing.contains("a.md"));
        assert!(listing.contains("b.txt"));
        assert!(!listing.contains("ignore.bin"));
    }

    #[test]
    fn reads_a_file_within_the_working_directory() {
        let directory = tempfile::tempdir().expect("temporary directory");
        fs::write(directory.path().join("note.md"), "# note").expect("seed note.md");

        let mut document = String::new();
        let result = execute_tool(
            "read_file",
            r#"{"path":"note.md"}"#,
            &mut document,
            Some(directory.path()),
        );

        assert_eq!(result.as_deref(), Ok("# note"));
    }

    #[test]
    fn rejects_paths_outside_the_working_directory() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let outside = tempfile::tempdir().expect("outside directory");
        let outside_file = outside.path().join("secret.md");
        fs::write(&outside_file, "secret").expect("seed secret.md");

        let mut document = String::new();
        let result = execute_tool(
            "read_file",
            &json!({ "path": outside_file.to_string_lossy() }).to_string(),
            &mut document,
            Some(directory.path()),
        );

        assert!(result.is_err());
    }

    #[test]
    fn requires_a_working_directory_for_directory_tools() {
        let mut document = String::new();
        assert!(execute_tool("list_documents", "{}", &mut document, None).is_err());
        assert!(execute_tool("read_file", r#"{"path":"a.md"}"#, &mut document, None).is_err());
    }

    #[test]
    fn deserializes_chat_messages_by_role() {
        let value = json!({ "role": "user", "content": "hi" });
        let message: ChatMessage = serde_json::from_value(value).unwrap();
        assert!(matches!(message, ChatMessage::User { content } if content == "hi"));
    }

    #[test]
    fn deserializes_assistant_tool_calls() {
        let value = json!({
            "role": "assistant",
            "content": "",
            "tool_calls": [{ "id": "1", "type": "function", "function": { "name": "read_document", "arguments": "{}" } }]
        });
        let message: ChatMessage = serde_json::from_value(value).unwrap();
        match message {
            ChatMessage::Assistant { tool_calls, .. } => {
                let calls = tool_calls.unwrap();
                assert_eq!(calls.len(), 1);
                assert_eq!(calls[0].id, "1");
                assert_eq!(calls[0].function.name, "read_document");
            }
            _ => panic!("expected assistant message"),
        }
    }

    #[test]
    fn serializes_tool_calls_to_openai_shape() {
        let call = ToolCall {
            id: "1".to_string(),
            call_type: "function".to_string(),
            function: FunctionCall {
                name: "read_document".to_string(),
                arguments: "{}".to_string(),
            },
        };
        let value = serde_json::to_value(&call).unwrap();
        assert_eq!(value["type"], "function");
        assert_eq!(value["function"]["name"], "read_document");
    }

    #[test]
    fn resolving_an_unknown_permission_request_fails() {
        let error = resolve_agent_permission(999, true).expect_err("unknown request must fail");
        assert_eq!(error, "permission request not found.");
    }

    #[test]
    fn resolves_a_registered_permission_request() {
        let (id, mut receiver) = register_permission_request();
        assert!(receiver.try_recv().is_err());

        resolve_agent_permission(id, true).expect("resolve permission");

        assert!(receiver.try_recv().expect("permission decision").allow);
    }
}
