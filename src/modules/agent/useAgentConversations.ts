import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteAgentSession } from './agentSessionStore';
import {
  loadConversationScope,
  saveConversationScope,
  type AgentConversationSummary,
  type PersistedConversationScope,
} from './agentConversationStore';
import type { AgentItem } from './types';

interface ConversationState extends PersistedConversationScope {
  scopeKey: string | null;
}

export interface AgentConversations {
  conversations: AgentConversationSummary[];
  activeConversationId: string;
  activeSessionKey: string | null;
  createConversation: () => void;
  selectConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  syncActiveConversation: (items: AgentItem[]) => void;
}

function nextId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyConversation(id = 'legacy'): AgentConversationSummary {
  const now = Date.now();
  return { id, title: '', createdAt: now, updatedAt: now };
}

function initialState(scopeKey: string | null): ConversationState {
  const conversation = emptyConversation();
  return {
    scopeKey,
    conversations: [conversation],
    activeConversationId: conversation.id,
  };
}

function sessionKeyFor(scopeKey: string | null, conversationId: string): string | null {
  if (!scopeKey) return null;
  // Keep the legacy key for the first conversation so existing histories restore automatically.
  return conversationId === 'legacy' ? scopeKey : `${scopeKey}::${conversationId}`;
}

function titleFrom(items: AgentItem[]): string {
  const firstUserMessage = items.find((item) => item.role === 'user');
  if (!firstUserMessage || firstUserMessage.role !== 'user') return '';
  return firstUserMessage.content.replace(/\s+/g, ' ').trim().slice(0, 56);
}

export function useAgentConversations(scopeKey: string | null): AgentConversations {
  const [state, setState] = useState<ConversationState>(() => initialState(scopeKey));
  const stateRef = useRef(state);

  const persist = useCallback((next: ConversationState) => {
    void saveConversationScope(next.scopeKey, {
      conversations: next.conversations,
      activeConversationId: next.activeConversationId,
    });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const commit = useCallback(
    (next: ConversationState) => {
      stateRef.current = next;
      setState(next);
      persist(next);
    },
    [persist],
  );

  useEffect(() => {
    let active = true;
    void loadConversationScope(scopeKey).then((restored) => {
      if (!active) return;
      if (!restored?.conversations.length) {
        setState(initialState(scopeKey));
        return;
      }
      const activeConversationId = restored.conversations.some(
        (conversation) => conversation.id === restored.activeConversationId,
      )
        ? restored.activeConversationId
        : restored.conversations[0].id;
      setState({ scopeKey, conversations: restored.conversations, activeConversationId });
    });
    return () => {
      active = false;
    };
  }, [scopeKey]);

  const selectConversation = useCallback(
    (id: string) => {
      const current = stateRef.current;
      if (!current.conversations.some((conversation) => conversation.id === id)) return;
      const next = { ...current, activeConversationId: id };
      commit(next);
    },
    [commit],
  );

  const createConversation = useCallback(() => {
    const current = stateRef.current;
    const conversation = emptyConversation(nextId());
    const next = {
      ...current,
      conversations: [conversation, ...current.conversations],
      activeConversationId: conversation.id,
    };
    commit(next);
  }, [commit]);

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const current = stateRef.current;
      const trimmed = title.trim();
      if (!trimmed) return;
      const conversation = current.conversations.find((item) => item.id === id);
      if (!conversation || conversation.title === trimmed) return;
      const next = {
        ...current,
        conversations: current.conversations.map((item) =>
          item.id === id
            ? { ...item, title: trimmed, customTitle: true, updatedAt: Date.now() }
            : item,
        ),
      };
      commit(next);
    },
    [commit],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const deleted = current.conversations.find((conversation) => conversation.id === id);
      if (!deleted) return;
      const remaining = current.conversations.filter((conversation) => conversation.id !== id);
      const conversations = remaining.length ? remaining : [emptyConversation(nextId())];
      const activeConversationId =
        current.activeConversationId === id ? conversations[0].id : current.activeConversationId;
      const next = { ...current, conversations, activeConversationId };
      commit(next);
      void deleteAgentSession(sessionKeyFor(current.scopeKey, deleted.id));
    },
    [commit],
  );

  const syncActiveConversation = useCallback(
    (items: AgentItem[]) => {
      const current = stateRef.current;
      const active = current.conversations.find(
        (conversation) => conversation.id === current.activeConversationId,
      );
      if (!active) return;
      if (active.customTitle) return;
      const title = titleFrom(items);
      if (active.title === title) return;
      const updated = { ...active, title, updatedAt: Date.now() };
      const next = {
        ...current,
        conversations: current.conversations
          .map((conversation) => (conversation.id === updated.id ? updated : conversation))
          .sort((left, right) => right.updatedAt - left.updatedAt),
      };
      commit(next);
    },
    [commit],
  );

  const activeSessionKey = useMemo(
    () => sessionKeyFor(state.scopeKey, state.activeConversationId),
    [state.activeConversationId, state.scopeKey],
  );

  return {
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    activeSessionKey,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    syncActiveConversation,
  };
}
