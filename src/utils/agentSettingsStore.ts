import { Store } from '@tauri-apps/plugin-store';
import { DEFAULT_AGENT_SETTINGS, type AgentSettings } from '@/types/agent';

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
    if (!value) return DEFAULT_AGENT_SETTINGS;

    return {
      panelVisible: value.panelVisible === true,
      enabled: value.enabled === true,
      endpoint: asString(value.endpoint, DEFAULT_AGENT_SETTINGS.endpoint),
      model: asString(value.model, DEFAULT_AGENT_SETTINGS.model),
      apiKey: asString(value.apiKey, ''),
      instructions: asString(value.instructions, ''),
      maxSteps: asNumber(value.maxSteps, DEFAULT_AGENT_SETTINGS.maxSteps),
      autoApply: value.autoApply === undefined ? true : value.autoApply === true,
      confirmWrites: value.confirmWrites === undefined ? true : value.confirmWrites === true,
    };
  } catch {
    return DEFAULT_AGENT_SETTINGS;
  }
}

export async function saveAgentSettings(settings: AgentSettings): Promise<void> {
  const store = await getStore();
  await store.set(KEY, settings);
  await store.save();
}
