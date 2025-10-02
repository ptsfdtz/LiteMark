import React from "react";
import styles from "./RecentFilesSidebar.module.css";
import { RecentFile } from "../../types/recentFiles";

interface RecentFilesSidebarProps {
  files: RecentFile[];
  onSelectFile: (file: RecentFile) => void;
  onClose: () => void;
  isOpen: boolean;
}

const RecentFilesSidebar: React.FC<RecentFilesSidebarProps> = ({
  files,
  onSelectFile,
  onClose,
  isOpen,
}) => {
  return (
    <div
      className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}
    >
      <div className={styles.header}>
        <button onClick={onClose} className={styles.closeButton}>
          ×
        </button>
        <h3>最近的文件</h3>
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
