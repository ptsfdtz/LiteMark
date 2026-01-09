import { Store } from '@tauri-apps/plugin-store';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'theme';

async function getStore(): Promise<Store> {
  return await Store.load('user-settings.json');
}

export async function loadTheme(): Promise<ThemeMode | null> {
  try {
    const store = await getStore();
    const val = (await store.get(KEY)) as string | null;
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveTheme(theme: ThemeMode): Promise<void> {
  const store = await getStore();
  await store.set(KEY, theme);
  await store.save();
}
