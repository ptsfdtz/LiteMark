import type { editor } from 'monaco-editor';

export type MarkdownTransform = (text: string, start: number, end: number) => string;
export type MarkdownEditor = editor.IStandaloneCodeEditor;

export function applyMarkdownTransform(
  target: MarkdownEditor,
  transform: MarkdownTransform,
  source: string,
): boolean {
  const model = target.getModel();
  const selection = target.getSelection();
  if (!model || !selection) return false;

  const start = model.getOffsetAt(selection.getStartPosition());
  const end = model.getOffsetAt(selection.getEndPosition());
  const nextText = transform(model.getValue(), start, end);
  target.executeEdits(source, [
    {
      range: model.getFullModelRange(),
      text: nextText,
      forceMoveMarkers: true,
    },
  ]);
  return true;
}
