import { Store } from '@tauri-apps/plugin-store';
import type { AgentItem, ChatMessage } from './types';

const FILE = 'agent-sessions.json';

export interface PersistedSession {
  items: AgentItem[];
  history: ChatMessage[];
}

async function getStore(): Promise<Store> {
  return await Store.load(FILE);
}

function keyFor(documentPath: string | null): string {
  return documentPath && documentPath.trim() ? documentPath.trim() : '__untitled__';
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
