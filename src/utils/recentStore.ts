import { Store } from "@tauri-apps/plugin-store";

export interface PersistedRecentFile {
  id: string;
  name: string;
  path: string;
  modified: string; // ISO string
}

const KEY = "recentFiles";

async function getStore(): Promise<Store> {
  return await Store.load("recent-files.json");
}

export async function loadRecentFiles(): Promise<PersistedRecentFile[]> {
  try {
    const store = await getStore();
    const val = (await store.get(KEY)) as PersistedRecentFile[] | null;
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

export async function saveRecentFiles(files: PersistedRecentFile[]): Promise<void> {
  const store = await getStore();
  await store.set(KEY, files);
  await store.save();
}


