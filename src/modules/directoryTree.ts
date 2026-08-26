import { invoke } from '@tauri-apps/api/core';
import type { DirectoryEntries, FileTreeNode } from '@/types/fileTree';

function normalizePath(path: string): string {
  return path
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLocaleLowerCase();
}

export function mergeDirectoryEntries(
  existing: FileTreeNode[],
  incoming: FileTreeNode[],
): FileTreeNode[] {
  const existingByPath = new Map(existing.map((node) => [normalizePath(node.path), node]));
  return incoming.map((node) => {
    const previous = existingByPath.get(normalizePath(node.path));
    if (!node.is_directory || !previous?.is_directory || !previous.children_loaded) return node;
    return {
      ...node,
      children: previous.children,
      children_loaded: true,
      ...(previous.truncated !== undefined ? { truncated: previous.truncated } : {}),
    };
  });
}

export function replaceDirectoryChildren(
  nodes: FileTreeNode[],
  directory: string,
  children: FileTreeNode[],
  truncated: boolean,
): FileTreeNode[] {
  return nodes.map((node) => {
    if (normalizePath(node.path) === normalizePath(directory)) {
      return {
        ...node,
        children: mergeDirectoryEntries(node.children, children),
        children_loaded: true,
        truncated,
      };
    }
    if (node.children.length === 0) return node;
    return {
      ...node,
      children: replaceDirectoryChildren(node.children, directory, children, truncated),
    };
  });
}

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

export async function createWorkspaceDirectory(parentPath: string, name: string): Promise<string> {
  return invoke<string>('create_untitled_directory', { parentPath, name });
}

export async function renameWorkspaceDirectory(path: string, newName: string): Promise<string> {
  return invoke<string>('rename_directory', { path, newName });
}
