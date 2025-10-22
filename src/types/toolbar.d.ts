import { EditorSelection } from "./editor";

export interface ToolbarProps {
value: string;
  setValue: (newValue: string) => void;
  selectionStart: number;
  selectionEnd: number;
  onOpenFolder?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  className?: string;
  editorRef?: React.RefObject<HTMLTextAreaElement | null>;
}