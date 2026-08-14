import type { Editor } from '@tiptap/core';
export type { MarkdownEditor } from '@/modules/markdownEditing/applyMarkdownTransform';

export interface EditorProps {
  value: string;
  onChange: (newValue: string) => void;
  filePath?: string | null;
  className?: string;
  theme?: 'light' | 'dark' | 'system';
  readOnly?: boolean;
  onSave?: () => void;
  onSaveAs?: () => void;
}

export type WysiwygEditor = Editor;
