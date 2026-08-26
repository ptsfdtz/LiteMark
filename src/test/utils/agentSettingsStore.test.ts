import { describe, expect, it } from 'vitest';
import { getActiveAgentProfile } from '@/types/agent';
import { parseAgentSettings } from '@/utils/agentSettingsStore';

describe('agent settings profiles', () => {
  it('migrates the legacy single-model settings', () => {
    const settings = parseAgentSettings({
      enabled: true,
      endpoint: 'https://legacy.example/v1/chat/completions',
      model: 'legacy-model',
      apiKey: 'legacy-key',
    });

    expect(settings.profiles).toHaveLength(1);
    expect(getActiveAgentProfile(settings)).toMatchObject({
      endpoint: 'https://legacy.example/v1/chat/completions',
      model: 'legacy-model',
      apiKey: 'legacy-key',
    });
  });

  it('restores multiple profiles and the selected model', () => {
    const settings = parseAgentSettings({
      profiles: [
        {
          id: 'openai',
          name: 'OpenAI',
          endpoint: 'https://a.example',
          model: 'model-a',
          apiKey: 'a',
        },
        {
          id: 'local',
          name: 'Local',
          endpoint: 'http://localhost:11434/v1/chat/completions',
          model: 'model-b',
          apiKey: 'b',
        },
      ],
      activeProfileId: 'local',
    });

    expect(settings.profiles).toHaveLength(2);
    expect(getActiveAgentProfile(settings).model).toBe('model-b');
  });
});
