import React, { useEffect, useReducer } from 'react';
import styles from './Toolbar.module.css';
import type { ToolbarProps } from '@/types/toolbar';
import {
  LuBold,
  LuCode,
  LuCopy,
  LuFolderOpen,
  LuImage,
  LuItalic,
  LuLink2,
  LuList,
  LuListOrdered,
  LuQuote,
  LuRedo2,
  LuSave,
  LuStrikethrough,
  LuTable2,
  LuUndo2,
} from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';

const Toolbar: React.FC<ToolbarProps> = ({
  onOpenFolder,
  onSave,
  onSaveAs,
  className,
  editor,
  disabled,
}) => {
  const { t } = useI18n();
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const noDrag = { 'data-tauri-drag-region': 'false' } as const;

  useEffect(() => {
    if (!editor) return;
    const update = () => refresh();
    editor.on('transaction', update);
    return () => editor.off('transaction', update);
  }, [editor]);

  const run = (command: () => boolean) => {
    if (!disabled && editor) command();
  };

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt(t('toolbar.linkPrompt'), previous ?? 'https://');
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
  };

  const addImage = () => {
    if (!editor) return;
    const src = window.prompt(t('toolbar.imagePrompt'), 'https://');
    if (src?.trim()) editor.chain().focus().setImage({ src: src.trim() }).run();
  };

  const formatDisabled = disabled || !editor;

  return (
    <div className={`${styles.toolbar} ${className ?? ''}`} data-tauri-drag-region="true">
      <div className={styles.group}>
        {onOpenFolder && (
          <button
            className="folderButton"
            onClick={onOpenFolder}
            title={t('toolbar.recentFiles')}
            aria-label={t('toolbar.recentFiles')}
            disabled={disabled}
            {...noDrag}
          >
            <LuFolderOpen />
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            title={t('toolbar.save')}
            aria-label={t('toolbar.save')}
            disabled={disabled}
            {...noDrag}
          >
            <LuSave />
          </button>
        )}
        {onSaveAs && (
          <button
            onClick={onSaveAs}
            title={t('toolbar.saveAs')}
            aria-label={t('toolbar.saveAs')}
            disabled={disabled}
            {...noDrag}
          >
            <LuCopy />
          </button>
        )}
      </div>

      <span className={styles.divider} />

      <div className={styles.group}>
        <button
          onClick={() => run(() => editor!.chain().focus().undo().run())}
          title={t('toolbar.undo')}
          aria-label={t('toolbar.undo')}
          disabled={formatDisabled || !editor?.can().undo()}
          {...noDrag}
        >
          <LuUndo2 />
        </button>
        <button
          onClick={() => run(() => editor!.chain().focus().redo().run())}
          title={t('toolbar.redo')}
          aria-label={t('toolbar.redo')}
          disabled={formatDisabled || !editor?.can().redo()}
          {...noDrag}
        >
          <LuRedo2 />
        </button>
      </div>

      <span className={styles.divider} />

      <div className={styles.group}>
        <select
          className={styles.blockSelect}
          value={
            editor?.isActive('heading', { level: 1 })
              ? '1'
              : editor?.isActive('heading', { level: 2 })
                ? '2'
                : editor?.isActive('heading', { level: 3 })
                  ? '3'
                  : '0'
          }
          onChange={(event) => {
            const level = Number(event.target.value);
            if (!editor) return;
            if (level === 0) editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .toggleHeading({ level: level as 1 | 2 | 3 })
                .run();
          }}
          aria-label={t('toolbar.heading')}
          title={t('toolbar.heading')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <option value="0">{t('toolbar.paragraph')}</option>
          <option value="1">{t('toolbar.heading1')}</option>
          <option value="2">{t('toolbar.heading2')}</option>
          <option value="3">{t('toolbar.heading3')}</option>
        </select>
        <button
          className={editor?.isActive('bold') ? styles.active : ''}
          aria-pressed={editor?.isActive('bold') ?? false}
          onClick={() => run(() => editor!.chain().focus().toggleBold().run())}
          title={t('toolbar.bold')}
          aria-label={t('toolbar.bold')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuBold />
        </button>
        <button
          className={editor?.isActive('italic') ? styles.active : ''}
          aria-pressed={editor?.isActive('italic') ?? false}
          onClick={() => run(() => editor!.chain().focus().toggleItalic().run())}
          title={t('toolbar.italic')}
          aria-label={t('toolbar.italic')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuItalic />
        </button>
        <button
          className={editor?.isActive('strike') ? styles.active : ''}
          aria-pressed={editor?.isActive('strike') ?? false}
          onClick={() => run(() => editor!.chain().focus().toggleStrike().run())}
          title={t('toolbar.strikethrough')}
          aria-label={t('toolbar.strikethrough')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuStrikethrough />
        </button>
        <button
          className={editor?.isActive('code') ? styles.active : ''}
          aria-pressed={editor?.isActive('code') ?? false}
          onClick={() => run(() => editor!.chain().focus().toggleCode().run())}
          title={t('toolbar.code')}
          aria-label={t('toolbar.code')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuCode />
        </button>
        <button
          className={editor?.isActive('link') ? styles.active : ''}
          aria-pressed={editor?.isActive('link') ?? false}
          onClick={setLink}
          title={t('toolbar.link')}
          aria-label={t('toolbar.link')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuLink2 />
        </button>
      </div>

      <span className={styles.divider} />

      <div className={styles.group}>
        <button
          className={editor?.isActive('bulletList') ? styles.active : ''}
          aria-pressed={editor?.isActive('bulletList') ?? false}
          onClick={() => run(() => editor!.chain().focus().toggleBulletList().run())}
          title={t('toolbar.unorderedList')}
          aria-label={t('toolbar.unorderedList')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuList />
        </button>
        <button
          className={editor?.isActive('orderedList') ? styles.active : ''}
          aria-pressed={editor?.isActive('orderedList') ?? false}
          onClick={() => run(() => editor!.chain().focus().toggleOrderedList().run())}
          title={t('toolbar.orderedList')}
          aria-label={t('toolbar.orderedList')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuListOrdered />
        </button>
        <button
          className={editor?.isActive('blockquote') ? styles.active : ''}
          aria-pressed={editor?.isActive('blockquote') ?? false}
          onClick={() => run(() => editor!.chain().focus().toggleBlockquote().run())}
          title={t('toolbar.quote')}
          aria-label={t('toolbar.quote')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuQuote />
        </button>
        <button
          onClick={() =>
            run(() =>
              editor!.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
            )
          }
          title={t('toolbar.table')}
          aria-label={t('toolbar.table')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuTable2 />
        </button>
        <button
          onClick={addImage}
          title={t('toolbar.image')}
          aria-label={t('toolbar.image')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <LuImage />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
