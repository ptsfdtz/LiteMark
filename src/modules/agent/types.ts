export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; name?: string; content: string };

export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_start'; id: string; name: string; arguments?: string }
  | { type: 'tool_call_end'; id: string; name: string; result: string }
  | { type: 'tool_call_error'; id: string; name: string; error: string }
  | { type: 'permission_request'; id: number; name: string; arguments: string }
  | { type: 'assistant_message'; content: string; tool_calls: ToolCall[] }
  | { type: 'edit'; content: string }
  | { type: 'file_written'; path: string }
  | { type: 'plan_updated'; steps: AgentPlanStep[] }
  | { type: 'done' };

export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface AgentPlanStep {
  id: string;
  description: string;
  status: PlanStepStatus;
}

export interface DiffSummary {
  added: number;
  removed: number;
}

export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  text: string;
}

export type AgentItem =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; content: string }
  | { id: string; role: 'tool'; name: string; arguments?: string; result?: string; error?: string }
  | { id: string; role: 'plan'; steps: AgentPlanStep[] }
  | {
      id: string;
      role: 'permission';
      requestId: number;
      name: string;
      arguments?: string;
      pending: boolean;
      decision?: 'allow' | 'deny';
    }
  | {
      id: string;
      role: 'edit';
      summary: DiffSummary;
      diff: DiffLine[];
      content: string;
      applied: boolean;
    };

export type AgentStatus = 'idle' | 'running';

export type AgentRunStatus =
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface PersistedAgentRun {
  id: string;
  goal: string;
  status: AgentRunStatus;
  stepCount: number;
  retryCount: number;
  plan: AgentPlanStep[];
  pendingApprovalId?: number;
  terminalReason?: string;
  startedAt: number;
  updatedAt: number;
}
