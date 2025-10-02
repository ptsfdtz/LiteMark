import React, { useState, useEffect, useRef } from "react";
import Editor from "../Editor/Editor";
import Preview from "../Preview/Preview";
import Toolbar from "../Toolbar/Toolbar";
import KeyboardShortcuts from "../KeyboardShortcuts/KeyboardShortcuts";
import Settings from "../Settings/Settings";
import styles from "./Layout.module.css";
import SettingsButton from "../SettingsButton/SettingsButton";
import { ScrollSync } from "../../hooks/useScrollSync";
import RecentFilesSidebar from "../RecentFilesSidebar/RecentFilesSidebar";
import { RecentFile } from "../../types/recentFiles";

const Layout: React.FC = () => {
  const [markdown, setMarkdown] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  // 模拟获取最近文件数据
  useEffect(() => {
    const mockFiles: RecentFile[] = [];
    setRecentFiles(mockFiles);
  }, []);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef<ScrollSync>(new ScrollSync());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.setAttribute("data-theme", systemTheme);
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        const root = document.documentElement;
        root.setAttribute("data-theme", e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => {
    const editorElement = editorRef.current;
    const previewElement = previewRef.current;
    const scrollSync = scrollSyncRef.current;

    if (!editorElement || !previewElement) return;

    const handleEditorScroll = () => {
      scrollSync.syncEditorToPreview(editorElement, previewElement);
    };

    const handlePreviewScroll = () => {
      scrollSync.syncPreviewToEditor(editorElement, previewElement);
    };

    editorElement.addEventListener("scroll", handleEditorScroll);
    previewElement.addEventListener("scroll", handlePreviewScroll);

    return () => {
      editorElement.removeEventListener("scroll", handleEditorScroll);
      previewElement.removeEventListener("scroll", handlePreviewScroll);
    };
  }, []);

  const handleOpenFolder = () => {
    setShowRecentFiles(true);
  };

  const handleSelectFile = (file: RecentFile) => {
    // 这里可以添加实际的文件加载逻辑
    console.log("打开文件:", file.name);
    // 可以在这里调用 Tauri API 来读取文件内容
    setShowRecentFiles(false);
  };

  const handleCloseSidebar = () => {
    setShowRecentFiles(false);
  };

  return (
    <div className={styles.container}>
      <div style={{ position: "relative" }}>
        <Toolbar
          value={markdown}
          setValue={setMarkdown}
          selectionStart={selection.start}
          selectionEnd={selection.end}
          onOpenFolder={handleOpenFolder}
        />
        <SettingsButton onClick={() => setShowSettings(true)} />
      </div>

      {/* 添加侧边栏 */}
      <RecentFilesSidebar
        files={recentFiles}
        onSelectFile={handleSelectFile}
        onClose={handleCloseSidebar}
        isOpen={showRecentFiles}
      />

      <div className={styles.editorPreview}>
        <Editor
          ref={editorRef}
          value={markdown}
          onChange={setMarkdown}
          onSelectionChange={(start, end) => setSelection({ start, end })}
        />
        <Preview ref={previewRef} content={markdown} />
      </div>
      <KeyboardShortcuts
        value={markdown}
        setValue={setMarkdown}
        selectionStart={selection.start}
        selectionEnd={selection.end}
      />
      {showSettings && (
        <Settings
          theme={theme}
          setTheme={setTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default Layout;
