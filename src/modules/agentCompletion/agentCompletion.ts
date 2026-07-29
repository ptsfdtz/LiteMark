import { invoke } from '@tauri-apps/api/core';
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import type { AgentSettings } from '@/types/agent';

const PREFIX_LIMIT = 6000;
const SUFFIX_LIMIT = 1500;
const COMPLETION_LIMIT = 2000;
const DEFAULT_DELAY_MS = 650;

export interface CompletionContext {
  prefix: string;
  suffix: string;
}

function takeLast(value: string, limit: number): string {
  const characters = Array.from(value);
  return characters.length <= limit ? value : characters.slice(-limit).join('');
}

function takeFirst(value: string, limit: number): string {
  const characters = Array.from(value);
  return characters.length <= limit ? value : characters.slice(0, limit).join('');
}

export function buildCompletionContext(document: string, offset: number): CompletionContext {
  return {
    prefix: takeLast(document.slice(0, offset), PREFIX_LIMIT),
    suffix: takeFirst(document.slice(offset), SUFFIX_LIMIT),
  };
}

function removeSuffixOverlap(completion: string, suffix: string): string {
  const overlapLimit = Math.min(completion.length, suffix.length);
  for (let length = overlapLimit; length > 0; length -= 1) {
    if (completion.endsWith(suffix.slice(0, length))) {
      return completion.slice(0, -length);
    }
  }
  return completion;
}

export function sanitizeCompletion(
  rawCompletion: string,
  { prefix, suffix }: CompletionContext,
): string {
  let completion = rawCompletion.replace(/\r\n?/g, '\n');
  const fenced = completion.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n?```\s*$/i);
  if (fenced) completion = fenced[1];
  if (completion.startsWith(prefix)) completion = completion.slice(prefix.length);
  completion = removeSuffixOverlap(completion, suffix);
  return takeFirst(completion, COMPLETION_LIMIT);
}

export async function requestAgentCompletion(
  settings: AgentSettings,
  context: CompletionContext,
): Promise<string> {
  return await invoke<string>('request_agent_completion', {
    endpoint: settings.endpoint.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    prefix: context.prefix,
    suffix: context.suffix,
  });
}

function isConfigured(settings: AgentSettings): boolean {
  return (
    settings.enabled &&
    settings.endpoint.trim().length > 0 &&
    settings.model.trim().length > 0 &&
    settings.apiKey.trim().length > 0
  );
}

export function registerAgentCompletionProvider(
  monaco: typeof Monaco,
  getSettings: () => AgentSettings,
  delayMs = DEFAULT_DELAY_MS,
): Monaco.IDisposable {
  return monaco.languages.registerInlineCompletionsProvider('markdown', {
    debounceDelayMs: delayMs,
    async provideInlineCompletions(model, position, _context, token) {
      const settings = getSettings();
      if (!isConfigured(settings)) {
        return { items: [] };
      }

      const offset = model.getOffsetAt(position);
      const completionContext = buildCompletionContext(model.getValue(), offset);
      if (completionContext.prefix.trim().length < 8 || token.isCancellationRequested) {
        return { items: [] };
      }

      try {
        const rawCompletion = await requestAgentCompletion(settings, completionContext);
        if (token.isCancellationRequested) return { items: [] };

        const insertText = sanitizeCompletion(rawCompletion, completionContext);
        if (!insertText) return { items: [] };

        return {
          enableForwardStability: true,
          items: [
            {
              insertText,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column,
              ),
            },
          ],
        };
      } catch (error) {
        console.warn('AI inline completion failed:', error);
        return { items: [] };
      }
    },
    disposeInlineCompletions() {},
  });
}
