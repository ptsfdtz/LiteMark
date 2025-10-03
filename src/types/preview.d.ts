export interface PreviewProps {
  content: string;
 previewMode?: boolean;
 onExitPreviewMode?: () => void;
 onEnterPreviewMode?: () => void;
 isPreviewOnly?: boolean;
}