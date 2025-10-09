import React from "react";
import styles from "./RecentFilesSidebar.module.css";
import { RecentFile } from "../../types/recentFiles";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FaFolderOpen, FaFile, FaFileAlt } from "react-icons/fa";

interface RecentFilesSidebarProps {
  files: RecentFile[];
  onSelectFile: (file: RecentFile) => void;
  onClose: () => void;
  isOpen: boolean;
  onLoadFile?: (path: string, content: string) => void;
  onLoadDir?: (
    files: { id: string; name: string; path: string; modified: Date }[]
  ) => void;
  onNewFile?: (path: string, content: string) => void;
}

const RecentFilesSidebar: React.FC<RecentFilesSidebarProps> = ({
  files,
  onSelectFile,
  onClose,
  isOpen,
  onLoadFile,
  onLoadDir,
  onNewFile,
}) => {
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
      onClose();
    } catch (err) {
      console.error("打开文件失败:", err);
    }
  };

  const handleNewFile = async () => {
    try {
      const target = await save({
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
        defaultPath: "untitled.md",
      });
      if (!target) return;
      const initialContent = "# 新建文档\n\n";
      await invoke("write_text_file", {
        path: target,
        content: initialContent,
      });
      if (onNewFile) onNewFile(target, initialContent);
      onClose();
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
      className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}
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
          onClick={onClose}
          className={styles.closeButton}
          title="关闭"
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <div className={styles.filesList}>
        {files.length === 0 ? (
          <div className={styles.noFiles}>暂无最近文件</div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              className={styles.fileItem}
              onClick={() => onSelectFile(file)}
            >
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.filePath}>{file.path}</div>
              <div className={styles.fileModified}>
                {file.modified.toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentFilesSidebar;
