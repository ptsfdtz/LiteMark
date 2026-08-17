import { Store } from '@tauri-apps/plugin-store';

const FILE = 'agent-conversations.json';

export interface AgentConversationSummary {
  id: string;
  title: string;
  customTitle?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PersistedConversationScope {
  conversations: AgentConversationSummary[];
  activeConversationId: string;
}

async function getStore(): Promise<Store> {
  return await Store.load(FILE);
}

function keyFor(scopeKey: string | null): string {
  return scopeKey && scopeKey.trim() ? scopeKey.trim() : '__untitled__';
}

export async function loadConversationScope(
  scopeKey: string | null,
): Promise<PersistedConversationScope | null> {
  try {
    const store = await getStore();
    const value = await store.get<unknown>(keyFor(scopeKey));
    if (!value || typeof value !== 'object') return null;
    const scope = value as Partial<PersistedConversationScope>;
    if (!Array.isArray(scope.conversations) || typeof scope.activeConversationId !== 'string') {
      return null;
    }
    return {
      conversations: scope.conversations.filter(
        (conversation): conversation is AgentConversationSummary =>
          Boolean(
            conversation &&
            typeof conversation.id === 'string' &&
            typeof conversation.title === 'string' &&
            typeof conversation.createdAt === 'number' &&
            typeof conversation.updatedAt === 'number',
          ),
      ),
      activeConversationId: scope.activeConversationId,
    };
  } catch {
    return null;
  }
}

export async function saveConversationScope(
  scopeKey: string | null,
  scope: PersistedConversationScope,
): Promise<void> {
  try {
    const store = await getStore();
    await store.set(keyFor(scopeKey), scope);
    await store.save();
  } catch {
    // Persistence is best-effort; ignore failures so editing never blocks.
  }
}
