import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';

export async function getImagePreviewSource(path: string): Promise<string> {
  if (!isTauri()) return path;
  const allowedPath = await invoke<string>('prepare_image_preview', { path });
  return convertFileSrc(allowedPath);
}
