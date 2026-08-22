use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::Duration;
use tauri::ipc::Channel;

use super::cancellation::{RunRegistration, WorkspaceWriteGuard};
use super::executor::{stream_completion, tool_calls_value};
use super::permissions::{discard_permission_request, register_permission_request};
use super::planner::{plan_is_complete, validate_plan, UpdatePlanArgs};
use super::prompt::AGENT_SYSTEM_PROMPT;
use super::protocol::{AgentEvent, ChatMessage, PlanStepStatus};
use super::state_machine::AgentRunState;
use super::tools::execute_tool;
use super::tools::filesystem::{resolve_work_path_for_write, WriteFileArgs};
use super::validator::{normalize_tool_call_ids, record_tool_failure};
use crate::agent_completion::validate_endpoint;

pub(crate) struct AgentRunRequest {
    pub(crate) run_id: String,
    pub(crate) endpoint: String,
    pub(crate) api_key: String,
    pub(crate) model: String,
    pub(crate) document: String,
    pub(crate) messages: Vec<ChatMessage>,
    pub(crate) instructions: Option<String>,
    pub(crate) max_steps: Option<u32>,
    pub(crate) work_dir: Option<String>,
    pub(crate) current_file_path: Option<String>,
    pub(crate) file_tree: Option<String>,
    pub(crate) confirm_writes: bool,
    pub(crate) on_event: Channel<AgentEvent>,
}

pub(crate) async fn run_agent_turn(request: AgentRunRequest) -> Result<(), String> {
    let AgentRunRequest {
        run_id,
        endpoint,
        api_key,
        model,
        document,
        messages,
        instructions,
        max_steps,
        work_dir,
        current_file_path,
        file_tree,
        confirm_writes,
        on_event,
    } = request;
    if run_id.trim().is_empty() {
        return Err("run id is required".to_string());
    }
    let run = RunRegistration::register(run_id.clone())?;
    let endpoint = validate_endpoint(&endpoint)?;
    if api_key.trim().is_empty() {
        return Err("The API key is required.".to_string());
    }
    if model.trim().is_empty() {
        return Err("The model is required.".to_string());
    }

    let max_steps = max_steps.unwrap_or(8).clamp(1, 32);
    let mut system_prompt = AGENT_SYSTEM_PROMPT.to_string();
    if let Some(custom) = instructions
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        system_prompt.push_str("\n\nAdditional user instructions:\n");
        system_prompt.push_str(&custom);
    }

    let work_dir_path = work_dir
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);

    // Project context: the current file is the user's primary reference, the
    // file tree lets the agent navigate without extra tool calls.
    let mut context_lines: Vec<String> = Vec::new();
    if let Some(directory) = &work_dir_path {
        context_lines.push(format!(
            "Project directory: {}",
            directory.to_string_lossy()
        ));
    }
    let current_file = current_file_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    context_lines.push(match current_file {
        Some(path) => format!("Current file the user is editing: {path}"),
        None => "Current file the user is editing: none".to_string(),
    });
    if let Some(tree) = file_tree
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        context_lines.push(format!("Project files:\n{tree}"));
    }
    if !context_lines.is_empty() {
        system_prompt.push_str("\n\nContext:\n");
        system_prompt.push_str(&context_lines.join("\n"));
    }

    let mut thread: Vec<Value> = vec![json!({ "role": "system", "content": system_prompt })];
    for message in &messages {
        thread
            .push(serde_json::to_value(message).map_err(|error| format!("bad message: {error}"))?);
    }

    let original_document = document;
    let mut document = original_document.clone();

    let mut state = AgentRunState::new();
    for step_index in 0..max_steps {
        if run.cancelled() {
            return Err("cancelled".to_string());
        }
        let mut completion = stream_completion(
            &endpoint,
            api_key.trim(),
            model.trim(),
            &thread,
            &on_event,
            &run,
        )
        .await?;
        normalize_tool_call_ids(&mut completion.tool_calls, &run_id, step_index);

        on_event
            .send(AgentEvent::AssistantMessage {
                content: completion.text.clone(),
                tool_calls: completion.tool_calls.clone(),
            })
            .map_err(|error| error.to_string())?;

        if completion.tool_calls.is_empty() {
            if state.plan.is_empty() || plan_is_complete(&state.plan) {
                state.completed = true;
                break;
            }
            if state
                .plan
                .iter()
                .any(|step| step.status == PlanStepStatus::Failed)
            {
                return Err("agent plan contains a failed step".to_string());
            }
            thread.push(json!({ "role": "assistant", "content": completion.text }));
            thread.push(json!({
                "role": "system",
                "content": "The published plan still has unfinished steps. Continue executing it, or call update_plan to accurately mark steps completed or failed."
            }));
            continue;
        }

        thread.push(json!({
            "role": "assistant",
            "content": completion.text,
            "tool_calls": tool_calls_value(&completion.tool_calls),
        }));

        for call in &completion.tool_calls {
            if let Some((name, result)) = state.completed_calls.get(&call.id) {
                on_event
                    .send(AgentEvent::ToolCallStart {
                        id: call.id.clone(),
                        name: name.clone(),
                    })
                    .map_err(|error| error.to_string())?;
                on_event
                    .send(AgentEvent::ToolCallEnd {
                        id: call.id.clone(),
                        name: name.clone(),
                        result: format!("{result}\n[reused completed call]"),
                    })
                    .map_err(|error| error.to_string())?;
                thread.push(json!({
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": result,
                }));
                continue;
            }
            if call.function.name == "update_plan" {
                on_event
                    .send(AgentEvent::ToolCallStart {
                        id: call.id.clone(),
                        name: call.function.name.clone(),
                    })
                    .map_err(|error| error.to_string())?;
                let result = match serde_json::from_str::<UpdatePlanArgs>(&call.function.arguments)
                {
                    Ok(args) => match validate_plan(&args.steps) {
                        Ok(()) => {
                            let step_count = args.steps.len();
                            state.plan = args.steps;
                            on_event
                                .send(AgentEvent::PlanUpdated {
                                    steps: state.plan.clone(),
                                })
                                .map_err(|error| error.to_string())?;
                            format!("Plan updated ({step_count} steps).")
                        }
                        Err(error) => format!("Error: {error}"),
                    },
                    Err(error) => format!("Error: invalid arguments: {error}"),
                };
                on_event
                    .send(AgentEvent::ToolCallEnd {
                        id: call.id.clone(),
                        name: call.function.name.clone(),
                        result: result.clone(),
                    })
                    .map_err(|error| error.to_string())?;
                if !result.starts_with("Error:") {
                    state.cache_result(call.id.clone(), call.function.name.clone(), result.clone());
                }
                thread.push(json!({
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": result,
                }));
                continue;
            }
            let requires_approval = confirm_writes
                && matches!(
                    call.function.name.as_str(),
                    "rewrite_document" | "replace_in_document" | "write_file"
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
                discard_permission_request(request_id);
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

            let is_write = matches!(
                call.function.name.as_str(),
                "rewrite_document" | "replace_in_document" | "write_file"
            );
            if is_write && state.workspace_write_guard.is_none() {
                if let Some(directory) = work_dir_path.as_deref() {
                    state.workspace_write_guard =
                        Some(WorkspaceWriteGuard::acquire(directory, &run_id)?);
                }
            }

            on_event
                .send(AgentEvent::ToolCallStart {
                    id: call.id.clone(),
                    name: call.function.name.clone(),
                })
                .map_err(|error| error.to_string())?;

            if call.function.name == "write_file" {
                let args: WriteFileArgs = serde_json::from_str(&call.function.arguments)
                    .map_err(|error| format!("invalid arguments: {error}"))?;
                let directory = work_dir_path
                    .as_deref()
                    .ok_or_else(|| "no working directory is set".to_string())?;
                let path = resolve_work_path_for_write(directory, &args.path)?;
                state.write_journal.capture(&path)?;
            }

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
                    if call.function.name == "write_file" {
                        if let (Ok(args), Some(directory)) = (
                            serde_json::from_str::<WriteFileArgs>(&call.function.arguments),
                            work_dir_path.as_deref(),
                        ) {
                            if let Ok(resolved) = resolve_work_path_for_write(directory, &args.path)
                            {
                                on_event
                                    .send(AgentEvent::FileWritten {
                                        path: resolved.to_string_lossy().to_string(),
                                    })
                                    .map_err(|error| error.to_string())?;
                            }
                        }
                    }
                    thread.push(json!({
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": result,
                    }));
                    state.cache_result(call.id.clone(), call.function.name.clone(), result);
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
                    record_tool_failure(&mut state.repeated_failures, call, &error)?;
                }
            }
        }
    }

    if !state.completed {
        return Err(format!(
            "agent stopped after reaching the maximum of {max_steps} steps"
        ));
    }

    on_event
        .send(AgentEvent::Done)
        .map_err(|error| error.to_string())?;
    if document != original_document {
        on_event
            .send(AgentEvent::Edit { content: document })
            .map_err(|error| error.to_string())?;
    }
    state.write_journal.commit();
    Ok(())
}
