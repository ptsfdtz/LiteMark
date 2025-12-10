// src/components/Layout/Layout.tsx
import React, { useState, useEffect, useRef } from 'react';
import Editor from '../Editor/Editor';
import Preview from '../Preview/Preview';
import Toolbar from '../Toolbar/Toolbar';
import Settings from '../Settings/Settings';
import styles from './Layout.module.css';
import SettingsButton from '../SettingsButton/SettingsButton';
import RecentFilesSidebar from '../RecentFilesSidebar/RecentFilesSidebar';
import { RecentFile } from '../../types/recentFiles';
import CurrentFileName from './hooks/CurrentFileName';
// import { loadRecentFiles, saveRecentFiles } from "../../utils/recentStore";
import useFileManager from './hooks/useFileManager';
import { loadWorkDir, saveWorkDir } from '../../utils/workDirStore';
import SaveSuccessToast from './hooks/SaveSuccessToast';

const Layout: React.FC = () => {
  const [markdown, setMarkdown] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [recentClosing, setRecentClosing] = useState(false);
  // recentFiles and file operations are managed by useFileManager
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [editorWidth, setEditorWidth] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
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

  // 持久化个人工作文件夹
  const setWorkDir = (dir: string) => {
    setWorkDirState(dir);
    saveWorkDir(dir);
  };

  // 启动时加载最近文件并自动打开最新的一个
  const {
    recentFiles,
    setRecentFiles,
    handleSelectFile,
    handleLoadFile,
    handleDeleteRecentFile,
    handleSave,
    handleSaveAs,
    handleOpenFolder,
  } = useFileManager({
    markdown,
    setMarkdown,
    currentFilePath,
    setCurrentFilePath,
    setShowRecentFiles,
    setForceEditFileName,
    onSaveSuccess: () => {
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 1500);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    let intervalId: number | null = null;
    let disposable: { dispose: () => void } | null = null;
    let previewHandler: ((e: Event) => void) | null = null;
    let attachedPreviewEl: HTMLDivElement | null = null;

    type EditorLike = {
      getScrollTop: () => number;
      getScrollHeight: () => number;
      getLayoutInfo: () => { height: number };
      setScrollTop: (v: number) => void;
      onDidScrollChange: (cb: (e: { scrollTopChanged?: boolean }) => void) => {
        dispose: () => void;
      };
    };

    const tryAttach = () => {
      const editorInstance = editorRef.current as EditorLike | null;
      const previewElement = previewRef.current;

      if (!editorInstance || !previewElement || !scrollSyncEnabled) return false;

      let isSyncingEditor = false;
      let isSyncingPreview = false;

      const handleEditorScroll = () => {
        if (isSyncingPreview) return;
        isSyncingEditor = true;
        const scrollTop = editorInstance.getScrollTop();
        const scrollHeight = editorInstance.getScrollHeight();
        const clientHeight = editorInstance.getLayoutInfo().height;

        const editorScrollableHeight = scrollHeight - clientHeight;
        if (editorScrollableHeight > 0) {
          const ratio = scrollTop / editorScrollableHeight;
          const previewScrollHeight = previewElement.scrollHeight - previewElement.clientHeight;
          previewElement.scrollTop = ratio * previewScrollHeight;
        }
        setTimeout(() => {
          isSyncingEditor = false;
        }, 50);
      };

      const handlePreviewScroll = () => {
        if (isSyncingEditor) return;
        isSyncingPreview = true;

        const previewScrollTop = previewElement.scrollTop;
        const previewScrollHeight = previewElement.scrollHeight - previewElement.clientHeight;

        if (previewScrollHeight > 0) {
          const ratio = previewScrollTop / previewScrollHeight;
          const editorScrollHeight = editorInstance.getScrollHeight();
          const editorClientHeight = editorInstance.getLayoutInfo().height;
          const editorScrollableHeight = editorScrollHeight - editorClientHeight;
          editorInstance.setScrollTop(ratio * editorScrollableHeight);
        }
        setTimeout(() => {
          isSyncingPreview = false;
        }, 50);
      };

      // Attach editor scroll listener
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      disposable = editorInstance.onDidScrollChange((e: any) => {
        if (e.scrollTopChanged) {
          handleEditorScroll();
        }
      });

      // Attach preview listener only when preview pane is shown
      if (!previewMode) {
        previewElement.addEventListener('scroll', handlePreviewScroll);
        previewHandler = handlePreviewScroll;
        attachedPreviewEl = previewElement;
      }

      return true;
    };

    if (scrollSyncEnabled) {
      // Try immediate attach; if not ready, poll briefly (up to ~1s)
      if (!tryAttach()) {
        let attempts = 0;
        intervalId = window.setInterval(() => {
          attempts += 1;
          if (tryAttach() || attempts > 20) {
            if (intervalId !== null) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        }, 50) as unknown as number;
      }
    }

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (disposable && disposable.dispose) disposable.dispose();
      if (previewHandler && attachedPreviewEl) {
        attachedPreviewEl.removeEventListener('scroll', previewHandler);
      }
    };
  }, [scrollSyncEnabled, previewMode]);

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

  const handleCloseSidebar = () => {
    setShowRecentFiles(false);
  };

  const toggleScrollSync = () => {
    setScrollSyncEnabled(!scrollSyncEnabled);
  };

  const enterPreviewMode = () => {
    setPreviewMode(true);
  };

  const exitPreviewMode = () => {
    setPreviewMode(false);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  return (
    <div className={styles.container}>
      <div style={{ position: 'relative' }}>
        <Toolbar
          value={markdown}
          setValue={setMarkdown}
          selectionStart={selection.start}
          selectionEnd={selection.end}
          onOpenFolder={handleOpenFolder}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          editorRef={editorRef}
          className="toolbar"
        />
        <SettingsButton
          className="settingsButton"
          onClick={() => {
            setShowSettings(true);
            setSettingsClosing(false);
          }}
        />
      </div>
      <RecentFilesSidebar
        files={recentFiles}
        onSelectFile={(f) => {
          handleSelectFile(f);
          setRecentClosing(true);
        }}
        onClose={handleCloseSidebar}
        isOpen={showRecentFiles && !recentClosing}
        onRequestClose={() => setRecentClosing(true)}
        onCloseComplete={() => {
          setShowRecentFiles(false);
          setRecentClosing(false);
        }}
        onLoadFile={handleLoadFile}
        onLoadDir={(files) => {
          setRecentFiles(files);
        }}
        onNewFile={(path, content) => {
          setMarkdown(content);
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
          setForceEditFileName(true); // 新建后强制编辑
        }}
        onDeleteFile={handleDeleteRecentFile}
        workDir={workDir}
      />
      <div
        ref={containerRef}
        className={styles.editorPreview}
        style={{ cursor: isResizing ? 'col-resize' : 'default' }}
      >
        {!previewMode && (
          <>
            <div className={styles.editorPanel} style={{ width: `${editorWidth}%` }}>
              <Editor
                ref={editorRef}
                value={markdown}
                onChange={setMarkdown}
                onSelectionChange={(start, end) => setSelection({ start, end })}
                className={styles.editor}
                theme={theme}
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
            ref={previewRef}
            content={markdown}
            scrollSyncEnabled={scrollSyncEnabled}
            onScrollSyncToggle={toggleScrollSync}
            previewMode={previewMode}
            onExitPreviewMode={exitPreviewMode}
            onEnterPreviewMode={enterPreviewMode}
            isPreviewOnly={previewMode}
          />
        </div>
      </div>
      {currentFilePath && (
        <CurrentFileName
          filePath={currentFilePath}
          recentFiles={recentFiles}
          setRecentFiles={setRecentFiles}
          setCurrentFilePath={setCurrentFilePath}
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
