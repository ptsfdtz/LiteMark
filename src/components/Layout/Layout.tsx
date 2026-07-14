// src/components/Layout/Layout.tsx
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { FaTimes } from 'react-icons/fa';
import Editor from '@/components/Editor/Editor';
import Preview from '@/components/Preview/Preview';
import Toolbar from '@/components/Toolbar/Toolbar';
import Settings from '@/components/Settings/Settings';
import SettingsButton from '@/components/SettingsButton/SettingsButton';
import RecentFilesSidebar from '@/components/RecentFilesSidebar/RecentFilesSidebar';
import WindowControls from '@/components/WindowControls/WindowControls';
import styles from './Layout.module.css';
import CurrentFileName from './components/CurrentFileName';
import { loadWorkDir, saveWorkDir } from '@/utils/workDirStore';
import SaveSuccessToast from './components/SaveSuccessToast';
import { useI18n } from '@/locales/useI18n';
import { loadTheme, saveTheme } from '@/utils/themeStore';
import useDocumentSession from '@/modules/documentSession/useDocumentSession';
import {
  tauriDocumentStorage,
  tauriRecentDocuments,
} from '@/modules/documentSession/tauriDocumentSession';
import { ask, message, open, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { MarkdownEditor } from '@/types/editor';
import { registerWindowCloseGuard } from '@/modules/windowCloseGuard/registerWindowCloseGuard';
import { connectScrollSync } from '@/modules/scrollSync/connectScrollSync';

const Layout: React.FC = () => {
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [themeReady, setThemeReady] = useState(false);
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [recentClosing, setRecentClosing] = useState(false);
  // Document Session owns document content, persistence, and Recent Documents.
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [editorOnly, setEditorOnly] = useState(false);
  const [minimapEnabled, setMinimapEnabledState] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('minimapEnabled');
      return v ? v === 'true' : false;
    } catch {
      return false;
    }
  });
  const [editorWidth, setEditorWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [workDir, setWorkDirState] = useState('');
  const [forceEditFileName, setForceEditFileName] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  // 加载个人工作文件夹
  useEffect(() => {
    (async () => {
      const dir = await loadWorkDir();
      setWorkDirState(dir);
    })();
  }, []);

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
      console.error('Document operation failed:', error);
      await message(t(fallbackKey), { title: t('dialog.error') });
    },
    [t],
  );

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

  const showSaveSuccess = () => {
    setShowSaveToast(true);
    window.setTimeout(() => setShowSaveToast(false), 1500);
  };

  const handleSave = async () => {
    if (!documentSessionReady) return;
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
    if (!documentSessionReady) return;
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
      if (saved) showSaveSuccess();
    } catch (error) {
      await showDocumentError(error, 'dialog.saveFailed');
    }
  };

  const handleOpenDocument = async (path: string) => {
    if (!documentSessionReady) return false;
    try {
      return await documentSession.openDocument(path);
    } catch (error) {
      await showDocumentError(error, 'dialog.fileMissing');
      return false;
    }
  };

  const handleCreateDocument = async (directory: string) => {
    if (!documentSessionReady) return false;
    try {
      const created = await documentSession.createDocument(directory, t('recent.newFileContent'));
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
      await documentSession.loadDirectory(directory);
    } catch (error) {
      await showDocumentError(error, 'dialog.openFolderFailed');
    }
  };

  const chooseDocument = async () => {
    if (!documentSessionReady) return false;
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: t('dialog.markdown'), extensions: ['md', 'markdown', 'txt'] },
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
      let directory = workDir;
      if (!directory) {
        const selected = await open({ multiple: false, directory: true });
        if (!selected || Array.isArray(selected)) return false;
        directory = selected;
      }
      return await handleCreateDocument(directory);
    } catch (error) {
      await showDocumentError(error, 'dialog.createFailed');
      return false;
    }
  };

  const handleOpenFolder = () => {
    if (!documentSessionReady) return;
    documentSession.clearDirectoryDocuments();
    setShowRecentFiles(true);
    setRecentClosing(false);
  };

  const editorRef = useRef<MarkdownEditor | null>(null);
  const [editorInstance, setEditorInstance] = useState<MarkdownEditor | null>(null);
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canCloseRef = useRef(documentSession.canClose);
  canCloseRef.current = documentSession.canClose;

  const attachEditor = useCallback((instance: MarkdownEditor | null) => {
    editorRef.current = instance;
    setEditorInstance((current) => (current === instance ? current : instance));
  }, []);

  const attachPreview = useCallback((element: HTMLDivElement | null) => {
    setPreviewElement((current) => (current === element ? current : element));
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    return registerWindowCloseGuard(appWindow, () => canCloseRef.current());
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

    document.startViewTransition(() => {
      updateTheme();
    });
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
        document.startViewTransition(updateTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    if (!scrollSyncEnabled || previewMode || editorOnly || !editorInstance || !previewElement) {
      return;
    }

    return connectScrollSync(editorInstance, previewElement);
  }, [editorInstance, editorOnly, previewElement, previewMode, scrollSyncEnabled]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      const newWidth = Math.min(Math.max((mouseX / containerWidth) * 100, 20), 80);
      setEditorWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const toggleScrollSync = () => {
    setScrollSyncEnabled(!scrollSyncEnabled);
  };

  const enterPreviewMode = () => {
    setPreviewMode(true);
  };

  const exitPreviewMode = () => {
    setPreviewMode(false);
  };

  const enterEditorOnly = () => {
    setEditorOnly(true);
  };

  const exitEditorOnly = () => {
    setEditorOnly(false);
  };

  const setMinimapEnabled = (v: boolean) => {
    setMinimapEnabledState(v);
    try {
      localStorage.setItem('minimapEnabled', v ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  return (
    <div className={styles.container}>
      <div style={{ position: 'relative' }} data-tauri-drag-region="true">
        <Toolbar
          onOpenFolder={handleOpenFolder}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          editorRef={editorRef}
          disabled={!documentSessionReady}
          className="toolbar"
        />
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
      <div
        ref={containerRef}
        className={styles.editorPreview}
        style={{ cursor: isResizing ? 'col-resize' : 'default' }}
      >
        {editorOnly ? (
          <div className={styles.editorPanel} style={{ width: `100%`, position: 'relative' }}>
            <Editor
              ref={attachEditor}
              value={markdown}
              onChange={setMarkdown}
              readOnly={!documentSessionReady}
              className={styles.editor}
              theme={theme}
              minimapEnabled={minimapEnabled}
              onSave={handleSave}
              onSaveAs={handleSaveAs}
            />
            <button
              aria-label={t('layout.exitEditMode')}
              title={t('layout.exitEditMode')}
              onClick={exitEditorOnly}
              className={styles.editorOnlyExit}
            >
              <FaTimes />
            </button>
          </div>
        ) : (
          <>
            {!previewMode && (
              <>
                <div className={styles.editorPanel} style={{ width: `${editorWidth}%` }}>
                  <Editor
                    ref={attachEditor}
                    value={markdown}
                    onChange={setMarkdown}
                    readOnly={!documentSessionReady}
                    className={styles.editor}
                    theme={theme}
                    minimapEnabled={minimapEnabled}
                    onSave={handleSave}
                    onSaveAs={handleSaveAs}
                  />
                </div>
                <div className={styles.resizer} onMouseDown={startResizing} />
              </>
            )}
            <div
              className={styles.previewPanel}
              style={{
                width: previewMode ? '100%' : `calc(${100 - editorWidth}% - 5px)`,
              }}
            >
              <Preview
                ref={attachPreview}
                content={markdown}
                filePath={currentFilePath}
                scrollSyncEnabled={scrollSyncEnabled}
                onScrollSyncToggle={toggleScrollSync}
                onExitPreviewMode={exitPreviewMode}
                onEnterPreviewMode={enterPreviewMode}
                onEnterEditorMode={enterEditorOnly}
                isPreviewOnly={previewMode}
              />
            </div>
          </>
        )}
      </div>
      {currentFilePath && (
        <CurrentFileName
          filePath={currentFilePath}
          onRename={documentSession.renameDocument}
          isDirty={isDirty}
          forceEdit={forceEditFileName}
          setForceEdit={setForceEditFileName}
        />
      )}
      {showSettings && (
        <Settings
          theme={theme}
          setTheme={setTheme}
          workDir={workDir}
          setWorkDir={setWorkDir}
          minimapEnabled={minimapEnabled}
          setMinimapEnabled={setMinimapEnabled}
          isClosing={settingsClosing}
          onRequestClose={() => setSettingsClosing(true)}
          onCloseComplete={() => {
            setShowSettings(false);
            setSettingsClosing(false);
          }}
        />
      )}
      <SaveSuccessToast show={showSaveToast} />
    </div>
  );
};

export default Layout;
