use std::collections::HashMap;

use super::cancellation::WorkspaceWriteGuard;
use super::protocol::AgentPlanStep;
use super::repository::WriteJournal;

pub(crate) struct AgentRunState {
    pub(crate) completed: bool,
    pub(crate) plan: Vec<AgentPlanStep>,
    pub(crate) repeated_failures: HashMap<String, u32>,
    pub(crate) completed_calls: HashMap<String, (String, String)>,
    pub(crate) workspace_write_guard: Option<WorkspaceWriteGuard>,
    pub(crate) write_journal: WriteJournal,
    pub(crate) verification_required: bool,
}

impl AgentRunState {
    pub(crate) fn new() -> Self {
        Self {
            completed: false,
            plan: Vec::new(),
            repeated_failures: HashMap::new(),
            completed_calls: HashMap::new(),
            workspace_write_guard: None,
            write_journal: WriteJournal::default(),
            verification_required: false,
        }
    }

    pub(crate) fn cache_result(&mut self, id: String, name: String, result: String) {
        self.completed_calls.insert(id, (name, result));
    }
}
