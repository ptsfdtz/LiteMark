import type { WysiwygEditor } from '@/types/editor';

export interface ToolbarProps {
  onOpenFolder?: () => void;
  onOpenDocument?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onExportImage?: () => void;
  onExportPdf?: () => void;
  className?: string;
  editor: WysiwygEditor | null;
  disabled?: boolean;
}
