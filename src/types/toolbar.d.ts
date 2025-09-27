import { EditorSelection } from "./editor";

export interface ToolbarProps {
  value: string;
  setValue: (newValue: string) => void;
  selectionStart: number;
  selectionEnd: number;
}