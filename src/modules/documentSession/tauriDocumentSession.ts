import { invoke } from '@tauri-apps/api/core';
import type {
  DocumentReference,
  DocumentStorage,
  RecentDocumentsStore,
} from './useDocumentSession';
import { loadRecentFiles, saveRecentFiles } from '@/utils/recentStore';

interface ListedDocument {
  path: string;
  name: string;
  modified_ms: number;
}

export const tauriDocumentStorage: DocumentStorage = {
  getStartupDocument: () => invoke<string | null>('get_startup_file'),
  read: (path) => invoke<string>('read_text_file', { path }),
  write: (path, content) => invoke<void>('write_text_file', { path, content }),
  createUntitled: (workDirectory, content) =>
    invoke<string>('create_untitled_file', { dirPath: workDirectory, content }),
  rename: (path, newName) => invoke<string>('rename_document', { path, newName }),
  list: async (directory) => {
    const documents = await invoke<ListedDocument[]>('list_text_files', {
      dirPath: directory,
    });
    return documents.map(
      (document): DocumentReference => ({
        name: document.name,
        path: document.path,
        modified: new Date(document.modified_ms),
      }),
    );
  },
};

export const tauriRecentDocuments: RecentDocumentsStore = {
  load: async () => {
    const documents = await loadRecentFiles();
    return documents.map((document) => ({
      ...document,
      modified: new Date(document.modified),
    }));
  },
  save: (documents) =>
    saveRecentFiles(
      documents.map((document) => ({
        ...document,
        modified: document.modified.toISOString(),
      })),
    ),
};
