export interface EditorProps {
  value: string;
  onChange: (newValue: string) => void;
  onSelectionChange?: (start: number, end: number) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'system';
  onSave?: () => void;
  onSaveAs?: () => void;
}
