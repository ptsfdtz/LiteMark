import type { RefObject } from 'react';
import type { MarkdownEditor } from '@/types/editor';

export interface ToolbarProps {
  onOpenFolder?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  className?: string;
  editorRef: RefObject<MarkdownEditor | null>;
  disabled?: boolean;
}
