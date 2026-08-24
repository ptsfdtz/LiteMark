import { Store } from '@tauri-apps/plugin-store';

const KEY = 'workspaceDirectories';
const LEGACY_KEY = 'workspaceDirectory';
const EXPLORER_VISIBLE_KEY = 'explorerVisible';

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

export async function loadExplorerVisible(): Promise<boolean> {
  try {
    const store = await getStore();
    return (await store.get<unknown>(EXPLORER_VISIBLE_KEY)) === true;
  } catch {
    return false;
  }
}

export async function saveExplorerVisible(visible: boolean): Promise<void> {
  const store = await getStore();
  await store.set(EXPLORER_VISIBLE_KEY, visible);
  await store.save();
}
