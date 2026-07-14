// src/components/Layout/components/CurrentFileName.tsx
import React from 'react';
import styles from '@/components/Layout/Layout.module.css';
import { message } from '@tauri-apps/plugin-dialog';
import { useI18n } from '@/locales/useI18n';

interface CurrentFileNameProps {
  filePath: string;
  onRename: (newName: string) => Promise<boolean>;
  isDirty?: boolean;
  forceEdit?: boolean;
  setForceEdit?: (v: boolean) => void;
}

const CurrentFileName: React.FC<CurrentFileNameProps> = ({
  filePath,
  onRename,
  isDirty,
  forceEdit,
  setForceEdit,
}) => {
  const { t } = useI18n();
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
    try {
      const renamed = await onRename(newName);
      if (!renamed) {
        setEditing(true);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
    } catch (err) {
      console.error('重命名失败:', err);
      const category = (err as { category?: string } | null)?.category;
      await message(
        category === 'already_exists' ? t('dialog.renameExists') : t('dialog.renameFailed'),
        { title: t('dialog.renameFailed') },
      );
      setEditing(true);
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
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
        if (e.key === 'Escape') {
          setValue(filePath.split(/[/\\]/).pop() || '');
          setEditing(false);
        }
      }}
      style={{ minWidth: 60, maxWidth: 300 }}
    />
  ) : (
    <div
      className={styles.currentFileName}
      title={isDirty ? t('file.unsaved') : t('file.renameHint')}
      style={{ cursor: 'pointer', userSelect: 'text' }}
      onDoubleClick={() => setEditing(true)}
    >
      {filePath.split(/[/\\\\]/).pop()}
      {isDirty ? ' *' : ''}
    </div>
  );
};

export default CurrentFileName;
