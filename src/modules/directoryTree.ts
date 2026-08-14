import { invoke } from '@tauri-apps/api/core';
import type { FileTreeNode } from '@/types/fileTree';

export async function listDirectoryTree(directory: string): Promise<FileTreeNode[]> {
  return invoke<FileTreeNode[]>('list_directory_tree', { dirPath: directory });
}

export async function deleteWorkspaceFile(path: string): Promise<void> {
  return invoke<void>('delete_file', { path });
}
