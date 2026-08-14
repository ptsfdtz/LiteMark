import type { WysiwygEditor } from '@/types/editor';

export interface OpenMenuItem {
  path: string;
  name: string;
}

export interface ToolbarProps {
  onOpenFolder?: () => void;
  onOpenDocument?: () => void;
  recentFolders?: OpenMenuItem[];
  recentFiles?: OpenMenuItem[];
  onOpenRecentFolder?: (path: string) => void;
  onOpenRecentDocument?: (path: string) => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  className?: string;
  editor: WysiwygEditor | null;
  disabled?: boolean;
}
