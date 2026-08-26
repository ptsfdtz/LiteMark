export interface AgentProfile {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface AgentSettings {
  panelVisible: boolean;
  enabled: boolean;
  profiles: AgentProfile[];
  activeProfileId: string;
  instructions: string;
  maxSteps: number;
  autoApply: boolean;
  confirmWrites: boolean;
}

export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  id: 'default',
  name: 'OpenAI',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  apiKey: '',
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  panelVisible: false,
  enabled: false,
  profiles: [DEFAULT_AGENT_PROFILE],
  activeProfileId: DEFAULT_AGENT_PROFILE.id,
  instructions: '',
  maxSteps: 8,
  autoApply: true,
  confirmWrites: true,
};

export function getActiveAgentProfile(settings: AgentSettings): AgentProfile {
  return (
    settings.profiles.find((profile) => profile.id === settings.activeProfileId) ??
    settings.profiles[0] ??
    DEFAULT_AGENT_PROFILE
  );
}
