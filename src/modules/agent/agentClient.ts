import { invoke, Channel } from '@tauri-apps/api/core';
import type { AgentSettings } from '@/types/agent';
import type { AgentEvent, ChatMessage } from './types';

export interface RunAgentTurnParams {
  settings: AgentSettings;
  document: string;
  messages: ChatMessage[];
  workDir: string;
  confirmWrites: boolean;
  onEvent: (event: AgentEvent) => void;
}

export async function runAgentTurn({
  settings,
  document,
  messages,
  workDir,
  confirmWrites,
  onEvent,
}: RunAgentTurnParams): Promise<void> {
  const channel = new Channel<AgentEvent>();
  channel.onmessage = onEvent;
  await invoke('run_agent_turn', {
    endpoint: settings.endpoint.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    document,
    messages,
    instructions: settings.instructions.trim() || null,
    maxSteps: settings.maxSteps,
    workDir: workDir || null,
    confirmWrites,
    onEvent: channel,
  });
}

export async function resolveAgentPermission(requestId: number, allow: boolean): Promise<void> {
  await invoke('resolve_agent_permission', { requestId, allow });
}

export async function cancelAgentTurn(): Promise<void> {
  await invoke('cancel_agent_turn');
}
