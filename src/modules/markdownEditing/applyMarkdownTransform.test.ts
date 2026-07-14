import { describe, expect, it, vi } from 'vitest';
import type { editor as Monaco } from 'monaco-editor';
import { applyBold } from './markdownTransforms';
import { applyMarkdownTransform } from './applyMarkdownTransform';

describe('Markdown Editing', () => {
  it('applies a selection transform through an undo-aware editor edit', () => {
    const range = { marker: 'full-model-range' };
    const model = {
      getOffsetAt: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(5),
      getValue: vi.fn(() => 'hello'),
      getFullModelRange: vi.fn(() => range),
    };
    const editor = {
      getModel: vi.fn(() => model),
      getSelection: vi.fn(() => ({
        getStartPosition: () => ({ lineNumber: 1, column: 1 }),
        getEndPosition: () => ({ lineNumber: 1, column: 6 }),
      })),
      executeEdits: vi.fn(),
    };

    const applied = applyMarkdownTransform(
      editor as unknown as Monaco.IStandaloneCodeEditor,
      applyBold,
      'toolbar',
    );

    expect(applied).toBe(true);
    expect(editor.executeEdits).toHaveBeenCalledWith('toolbar', [
      {
        range,
        text: '**hello**',
        forceMoveMarkers: true,
      },
    ]);
  });
});
