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
import { loadWorkDir, saveWorkDir } from "../../utils/workDirStore";

// 保存成功动画组件
const SaveSuccessToast: React.FC<{ show: boolean }> = ({ show }) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        right: 16,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: show ? 1 : 0,
        transform: show ? "scale(1)" : "scale(0.7)",
        transition: "opacity 0.4s, transform 0.4s",
        background: "linear-gradient(135deg, #4fcf70 0%, #36b37e 100%)",
        color: "#fff",
        borderRadius: "50%",
        width: 20,
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
      }}
    >
      <span role="img" aria-label="success">
        ✔
      </span>
    </div>
  );
};

const Layout: React.FC = () => {
  const [markdown, setMarkdown] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [recentClosing, setRecentClosing] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [editorWidth, setEditorWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [workDir, setWorkDirState] = useState("");
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
      if (restored.length > 0) {
        // 自动打开最新的文件
        try {
          const content = await invoke<string>("read_text_file", {
            path: restored[0].path,
          });
          setMarkdown(content);
          setCurrentFilePath(restored[0].path);
        } catch (err) {
          console.error("自动打开最近文件失败:", err);
        }
      }
    })();
  }, []);

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

    editorElement.removeEventListener("scroll", handleEditorScroll);
    previewElement.removeEventListener("scroll", handlePreviewScroll);

    if (!previewMode) {
      editorElement.addEventListener("scroll", handleEditorScroll);
      previewElement.addEventListener("scroll", handlePreviewScroll);
    }

    return () => {
      editorElement.removeEventListener("scroll", handleEditorScroll);
      previewElement.removeEventListener("scroll", handlePreviewScroll);
    };
  }, [scrollSyncEnabled, previewMode]);

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
        setRecentFiles((prev) => prev.filter((f) => f.path !== file.path));
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

  const handleDeleteRecentFile = async (id: string) => {
    const file = recentFiles.find((f) => f.id === id);
    if (!file) return;
    try {
      await invoke("delete_file", { path: file.path });
      setRecentFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("删除文件失败:", err);
      await message("删除文件失败，可能没有权限或文件正在被使用", {
        title: "错误",
      });
    }
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
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 1500);
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
            const withoutDup = prev.filter((f) => f.path !== path);
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
                className="editor"
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

// 右上角文件名双击可重命名组件
interface CurrentFileNameProps {
  filePath: string;
  recentFiles: RecentFile[];
  setRecentFiles: React.Dispatch<React.SetStateAction<RecentFile[]>>;
  setCurrentFilePath: (p: string) => void;
  forceEdit?: boolean;
  setForceEdit?: (v: boolean) => void;
}

const CurrentFileName: React.FC<CurrentFileNameProps> = ({
  filePath,
  setRecentFiles,
  setCurrentFilePath,
  forceEdit,
  setForceEdit,
}) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(filePath.split(/[/\\]/).pop() || "");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setValue(filePath.split(/[/\\]/).pop() || "");
  }, [filePath]);

  // 新建后强制进入编辑
  React.useEffect(() => {
    if (forceEdit) {
      setEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
        setForceEdit && setForceEdit(false);
      }, 0);
    }
  }, [forceEdit]);

  const handleRename = async () => {
    let newName = value.trim();
    if (!newName || newName === filePath.split(/[/\\]/).pop()) {
      setEditing(false);
      return;
    }
    // 自动补全 .md 后缀
    if (!/\.[a-zA-Z0-9]+$/.test(newName)) {
      newName += ".md";
    }
    const dir = filePath.replace(/[/\\][^/\\]+$/, "");
    const newPath =
      dir +
      (dir.endsWith("/") || dir.endsWith("\\")
        ? ""
        : dir.includes("\\")
        ? "\\"
        : "/") +
      newName;
    // 检查是否已存在同名文件
    try {
      const exists = await invoke("file_exists", { path: newPath });
      if (exists) {
        await message("该文件名已存在，请输入其他名称。", {
          title: "重命名失败",
        });
        setEditing(true);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      await invoke("rename_file", { oldPath: filePath, newPath });
      setCurrentFilePath(newPath);
      setRecentFiles((prev) =>
        prev.map((f) =>
          f.path === filePath ? { ...f, name: newName, path: newPath } : f
        )
      );
    } catch (err) {
      console.error("重命名失败:", err);
    }
    setEditing(false);
  };

  return editing ? (
    <input
      className={styles.currentFileName}
      ref={inputRef}
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleRename}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleRename();
        if (e.key === "Escape") setEditing(false);
      }}
      style={{ minWidth: 60, maxWidth: 300 }}
    />
  ) : (
    <div
      className={styles.currentFileName}
      title="双击重命名"
      style={{ cursor: "pointer", userSelect: "text" }}
      onDoubleClick={() => setEditing(true)}
    >
      {filePath.split(/[/\\]/).pop()}
    </div>
  );
};
