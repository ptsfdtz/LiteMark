import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  activeScopeKey: string | null;
  activeScopeKind: 'project' | 'file';
  createConversation: () => void;
  selectConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  archiveConversation: (id: string) => void;
  restoreConversation: (id: string) => void;
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

export function useAgentConversations(
  scopeKey: string | null,
  scopeKind: 'project' | 'file' = 'project',
): AgentConversations {
  const [state, setState] = useState<ConversationState>(() => initialState(scopeKey));
  const [boundScopeKind, setBoundScopeKind] = useState(scopeKind);
  const stateRef = useRef(state);
  const currentScopeRef = useRef({ key: scopeKey, kind: scopeKind });
  const initialScopeRef = useRef({ key: scopeKey, kind: scopeKind });
  const revisionRef = useRef(0);
  const switchingScopeRef = useRef(false);

  useLayoutEffect(() => {
    currentScopeRef.current = { key: scopeKey, kind: scopeKind };
  }, [scopeKey, scopeKind]);

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
      revisionRef.current += 1;
      stateRef.current = next;
      setState(next);
      persist(next);
    },
    [persist],
  );

  useLayoutEffect(() => {
    let active = true;
    const initialScope = initialScopeRef.current;
    const revision = revisionRef.current;
    void loadConversationScope(initialScope.key).then((restored) => {
      if (
        !active ||
        revisionRef.current !== revision ||
        currentScopeRef.current.key !== initialScope.key
      )
        return;
      if (!restored?.conversations.length) {
        setState(initialState(initialScope.key));
        return;
      }
      const conversations = restored.conversations.some((conversation) => !conversation.archivedAt)
        ? restored.conversations
        : [emptyConversation(nextId()), ...restored.conversations];
      const activeConversationId = conversations.some(
        (conversation) =>
          conversation.id === restored.activeConversationId && !conversation.archivedAt,
      )
        ? restored.activeConversationId
        : conversations.find((conversation) => !conversation.archivedAt)!.id;
      setState({ scopeKey: initialScope.key, conversations, activeConversationId });
      setBoundScopeKind(initialScope.kind);
    });
    return () => {
      active = false;
    };
  }, []);

  // Follow workspace restoration only while the initial conversation is still pristine.
  // Once a conversation has content, its workspace binding remains stable until New Chat.
  useEffect(() => {
    const current = stateRef.current;
    const pristine =
      current.conversations.length === 1 &&
      current.conversations[0].title === '' &&
      current.activeConversationId === current.conversations[0].id;
    if (!pristine || current.scopeKey === scopeKey || switchingScopeRef.current) return;
    switchingScopeRef.current = true;
    const revision = revisionRef.current;
    void loadConversationScope(scopeKey).then((restored) => {
      switchingScopeRef.current = false;
      if (revisionRef.current !== revision || !restored?.conversations.length) {
        if (revisionRef.current === revision) {
          const next = initialState(scopeKey);
          stateRef.current = next;
          setState(next);
          setBoundScopeKind(scopeKind);
        }
        return;
      }
      const conversations = restored.conversations.some((item) => !item.archivedAt)
        ? restored.conversations
        : [emptyConversation(nextId()), ...restored.conversations];
      const activeConversationId = conversations.some(
        (item) => item.id === restored.activeConversationId && !item.archivedAt,
      )
        ? restored.activeConversationId
        : conversations.find((item) => !item.archivedAt)!.id;
      const next = { scopeKey, conversations, activeConversationId };
      stateRef.current = next;
      setState(next);
      setBoundScopeKind(scopeKind);
    });
  }, [scopeKey, scopeKind]);

  const selectConversation = useCallback(
    (id: string) => {
      const current = stateRef.current;
      if (
        !current.conversations.some(
          (conversation) => conversation.id === id && !conversation.archivedAt,
        )
      )
        return;
      const next = { ...current, activeConversationId: id };
      commit(next);
    },
    [commit],
  );

  const createConversation = useCallback(() => {
    const current = stateRef.current;
    const target = currentScopeRef.current;
    if (target.key !== current.scopeKey) {
      if (switchingScopeRef.current) return;
      switchingScopeRef.current = true;
      const revision = revisionRef.current;
      void loadConversationScope(target.key).then((restored) => {
        switchingScopeRef.current = false;
        if (revisionRef.current !== revision) return;
        const conversation = emptyConversation(nextId());
        const next = {
          scopeKey: target.key,
          conversations: [conversation, ...(restored?.conversations ?? [])],
          activeConversationId: conversation.id,
        };
        setBoundScopeKind(target.kind);
        commit(next);
      });
      return;
    }
    const conversation = emptyConversation(nextId());
    const next = {
      ...current,
      conversations: [conversation, ...current.conversations],
      activeConversationId: conversation.id,
    };
    commit(next);
    setBoundScopeKind(target.kind);
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

  const archiveConversation = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const conversation = current.conversations.find((item) => item.id === id);
      if (!conversation || conversation.archivedAt) return;
      const archived = { ...conversation, archivedAt: Date.now(), updatedAt: Date.now() };
      let conversations = current.conversations.map((item) => (item.id === id ? archived : item));
      let activeConversationId = current.activeConversationId;
      if (activeConversationId === id) {
        const nextActive = conversations.find((item) => !item.archivedAt && item.id !== id);
        if (nextActive) {
          activeConversationId = nextActive.id;
        } else {
          const replacement = emptyConversation(nextId());
          conversations = [replacement, ...conversations];
          activeConversationId = replacement.id;
        }
      }
      commit({ ...current, conversations, activeConversationId });
    },
    [commit],
  );

  const restoreConversation = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const conversation = current.conversations.find((item) => item.id === id);
      if (!conversation?.archivedAt) return;
      const restored = { ...conversation, archivedAt: undefined, updatedAt: Date.now() };
      commit({
        ...current,
        conversations: current.conversations
          .map((item) => (item.id === id ? restored : item))
          .sort((left, right) => right.updatedAt - left.updatedAt),
        activeConversationId: id,
      });
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
      if (active.archivedAt) return;
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
    activeScopeKey: state.scopeKey,
    activeScopeKind: boundScopeKind,
    createConversation,
    selectConversation,
    renameConversation,
    archiveConversation,
    restoreConversation,
    deleteConversation,
    syncActiveConversation,
  };
}
