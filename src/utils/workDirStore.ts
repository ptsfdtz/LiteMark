import { Store } from "@tauri-apps/plugin-store";

const KEY = "workDir";

async function getStore(): Promise<Store> {
  return await Store.load("user-settings.json");
}

export async function loadWorkDir(): Promise<string> {
  try {
    const store = await getStore();
    const val = (await store.get(KEY)) as string | null;
    return typeof val === "string" ? val : "";
  } catch {
    return "";
  }
}

export async function saveWorkDir(dir: string): Promise<void> {
  const store = await getStore();
  await store.set(KEY, dir);
  await store.save();
}
