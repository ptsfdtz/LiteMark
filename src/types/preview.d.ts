export interface PreviewProps {
  content: string;
  filePath?: string | null;
  scrollSyncEnabled?: boolean;
  onScrollSyncToggle?: () => void;
  onTaskToggle?: (sourceLine: number, checked: boolean) => void;
  onExitPreviewMode?: () => void;
  onEnterPreviewMode?: () => void;
  onEnterEditorMode?: () => void;
  isPreviewOnly?: boolean;
}
