export interface PreviewProps {
  content: string;
  scrollSyncEnabled?: boolean;
  onScrollSyncToggle?: () => void;
  previewMode?: boolean;
  onExitPreviewMode?: () => void;
  onEnterPreviewMode?: () => void;
  onEnterEditorMode?: () => void;
  onExitEditorMode?: () => void;
  isPreviewOnly?: boolean;
}
