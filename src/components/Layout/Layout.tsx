// src/components/Layout/Layout.tsx
import React, { useState, useEffect, useRef } from 'react';
import Editor from '../Editor/Editor';
import Preview from '../Preview/Preview';
import Toolbar from '../Toolbar/Toolbar';
import KeyboardShortcuts from '../KeyboardShortcuts/KeyboardShortcuts';
import Settings from '../Settings/Settings';
import styles from './Layout.module.css';
import SettingsButton from '../SettingsButton/SettingsButton';
import { ScrollSync } from '../../hooks/useScrollSync';
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
  const [editorWidth, setEditorWidth] = useState(50);
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

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef<ScrollSync>(new ScrollSync());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.setAttribute('data-theme', systemTheme);
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const root = document.documentElement;
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    const editorElement = editorRef.current;
    const previewElement = previewRef.current;
    const scrollSync = scrollSyncRef.current;

    if (!editorElement || !previewElement || !scrollSyncEnabled) return;

    const handleEditorScroll = () => {
      scrollSync.syncEditorToPreview(editorElement, previewElement);
    };

    const handlePreviewScroll = () => {
      scrollSync.syncPreviewToEditor(editorElement, previewElement);
    };

    editorElement.removeEventListener('scroll', handleEditorScroll);
    previewElement.removeEventListener('scroll', handlePreviewScroll);

    if (!previewMode) {
      editorElement.addEventListener('scroll', handleEditorScroll);
      previewElement.addEventListener('scroll', handlePreviewScroll);
    }

    return () => {
      editorElement.removeEventListener('scroll', handleEditorScroll);
      previewElement.removeEventListener('scroll', handlePreviewScroll);
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
                className="editor"
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
      <KeyboardShortcuts
        value={markdown}
        setValue={setMarkdown}
        selectionStart={selection.start}
        selectionEnd={selection.end}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
      />
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
