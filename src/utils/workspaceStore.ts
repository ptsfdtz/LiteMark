import { Store } from '@tauri-apps/plugin-store';

const KEY = 'workspaceDirectories';
const LEGACY_KEY = 'workspaceDirectory';

async function getStore(): Promise<Store> {
  return Store.load('user-settings.json');
}

export async function loadWorkspaceDirectories(): Promise<string[]> {
  try {
    const store = await getStore();
    const directories = await store.get<unknown>(KEY);
    if (Array.isArray(directories)) {
      return directories.filter(
        (directory): directory is string => typeof directory === 'string' && directory.length > 0,
      );
    }

    const legacyDirectory = await store.get<string>(LEGACY_KEY);
    return legacyDirectory ? [legacyDirectory] : [];
  } catch {
    return [];
  }
}

export async function saveWorkspaceDirectories(directories: string[]): Promise<void> {
  const store = await getStore();
  await store.set(KEY, directories);
  await store.delete(LEGACY_KEY);
  await store.save();
}
