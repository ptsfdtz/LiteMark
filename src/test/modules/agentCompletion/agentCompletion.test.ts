import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AGENT_SETTINGS } from '@/types/agent';
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

import {
  buildCompletionContext,
  registerAgentCompletionProvider,
  requestAgentCompletion,
  sanitizeCompletion,
} from '@/modules/agentCompletion/agentCompletion';

function createProvider(): Monaco.languages.InlineCompletionsProvider {
  let provider: Monaco.languages.InlineCompletionsProvider | undefined;
  const monaco = {
    languages: {
      registerInlineCompletionsProvider: (
        _language: string,
        registered: Monaco.languages.InlineCompletionsProvider,
      ) => {
        provider = registered;
        return { dispose: vi.fn() };
      },
    },
    Range: class {
      constructor(
        readonly startLineNumber: number,
        readonly startColumn: number,
        readonly endLineNumber: number,
        readonly endColumn: number,
      ) {}
    },
  } as unknown as typeof Monaco;
  registerAgentCompletionProvider(
    monaco,
    () => ({ ...DEFAULT_AGENT_SETTINGS, enabled: true, apiKey: 'secret' }),
    0,
  );
  if (!provider) throw new Error('Inline completion provider was not registered');
  return provider;
}

function activeToken(): Monaco.CancellationToken {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: vi.fn() }),
  } as unknown as Monaco.CancellationToken;
}

function controllableToken(): { token: Monaco.CancellationToken; cancel: () => void } {
  const listeners = new Set<() => void>();
  const token = {
    isCancellationRequested: false,
    onCancellationRequested: (listener: () => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  } as unknown as Monaco.CancellationToken;

  return {
    token,
    cancel: () => {
      (token as { isCancellationRequested: boolean }).isCancellationRequested = true;
      listeners.forEach((listener) => listener());
    },
  };
}

const model = {
  getOffsetAt: () => 18,
  getValue: () => 'Existing paragraph',
} as unknown as Monaco.editor.ITextModel;
const position = { lineNumber: 1, column: 19 } as Monaco.Position;
const inlineContext = { triggerKind: 0 } as Monaco.languages.InlineCompletionContext;

describe('agent completion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps bounded context around the cursor', () => {
    const document = `${'a'.repeat(6100)}CURSOR${'b'.repeat(1600)}`;
    const offset = document.indexOf('CURSOR') + 'CURSOR'.length;

    const context = buildCompletionContext(document, offset);

    expect(Array.from(context.prefix)).toHaveLength(6000);
    expect(context.prefix.endsWith('CURSOR')).toBe(true);
    expect(Array.from(context.suffix)).toHaveLength(1500);
  });

  it('removes response wrappers and overlap with existing text', () => {
    expect(
      sanitizeCompletion('```markdown\n world again\n```', {
        prefix: 'Hello',
        suffix: ' again tomorrow',
      }),
    ).toBe(' world');
  });

  it('does not resend an echoed prefix', () => {
    expect(
      sanitizeCompletion('Existing paragraph continued.', {
        prefix: 'Existing paragraph',
        suffix: '',
      }),
    ).toBe(' continued.');
  });

  it('invokes the Tauri request command with trimmed credentials', async () => {
    mocks.invoke.mockResolvedValue('completion');
    const settings = {
      ...DEFAULT_AGENT_SETTINGS,
      enabled: true,
      apiKey: '  secret  ',
      endpoint: '  https://example.com/v1/chat/completions  ',
      model: '  example-model  ',
    };

    await expect(
      requestAgentCompletion(settings, { prefix: 'before', suffix: 'after' }),
    ).resolves.toBe('completion');
    expect(mocks.invoke).toHaveBeenCalledWith('request_agent_completion', {
      endpoint: 'https://example.com/v1/chat/completions',
      apiKey: 'secret',
      model: 'example-model',
      prefix: 'before',
      suffix: 'after',
    });
  });

  it('provides an inline insertion at the current cursor', async () => {
    mocks.invoke.mockResolvedValue(' continued');
    const provider = createProvider();

    const result = await provider.provideInlineCompletions(
      model,
      position,
      inlineContext,
      activeToken(),
    );

    expect(result).toEqual(
      expect.objectContaining({
        enableForwardStability: true,
        items: [
          expect.objectContaining({
            insertText: ' continued',
            range: expect.objectContaining({
              startLineNumber: 1,
              startColumn: 19,
              endLineNumber: 1,
              endColumn: 19,
            }),
          }),
        ],
      }),
    );
  });

  it('does not block the latest completion behind an obsolete request', async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    const firstResponse = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    mocks.invoke.mockImplementationOnce(() => firstResponse).mockResolvedValueOnce(' second');
    const provider = createProvider();
    const firstToken = controllableToken();

    const first = provider.provideInlineCompletions(
      model,
      position,
      inlineContext,
      firstToken.token,
    );
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    firstToken.cancel();
    const second = provider.provideInlineCompletions(model, position, inlineContext, activeToken());

    try {
      await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
      await expect(second).resolves.toEqual(
        expect.objectContaining({
          items: [expect.objectContaining({ insertText: ' second' })],
        }),
      );
    } finally {
      resolveFirst(' first');
      await first;
    }
  });
});
