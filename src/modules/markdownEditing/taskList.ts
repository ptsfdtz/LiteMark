import type { MarkdownEditor } from './applyMarkdownTransform';

const taskListMarker = /^(\s*(?:[-+*]|\d+[.)])\s+\[)([ xX])(\])/;

interface TaskListItemMarker {
  stateOffset: number;
  checked: boolean;
}

const getTaskListItemMarker = (line: string): TaskListItemMarker | null => {
  const match = line.match(taskListMarker);
  const markerPrefix = match?.[1];
  const state = match?.[2];
  if (!markerPrefix || !state) return null;

  return {
    stateOffset: markerPrefix.length,
    checked: state.toLowerCase() === 'x',
  };
};

export function setTaskListItemChecked(
  content: string,
  sourceLine: number,
  checked: boolean,
): string {
  if (!Number.isInteger(sourceLine) || sourceLine < 1) return content;

  let lineStart = 0;
  for (let currentLine = 1; currentLine < sourceLine; currentLine += 1) {
    const lineBreak = content.indexOf('\n', lineStart);
    if (lineBreak === -1) return content;
    lineStart = lineBreak + 1;
  }

  const lineEnd = content.indexOf('\n', lineStart);
  const targetLine = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
  const marker = getTaskListItemMarker(targetLine);

  if (!marker || marker.checked === checked) return content;

  const stateOffset = lineStart + marker.stateOffset;
  return `${content.slice(0, stateOffset)}${checked ? 'x' : ' '}${content.slice(stateOffset + 1)}`;
}

export function setTaskListItemCheckedInEditor(
  target: MarkdownEditor,
  sourceLine: number,
  checked: boolean,
): boolean {
  const model = target.getModel();
  if (!model || !Number.isInteger(sourceLine) || sourceLine < 1) return false;

  const marker = getTaskListItemMarker(model.getLineContent(sourceLine));
  if (!marker || marker.checked === checked) return false;

  const startColumn = marker.stateOffset + 1;
  target.pushUndoStop();
  target.executeEdits('preview-task-toggle', [
    {
      range: {
        startLineNumber: sourceLine,
        startColumn,
        endLineNumber: sourceLine,
        endColumn: startColumn + 1,
      },
      text: checked ? 'x' : ' ',
      forceMoveMarkers: true,
    },
  ]);
  target.pushUndoStop();
  return true;
}
