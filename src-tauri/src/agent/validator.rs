use super::protocol::ToolCall;
use std::collections::{HashMap, HashSet};

pub(crate) fn record_tool_failure(
    failures: &mut HashMap<String, u32>,
    call: &ToolCall,
    error: &str,
) -> Result<(), String> {
    let signature = format!(
        "{}\n{}\n{}",
        call.function.name, call.function.arguments, error
    );
    let attempts = failures.entry(signature).or_insert(0);
    *attempts += 1;
    if *attempts >= 3 {
        return Err(format!(
            "tool {} failed identically 3 times: {error}",
            call.function.name
        ));
    }
    Ok(())
}
pub(crate) fn normalize_tool_call_ids(tool_calls: &mut [ToolCall], run_id: &str, step: u32) {
    let mut seen = HashSet::new();
    for (index, call) in tool_calls.iter_mut().enumerate() {
        if call.id.trim().is_empty() || !seen.insert(call.id.clone()) {
            call.id = format!("{run_id}-step-{step}-call-{index}");
            seen.insert(call.id.clone());
        }
    }
}
