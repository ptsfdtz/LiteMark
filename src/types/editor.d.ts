import type { MarkdownEditor } from '@/modules/markdownEditing/applyMarkdownTransform';

export interface EditorProps {
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'system';
  minimapEnabled?: boolean;
  readOnly?: boolean;
  onSave?: () => void;
  onSaveAs?: () => void;
}

export type { MarkdownEditor };
