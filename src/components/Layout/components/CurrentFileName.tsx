// src/components/Layout/hooks/CurrentFileName.tsx
import React from 'react';
import styles from '../Layout.module.css';
import { RecentFile } from '../../../types/recentFiles';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';

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
  const [value, setValue] = React.useState(filePath.split(/[/\\\\]/).pop() || '');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setValue(filePath.split(/[/\\\\]/).pop() || '');
  }, [filePath]);

  React.useEffect(() => {
    if (forceEdit) {
      setEditing(true);
      setTimeout(() => {
        const cur = inputRef.current;
        if (cur) {
          cur.focus();
          cur.select();
        }
        if (setForceEdit) {
          setForceEdit(false);
        }
      }, 0);
    }
  }, [forceEdit, setForceEdit]);

  const handleRename = async () => {
    let newName = value.trim();
    if (!newName || newName === filePath.split(/[/\\\\]/).pop()) {
      setEditing(false);
      return;
    }
    if (!/\.[a-zA-Z0-9]+$/.test(newName)) {
      newName += '.md';
    }
    const dir = filePath.replace(/[/\\\\][^/\\\\]+$/, '');
    const newPath =
      dir +
      (dir.endsWith('/') || dir.endsWith('\\\\') ? '' : dir.includes('\\\\') ? '\\\\' : '/') +
      newName;
    try {
      const exists = await invoke('file_exists', { path: newPath });
      if (exists) {
        await message('该文件名已存在，请输入其他名称。', {
          title: '重命名失败',
        });
        setEditing(true);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      await invoke('rename_file', { oldPath: filePath, newPath });
      setCurrentFilePath(newPath);
      setRecentFiles((prev) =>
        prev.map((f) =>
          f.path === filePath ? { ...f, id: newPath, name: newName, path: newPath } : f,
        ),
      );
    } catch (err) {
      console.error('重命名失败:', err);
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
        if (e.key === 'Enter') handleRename();
        if (e.key === 'Escape') setEditing(false);
      }}
      style={{ minWidth: 60, maxWidth: 300 }}
    />
  ) : (
    <div
      className={styles.currentFileName}
      title="双击重命名"
      style={{ cursor: 'pointer', userSelect: 'text' }}
      onDoubleClick={() => setEditing(true)}
    >
      {filePath.split(/[/\\\\]/).pop()}
    </div>
  );
};

export default CurrentFileName;
