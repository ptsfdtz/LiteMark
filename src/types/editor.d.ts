export interface EditorProps {
  value: string;
  onChange: (newValue: string) => void;
}

export interface EditorSelection {
  start: number;
  end: number;
}
