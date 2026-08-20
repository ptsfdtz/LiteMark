use super::protocol::{AgentPlanStep, PlanStepStatus};
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Deserialize)]
pub(crate) struct UpdatePlanArgs {
    pub(crate) steps: Vec<AgentPlanStep>,
}

pub(crate) fn validate_plan(steps: &[AgentPlanStep]) -> Result<(), String> {
    if steps.is_empty() {
        return Err("plan must contain at least one step".to_string());
    }
    let mut ids = HashSet::new();
    let mut in_progress = 0;
    for step in steps {
        if step.id.trim().is_empty() || step.description.trim().is_empty() {
            return Err("plan step ids and descriptions must not be empty".to_string());
        }
        if !ids.insert(step.id.as_str()) {
            return Err(format!("duplicate plan step id: {}", step.id));
        }
        if step.status == PlanStepStatus::InProgress {
            in_progress += 1;
        }
    }
    if in_progress > 1 {
        return Err("plan must not contain more than one in_progress step".to_string());
    }
    Ok(())
}

pub(crate) fn plan_is_complete(steps: &[AgentPlanStep]) -> bool {
    steps
        .iter()
        .all(|step| step.status == PlanStepStatus::Completed)
}
