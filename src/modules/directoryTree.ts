import { invoke } from '@tauri-apps/api/core';
import type { DirectoryEntries, FileTreeNode } from '@/types/fileTree';

export async function listDirectoryTree(directory: string): Promise<FileTreeNode[]> {
  return invoke<FileTreeNode[]>('list_directory_tree', { dirPath: directory });
}

export async function listDirectoryEntries(directory: string): Promise<DirectoryEntries> {
  const result = await invoke<DirectoryEntries>('list_directory_entries', { dirPath: directory });
  return {
    ...result,
    entries: result.entries.map((entry) => ({
      ...entry,
      children_loaded: !entry.is_directory,
    })),
  };
}

export async function deleteWorkspaceFile(path: string): Promise<void> {
  return invoke<void>('delete_file', { path });
}

export async function deleteWorkspaceDirectory(path: string): Promise<void> {
  return invoke<void>('delete_directory', { path });
}
