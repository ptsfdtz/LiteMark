use tauri::ipc::Channel;

use super::cancellation::cancel_run;
use super::permissions::resolve_permission;
use super::protocol::{AgentEvent, ChatMessage};
use super::run;

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn run_agent_turn(
    run_id: String,
    endpoint: String,
    api_key: String,
    model: String,
    document: String,
    messages: Vec<ChatMessage>,
    instructions: Option<String>,
    max_steps: Option<u32>,
    work_dir: Option<String>,
    current_file_path: Option<String>,
    file_tree: Option<String>,
    confirm_writes: bool,
    on_event: Channel<AgentEvent>,
) -> Result<(), String> {
    run::run_agent_turn(run::AgentRunRequest {
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
    })
    .await
}

#[tauri::command]
pub async fn cancel_agent_turn(run_id: String) -> Result<(), String> {
    cancel_run(&run_id)
}

#[tauri::command]
pub fn resolve_agent_permission(request_id: u64, allow: bool) -> Result<(), String> {
    resolve_permission(request_id, allow)
}
