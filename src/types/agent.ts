export interface AgentSettings {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey: string;
  instructions: string;
  maxSteps: number;
  autoApply: boolean;
  confirmWrites: boolean;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: false,
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  apiKey: '',
  instructions: '',
  maxSteps: 8,
  autoApply: true,
  confirmWrites: true,
};
