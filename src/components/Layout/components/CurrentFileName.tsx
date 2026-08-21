// src/components/Layout/components/CurrentFileName.tsx
import React from 'react';
import styles from '@/components/Layout/Layout.module.css';
import { message } from '@tauri-apps/plugin-dialog';
import { useI18n } from '@/locales/useI18n';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { LuCopy, LuFolderOpen, LuPenLine } from 'react-icons/lu';
import ContextMenu from '@/components/ContextMenu/ContextMenu';

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
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);
  const fileName = filePath.split(/[/\\]/).pop() || '';

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
      className={`${styles.currentFileName} ${styles.currentFileNameInput}`}
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
    />
  ) : (
    <>
      <button
        type="button"
        className={styles.currentFileName}
        title={isDirty ? t('file.unsaved') : t('file.renameHint')}
        onDoubleClick={() => setEditing(true)}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'F2') setEditing(true);
        }}
      >
        {fileName}
        {isDirty ? ' *' : ''}
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={t('file.actions')}
          onClose={() => setMenu(null)}
          items={[
            {
              id: 'rename',
              label: t('file.rename'),
              icon: <LuPenLine />,
              shortcut: 'F2',
              onSelect: () => setEditing(true),
            },
            {
              id: 'copy-name',
              label: t('file.copyName'),
              icon: <LuCopy />,
              onSelect: () => void navigator.clipboard.writeText(fileName),
            },
            {
              id: 'copy-path',
              label: t('explorer.copyAbsolutePath'),
              icon: <LuCopy />,
              onSelect: () => void navigator.clipboard.writeText(filePath),
            },
            {
              id: 'reveal',
              label: t('explorer.revealInFileExplorer'),
              icon: <LuFolderOpen />,
              onSelect: () => void revealItemInDir(filePath),
            },
          ]}
        />
      )}
    </>
  );
};

export default CurrentFileName;
