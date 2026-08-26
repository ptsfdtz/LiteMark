import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedConversationScope } from '@/modules/agent/agentConversationStore';
import { useAgentConversations } from '@/modules/agent/useAgentConversations';

const mocks = vi.hoisted(() => ({
  loadConversationScope: vi.fn<
    (scopeKey: string | null) => Promise<PersistedConversationScope | null>
  >(async () => null),
  saveConversationScope: vi.fn(async () => undefined),
  deleteAgentSession: vi.fn(async () => undefined),
}));

vi.mock('@/modules/agent/agentConversationStore', () => ({
  loadConversationScope: mocks.loadConversationScope,
  saveConversationScope: mocks.saveConversationScope,
}));

vi.mock('@/modules/agent/agentSessionStore', () => ({
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

  it('does not overwrite a new chat created while persisted chats are still loading', async () => {
    let finishLoading: (value: PersistedConversationScope | null) => void = () => undefined;
    mocks.loadConversationScope.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLoading = resolve;
        }),
    );
    const { result } = renderHook(() => useAgentConversations('C:\\notes'));

    act(() => result.current.createConversation());
    const createdId = result.current.activeConversationId;
    expect(createdId).not.toBe('legacy');

    await act(async () => finishLoading(null));
    expect(result.current.activeConversationId).toBe(createdId);
    expect(result.current.conversations.some((item) => item.id === createdId)).toBe(true);
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

  it('keeps the active agent bound when folders switch until a new chat is created', async () => {
    const { result, rerender } = renderHook(({ scope }) => useAgentConversations(scope), {
      initialProps: { scope: 'C:\\notes' },
    });
    await waitFor(() => expect(mocks.loadConversationScope).toHaveBeenCalledWith('C:\\notes'));
    act(() => {
      result.current.syncActiveConversation([
        { id: 'user-1', role: 'user', content: 'Keep working in notes' },
      ]);
    });

    rerender({ scope: 'D:\\novel' });
    expect(result.current.activeScopeKey).toBe('C:\\notes');
    expect(result.current.activeSessionKey).toBe('C:\\notes');
    expect(result.current.conversations[0].title).toBe('Keep working in notes');

    act(() => result.current.createConversation());
    await waitFor(() => expect(result.current.activeScopeKey).toBe('D:\\novel'));
    expect(result.current.activeSessionKey).toContain('D:\\novel::');
    expect(result.current.conversations[0].title).toBe('');
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

  it('archives without deleting session data and restores the conversation', async () => {
    mocks.loadConversationScope.mockResolvedValue({
      activeConversationId: 'first',
      conversations: [
        { id: 'first', title: 'First chat', createdAt: 1, updatedAt: 1 },
        { id: 'second', title: 'Second chat', createdAt: 2, updatedAt: 2 },
      ],
    });
    const { result } = renderHook(() => useAgentConversations('C:\\notes'));
    await waitFor(() => expect(result.current.activeConversationId).toBe('first'));

    act(() => result.current.archiveConversation('first'));
    expect(result.current.conversations.find((item) => item.id === 'first')?.archivedAt).toEqual(
      expect.any(Number),
    );
    expect(result.current.activeConversationId).toBe('second');
    expect(mocks.deleteAgentSession).not.toHaveBeenCalled();

    act(() => result.current.restoreConversation('first'));
    expect(result.current.activeConversationId).toBe('first');
    expect(
      result.current.conversations.find((item) => item.id === 'first')?.archivedAt,
    ).toBeUndefined();
  });

  it('permanently deletes an archived conversation and its session', async () => {
    mocks.loadConversationScope.mockResolvedValue({
      activeConversationId: 'active',
      conversations: [
        { id: 'active', title: 'Active chat', createdAt: 1, updatedAt: 2 },
        { id: 'old', title: 'Archived chat', createdAt: 1, updatedAt: 1, archivedAt: 2 },
      ],
    });
    const { result } = renderHook(() => useAgentConversations('C:\\notes'));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    act(() => result.current.deleteConversation('old'));
    expect(mocks.deleteAgentSession).toHaveBeenCalledWith('C:\\notes::old');
    expect(result.current.conversations.some((item) => item.id === 'old')).toBe(false);
  });

  it('creates an active blank chat when every restored conversation is archived', async () => {
    mocks.loadConversationScope.mockResolvedValue({
      activeConversationId: 'old',
      conversations: [
        { id: 'old', title: 'Archived chat', createdAt: 1, updatedAt: 1, archivedAt: 2 },
      ],
    });
    const { result } = renderHook(() => useAgentConversations('C:\\notes'));

    await waitFor(() => expect(result.current.conversations).toHaveLength(2));
    const active = result.current.conversations.find(
      (item) => item.id === result.current.activeConversationId,
    );
    expect(active).toMatchObject({ title: '' });
    expect(active?.archivedAt).toBeUndefined();
  });
});
