import React, { useEffect, useRef, useState } from "react";
import styles from "./RecentFilesSidebar.module.css";
import DeleteConfirm from "./components/DeleteConfirm/DeleteConfirm";
import { RecentFile } from "../../types/recentFiles";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  FaFolderOpen,
  FaFile,
  FaFileAlt,
  FaTimes,
  FaTrash,
} from "react-icons/fa";

interface RecentFilesSidebarProps {
  files: RecentFile[];
  onSelectFile: (file: RecentFile) => void;
  onClose?: () => void;
  isOpen: boolean;
  onRequestClose?: () => void;
  onCloseComplete?: () => void;
  onLoadFile?: (path: string, content: string) => void;
  onLoadDir?: (
    files: { id: string; name: string; path: string; modified: Date }[]
  ) => void;
  onNewFile?: (path: string, content: string) => void;
  onDeleteFile?: (id: string) => void;
  workDir?: string;
}

const RecentFilesSidebar: React.FC<RecentFilesSidebarProps> = ({
  files,
  onSelectFile,
  onClose,
  isOpen,
  onRequestClose,
  onCloseComplete,
  onLoadFile,
  onLoadDir,
  onNewFile,
  onDeleteFile,
  workDir,
}) => {
  // Ctrl+N 新建文件快捷键
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNewFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  // 记录正在删除动画的文件 id
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 记录弹窗确认删除的文件 id 和按钮 ref
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    id: string;
    anchor: HTMLButtonElement | null;
  } | null>(null);
  // 用于持久化每个文件的按钮ref，避免闪烁
  const trashBtnRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Close when clicking outside the sidebar
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(null); // 关闭弹窗
      return;
    }
    const onDocMouseDown = (e: MouseEvent) => {
      if (!sidebarRef.current) return;
      const target = e.target as Node;
      if (!sidebarRef.current.contains(target)) {
        if (onRequestClose) onRequestClose();
        else if (onClose) onClose();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isOpen, onRequestClose, onClose]);
  const handleOpenFile = async () => {
    try {
      console.log("[RecentFilesSidebar] 点击 打开文件");
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      console.log("[RecentFilesSidebar] open 返回:", selected);
      if (!selected || Array.isArray(selected)) return;
      const content = await invoke<string>("read_text_file", {
        path: selected,
      });
      console.log("[RecentFilesSidebar] 读取完成, 长度:", content?.length);
      if (onLoadFile) onLoadFile(selected, content);
      if (onRequestClose) onRequestClose();
      if (onClose) onClose();
    } catch (err) {
      console.error("打开文件失败:", err);
    }
  };

  const handleNewFile = async () => {
    try {
      let defaultPath = "untitled.md";
      if (workDir) {
        // 拼接路径，兼容 Windows/Unix
        defaultPath =
          workDir.replace(/[\\/]$/, "") +
          (workDir.includes("\\") ? "\\" : "/") +
          "untitled.md";
      }
      const target = await save({
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
        defaultPath,
      });
      if (!target) return;
      const initialContent = "# 新建文档\n\n";
      await invoke("write_text_file", {
        path: target,
        content: initialContent,
      });
      if (onNewFile) onNewFile(target, initialContent);
      if (onRequestClose) onRequestClose();
      if (onClose) onClose();
    } catch (err) {
      console.error("新建文件失败:", err);
    }
  };

  const handleOpenDirectory = async () => {
    try {
      console.log("[RecentFilesSidebar] 点击 打开文件夹");
      const selected = await open({ multiple: false, directory: true });
      console.log("[RecentFilesSidebar] open(dir) 返回:", selected);
      if (!selected || Array.isArray(selected)) return;
      const list = await invoke<
        Array<{ path: string; name: string; modified_ms: number }>
      >("list_text_files", { dirPath: selected });
      console.log("[RecentFilesSidebar] 列表条数:", list.length);
      const files = list.map((f) => ({
        id: f.path,
        name: f.name,
        path: f.path,
        modified: new Date(f.modified_ms),
      }));
      if (onLoadDir) onLoadDir(files);
    } catch (err) {
      console.error("打开文件夹失败:", err);
    }
  };
  return (
    <div
      ref={sidebarRef}
      className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}
      onTransitionEnd={(e) => {
        if (e.currentTarget !== e.target) return;
        if (!isOpen && onCloseComplete) onCloseComplete();
      }}
    >
      <div className={styles.header}>
        <button
          onClick={handleOpenDirectory}
          className={styles.openButton}
          title="打开文件夹"
          aria-label="打开文件夹"
        >
          <FaFolderOpen />
        </button>
        <button
          onClick={handleOpenFile}
          className={styles.openButton}
          title="打开文件"
          aria-label="打开文件"
        >
          <FaFile />
        </button>
        <button
          onClick={handleNewFile}
          className={styles.openButton}
          title="新建文件"
          aria-label="新建文件"
        >
          <FaFileAlt />
        </button>
        <button
          onClick={() => {
            if (onRequestClose) onRequestClose();
            if (onClose) onClose();
          }}
          className={styles.closeButton}
          title="关闭"
          aria-label="关闭"
        >
          <FaTimes />
        </button>
      </div>
      <div className={styles.filesList}>
        {files.length === 0 ? (
          <div className={styles.noFiles}>暂无最近文件</div>
        ) : (
          files.map((file) => {
            return (
              <div
                key={file.id}
                className={`${styles.fileItem} ${
                  deletingId === file.id ? styles.deleting : ""
                }`}
              >
                <div
                  className={styles.fileContent}
                  onClick={() => onSelectFile(file)}
                >
                  <div className={styles.fileName}>{file.name}</div>
                  <div className={styles.filePath}>{file.path}</div>
                  <div className={styles.fileModified}>
                    {file.modified.toLocaleString()}
                  </div>
                </div>
                <button
                  ref={(el) => {
                    trashBtnRefs.current.set(file.id, el);
                  }}
                  className={styles.trashButton}
                  title="删除"
                  aria-label={`删除 ${file.name}`}
                  onClick={() =>
                    setShowDeleteConfirm({
                      id: file.id,
                      anchor: trashBtnRefs.current.get(file.id) || null,
                    })
                  }
                  disabled={deletingId === file.id}
                >
                  <FaTrash />
                </button>
              </div>
            );
          })
        )}
      </div>
      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <DeleteConfirm
          open={true}
          anchorRef={showDeleteConfirm.anchor}
          fileName={
            files.find((f) => f.id === showDeleteConfirm.id)?.name || ""
          }
          onConfirm={() => {
            setDeletingId(showDeleteConfirm.id);
            setShowDeleteConfirm(null);
            setTimeout(() => {
              setDeletingId(null);
              if (onDeleteFile) onDeleteFile(showDeleteConfirm.id);
            }, 400);
          }}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

export default RecentFilesSidebar;
