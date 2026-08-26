import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentSettings } from '@/types/agent';
import { cancelAgentTurn, resolveAgentPermission, runAgentTurn } from './agentClient';
import { loadAgentSession, saveAgentSession } from './agentSessionStore';
import { diffLines, summarizeDiff } from './diff';
import type { AgentEvent, AgentItem, AgentStatus, ChatMessage, PersistedAgentRun } from './types';

export interface AgentSessionOptions {
  getSettings: () => AgentSettings;
  getDocument: () => string;
  applyDocument: (content: string) => void;
  getWorkDir: () => string;
  /** Scope the conversation is persisted under: the project directory. */
  sessionKey: string | null;
  /** The document the user is editing right now; the agent's primary reference. */
  getCurrentFilePath: () => string | null;
  /** Serialized project file tree injected into the system prompt. */
  getFileTree: () => string | null;
  /** Called after the agent writes a project file to disk via write_file. */
  onFileWritten?: (path: string) => void;
}

export interface AgentSession {
  items: AgentItem[];
  status: AgentStatus;
  error: string | null;
  activeRun?: PersistedAgentRun;
  send: (text: string) => Promise<void>;
  resume: () => Promise<void>;
  stop: () => void;
  clear: () => void;
  applyEdit: (id: string) => void;
  respondPermission: (requestId: number, allow: boolean, remember?: boolean) => void;
}

function nextId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function isCancellation(reason: unknown): boolean {
  const message = typeof reason === 'string' ? reason : String(reason);
  return message.toLowerCase().includes('cancelled') || message.toLowerCase().includes('canceled');
}

function rebuildPendingEdits(items: AgentItem[]): Map<string, string> {
  const pending = new Map<string, string>();
  for (const item of items) {
    if (item.role === 'edit' && !item.applied) pending.set(item.id, item.content);
  }
  return pending;
}

function repairInterruptedHistory(history: ChatMessage[]): ChatMessage[] {
  const repaired: ChatMessage[] = [];
  for (let index = 0; index < history.length; index += 1) {
    const message = history[index];
    if (message.role === 'tool') continue;

    repaired.push(message);
    if (message.role !== 'assistant' || !message.tool_calls?.length) continue;

    const responses = new Map<string, ChatMessage & { role: 'tool' }>();
    while (history[index + 1]?.role === 'tool') {
      const response = history[index + 1] as ChatMessage & { role: 'tool' };
      if (!responses.has(response.tool_call_id)) responses.set(response.tool_call_id, response);
      index += 1;
    }

    for (const call of message.tool_calls) {
      repaired.push(
        responses.get(call.id) ?? {
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: 'Error: tool call interrupted before completion.',
        },
      );
    }
  }
  return repaired;
}

function repairInterruptedItems(items: AgentItem[]): AgentItem[] {
  return items
    .filter((item) => item.role !== 'tool' || item.name !== 'update_plan')
    .map((item) =>
      item.role === 'permission' && item.pending
        ? { ...item, pending: false, decision: 'deny' as const }
        : item,
    );
}

export function useAgentSession({
  getSettings,
  getDocument,
  applyDocument,
  getWorkDir,
  sessionKey,
  getCurrentFilePath,
  getFileTree,
  onFileWritten,
}: AgentSessionOptions): AgentSession {
  const [items, setItems] = useState<AgentItem[]>([]);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [checkpointRevision, setCheckpointRevision] = useState(0);

  const getSettingsRef = useRef(getSettings);
  const getDocumentRef = useRef(getDocument);
  const applyDocumentRef = useRef(applyDocument);
  const getWorkDirRef = useRef(getWorkDir);
  const getCurrentFilePathRef = useRef(getCurrentFilePath);
  const getFileTreeRef = useRef(getFileTree);
  const onFileWrittenRef = useRef(onFileWritten);
  getSettingsRef.current = getSettings;
  getDocumentRef.current = getDocument;
  applyDocumentRef.current = applyDocument;
  getWorkDirRef.current = getWorkDir;
  getCurrentFilePathRef.current = getCurrentFilePath;
  getFileTreeRef.current = getFileTree;
  onFileWrittenRef.current = onFileWritten;

  const historyRef = useRef<ChatMessage[]>([]);
  const activeRunRef = useRef<PersistedAgentRun | undefined>(undefined);
  const runningRef = useRef(false);
  const pendingEditsRef = useRef(new Map<string, string>());
  const alwaysAllowRef = useRef(new Set<string>());
  const pendingPermissionsRef = useRef(new Map<number, string>());
  const itemsRef = useRef<AgentItem[]>([]);
  itemsRef.current = items;
  const scopeRef = useRef(sessionKey);
  const loadedRef = useRef(false);
  const editRevisionRef = useRef(0);

  // Restore the conversation for the current project, persisting the one we leave.
  useEffect(() => {
    const previousScope = scopeRef.current;
    scopeRef.current = sessionKey;

    if (previousScope !== sessionKey) {
      void saveAgentSession(previousScope, {
        items: itemsRef.current,
        history: [...historyRef.current],
        ...(activeRunRef.current ? { activeRun: activeRunRef.current } : {}),
      });
    }

    const revision = editRevisionRef.current;
    let active = true;
    void loadAgentSession(sessionKey).then((restored) => {
      if (!active) return;
      loadedRef.current = true;
      // A turn started while loading; keep the user's fresh message instead of clobbering it.
      if (editRevisionRef.current !== revision) return;
      const session = restored ?? { items: [], history: [] };
      historyRef.current = session.history;
      activeRunRef.current = session.activeRun;
      if (
        activeRunRef.current &&
        ['running', 'waiting_approval'].includes(activeRunRef.current.status)
      ) {
        activeRunRef.current = {
          ...activeRunRef.current,
          status: 'interrupted',
          terminalReason: 'Application closed before the run completed.',
          updatedAt: Date.now(),
        };
        historyRef.current = repairInterruptedHistory(session.history);
        session.items = repairInterruptedItems(session.items);
        void saveAgentSession(sessionKey, {
          items: session.items,
          history: [...historyRef.current],
          activeRun: activeRunRef.current,
        });
      }
      pendingEditsRef.current = rebuildPendingEdits(session.items);
      setItems(session.items);
      setError(null);
    });

    return () => {
      active = false;
    };
  }, [sessionKey]);

  // Persist the conversation whenever it changes (debounced).
  useEffect(() => {
    if (!loadedRef.current) return;
    const timeout = window.setTimeout(() => {
      void saveAgentSession(scopeRef.current, {
        items,
        history: [...historyRef.current],
        ...(activeRunRef.current ? { activeRun: activeRunRef.current } : {}),
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [items, checkpointRevision]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || runningRef.current) return;
    runningRef.current = true;
    const runId = nextId('run');
    const startedAt = Date.now();
    activeRunRef.current = {
      id: runId,
      goal: trimmed,
      status: 'running',
      stepCount: 0,
      retryCount: 0,
      plan: [],
      startedAt,
      updatedAt: startedAt,
    };
    editRevisionRef.current += 1;
    setError(null);
    setStatus('running');
    const initialDocument = getDocumentRef.current();

    historyRef.current = repairInterruptedHistory(historyRef.current);
    historyRef.current.push({ role: 'user', content: trimmed });
    const userItem: AgentItem = { id: nextId('user'), role: 'user', content: trimmed };
    const assistantId = nextId('assistant');
    const planItemId = nextId('plan');
    const assistantItem: AgentItem = { id: assistantId, role: 'assistant', content: '' };
    setItems((current) => [...current, userItem, assistantItem]);

    const toolItemIdByCallId = new Map<string, string>();

    const onEvent = (event: AgentEvent) => {
      switch (event.type) {
        case 'text_delta':
          setItems((current) =>
            current.map((item) =>
              item.id === assistantId && item.role === 'assistant'
                ? { ...item, content: item.content + event.text }
                : item,
            ),
          );
          break;
        case 'assistant_message':
          historyRef.current.push({
            role: 'assistant',
            content: event.content,
            tool_calls: event.tool_calls.length ? event.tool_calls : undefined,
          });
          break;
        case 'tool_call_start': {
          if (activeRunRef.current) {
            activeRunRef.current = {
              ...activeRunRef.current,
              status: 'running',
              stepCount: activeRunRef.current.stepCount + 1,
              pendingApprovalId: undefined,
              updatedAt: Date.now(),
            };
          }
          const callId = event.id || nextId('call');
          if (event.name === 'update_plan') break;
          const toolId = nextId('tool');
          toolItemIdByCallId.set(callId, toolId);
          setItems((current) => [
            ...current,
            {
              id: toolId,
              role: 'tool',
              name: event.name,
              ...(event.arguments ? { arguments: event.arguments } : {}),
            },
          ]);
          break;
        }
        case 'tool_call_end': {
          const toolId = toolItemIdByCallId.get(event.id);
          historyRef.current.push({
            role: 'tool',
            tool_call_id: event.id,
            content: event.result,
          });
          setItems((current) =>
            current.map((item) =>
              item.id === toolId && item.role === 'tool' ? { ...item, result: event.result } : item,
            ),
          );
          break;
        }
        case 'tool_call_error': {
          if (activeRunRef.current) {
            activeRunRef.current = {
              ...activeRunRef.current,
              retryCount: activeRunRef.current.retryCount + 1,
              updatedAt: Date.now(),
            };
          }
          const toolId = toolItemIdByCallId.get(event.id);
          historyRef.current.push({
            role: 'tool',
            tool_call_id: event.id,
            content: `Error: ${event.error}`,
          });
          setItems((current) =>
            current.map((item) =>
              item.id === toolId && item.role === 'tool' ? { ...item, error: event.error } : item,
            ),
          );
          break;
        }
        case 'permission_request': {
          if (activeRunRef.current) {
            activeRunRef.current = {
              ...activeRunRef.current,
              status: 'waiting_approval',
              pendingApprovalId: event.id,
              updatedAt: Date.now(),
            };
          }
          const permissionId = nextId('permission');
          if (alwaysAllowRef.current.has(event.name)) {
            void resolveAgentPermission(event.id, true);
            setItems((current) => [
              ...current,
              {
                id: permissionId,
                role: 'permission',
                requestId: event.id,
                name: event.name,
                arguments: event.arguments,
                pending: false,
                decision: 'allow',
              },
            ]);
          } else {
            pendingPermissionsRef.current.set(event.id, event.name);
            setItems((current) => [
              ...current,
              {
                id: permissionId,
                role: 'permission',
                requestId: event.id,
                name: event.name,
                arguments: event.arguments,
                pending: true,
              },
            ]);
          }
          break;
        }
        case 'edit': {
          const before = getDocumentRef.current();
          const summary = summarizeDiff(before, event.content);
          const hasVersionConflict = before !== initialDocument;
          const autoApply = getSettingsRef.current().autoApply !== false && !hasVersionConflict;
          if (autoApply) applyDocumentRef.current(event.content);
          if (hasVersionConflict) {
            setError(
              'The document changed while the agent was running. Review the edit before applying it.',
            );
          }
          const editId = nextId('edit');
          pendingEditsRef.current.set(editId, event.content);
          setItems((current) => [
            ...current,
            {
              id: editId,
              role: 'edit',
              summary,
              diff: diffLines(before, event.content),
              content: event.content,
              applied: autoApply,
            },
          ]);
          break;
        }
        case 'file_written':
          onFileWrittenRef.current?.(event.path);
          break;
        case 'plan_updated':
          if (activeRunRef.current) {
            activeRunRef.current = {
              ...activeRunRef.current,
              plan: event.steps,
              updatedAt: Date.now(),
            };
          }
          setItems((current) => {
            const existing = current.findIndex((item) => item.id === planItemId);
            if (existing === -1) {
              return [...current, { id: planItemId, role: 'plan', steps: event.steps }];
            }
            return current.map((item, index) =>
              index === existing && item.role === 'plan' ? { ...item, steps: event.steps } : item,
            );
          });
          setCheckpointRevision((current) => current + 1);
          break;
        case 'done':
          if (activeRunRef.current) {
            activeRunRef.current = {
              ...activeRunRef.current,
              status: 'completed',
              pendingApprovalId: undefined,
              updatedAt: Date.now(),
            };
          }
          break;
      }
    };

    try {
      await runAgentTurn({
        runId,
        settings: getSettingsRef.current(),
        document: initialDocument,
        messages: [...historyRef.current],
        workDir: getWorkDirRef.current(),
        currentFilePath: getCurrentFilePathRef.current(),
        fileTree: getFileTreeRef.current(),
        confirmWrites: getSettingsRef.current().confirmWrites !== false,
        onEvent,
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (!isCancellation(message)) {
        if (activeRunRef.current) {
          activeRunRef.current = {
            ...activeRunRef.current,
            status: 'failed',
            terminalReason: message,
            pendingApprovalId: undefined,
            updatedAt: Date.now(),
          };
        }
        setError(message);
      } else if (activeRunRef.current) {
        activeRunRef.current = {
          ...activeRunRef.current,
          status: 'cancelled',
          terminalReason: 'Cancelled by user.',
          pendingApprovalId: undefined,
          updatedAt: Date.now(),
        };
      }
    } finally {
      runningRef.current = false;
      setStatus('idle');
      setCheckpointRevision((current) => current + 1);
    }
  }, []);

  const stop = useCallback(() => {
    if (!runningRef.current) return;
    for (const requestId of pendingPermissionsRef.current.keys()) {
      void resolveAgentPermission(requestId, false);
    }
    pendingPermissionsRef.current.clear();
    const runId = activeRunRef.current?.id;
    if (runId) void cancelAgentTurn(runId);
  }, []);

  const resume = useCallback(async () => {
    const interrupted = activeRunRef.current;
    if (!interrupted || interrupted.status !== 'interrupted' || runningRef.current) return;
    await send(`Continue the interrupted task. Original goal: ${interrupted.goal}`);
  }, [send]);

  const clear = useCallback(() => {
    if (runningRef.current) return;
    historyRef.current = [];
    activeRunRef.current = undefined;
    pendingEditsRef.current.clear();
    setItems([]);
    setError(null);
  }, []);

  const applyEdit = useCallback((id: string) => {
    const content = pendingEditsRef.current.get(id);
    if (content === undefined) return;
    applyDocumentRef.current(content);
    pendingEditsRef.current.delete(id);
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.role === 'edit' ? { ...item, applied: true } : item,
      ),
    );
  }, []);

  const respondPermission = useCallback((requestId: number, allow: boolean, remember = false) => {
    const name = pendingPermissionsRef.current.get(requestId);
    if (name === undefined) return;
    pendingPermissionsRef.current.delete(requestId);
    if (remember && allow) {
      alwaysAllowRef.current.add(name);
    }
    void resolveAgentPermission(requestId, allow);
    if (activeRunRef.current) {
      activeRunRef.current = {
        ...activeRunRef.current,
        status: 'running',
        pendingApprovalId: undefined,
        updatedAt: Date.now(),
      };
    }
    setItems((current) =>
      current.map((item) =>
        item.role === 'permission' && item.requestId === requestId
          ? { ...item, pending: false, decision: allow ? 'allow' : 'deny' }
          : item,
      ),
    );
  }, []);

  return {
    items,
    status,
    error,
    activeRun: activeRunRef.current,
    send,
    resume,
    stop,
    clear,
    applyEdit,
    respondPermission,
  };
}
