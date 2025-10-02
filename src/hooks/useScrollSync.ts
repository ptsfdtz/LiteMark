export class ScrollSync {
  syncEditorToPreview(editor: HTMLElement, preview: HTMLElement): void {
    const editorScrollTop = editor.scrollTop;
    const editorScrollHeight = editor.scrollHeight - editor.clientHeight;
    const previewScrollHeight = preview.scrollHeight - preview.clientHeight;

    if (editorScrollHeight === 0) return;

    const ratio = editorScrollTop / editorScrollHeight;
    preview.scrollTop = ratio * previewScrollHeight;
  }

  syncPreviewToEditor(editor: HTMLElement, preview: HTMLElement): void {
    const previewScrollTop = preview.scrollTop;
    const previewScrollHeight = preview.scrollHeight - preview.clientHeight;
    const editorScrollHeight = editor.scrollHeight - editor.clientHeight;

    if (previewScrollHeight === 0) return;

    const ratio = previewScrollTop / previewScrollHeight;
    editor.scrollTop = ratio * editorScrollHeight;
  }
}