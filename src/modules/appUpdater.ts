import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';

export interface AppUpdate {
  version: string;
  notes?: string;
  downloadAndInstall(onEvent: (event: DownloadEvent) => void): Promise<void>;
  close(): Promise<void>;
}

export async function checkForAppUpdate(): Promise<AppUpdate | null> {
  if (!isTauri()) return null;
  const update: Update | null = await check({ timeout: 15_000 });
  if (!update) return null;

  return {
    version: update.version,
    notes: update.body,
    downloadAndInstall: (onEvent) => update.downloadAndInstall(onEvent),
    close: () => update.close(),
  };
}

export async function restartAfterUpdate(): Promise<void> {
  await relaunch();
}
