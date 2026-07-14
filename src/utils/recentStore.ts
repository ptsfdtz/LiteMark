import { Store } from '@tauri-apps/plugin-store';

export interface PersistedRecentFile {
  name: string;
  path: string;
  modified: string; // ISO string
}

const KEY = 'recentFiles';

async function getStore(): Promise<Store> {
  return await Store.load('recent-files.json');
}

export async function loadRecentFiles(): Promise<PersistedRecentFile[]> {
  try {
    const store = await getStore();
    const val = (await store.get(KEY)) as (PersistedRecentFile & { id?: string })[] | null;
    const arr = Array.isArray(val) ? val : [];
    const migrated = arr.map((f) => ({
      name: f.name,
      path: f.path,
      modified: f.modified,
    }));
    if (JSON.stringify(migrated) !== JSON.stringify(arr)) {
      await store.set(KEY, migrated);
      await store.save();
    }
    return migrated;
  } catch {
    return [];
  }
}

export async function saveRecentFiles(files: PersistedRecentFile[]): Promise<void> {
  const store = await getStore();
  await store.set(KEY, files);
  await store.save();
}
