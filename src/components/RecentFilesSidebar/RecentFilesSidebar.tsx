import React, { useEffect, useRef, useState } from "react";
import styles from "./RecentFilesSidebar.module.css";
import { RecentFilesSidebarProps } from "../../types/recentFiles";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  FaFolderOpen,
  FaFile,
  FaFileAlt,
  FaTimes,
  FaTrash,
} from "react-icons/fa";
import { FaCheck } from "react-icons/fa";

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
  // 记录当前显示确认/取消按钮的文件 id
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Close when clicking outside the sidebar
  useEffect(() => {
    if (!isOpen) {
      // setShowDeleteConfirm(null); // 关闭弹窗（已移除弹窗逻辑）
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
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!selected || Array.isArray(selected)) return;
      const content = await invoke<string>("read_text_file", {
        path: selected,
      });
      if (onLoadFile) onLoadFile(selected, content);
      if (onRequestClose) onRequestClose();
      if (onClose) onClose();
    } catch (err) {
      console.error("打开文件失败:", err);
    }
  };

  // 新建文件直接保存到个人工作文件夹，无弹窗
  const handleNewFile = async () => {
    try {
      let target = "untitled.md";
      if (workDir) {
        target =
          workDir.replace(/[\\\/]$/, "") +
          (workDir.includes("\\") ? "\\" : "/") +
          "untitled.md";
      }
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
      const selected = await open({ multiple: false, directory: true });
      if (!selected || Array.isArray(selected)) return;
      const list = await invoke<
        Array<{ path: string; name: string; modified_ms: number }>
      >("list_text_files", { dirPath: selected });
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
                {confirmingId === file.id ? (
                  <span className={styles.confirmBtns}>
                    <button
                      className={styles.confirmButton}
                      title="确认删除"
                      aria-label={`确认删除 ${file.name}`}
                      onClick={() => {
                        setDeletingId(file.id);
                        setConfirmingId(null);
                        setTimeout(() => {
                          setDeletingId(null);
                          if (onDeleteFile) onDeleteFile(file.id);
                        }, 400);
                      }}
                      disabled={deletingId === file.id}
                    >
                      <FaCheck />
                    </button>
                    <button
                      className={styles.cancelButton}
                      title="取消"
                      aria-label={`取消删除 ${file.name}`}
                      onClick={() => setConfirmingId(null)}
                      disabled={deletingId === file.id}
                    >
                      <FaTimes />
                    </button>
                  </span>
                ) : (
                  <button
                    className={styles.trashButton}
                    title="删除"
                    aria-label={`删除 ${file.name}`}
                    onClick={() => setConfirmingId(file.id)}
                    disabled={deletingId === file.id}
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* 删除确认弹窗已移除，直接在列表项内显示确认/取消按钮 */}
    </div>
  );
};

export default RecentFilesSidebar;
