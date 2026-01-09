import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RecentFile } from '@/types/recentFiles';
import { loadRecentFiles, saveRecentFiles } from '@/utils/recentStore';
import { save as saveDialog, message } from '@tauri-apps/plugin-dialog';
import { useI18n } from '@/locales/useI18n';

/**
 * Hook: useFileManager
 * 管理 recentFiles 列表以及打开/保存/删除等文件操作。
 *
 * 参数：
 * - markdown, setMarkdown: 当前编辑器内容和 setter
 * - currentFilePath, setCurrentFilePath: 当前文件路径及 setter（Layout 中管理）
 * - setShowRecentFiles?: 可选，用于在打开/选择后关闭侧边栏
 * - setForceEditFileName?: 可选，用于在新建后触发重命名
 */
export function useFileManager(opts: {
  markdown: string;
  setMarkdown: (s: string) => void;
  currentFilePath: string | null;
  setCurrentFilePath: (p: string | null) => void;
  setShowRecentFiles?: (v: boolean) => void;
  setForceEditFileName?: (v: boolean) => void;
  onSaveSuccess?: () => void;
}) {
  const {
    markdown,
    setMarkdown,
    currentFilePath,
    setCurrentFilePath,
    setShowRecentFiles,
    // setForceEditFileName,
  } = opts;
  const { t } = useI18n();

  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  // 启动时从存储加载最近文件并尝试打开最新的一个（若没有当前文件）
  useEffect(() => {
    (async () => {
      try {
        const persisted = await loadRecentFiles();
        const restored: RecentFile[] = persisted.map((f) => ({
          id: f.id,
          name: f.name,
          path: f.path,
          modified: new Date(f.modified),
        }));
        setRecentFiles(restored);
        let openedStartup = false;
        try {
          const startupPath = await invoke<string | null>('get_startup_file');
          if (startupPath) {
            const content = await invoke<string>('read_text_file', { path: startupPath });
            handleLoadFile(startupPath, content);
            openedStartup = true;
          }
        } catch (err) {
          console.error('自动打开启动文件失败:', err);
          await message(t('dialog.startupFileMissing'), { title: t('dialog.error') });
        }

        if (!openedStartup && restored.length > 0 && !currentFilePath) {
          try {
            const content = await invoke<string>('read_text_file', {
              path: restored[0].path,
            });
            setMarkdown(content);
            setCurrentFilePath(restored[0].path);
          } catch (err) {
            console.error('自动打开最近文件失败:', err);
          }
        }
      } catch (err) {
        console.error('加载最近文件失败:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 持久化 recentFiles
  useEffect(() => {
    (async () => {
      try {
        const toStore = recentFiles.map((f) => ({
          id: f.id,
          name: f.name,
          path: f.path,
          modified: f.modified.toISOString(),
        }));
        await saveRecentFiles(toStore);
      } catch (err) {
        console.error('保存最近文件到存储失败:', err);
      }
    })();
  }, [recentFiles]);

  const handleSelectFile = (file: RecentFile) => {
    (async () => {
      try {
        const content = await invoke<string>('read_text_file', {
          path: file.path,
        });
        setMarkdown(content);
        if (setShowRecentFiles) {
          setShowRecentFiles(false);
        }
        setCurrentFilePath(file.path);
        setRecentFiles((prev) => {
          const withoutDup = prev.filter((f) => f.path !== file.path && f.id !== file.path);
          const bumped: RecentFile = {
            id: file.path,
            name: file.name,
            path: file.path,
            modified: new Date(),
          };
          return [bumped, ...withoutDup].slice(0, 50);
        });
      } catch (err) {
        console.error('读取文件失败:', err);
        setRecentFiles((prev) => prev.filter((f) => f.path !== file.path && f.id !== file.path));
        await message(t('dialog.fileMissing'), { title: t('dialog.error') });
      }
    })();
  };

  const handleLoadFile = (path: string, content: string) => {
    setMarkdown(content);
    setCurrentFilePath(path);
    const name = path.split(/[/\\]/).pop() || path;
    const newItem: RecentFile = {
      id: path,
      name,
      path,
      modified: new Date(),
    };
    setRecentFiles((prev) => {
      const withoutDup = prev.filter((f) => f.path !== path && f.id !== path);
      return [newItem, ...withoutDup].slice(0, 50);
    });
  };

  const handleDeleteRecentFile = async (id: string) => {
    const file = recentFiles.find((f) => f.id === id);
    if (!file) return;
    try {
      await invoke('delete_file', { path: file.path });
      setRecentFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('删除文件失败:', err);
      await message(t('dialog.deleteFailed'), {
        title: t('dialog.error'),
      });
    }
  };

  const handleSave = async () => {
    try {
      let path = currentFilePath;
      if (!path) {
        const selected = await saveDialog({
          filters: [
            { name: t('dialog.markdown'), extensions: ['md', 'markdown', 'txt'] },
            { name: t('dialog.allFiles'), extensions: ['*'] },
          ],
          defaultPath: 'note.md',
        });
        if (!selected) return;
        path = selected as string;
        setCurrentFilePath(path);
      }
      await invoke('write_text_file', { path, content: markdown });
      const name = path.split(/[/\\]/).pop() || path;
      const item: RecentFile = {
        id: path,
        name,
        path,
        modified: new Date(),
      };
      setRecentFiles((prev) => {
        const withoutDup = prev.filter((f) => f.path !== path && f.id !== path);
        const next = [item, ...withoutDup].slice(0, 50);
        return next;
      });
      // call optional success callback
      if (opts.onSaveSuccess) {
        opts.onSaveSuccess();
      }
    } catch (err) {
      console.error('保存失败:', err);
    }
  };

  const handleSaveAs = async () => {
    try {
      const selected = await saveDialog({
        filters: [
          { name: t('dialog.markdown'), extensions: ['md', 'markdown', 'txt'] },
          { name: t('dialog.allFiles'), extensions: ['*'] },
        ],
        defaultPath: (currentFilePath && currentFilePath.split(/[/\\]/).pop()) || 'note.md',
      });
      if (!selected) return;
      const path = selected as string;
      await invoke('write_text_file', { path, content: markdown });
      setCurrentFilePath(path);
      const name = path.split(/[/\\]/).pop() || path;
      const item: RecentFile = {
        id: path,
        name,
        path,
        modified: new Date(),
      };
      setRecentFiles((prev) => {
        const withoutDup = prev.filter((f) => f.path !== path && f.id !== path);
        return [item, ...withoutDup].slice(0, 50);
      });
      // call optional success callback
      if (opts.onSaveSuccess) {
        opts.onSaveSuccess();
      }
    } catch (err) {
      console.error('另存为失败:', err);
    }
  };

  const handleOpenFolder = () => {
    if (setShowRecentFiles) setShowRecentFiles(true);
  };

  return {
    recentFiles,
    setRecentFiles,
    handleSelectFile,
    handleLoadFile,
    handleDeleteRecentFile,
    handleSave,
    handleSaveAs,
    handleOpenFolder,
  } as const;
}

export default useFileManager;
