import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedConversationScope } from './agentConversationStore';
import { useAgentConversations } from './useAgentConversations';

const mocks = vi.hoisted(() => ({
  loadConversationScope: vi.fn<
    (scopeKey: string | null) => Promise<PersistedConversationScope | null>
  >(async () => null),
  saveConversationScope: vi.fn(async () => undefined),
  deleteAgentSession: vi.fn(async () => undefined),
}));

vi.mock('./agentConversationStore', () => ({
  loadConversationScope: mocks.loadConversationScope,
  saveConversationScope: mocks.saveConversationScope,
}));

vi.mock('./agentSessionStore', () => ({
  deleteAgentSession: mocks.deleteAgentSession,
}));

describe('Agent conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConversationScope.mockResolvedValue(null);
  });

  it('uses the legacy session key so existing histories restore after the upgrade', async () => {
    const { result } = renderHook(() => useAgentConversations('C:\\notes'));

    await waitFor(() => expect(mocks.loadConversationScope).toHaveBeenCalledWith('C:\\notes'));

    expect(result.current.activeConversationId).toBe('legacy');
    expect(result.current.activeSessionKey).toBe('C:\\notes');
  });

  it('restores the previously active conversation for a scope', async () => {
    mocks.loadConversationScope.mockResolvedValue({
      activeConversationId: 'second',
      conversations: [
        { id: 'first', title: 'First chat', createdAt: 1, updatedAt: 1 },
        { id: 'second', title: 'Second chat', createdAt: 2, updatedAt: 2 },
      ],
    });

    const { result } = renderHook(() => useAgentConversations('C:\\notes'));

    await waitFor(() => expect(result.current.activeConversationId).toBe('second'));

    expect(result.current.activeSessionKey).toBe('C:\\notes::second');
  });

  it('creates, selects, and deletes conversations without leaving an empty scope', async () => {
    const { result } = renderHook(() => useAgentConversations('C:\\notes'));
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    act(() => result.current.createConversation());
    const created = result.current.activeConversationId;
    expect(created).not.toBe('legacy');
    expect(result.current.conversations).toHaveLength(2);

    act(() => result.current.selectConversation('legacy'));
    expect(result.current.activeConversationId).toBe('legacy');

    act(() => result.current.deleteConversation('legacy'));
    expect(mocks.deleteAgentSession).toHaveBeenCalledWith('C:\\notes');
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeConversationId).toBe(created);
  });

  it('uses the first user message as the conversation title', async () => {
    const { result } = renderHook(() => useAgentConversations('C:\\notes'));
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    act(() => {
      result.current.syncActiveConversation([
        { id: 'user-1', role: 'user', content: 'Refactor the project file tree please' },
      ]);
    });

    expect(result.current.conversations[0].title).toBe('Refactor the project file tree please');
  });

  it('keeps a user-defined title when later messages arrive', async () => {
    const { result } = renderHook(() => useAgentConversations('C:\\notes'));
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    act(() => result.current.renameConversation('legacy', 'Release plan'));
    act(() => {
      result.current.syncActiveConversation([
        { id: 'user-1', role: 'user', content: 'Replace the old title' },
      ]);
    });

    expect(result.current.conversations[0]).toMatchObject({
      title: 'Release plan',
      customTitle: true,
    });
  });
});
