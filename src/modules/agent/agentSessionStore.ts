import { Store } from '@tauri-apps/plugin-store';
import type { AgentItem, ChatMessage, PersistedAgentRun } from './types';

const FILE = 'agent-sessions.json';

export interface PersistedSession {
  items: AgentItem[];
  history: ChatMessage[];
  activeRun?: PersistedAgentRun;
}

async function getStore(): Promise<Store> {
  return await Store.load(FILE);
}

function keyFor(documentPath: string | null): string {
  return documentPath && documentPath.trim() ? documentPath.trim() : '__untitled__';
}

function parseAgentRun(value: unknown): PersistedAgentRun | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const run = value as Partial<PersistedAgentRun>;
  const statuses: PersistedAgentRun['status'][] = [
    'running',
    'waiting_approval',
    'completed',
    'failed',
    'cancelled',
    'interrupted',
  ];
  if (
    typeof run.id !== 'string' ||
    typeof run.goal !== 'string' ||
    !statuses.includes(run.status as PersistedAgentRun['status']) ||
    typeof run.startedAt !== 'number' ||
    typeof run.updatedAt !== 'number'
  ) {
    return undefined;
  }
  return {
    id: run.id,
    goal: run.goal,
    status: run.status as PersistedAgentRun['status'],
    stepCount: typeof run.stepCount === 'number' ? run.stepCount : 0,
    retryCount: typeof run.retryCount === 'number' ? run.retryCount : 0,
    plan: Array.isArray(run.plan) ? run.plan : [],
    ...(typeof run.pendingApprovalId === 'number'
      ? { pendingApprovalId: run.pendingApprovalId }
      : {}),
    ...(typeof run.terminalReason === 'string' ? { terminalReason: run.terminalReason } : {}),
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
  };
}

export async function loadAgentSession(
  documentPath: string | null,
): Promise<PersistedSession | null> {
  try {
    const store = await getStore();
    const value = await store.get<unknown>(keyFor(documentPath));
    if (Array.isArray(value)) {
      // Legacy shape: only display items were persisted.
      return { items: value as AgentItem[], history: [] };
    }
    if (!value || typeof value !== 'object') return null;
    const session = value as Partial<PersistedSession>;
    return {
      items: Array.isArray(session.items) ? session.items : [],
      history: Array.isArray(session.history) ? session.history : [],
      activeRun: parseAgentRun(session.activeRun),
    };
  } catch {
    return null;
  }
}

export async function saveAgentSession(
  documentPath: string | null,
  session: PersistedSession,
): Promise<void> {
  try {
    const store = await getStore();
    await store.set(keyFor(documentPath), session);
    await store.save();
  } catch {
    // Persistence is best-effort; ignore failures so editing never blocks.
  }
}

export async function deleteAgentSession(documentPath: string | null): Promise<void> {
  try {
    const store = await getStore();
    await store.delete(keyFor(documentPath));
    await store.save();
  } catch {
    // Persistence is best-effort; ignore failures so editing never blocks.
  }
}
