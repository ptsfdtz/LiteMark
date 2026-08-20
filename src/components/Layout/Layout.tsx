// src/components/Layout/Layout.tsx
import React, { useCallback, useState, useEffect, useRef } from 'react';
import Editor from '@/components/Editor/Editor';
import Toolbar from '@/components/Toolbar/Toolbar';
import Settings from '@/components/Settings/Settings';
import SettingsButton from '@/components/SettingsButton/SettingsButton';
import RecentFilesSidebar from '@/components/RecentFilesSidebar/RecentFilesSidebar';
import WindowControls from '@/components/WindowControls/WindowControls';
import styles from './Layout.module.css';
import CurrentFileName from './components/CurrentFileName';
import { loadWorkDir, saveWorkDir } from '@/utils/workDirStore';
import SaveSuccessToast from './components/SaveSuccessToast';
import ExportSurface, { type ExportMode } from './components/ExportSurface';
import {
  exportBaseName,
  renderElementToPdfBytes,
  renderElementToPngBytes,
  writeBinaryFile,
} from '@/modules/exportDocument';
import { useI18n } from '@/locales/useI18n';
import { loadTheme, saveTheme } from '@/utils/themeStore';
import { loadAgentSettings, saveAgentSettings } from '@/utils/agentSettingsStore';
import { DEFAULT_AGENT_SETTINGS, type AgentSettings } from '@/types/agent';
import AgentPanel from '@/components/AgentPanel/AgentPanel';
import FileExplorer, { type FileExplorerRoot } from '@/components/FileExplorer/FileExplorer';
import { useAgentSession } from '@/modules/agent/useAgentSession';
import { useAgentConversations } from '@/modules/agent/useAgentConversations';
import useDocumentSession from '@/modules/documentSession/useDocumentSession';
import {
  tauriDocumentStorage,
  tauriRecentDocuments,
} from '@/modules/documentSession/tauriDocumentSession';
import { ask, message, open, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';
import type { WysiwygEditor } from '@/types/editor';
import { registerWindowCloseGuard } from '@/modules/windowCloseGuard/registerWindowCloseGuard';
import {
  expandWindowForDocumentWidth,
  persistWindowState,
  restoreWindowState,
} from '@/modules/windowState/windowState';
import {
  deleteWorkspaceDirectory,
  deleteWorkspaceFile,
  listDirectoryTree,
} from '@/modules/directoryTree';
import { getFileViewKind, type FileTreeNode } from '@/types/fileTree';
import { loadWorkspaceDirectories, saveWorkspaceDirectories } from '@/utils/workspaceStore';
import OpenTabs from '@/components/OpenTabs/OpenTabs';
import { LuPanelLeftOpen } from 'react-icons/lu';

function normalizePath(path: string): string {
  return path
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLocaleLowerCase();
}

function pathBelongsToDirectory(path: string | null, directory: string): boolean {
  if (!path) return false;
  const normalizedPath = normalizePath(path);
  const normalizedDirectory = normalizePath(directory);
  return (
    normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

const AGENT_FILE_TREE_LINE_LIMIT = 200;

function serializeFileTree(nodes: FileTreeNode[]): string {
  const lines: string[] = [];
  const walk = (items: FileTreeNode[], depth: number) => {
    for (const item of items) {
      if (lines.length >= AGENT_FILE_TREE_LINE_LIMIT) return;
      lines.push(`${'  '.repeat(depth)}${item.name}${item.is_directory ? '/' : ''}`);
      if (item.is_directory) walk(item.children, depth + 1);
    }
  };
  walk(nodes, 0);
  if (lines.length >= AGENT_FILE_TREE_LINE_LIMIT) lines.push('…');
  return lines.join('\n');
}

const Layout: React.FC = () => {
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [themeReady, setThemeReady] = useState(false);
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [recentClosing, setRecentClosing] = useState(false);
  // Document Session owns document content, persistence, and Recent Documents.
  const [workDir, setWorkDirState] = useState('');
  const [workspaceRoots, setWorkspaceRoots] = useState<FileExplorerRoot[]>([]);
  const [explorerVisible, setExplorerVisible] = useState(false);
  // Keep panels mounted while their close animation plays out.
  const [explorerRendered, setExplorerRendered] = useState(false);
  const [agentPanelRendered, setAgentPanelRendered] = useState(false);
  const workspaceRestoredRef = useRef(false);
  const [forceEditFileName, setForceEditFileName] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState<string | undefined>();
  const [exportRequest, setExportRequest] = useState<{ mode: ExportMode } | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(DEFAULT_AGENT_SETTINGS);
  const [agentSettingsReady, setAgentSettingsReady] = useState(false);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [windowStateReady, setWindowStateReady] = useState(false);
  const pendingSessionActivationRef = useRef(false);
  const documentAreaRef = useRef<HTMLDivElement | null>(null);

  // 加载个人工作文件夹
  useEffect(() => {
    (async () => {
      const dir = await loadWorkDir();
      setWorkDirState(dir);
    })();
  }, []);

  useEffect(() => {
    if (explorerVisible) setExplorerRendered(true);
  }, [explorerVisible]);

  useEffect(() => {
    if (agentSettings.panelVisible) setAgentPanelRendered(true);
  }, [agentSettings.panelVisible]);

  useEffect(() => {
    if (!isTauri() || !windowStateReady || (!explorerVisible && !agentSettings.panelVisible)) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const documentWidth = documentAreaRef.current?.getBoundingClientRect().width;
      if (documentWidth === undefined) return;
      void expandWindowForDocumentWidth(getCurrentWindow(), documentWidth, 760).catch((error) =>
        console.error('Failed to expand the window for side panels:', error),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [agentSettings.panelVisible, explorerVisible, windowStateReady]);

  // 启动时加载主题设置
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const storedTheme = await loadTheme();
        if (storedTheme && active) {
          setTheme(storedTheme);
        }
      } finally {
        if (active) setThemeReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 持久化主题设置
  useEffect(() => {
    if (!themeReady) return;
    (async () => {
      try {
        await saveTheme(theme);
      } catch {
        // ignore
      }
    })();
  }, [theme, themeReady]);

  const showDocumentError = useCallback(
    async (error: unknown, fallbackKey: Parameters<typeof t>[0]) => {
      if (!isTauri()) return;
      console.error('Document operation failed:', error);
      await message(t(fallbackKey), { title: t('dialog.error') });
    },
    [t],
  );

  useEffect(() => {
    let active = true;
    void loadAgentSettings().then((settings) => {
      if (!active) return;
      setAgentSettings(settings);
      setAgentSettingsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!agentSettingsReady) return;
    const timeout = window.setTimeout(() => {
      void saveAgentSettings(agentSettings).catch((error) => {
        void showDocumentError(error, 'dialog.settingsSaveFailed');
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [agentSettings, agentSettingsReady, showDocumentError]);

  const setWorkDir = (dir: string) => {
    setWorkDirState(dir);
    void saveWorkDir(dir).catch((error) => {
      void showDocumentError(error, 'dialog.settingsSaveFailed');
    });
  };

  const confirmDiscard = useCallback(
    () =>
      ask(t('dialog.unsavedChanges'), {
        title: t('dialog.unsavedTitle'),
        kind: 'warning',
      }),
    [t],
  );

  const reportRecentDocumentsError = useCallback(
    (error: unknown) => {
      void showDocumentError(error, 'dialog.recentSaveFailed');
    },
    [showDocumentError],
  );

  const reportInitializationError = useCallback(
    (error: unknown) => {
      void showDocumentError(error, 'dialog.startupFileMissing');
    },
    [showDocumentError],
  );

  const documentSession = useDocumentSession({
    storage: tauriDocumentStorage,
    recentDocuments: tauriRecentDocuments,
    confirmDiscard,
    onRecentDocumentsError: reportRecentDocumentsError,
    onInitializationError: reportInitializationError,
  });
  const {
    ready: documentSessionReady,
    content: markdown,
    setContent: setMarkdown,
    currentDocumentPath: currentFilePath,
    isDirty,
    recentDocuments,
    directoryDocuments,
  } = documentSession;

  const rememberTab = useCallback((path: string) => {
    setOpenTabs((current) => (current.includes(path) ? current : [...current, path]));
    setActiveFilePath(path);
  }, []);

  useEffect(() => {
    if (!currentFilePath) return;
    if (pendingSessionActivationRef.current || activeFilePath === null) {
      pendingSessionActivationRef.current = false;
      rememberTab(currentFilePath);
    }
  }, [activeFilePath, currentFilePath, rememberTab]);

  const activeViewKind = activeFilePath ? getFileViewKind(activeFilePath) : 'markdown';
  const activeTextDocument =
    activeFilePath === null
      ? currentFilePath === null
      : activeFilePath === currentFilePath &&
        activeViewKind !== 'image' &&
        activeViewKind !== 'pdf' &&
        activeViewKind !== 'unsupported';

  const agentConfigured = Boolean(
    agentSettings.enabled &&
    agentSettings.endpoint.trim() &&
    agentSettings.model.trim() &&
    agentSettings.apiKey.trim(),
  );
  const activeWorkspaceDirectory =
    workspaceRoots.find((root) => pathBelongsToDirectory(activeFilePath, root.path))?.path ??
    workspaceRoots[0]?.path;
  const recentStandaloneFiles = recentDocuments
    .filter(
      (document) =>
        !workspaceRoots.some((root) => pathBelongsToDirectory(document.path, root.path)),
    )
    .map(({ path, name }) => ({ path, name }));
  const explorerHasItems = workspaceRoots.length > 0 || recentStandaloneFiles.length > 0;

  const agentFileWrittenRef = useRef<(path: string) => void>(() => {});
  const agentScopeKey = activeWorkspaceDirectory || (activeTextDocument ? currentFilePath : null);
  const agentScopeKind = activeWorkspaceDirectory ? 'project' : 'file';
  const agentConversations = useAgentConversations(agentScopeKey);
  const { syncActiveConversation } = agentConversations;
  const agentSession = useAgentSession({
    getSettings: () => agentSettings,
    getDocument: () => (activeTextDocument ? markdown : ''),
    applyDocument: (content) => {
      if (activeTextDocument) setMarkdown(content);
    },
    // Directory tools are only available when the current document belongs to an open project.
    getWorkDir: () => activeWorkspaceDirectory || '',
    sessionKey: agentConversations.activeSessionKey,
    getCurrentFilePath: () => (activeTextDocument ? currentFilePath : null),
    getFileTree: () => {
      if (!activeWorkspaceDirectory) return null;
      const root = workspaceRoots.find(
        (candidate) => normalizePath(candidate.path) === normalizePath(activeWorkspaceDirectory),
      );
      return root ? serializeFileTree(root.nodes) : null;
    },
    onFileWritten: (path) => agentFileWrittenRef.current(path),
  });

  useEffect(() => {
    syncActiveConversation(agentSession.items);
  }, [agentSession.items, syncActiveConversation]);

  const showSaveSuccess = (message?: string) => {
    setSaveToastMessage(message);
    setShowSaveToast(true);
    window.setTimeout(() => setShowSaveToast(false), 3000);
  };

  const handleSave = async () => {
    if (!documentSessionReady || (activeFilePath && !activeTextDocument)) return;
    try {
      let saved: boolean;
      if (currentFilePath) {
        saved = await documentSession.saveDocument();
      } else {
        const selected = await saveDialog({
          filters: [
            { name: t('dialog.markdown'), extensions: ['md', 'markdown', 'txt'] },
            { name: t('dialog.allFiles'), extensions: ['*'] },
          ],
          defaultPath: 'note.md',
        });
        if (!selected) return;
        saved = await documentSession.saveDocumentAs(selected);
      }
      if (saved) showSaveSuccess();
    } catch (error) {
      await showDocumentError(error, 'dialog.saveFailed');
    }
  };

  const handleSaveAs = async () => {
    if (!documentSessionReady || (activeFilePath && !activeTextDocument)) return;
    try {
      const selected = await saveDialog({
        filters: [
          { name: t('dialog.markdown'), extensions: ['md', 'markdown', 'txt'] },
          { name: t('dialog.allFiles'), extensions: ['*'] },
        ],
        defaultPath: currentFilePath?.split(/[/\\]/).pop() || 'note.md',
      });
      if (!selected) return;
      const saved = await documentSession.saveDocumentAs(selected);
      if (saved) {
        if (currentFilePath) {
          setOpenTabs((current) =>
            current.map((path) => (path === currentFilePath ? selected : path)),
          );
        } else {
          setOpenTabs((current) => (current.includes(selected) ? current : [...current, selected]));
        }
        setActiveFilePath(selected);
        showSaveSuccess();
      }
    } catch (error) {
      await showDocumentError(error, 'dialog.saveFailed');
    }
  };

  const handleExportImage = () => {
    if (activeTextDocument) setExportRequest({ mode: 'png' });
  };

  const handleExportPdf = () => {
    if (activeTextDocument) setExportRequest({ mode: 'pdf' });
  };

  const handleExport = async (element: HTMLElement) => {
    if (!exportRequest) return;
    try {
      const selected = await open({ multiple: false, directory: true });
      if (!selected || Array.isArray(selected)) return;
      const extension = exportRequest.mode;
      const data =
        extension === 'pdf'
          ? await renderElementToPdfBytes(element)
          : await renderElementToPngBytes(element);
      const separator = selected.includes('\\') ? '\\' : '/';
      await writeBinaryFile(
        `${selected}${separator}${exportBaseName(currentFilePath)}.${extension}`,
        data,
      );
      showSaveSuccess(
        t('export.completed', { path: `${exportBaseName(currentFilePath)}.${extension}` }),
      );
      setExportRequest(null);
    } catch (error) {
      await showDocumentError(error, 'dialog.exportFailed');
    }
  };

  const handleOpenDocument = async (path: string) => {
    if (!documentSessionReady) return false;
    const viewKind = getFileViewKind(path);
    if (viewKind === 'unsupported') return false;
    if (viewKind === 'image' || viewKind === 'pdf') {
      rememberTab(path);
      return true;
    }
    if (path === currentFilePath) {
      rememberTab(path);
      return true;
    }
    try {
      const opened = await documentSession.openDocument(path);
      if (opened) {
        rememberTab(path);
        setExplorerVisible(true);
      }
      return opened;
    } catch (error) {
      await showDocumentError(error, 'dialog.fileMissing');
      return false;
    }
  };

  const handleCreateDocument = async (directory: string) => {
    if (!documentSessionReady) return false;
    try {
      pendingSessionActivationRef.current = true;
      const created = await documentSession.createDocument(directory, t('recent.newFileContent'));
      if (!created) pendingSessionActivationRef.current = false;
      if (created) setForceEditFileName(true);
      return created;
    } catch (error) {
      await showDocumentError(error, 'dialog.createFailed');
      return false;
    }
  };

  const handleOpenDirectory = async (directory: string) => {
    if (!documentSessionReady) return;
    try {
      const tree = await listDirectoryTree(directory);
      setWorkspaceRoots((current) => {
        const existingIndex = current.findIndex(
          (root) => normalizePath(root.path) === normalizePath(directory),
        );
        const next = [...current];
        if (existingIndex >= 0) next[existingIndex] = { path: directory, nodes: tree };
        else next.push({ path: directory, nodes: tree });
        void saveWorkspaceDirectories(next.map((root) => root.path)).catch((error) => {
          void showDocumentError(error, 'dialog.settingsSaveFailed');
        });
        return next;
      });
      setExplorerVisible(true);
      setRecentClosing(true);
    } catch (error) {
      await showDocumentError(error, 'dialog.openFolderFailed');
    }
  };

  const refreshWorkspaceTree = useCallback(
    async (directory: string) => {
      try {
        const tree = await listDirectoryTree(directory);
        setWorkspaceRoots((current) =>
          current.map((root) =>
            normalizePath(root.path) === normalizePath(directory) ? { ...root, nodes: tree } : root,
          ),
        );
      } catch (error) {
        await showDocumentError(error, 'dialog.openFolderFailed');
      }
    },
    [showDocumentError],
  );

  const refreshAllWorkspaceTrees = async () => {
    await Promise.all(workspaceRoots.map((root) => refreshWorkspaceTree(root.path)));
  };

  // The agent wrote a project file to disk: surface it to the user.
  agentFileWrittenRef.current = (path: string) => {
    void (async () => {
      const root = workspaceRoots.find((candidate) => pathBelongsToDirectory(path, candidate.path));
      if (root) await refreshWorkspaceTree(root.path);
      if (path === currentFilePath) {
        // Reload the buffer so the editor reflects the agent's write.
        if (!isDirty) await documentSession.openDocument(path);
        return;
      }
      await handleOpenDocument(path);
    })();
  };

  const removeWorkspaceDirectory = (directory: string) => {
    setWorkspaceRoots((current) => {
      const next = current.filter((root) => normalizePath(root.path) !== normalizePath(directory));
      void saveWorkspaceDirectories(next.map((root) => root.path)).catch((error) => {
        void showDocumentError(error, 'dialog.settingsSaveFailed');
      });
      return next;
    });
  };

  const reorderWorkspaceDirectory = (
    sourcePath: string,
    targetPath: string,
    position: 'before' | 'after',
  ) => {
    setWorkspaceRoots((current) => {
      const sourceIndex = current.findIndex(
        (root) => normalizePath(root.path) === normalizePath(sourcePath),
      );
      if (sourceIndex < 0 || normalizePath(sourcePath) === normalizePath(targetPath))
        return current;

      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      const targetIndex = next.findIndex(
        (root) => normalizePath(root.path) === normalizePath(targetPath),
      );
      if (!source || targetIndex < 0) return current;

      next.splice(targetIndex + (position === 'after' ? 1 : 0), 0, source);
      void saveWorkspaceDirectories(next.map((root) => root.path)).catch((error) => {
        void showDocumentError(error, 'dialog.settingsSaveFailed');
      });
      return next;
    });
  };

  const chooseDocument = async () => {
    if (!documentSessionReady) return false;
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: t('dialog.markdown'), extensions: ['md', 'markdown', 'txt'] },
          { name: t('dialog.pdf'), extensions: ['pdf'] },
          { name: t('dialog.allFiles'), extensions: ['*'] },
        ],
      });
      if (!selected || Array.isArray(selected)) return false;
      return await handleOpenDocument(selected);
    } catch (error) {
      await showDocumentError(error, 'dialog.fileMissing');
      return false;
    }
  };

  const chooseDirectory = async () => {
    if (!documentSessionReady) return;
    try {
      const selected = await open({ multiple: false, directory: true });
      if (!selected || Array.isArray(selected)) return;
      await handleOpenDirectory(selected);
    } catch (error) {
      await showDocumentError(error, 'dialog.openFolderFailed');
    }
  };

  const createDocument = async () => {
    if (!documentSessionReady) return false;
    try {
      let directory = activeWorkspaceDirectory || workDir;
      if (!directory) {
        const selected = await open({ multiple: false, directory: true });
        if (!selected || Array.isArray(selected)) return false;
        directory = selected;
      }
      const created = await handleCreateDocument(directory);
      if (
        created &&
        workspaceRoots.some((root) => normalizePath(root.path) === normalizePath(directory))
      ) {
        await refreshWorkspaceTree(directory);
      }
      return created;
    } catch (error) {
      await showDocumentError(error, 'dialog.createFailed');
      return false;
    }
  };

  const editorRef = useRef<WysiwygEditor | null>(null);
  const [editorInstance, setEditorInstance] = useState<WysiwygEditor | null>(null);
  const markdownDocument = !activeFilePath || activeViewKind === 'markdown';
  const canCloseRef = useRef(documentSession.canClose);
  canCloseRef.current = documentSession.canClose;

  const attachEditor = useCallback((instance: WysiwygEditor | null) => {
    editorRef.current = instance;
    setEditorInstance(instance);
  }, []);

  const handleActivateTab = async (path: string) => {
    if (path === activeFilePath) return;
    const previousPath = activeFilePath;
    setActiveFilePath(path);
    const opened = await handleOpenDocument(path);
    if (!opened) {
      setActiveFilePath((current) => (current === path ? previousPath : current));
    }
  };

  const handleCloseTab = async (path: string) => {
    if (path === currentFilePath && isDirty) {
      if (!(await confirmDiscard())) return;
      documentSession.discardChanges();
    }

    const closingIndex = openTabs.indexOf(path);
    const nextTabs = openTabs.filter((tabPath) => tabPath !== path);
    setOpenTabs(nextTabs);
    if (activeFilePath !== path) return;

    const nextPath = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
    setActiveFilePath(null);
    if (nextPath) await handleActivateTab(nextPath);
    else if (path === currentFilePath) documentSession.closeDocument();
  };

  const handleCloseTabs = async (pathsToClose: string[]) => {
    const tabsToClose = openTabs.filter((path) => pathsToClose.includes(path));
    if (tabsToClose.length === 0) return;

    const closesCurrentDocument = currentFilePath !== null && tabsToClose.includes(currentFilePath);
    if (closesCurrentDocument && isDirty) {
      if (!(await confirmDiscard())) return;
      documentSession.discardChanges();
    }

    const closingIndex = activeFilePath ? openTabs.indexOf(activeFilePath) : -1;
    const closesActiveTab = activeFilePath !== null && tabsToClose.includes(activeFilePath);
    const nextTabs = openTabs.filter((path) => !tabsToClose.includes(path));
    setOpenTabs(nextTabs);

    if (!closesActiveTab) return;

    const nextPath = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
    setActiveFilePath(null);
    if (nextPath) await handleActivateTab(nextPath);
    else if (closesCurrentDocument) documentSession.closeDocument();
  };

  const handleCloseAllTabs = () => handleCloseTabs(openTabs);

  const handleCloseOtherTabs = (path: string) =>
    handleCloseTabs(openTabs.filter((tabPath) => tabPath !== path));

  const handleDeleteWorkspaceFile = async (path: string) => {
    const deletingCurrentDocument = path === currentFilePath;
    if (deletingCurrentDocument && isDirty && !(await confirmDiscard())) return false;

    try {
      await deleteWorkspaceFile(path);
      void documentSession.removeRecentDocument(path).catch((error) => {
        void showDocumentError(error, 'dialog.recentSaveFailed');
      });

      const closingIndex = openTabs.indexOf(path);
      const nextTabs = openTabs.filter((tabPath) => tabPath !== path);
      setOpenTabs(nextTabs);
      if (deletingCurrentDocument) documentSession.closeDocument();

      if (activeFilePath === path) {
        const nextPath = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
        setActiveFilePath(null);
        if (nextPath) await handleActivateTab(nextPath);
      }

      const root = workspaceRoots.find((candidate) => pathBelongsToDirectory(path, candidate.path));
      if (root) await refreshWorkspaceTree(root.path);
      return true;
    } catch (error) {
      await showDocumentError(error, 'dialog.fileMissing');
      return false;
    }
  };

  const handleCreateWorkspaceFile = async (directory: string) => {
    const created = await handleCreateDocument(directory);
    if (!created) return false;
    const root = workspaceRoots.find((candidate) =>
      pathBelongsToDirectory(directory, candidate.path),
    );
    if (root) await refreshWorkspaceTree(root.path);
    return true;
  };

  const handleDeleteWorkspaceDirectory = async (directory: string) => {
    const deletingCurrentDocument = pathBelongsToDirectory(currentFilePath, directory);
    if (deletingCurrentDocument && isDirty && !(await confirmDiscard())) return false;

    try {
      const closingIndex = activeFilePath
        ? openTabs.findIndex((path) => pathBelongsToDirectory(path, directory))
        : -1;
      const nextTabs = openTabs.filter((path) => !pathBelongsToDirectory(path, directory));
      await deleteWorkspaceDirectory(directory);

      void Promise.all(
        recentDocuments
          .filter((document) => pathBelongsToDirectory(document.path, directory))
          .map((document) => documentSession.removeRecentDocument(document.path)),
      ).catch((error) => {
        void showDocumentError(error, 'dialog.recentSaveFailed');
      });
      setOpenTabs(nextTabs);
      if (deletingCurrentDocument) documentSession.closeDocument();

      if (activeFilePath && pathBelongsToDirectory(activeFilePath, directory)) {
        const nextPath = nextTabs[Math.max(0, closingIndex)] ?? null;
        setActiveFilePath(null);
        if (nextPath) await handleActivateTab(nextPath);
      }

      const isWorkspaceRoot = workspaceRoots.some(
        (root) => normalizePath(root.path) === normalizePath(directory),
      );
      if (isWorkspaceRoot) removeWorkspaceDirectory(directory);
      else {
        const root = workspaceRoots.find((candidate) =>
          pathBelongsToDirectory(directory, candidate.path),
        );
        if (root) await refreshWorkspaceTree(root.path);
      }
      return true;
    } catch (error) {
      await showDocumentError(error, 'dialog.deleteDirectoryFailed');
      return false;
    }
  };

  const shortcutActionsRef = useRef({
    activeFilePath,
    activeTextDocument,
    openTabs,
    activateTab: handleActivateTab,
    closeTab: handleCloseTab,
    createDocument,
    openDocument: chooseDocument,
    openDirectory: chooseDirectory,
    save: handleSave,
    saveAs: handleSaveAs,
  });
  shortcutActionsRef.current = {
    activeFilePath,
    activeTextDocument,
    openTabs,
    activateTab: handleActivateTab,
    closeTab: handleCloseTab,
    createDocument,
    openDocument: chooseDocument,
    openDirectory: chooseDirectory,
    save: handleSave,
    saveAs: handleSaveAs,
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const primaryModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const actions = shortcutActionsRef.current;
      let handled = false;

      if (!event.altKey && primaryModifier) {
        if (key === 's') {
          handled = true;
          if (!event.repeat) void (event.shiftKey ? actions.saveAs() : actions.save());
        } else if (key === 'w' && !event.shiftKey) {
          handled = true;
          if (!event.repeat && actions.activeFilePath) {
            void actions.closeTab(actions.activeFilePath);
          }
        } else if (key === 'n' && !event.shiftKey) {
          handled = true;
          if (!event.repeat) void actions.createDocument();
        } else if (key === 'o') {
          handled = true;
          if (!event.repeat) {
            void (event.shiftKey ? actions.openDirectory() : actions.openDocument());
          }
        } else if (key === 'p' && !event.shiftKey) {
          handled = true;
          if (!event.repeat) {
            setShowRecentFiles(true);
            setRecentClosing(false);
          }
        } else if (key === ',' && !event.shiftKey) {
          handled = true;
          if (!event.repeat) {
            setShowSettings(true);
            setSettingsClosing(false);
          }
        } else if (key === 'tab' || key === 'pageup' || key === 'pagedown') {
          handled = true;
          if (!event.repeat && actions.openTabs.length > 1) {
            const currentIndex = Math.max(
              0,
              actions.openTabs.indexOf(actions.activeFilePath ?? ''),
            );
            const backwards = key === 'pageup' || (key === 'tab' && event.shiftKey);
            const offset = backwards ? -1 : 1;
            const nextIndex =
              (currentIndex + offset + actions.openTabs.length) % actions.openTabs.length;
            void actions.activateTab(actions.openTabs[nextIndex]);
          }
        }
      } else if (!primaryModifier && !event.altKey && key === 'f2') {
        handled = Boolean(actions.activeFilePath && actions.activeTextDocument);
        if (handled && !event.repeat) setForceEditFileName(true);
      }

      if (!handled) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleShortcut, { capture: true });
    return () => window.removeEventListener('keydown', handleShortcut, { capture: true });
  }, []);

  useEffect(() => {
    if (!documentSessionReady || workspaceRestoredRef.current) return;
    workspaceRestoredRef.current = true;
    let active = true;
    void loadWorkspaceDirectories().then(async (directories) => {
      if (directories.length === 0 || !active) return;
      const restored = (
        await Promise.all(
          directories.map(async (directory) => {
            try {
              return { path: directory, nodes: await listDirectoryTree(directory) };
            } catch {
              return null;
            }
          }),
        )
      ).filter((root): root is FileExplorerRoot => root !== null);
      if (active && restored.length > 0) {
        setWorkspaceRoots(restored);
        setExplorerVisible(true);
      }
      if (active) {
        void saveWorkspaceDirectories(restored.map((root) => root.path)).catch((error) => {
          void showDocumentError(error, 'dialog.settingsSaveFailed');
        });
      }
    });
    return () => {
      active = false;
    };
  }, [documentSessionReady, showDocumentError]);

  useEffect(() => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();
    return registerWindowCloseGuard(
      appWindow,
      () => canCloseRef.current(),
      () => persistWindowState(appWindow),
    );
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();
    let disposed = false;
    let timeout = 0;
    const unlisten: Array<() => void> = [];

    const schedulePersist = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        void persistWindowState(appWindow).catch(console.error);
      }, 200);
    };

    void (async () => {
      try {
        await restoreWindowState(appWindow);
        if (disposed) return;
        await persistWindowState(appWindow);
        const listeners = await Promise.all([
          appWindow.onMoved(schedulePersist),
          appWindow.onResized(schedulePersist),
        ]);
        if (disposed) listeners.forEach((stopListening) => stopListening());
        else unlisten.push(...listeners);
      } catch (error) {
        console.error('Failed to restore window state:', error);
      } finally {
        if (!disposed) setWindowStateReady(true);
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      unlisten.forEach((stopListening) => stopListening());
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => {
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
        root.setAttribute('data-theme', systemTheme);
      } else {
        root.setAttribute('data-theme', theme);
      }
    };

    if (!document.startViewTransition) {
      updateTheme();
      return;
    }

    const transition = document.startViewTransition(() => {
      updateTheme();
    });
    void transition.ready.catch(() => undefined);
    void transition.finished.catch(() => undefined);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const root = document.documentElement;
        const updateTheme = () => {
          root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        };

        if (!document.startViewTransition) {
          updateTheme();
          return;
        }
        const transition = document.startViewTransition(updateTheme);
        void transition.ready.catch(() => undefined);
        void transition.finished.catch(() => undefined);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <div className={styles.container}>
      <div className={styles.titleBar} data-tauri-drag-region="true">
        <Toolbar
          onOpenFolder={() => void chooseDirectory()}
          onOpenDocument={() => void chooseDocument()}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onExportImage={activeTextDocument ? handleExportImage : undefined}
          onExportPdf={activeTextDocument ? handleExportPdf : undefined}
          editor={markdownDocument ? editorInstance : null}
          disabled={!documentSessionReady}
          className="toolbar"
        />
        <div className={styles.currentFileNameSlot}>
          {activeTextDocument && activeFilePath && (
            <CurrentFileName
              filePath={activeFilePath}
              onRename={async (newName) => {
                const previousPath = activeFilePath;
                const renamed = await documentSession.renameDocument(newName);
                if (renamed) {
                  const separatorIndex = Math.max(
                    previousPath.lastIndexOf('/'),
                    previousPath.lastIndexOf('\\'),
                  );
                  const nextPath = `${previousPath.slice(0, separatorIndex + 1)}${newName}`;
                  setOpenTabs((current) =>
                    current.map((path) => (path === previousPath ? nextPath : path)),
                  );
                  setActiveFilePath(nextPath);
                }
                if (renamed && activeWorkspaceDirectory) {
                  await refreshWorkspaceTree(activeWorkspaceDirectory);
                }
                return renamed;
              }}
              isDirty={isDirty}
              forceEdit={forceEditFileName}
              setForceEdit={setForceEditFileName}
            />
          )}
        </div>
        <div className={styles.topRightControls}>
          <SettingsButton
            className="settingsButton"
            onClick={() => {
              setShowSettings(true);
              setSettingsClosing(false);
            }}
          />
          <WindowControls />
        </div>
      </div>
      <RecentFilesSidebar
        files={directoryDocuments ?? recentDocuments}
        canRemoveDocuments={directoryDocuments === null}
        onOpenDocument={handleOpenDocument}
        onChooseDocument={chooseDocument}
        onChooseDirectory={chooseDirectory}
        onCreateDocument={createDocument}
        isOpen={showRecentFiles && !recentClosing}
        onRequestClose={() => setRecentClosing(true)}
        onCloseComplete={() => {
          setShowRecentFiles(false);
          setRecentClosing(false);
        }}
        onRemoveRecentDocument={async (path) => {
          try {
            await documentSession.removeRecentDocument(path);
          } catch (error) {
            await showDocumentError(error, 'dialog.recentSaveFailed');
          }
        }}
      />
      <div className={styles.mainArea}>
        {explorerHasItems && explorerRendered && (
          <FileExplorer
            roots={workspaceRoots}
            standaloneFiles={recentStandaloneFiles}
            currentPath={activeFilePath}
            onOpenFile={handleOpenDocument}
            onChooseDirectory={chooseDirectory}
            onRefresh={refreshAllWorkspaceTrees}
            onRemoveDirectory={removeWorkspaceDirectory}
            onReorderDirectory={reorderWorkspaceDirectory}
            onDeleteFile={handleDeleteWorkspaceFile}
            onCreateFile={handleCreateWorkspaceFile}
            onDeleteDirectory={handleDeleteWorkspaceDirectory}
            onRemoveStandaloneFile={async (path) => {
              try {
                await documentSession.removeRecentDocument(path);
              } catch (error) {
                await showDocumentError(error, 'dialog.recentSaveFailed');
              }
            }}
            onClose={() => setExplorerVisible(false)}
            closing={!explorerVisible}
            onCloseComplete={() => setExplorerRendered(false)}
          />
        )}
        <div className={styles.documentArea} ref={documentAreaRef}>
          <OpenTabs
            paths={openTabs}
            activePath={activeFilePath}
            dirtyPath={isDirty ? currentFilePath : null}
            leadingControl={
              explorerHasItems && !explorerVisible ? (
                <button
                  type="button"
                  className={styles.showExplorerButton}
                  onClick={() => setExplorerVisible(true)}
                  title={t('explorer.show')}
                  aria-label={t('explorer.show')}
                >
                  <LuPanelLeftOpen aria-hidden="true" />
                </button>
              ) : undefined
            }
            onActivate={(path) => void handleActivateTab(path)}
            onClose={(path) => void handleCloseTab(path)}
            onCloseAll={() => void handleCloseAllTabs()}
            onCloseOthers={(path) => void handleCloseOtherTabs(path)}
            onDelete={handleDeleteWorkspaceFile}
          />
          <div className={styles.editorCanvas}>
            <Editor
              ref={attachEditor}
              value={markdown}
              onChange={setMarkdown}
              filePath={activeFilePath}
              readOnly={!documentSessionReady || !activeTextDocument}
              className={styles.editor}
              theme={theme}
              onSave={handleSave}
              onSaveAs={handleSaveAs}
            />
            <SaveSuccessToast show={showSaveToast} message={saveToastMessage} />
            {exportRequest && activeTextDocument && (
              <ExportSurface
                content={markdown}
                filePath={currentFilePath}
                mode={exportRequest.mode}
                onExport={handleExport}
                onClose={() => setExportRequest(null)}
              />
            )}
          </div>
        </div>
        {agentPanelRendered && (
          <AgentPanel
            session={agentSession}
            conversations={agentConversations.conversations}
            activeConversationId={agentConversations.activeConversationId}
            scopeKind={agentScopeKind}
            onCreateConversation={agentConversations.createConversation}
            onSelectConversation={agentConversations.selectConversation}
            onRenameConversation={agentConversations.renameConversation}
            onDeleteConversation={agentConversations.deleteConversation}
            isConfigured={agentConfigured}
            modelName={agentSettings.model}
            onClose={() => setAgentSettings({ ...agentSettings, panelVisible: false })}
            closing={!agentSettings.panelVisible}
            onCloseComplete={() => setAgentPanelRendered(false)}
          />
        )}
      </div>
      {showSettings && (
        <Settings
          theme={theme}
          setTheme={setTheme}
          workDir={workDir}
          setWorkDir={setWorkDir}
          agentSettings={agentSettings}
          setAgentSettings={setAgentSettings}
          isClosing={settingsClosing}
          onRequestClose={() => setSettingsClosing(true)}
          onCloseComplete={() => {
            setShowSettings(false);
            setSettingsClosing(false);
          }}
        />
      )}
    </div>
  );
};

export default Layout;
