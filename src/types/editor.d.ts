import type { MarkdownEditor } from '@/modules/markdownEditing/applyMarkdownTransform';
import type { AgentSettings } from './agent';

export interface EditorProps {
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'system';
  minimapEnabled?: boolean;
  agentSettings: AgentSettings;
  readOnly?: boolean;
  onSave?: () => void;
  onSaveAs?: () => void;
}

export type { MarkdownEditor };
