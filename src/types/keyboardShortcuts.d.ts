export interface KeyboardShortcutsProps {
  value: string;
  setValue: (newValue: string) => void;
  selectionStart: number;
  selectionEnd: number;
  onSave?: () => void;
  onSaveAs?: () => void;
}