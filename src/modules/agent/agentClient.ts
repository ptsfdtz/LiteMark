import { invoke, Channel } from '@tauri-apps/api/core';
import type { AgentSettings } from '@/types/agent';
import type { AgentEvent, ChatMessage } from './types';

export interface RunAgentTurnParams {
  runId: string;
  settings: AgentSettings;
  document: string;
  messages: ChatMessage[];
  workDir: string;
  currentFilePath: string | null;
  fileTree: string | null;
  confirmWrites: boolean;
  onEvent: (event: AgentEvent) => void;
}

export async function runAgentTurn({
  settings,
  document,
  messages,
  workDir,
  currentFilePath,
  fileTree,
  confirmWrites,
  onEvent,
  runId,
}: RunAgentTurnParams): Promise<void> {
  const channel = new Channel<AgentEvent>();
  channel.onmessage = onEvent;
  await invoke('run_agent_turn', {
    runId,
    endpoint: settings.endpoint.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    document,
    messages,
    instructions: settings.instructions.trim() || null,
    maxSteps: settings.maxSteps,
    workDir: workDir || null,
    currentFilePath: currentFilePath || null,
    fileTree: fileTree || null,
    confirmWrites,
    onEvent: channel,
  });
}

export async function resolveAgentPermission(requestId: number, allow: boolean): Promise<void> {
  await invoke('resolve_agent_permission', { requestId, allow });
}

export async function cancelAgentTurn(runId: string): Promise<void> {
  await invoke('cancel_agent_turn', { runId });
}

export async function acceptAgentCheckpoint(checkpointId: string): Promise<void> {
  await invoke('accept_agent_checkpoint', { checkpointId });
}

export async function revertAgentCheckpoint(checkpointId: string): Promise<string[]> {
  return invoke<string[]>('revert_agent_checkpoint', { checkpointId });
}
