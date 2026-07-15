import { describe, expect, it, vi } from 'vitest';
import type { editor as Monaco } from 'monaco-editor';

import { setTaskListItemChecked, setTaskListItemCheckedInEditor } from './taskList';

describe('setTaskListItemChecked', () => {
  it('updates only the requested task marker and preserves CRLF line endings', () => {
    const content = '- [ ] First\r\n  * [X] Nested\r\n1) [x] Ordered\r\n- [ ] Last';

    expect(setTaskListItemChecked(content, 2, false)).toBe(
      '- [ ] First\r\n  * [ ] Nested\r\n1) [x] Ordered\r\n- [ ] Last',
    );
    expect(setTaskListItemChecked(content, 3, true)).toBe(
      '- [ ] First\r\n  * [X] Nested\r\n1) [x] Ordered\r\n- [ ] Last',
    );
  });

  it('does not modify a non-task line or an invalid source line', () => {
    const content = '- [ ] Task\n- Plain list item';

    expect(setTaskListItemChecked(content, 2, true)).toBe(content);
    expect(setTaskListItemChecked(content, 3, true)).toBe(content);
    expect(setTaskListItemChecked(content, 0, true)).toBe(content);
  });

  it('updates only the checkbox state character through an undo-aware editor edit', () => {
    const model = {
      getLineContent: vi.fn(() => '- [ ] Second'),
    };
    const editor = {
      getModel: vi.fn(() => model),
      pushUndoStop: vi.fn(),
      executeEdits: vi.fn(),
    };

    const updated = setTaskListItemCheckedInEditor(
      editor as unknown as Monaco.IStandaloneCodeEditor,
      2,
      true,
    );

    expect(updated).toBe(true);
    expect(model.getLineContent).toHaveBeenCalledWith(2);
    expect(editor.pushUndoStop).toHaveBeenCalledTimes(2);
    expect(editor.executeEdits).toHaveBeenCalledWith('preview-task-toggle', [
      {
        range: {
          startLineNumber: 2,
          startColumn: 4,
          endLineNumber: 2,
          endColumn: 5,
        },
        text: 'x',
        forceMoveMarkers: true,
      },
    ]);
  });
});
