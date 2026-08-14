import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AGENT_SETTINGS, type AgentSettings } from '@/types/agent';
import type { PersistedSession } from './agentSessionStore';
import type { AgentEvent } from './types';
import { useAgentSession } from './useAgentSession';

const mocks = vi.hoisted(() => ({
  runAgentTurn: vi.fn(),
  cancelAgentTurn: vi.fn(),
  resolveAgentPermission: vi.fn(),
  loadAgentSession: vi.fn<(documentPath: string | null) => Promise<PersistedSession | null>>(
    async () => null,
  ),
  saveAgentSession: vi.fn<
    (documentPath: string | null, session: PersistedSession) => Promise<void>
  >(async () => undefined),
}));

vi.mock('./agentClient', () => ({
  runAgentTurn: mocks.runAgentTurn,
  cancelAgentTurn: mocks.cancelAgentTurn,
  resolveAgentPermission: mocks.resolveAgentPermission,
}));

vi.mock('./agentSessionStore', () => ({
  loadAgentSession: mocks.loadAgentSession,
  saveAgentSession: mocks.saveAgentSession,
}));

function configuredSettings(overrides: Partial<AgentSettings> = {}): AgentSettings {
  return { ...DEFAULT_AGENT_SETTINGS, enabled: true, apiKey: 'secret', ...overrides };
}

interface RunAgentTurnArgs {
  settings: AgentSettings;
  document: string;
  messages: unknown[];
  workDir: string;
  currentFilePath: string | null;
  fileTree: string | null;
  confirmWrites: boolean;
  onEvent: (event: AgentEvent) => void;
}

function setup(settings: AgentSettings = configuredSettings()) {
  const getSettings = vi.fn(() => settings);
  const getDocument = vi.fn(() => '# Hello\n\nWorld');
  const applyDocument = vi.fn();
  const getWorkDir = vi.fn(() => 'C:\\notes');
  const getCurrentFilePath = vi.fn(() => 'C:\\notes\\doc.md');
  const getFileTree = vi.fn(() => 'doc.md\nassets/\n  logo.png');
  const onFileWritten = vi.fn();
  const { result } = renderHook(() =>
    useAgentSession({
      getSettings,
      getDocument,
      applyDocument,
      getWorkDir,
      sessionKey: 'C:\\notes',
      getCurrentFilePath,
      getFileTree,
      onFileWritten,
    }),
  );
  return { result, getSettings, getDocument, applyDocument, getWorkDir, onFileWritten };
}

function emit(mock: ReturnType<typeof vi.fn>, events: AgentEvent[]) {
  mock.mockImplementationOnce(async ({ onEvent }: RunAgentTurnArgs) => {
    for (const event of events) onEvent(event);
  });
}

describe('Agent Session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAgentSession.mockResolvedValue(null);
  });

  it('sends a user turn and streams the assistant reply', async () => {
    const { result, getDocument } = setup();
    emit(mocks.runAgentTurn, [
      { type: 'text_delta', text: 'Hello ' },
      { type: 'text_delta', text: 'there' },
      { type: 'done' },
    ]);

    await act(async () => {
      await result.current.send('summarize');
    });

    expect(mocks.runAgentTurn).toHaveBeenCalledTimes(1);
    const args = mocks.runAgentTurn.mock.calls[0][0] as RunAgentTurnArgs;
    expect(args.document).toBe('# Hello\n\nWorld');
    expect(args.workDir).toBe('C:\\notes');
    expect(args.currentFilePath).toBe('C:\\notes\\doc.md');
    expect(args.fileTree).toBe('doc.md\nassets/\n  logo.png');
    expect(args.confirmWrites).toBe(true);
    expect(args.messages).toEqual([{ role: 'user', content: 'summarize' }]);
    expect(getDocument).toHaveBeenCalled();

    const assistant = result.current.items.find((item) => item.role === 'assistant');
    expect(assistant?.content).toBe('Hello there');
    expect(result.current.status).toBe('idle');
  });

  it('records tool calls with their results', async () => {
    const { result } = setup();
    emit(mocks.runAgentTurn, [
      { type: 'tool_call_start', id: '1', name: 'read_document' },
      { type: 'tool_call_end', id: '1', name: 'read_document', result: '# Hello' },
      { type: 'tool_call_start', id: '2', name: 'rewrite_document' },
      { type: 'tool_call_error', id: '2', name: 'rewrite_document', error: 'bad args' },
      { type: 'done' },
    ]);

    await act(async () => {
      await result.current.send('rewrite it');
    });

    const tools = result.current.items.filter((item) => item.role === 'tool');
    expect(tools).toHaveLength(2);
    expect(tools[0]).toMatchObject({ name: 'read_document', result: '# Hello' });
    expect(tools[1]).toMatchObject({ name: 'rewrite_document', error: 'bad args' });
  });

  it('reconstructs tool calls and tool results into the history', async () => {
    const { result } = setup();
    emit(mocks.runAgentTurn, [
      {
        type: 'assistant_message',
        content: '',
        tool_calls: [
          { id: '1', type: 'function', function: { name: 'read_document', arguments: '{}' } },
        ],
      },
      { type: 'tool_call_start', id: '1', name: 'read_document' },
      { type: 'tool_call_end', id: '1', name: 'read_document', result: '# Hello' },
      { type: 'assistant_message', content: 'done', tool_calls: [] },
      { type: 'done' },
    ]);

    await act(async () => {
      await result.current.send('go');
    });

    emit(mocks.runAgentTurn, [{ type: 'done' }]);
    await act(async () => {
      await result.current.send('next');
    });

    const args = mocks.runAgentTurn.mock.calls[1][0] as RunAgentTurnArgs;
    expect(args.messages).toEqual([
      { role: 'user', content: 'go' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          { id: '1', type: 'function', function: { name: 'read_document', arguments: '{}' } },
        ],
      },
      { role: 'tool', tool_call_id: '1', content: '# Hello' },
      { role: 'assistant', content: 'done' },
      { role: 'user', content: 'next' },
    ]);
  });

  it('prompts for write tools and resolves via respondPermission', async () => {
    const { result } = setup();
    emit(mocks.runAgentTurn, [
      { type: 'permission_request', id: 7, name: 'rewrite_document', arguments: '{"content":"x"}' },
    ]);

    await act(async () => {
      await result.current.send('rewrite it');
    });

    const pending = result.current.items.find((item) => item.role === 'permission');
    expect(pending).toMatchObject({ requestId: 7, pending: true });

    await act(async () => {
      result.current.respondPermission(7, true);
    });

    expect(mocks.resolveAgentPermission).toHaveBeenCalledWith(7, true);
    const resolved = result.current.items.find((item) => item.role === 'permission');
    expect(resolved).toMatchObject({ pending: false, decision: 'allow' });
  });

  it('auto-approves tools marked as always allow', async () => {
    const { result } = setup();
    emit(mocks.runAgentTurn, [
      { type: 'permission_request', id: 1, name: 'replace_in_document', arguments: '{}' },
    ]);

    await act(async () => {
      await result.current.send('do it');
    });
    await act(async () => {
      result.current.respondPermission(1, true, true);
    });

    emit(mocks.runAgentTurn, [
      { type: 'permission_request', id: 2, name: 'replace_in_document', arguments: '{}' },
    ]);
    await act(async () => {
      await result.current.send('again');
    });

    expect(mocks.resolveAgentPermission).toHaveBeenCalledWith(2, true);
    const permissions = result.current.items.filter((item) => item.role === 'permission');
    expect(permissions[1]).toMatchObject({ pending: false, decision: 'allow' });
  });

  it('applies edits automatically and shows an applied summary', async () => {
    const { result, applyDocument } = setup();
    emit(mocks.runAgentTurn, [{ type: 'edit', content: '# Hi\n\nNew text' }, { type: 'done' }]);

    await act(async () => {
      await result.current.send('rewrite it');
    });

    expect(applyDocument).toHaveBeenCalledWith('# Hi\n\nNew text');
    const edit = result.current.items.find((item) => item.role === 'edit');
    expect(edit).toMatchObject({ applied: true });
  });

  it('defers edits when autoApply is disabled and applies them on demand', async () => {
    const { result, applyDocument } = setup(configuredSettings({ autoApply: false }));
    emit(mocks.runAgentTurn, [{ type: 'edit', content: '# New' }, { type: 'done' }]);

    await act(async () => {
      await result.current.send('rewrite it');
    });

    expect(applyDocument).not.toHaveBeenCalled();
    const edit = result.current.items.find((item) => item.role === 'edit');
    expect(edit).toMatchObject({ applied: false });

    await act(async () => {
      result.current.applyEdit(edit!.id);
    });

    expect(applyDocument).toHaveBeenCalledWith('# New');
    const applied = result.current.items.find((item) => item.role === 'edit');
    expect(applied).toMatchObject({ applied: true });
  });

  it('surfaces request errors without dropping the streamed text', async () => {
    const { result } = setup();
    mocks.runAgentTurn.mockImplementationOnce(async ({ onEvent }: RunAgentTurnArgs) => {
      onEvent({ type: 'text_delta', text: 'partial' });
      throw new Error('network down');
    });

    await act(async () => {
      await result.current.send('do it');
    });

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.error).toBe('network down');
    expect(result.current.items.find((item) => item.role === 'assistant')?.content).toBe('partial');
  });

  it('ignores cancellation as an error', async () => {
    const { result } = setup();
    mocks.runAgentTurn.mockRejectedValueOnce('cancelled');

    await act(async () => {
      await result.current.send('do it');
    });

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.error).toBeNull();
  });

  it('stops the running turn', async () => {
    const { result } = setup();
    let resolveTurn!: () => void;
    mocks.runAgentTurn.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveTurn = resolve)),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.send('do it');
    });

    await waitFor(() => expect(result.current.status).toBe('running'));
    await act(async () => {
      result.current.stop();
    });
    expect(mocks.cancelAgentTurn).toHaveBeenCalled();

    await act(async () => {
      resolveTurn();
      await pending;
    });
    expect(result.current.status).toBe('idle');
  });

  it('clears the conversation when idle', async () => {
    const { result } = setup();
    emit(mocks.runAgentTurn, [{ type: 'text_delta', text: 'done' }, { type: 'done' }]);

    await act(async () => {
      await result.current.send('first');
    });
    expect(result.current.items.length).toBeGreaterThan(0);

    await act(async () => {
      result.current.clear();
    });
    expect(result.current.items).toEqual([]);
  });

  it('restores the persisted conversation for the current document', async () => {
    const persisted: PersistedSession = {
      items: [
        { id: 'user-1', role: 'user', content: 'hello' },
        { id: 'assistant-1', role: 'assistant', content: 'hi there' },
      ],
      history: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    };
    mocks.loadAgentSession.mockResolvedValue(persisted);

    const { result } = setup();

    await waitFor(() => expect(result.current.items).toEqual(persisted.items));

    emit(mocks.runAgentTurn, [{ type: 'text_delta', text: 'again' }, { type: 'done' }]);
    await act(async () => {
      await result.current.send('once more');
    });

    expect(mocks.runAgentTurn).toHaveBeenCalledTimes(1);
    const args = mocks.runAgentTurn.mock.calls[0][0] as RunAgentTurnArgs;
    expect(args.messages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'once more' },
    ]);
  });

  it('persists the conversation after it changes', async () => {
    const { result } = setup();
    emit(mocks.runAgentTurn, [{ type: 'text_delta', text: 'ok' }, { type: 'done' }]);

    await act(async () => {
      await result.current.send('save me');
    });

    await waitFor(() => expect(mocks.saveAgentSession).toHaveBeenCalled());
    const lastCall =
      mocks.saveAgentSession.mock.calls[mocks.saveAgentSession.mock.calls.length - 1];
    expect(lastCall[0]).toBe('C:\\notes');
    expect(lastCall[1].items).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'save me' })]),
    );
  });

  it('reloads and persists when the project scope changes', async () => {
    const { result, rerender } = renderHook(
      ({ scope }) =>
        useAgentSession({
          getSettings: () => configuredSettings(),
          getDocument: () => '# Hello\n\nWorld',
          applyDocument: vi.fn(),
          getWorkDir: () => scope ?? '',
          sessionKey: scope,
          getCurrentFilePath: () => null,
          getFileTree: () => null,
        }),
      { initialProps: { scope: 'C:\\notes' as string | null } },
    );

    await waitFor(() => expect(mocks.loadAgentSession).toHaveBeenCalledWith('C:\\notes'));

    rerender({ scope: 'C:\\other-project' });

    await waitFor(() => expect(mocks.loadAgentSession).toHaveBeenCalledWith('C:\\other-project'));
    expect(mocks.saveAgentSession).toHaveBeenCalledWith('C:\\notes', {
      items: [],
      history: [],
    });
    expect(result.current.items).toEqual([]);
  });

  it('notifies when the agent writes a project file', async () => {
    const { result, onFileWritten } = setup();
    emit(mocks.runAgentTurn, [
      { type: 'tool_call_start', id: '1', name: 'write_file' },
      { type: 'tool_call_end', id: '1', name: 'write_file', result: 'File written.' },
      { type: 'file_written', path: 'C:\\notes\\summary.md' },
      { type: 'done' },
    ]);

    await act(async () => {
      await result.current.send('create a summary');
    });

    expect(onFileWritten).toHaveBeenCalledWith('C:\\notes\\summary.md');
  });
});
