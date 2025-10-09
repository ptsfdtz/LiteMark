// src/components/Layout/Layout.tsx
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
import { invoke } from "@tauri-apps/api/core";
import { loadRecentFiles, saveRecentFiles } from "../../utils/recentStore";
import { save as saveDialog, message } from "@tauri-apps/plugin-dialog";

const Layout: React.FC = () => {
  const [markdown, setMarkdown] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [editorWidth, setEditorWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

  // 启动时从 AppData 读取最近文件（Tauri fs）
  useEffect(() => {
    (async () => {
      const persisted = await loadRecentFiles();
      const restored: RecentFile[] = persisted.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        modified: new Date(f.modified),
      }));
      setRecentFiles(restored);
    })();
  }, []);

  // recentFiles 变更时写回 AppData（Tauri fs）
  useEffect(() => {
    (async () => {
      const toStore = recentFiles.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        modified: f.modified.toISOString(),
      }));
      await saveRecentFiles(toStore);
    })();
  }, [recentFiles]);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef<ScrollSync>(new ScrollSync());
  const containerRef = useRef<HTMLDivElement>(null);

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

    if (!editorElement || !previewElement || !scrollSyncEnabled) return;

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
  }, [scrollSyncEnabled]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      const newWidth = Math.min(
        Math.max((mouseX / containerWidth) * 100, 20),
        80
      );
      setEditorWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);
  const handleOpenFolder = () => {
    setShowRecentFiles(true);
  };

  const handleSelectFile = (file: RecentFile) => {
    console.log("打开文件:", file.name);
    (async () => {
      try {
        const content = await invoke<string>("read_text_file", {
          path: file.path,
        });
        setMarkdown(content);
        setShowRecentFiles(false);
        setCurrentFilePath(file.path);
        // 读取成功后将该文件置顶到最近列表
        setRecentFiles((prev) => {
          const withoutDup = prev.filter((f) => f.path !== file.path);
          const bumped: RecentFile = {
            id: file.path,
            name: file.name,
            path: file.path,
            modified: new Date(),
          };
          return [bumped, ...withoutDup].slice(0, 50);
        });
      } catch (err) {
        console.error("读取文件失败:", err);
        // 从最近文件列表中移除该文件
        setRecentFiles((prev) => prev.filter((f) => f.path !== file.path));
        // 显示错误对话框
        await message("文件不存在或无法访问", { title: "错误" });
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
      const withoutDup = prev.filter((f) => f.path !== path);
      return [newItem, ...withoutDup].slice(0, 50);
    });
  };

  const handleSave = async () => {
    try {
      let path = currentFilePath;
      if (!path) {
        const selected = await saveDialog({
          filters: [
            { name: "Markdown", extensions: ["md", "markdown", "txt"] },
            { name: "All Files", extensions: ["*"] },
          ],
          defaultPath: "note.md",
        });
        if (!selected) return;
        path = selected as string;
        setCurrentFilePath(path);
      }
      await invoke("write_text_file", { path, content: markdown });
      const name = path.split(/[/\\]/).pop() || path;
      const item: RecentFile = {
        id: path,
        name,
        path,
        modified: new Date(),
      };
      setRecentFiles((prev) => {
        const withoutDup = prev.filter((f) => f.path !== path);
        return [item, ...withoutDup].slice(0, 50);
      });
    } catch (err) {
      console.error("保存失败:", err);
    }
  };

  const handleCloseSidebar = () => {
    setShowRecentFiles(false);
  };

  const handleSaveAs = async () => {
    try {
      const selected = await saveDialog({
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
        defaultPath:
          (currentFilePath && currentFilePath.split(/[/\\]/).pop()) ||
          "note.md",
      });
      if (!selected) return;
      const path = selected as string;
      await invoke("write_text_file", { path, content: markdown });
      setCurrentFilePath(path);
      const name = path.split(/[/\\]/).pop() || path;
      const item: RecentFile = {
        id: path,
        name,
        path,
        modified: new Date(),
      };
      setRecentFiles((prev) => {
        const withoutDup = prev.filter((f) => f.path !== path);
        return [item, ...withoutDup].slice(0, 50);
      });
    } catch (err) {
      console.error("另存为失败:", err);
    }
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
      <div style={{ position: "relative" }}>
        <Toolbar
          value={markdown}
          setValue={setMarkdown}
          selectionStart={selection.start}
          selectionEnd={selection.end}
          onOpenFolder={handleOpenFolder}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
        />
        <SettingsButton onClick={() => setShowSettings(true)} />
      </div>
      <RecentFilesSidebar
        files={recentFiles}
        onSelectFile={handleSelectFile}
        onClose={handleCloseSidebar}
        isOpen={showRecentFiles}
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
            const withoutDup = prev.filter((f) => f.path !== path);
            return [item, ...withoutDup].slice(0, 50);
          });
        }}
      />
      <div
        ref={containerRef}
        className={styles.editorPreview}
        style={{ cursor: isResizing ? "col-resize" : "default" }}
      >
        {!previewMode && (
          <>
            <div
              className={styles.editorPanel}
              style={{ width: `${editorWidth}%` }}
            >
              <Editor
                ref={editorRef}
                value={markdown}
                onChange={setMarkdown}
                onSelectionChange={(start, end) => setSelection({ start, end })}
              />
            </div>
            <div className={styles.resizer} onMouseDown={startResizing} />
          </>
        )}
        <div
          className={styles.previewPanel}
          style={{
            width: previewMode ? "100%" : `calc(${100 - editorWidth}% - 5px)`,
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
