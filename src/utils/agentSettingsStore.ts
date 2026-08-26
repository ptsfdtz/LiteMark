import { Store } from '@tauri-apps/plugin-store';
import {
  DEFAULT_AGENT_PROFILE,
  DEFAULT_AGENT_SETTINGS,
  type AgentProfile,
  type AgentSettings,
} from '@/types/agent';

const KEY = 'agentSettings';

async function getStore(): Promise<Store> {
  return await Store.load('user-settings.json');
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function loadAgentSettings(): Promise<AgentSettings> {
  try {
    const store = await getStore();
    const value = await store.get<Record<string, unknown>>(KEY);
    return parseAgentSettings(value);
  } catch {
    return DEFAULT_AGENT_SETTINGS;
  }
}

export function parseAgentSettings(
  value: Record<string, unknown> | null | undefined,
): AgentSettings {
  if (!value) return DEFAULT_AGENT_SETTINGS;
  const profiles = parseProfiles(value);
  const activeProfileId = asString(value.activeProfileId, profiles[0].id);
  return {
    panelVisible: value.panelVisible === true,
    enabled: value.enabled === true,
    profiles,
    activeProfileId: profiles.some((profile) => profile.id === activeProfileId)
      ? activeProfileId
      : profiles[0].id,
    instructions: asString(value.instructions, ''),
    maxSteps: asNumber(value.maxSteps, DEFAULT_AGENT_SETTINGS.maxSteps),
    autoApply: value.autoApply === undefined ? true : value.autoApply === true,
    confirmWrites: value.confirmWrites === undefined ? true : value.confirmWrites === true,
  };
}

function parseProfiles(value: Record<string, unknown>): AgentProfile[] {
  if (Array.isArray(value.profiles)) {
    const ids = new Set<string>();
    const profiles = value.profiles.flatMap((candidate): AgentProfile[] => {
      if (!candidate || typeof candidate !== 'object') return [];
      const profile = candidate as Record<string, unknown>;
      const id = asString(profile.id, '').trim();
      if (!id || ids.has(id)) return [];
      ids.add(id);
      return [
        {
          id,
          name: asString(profile.name, '').trim() || asString(profile.model, '').trim() || 'Model',
          endpoint: asString(profile.endpoint, ''),
          model: asString(profile.model, ''),
          apiKey: asString(profile.apiKey, ''),
        },
      ];
    });
    if (profiles.length) return profiles;
  }

  // Migrate the original single-provider settings without losing credentials.
  return [
    {
      ...DEFAULT_AGENT_PROFILE,
      endpoint: asString(value.endpoint, DEFAULT_AGENT_PROFILE.endpoint),
      model: asString(value.model, DEFAULT_AGENT_PROFILE.model),
      apiKey: asString(value.apiKey, ''),
    },
  ];
}

export async function saveAgentSettings(settings: AgentSettings): Promise<void> {
  const store = await getStore();
  await store.set(KEY, settings);
  await store.save();
}
