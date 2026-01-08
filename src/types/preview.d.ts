export interface PreviewProps {
  content: string;
  filePath?: string | null;
  scrollSyncEnabled?: boolean;
  onScrollSyncToggle?: () => void;
  previewMode?: boolean;
  onExitPreviewMode?: () => void;
  onEnterPreviewMode?: () => void;
  onEnterEditorMode?: () => void;
  onExitEditorMode?: () => void;
  isPreviewOnly?: boolean;
}
