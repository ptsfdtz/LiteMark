mod cancellation;
pub(crate) mod commands;
mod executor;
mod permissions;
mod planner;
mod prompt;
mod protocol;
mod repository;
mod run;
mod state_machine;
mod tools;
mod validator;

#[cfg(test)]
use cancellation::{cancellation_registry, RunRegistration, WorkspaceWriteGuard};
#[cfg(test)]
use commands::resolve_agent_permission;
#[cfg(test)]
use executor::take_sse_block;
#[cfg(test)]
use permissions::register_permission_request;
#[cfg(test)]
use planner::validate_plan;
#[cfg(test)]
use protocol::{AgentPlanStep, ChatMessage, FunctionCall, PlanStepStatus, ToolCall};
#[cfg(test)]
use repository::WriteJournal;
#[cfg(test)]
use tools::{execute_tool, MAX_READ_CHARS};
#[cfg(test)]
use validator::{normalize_tool_call_ids, record_tool_failure};

#[cfg(test)]
#[path = "../../test/agent.rs"]
mod tests;
