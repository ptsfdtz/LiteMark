import React, { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toolbar.module.css';
import type { ToolbarProps } from '@/types/toolbar';
import {
  LuBold,
  LuCheck,
  LuChevronDown,
  LuCode,
  LuCopy,
  LuFileText,
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
  LuUnlink,
  LuX,
} from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';

const Toolbar: React.FC<ToolbarProps> = ({
  onOpenFolder,
  onOpenDocument,
  onSave,
  onSaveAs,
  className,
  editor,
  disabled,
}) => {
  const { t } = useI18n();
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [editingLink, setEditingLink] = useState(false);
  const [linkPosition, setLinkPosition] = useState({ left: 8, top: 48 });
  const [blockMenuPosition, setBlockMenuPosition] = useState({ left: 8, top: 48 });
  const [openMenuPosition, setOpenMenuPosition] = useState({ left: 8, top: 48 });
  const linkInputId = useId();
  const blockMenuId = useId();
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const blockButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const linkPopoverRef = useRef<HTMLFormElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const openMenuRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
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

  const openLinkEditor = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    setLinkValue(previous ?? 'https://');
    setEditingLink(Boolean(previous));
    setBlockMenuOpen(false);
    setLinkEditorOpen(true);
  }, [editor]);

  useEffect(() => {
    const handleFormattingShortcut = (event: KeyboardEvent) => {
      if (!editor?.isFocused || disabled || event.altKey || (!event.ctrlKey && !event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      let handled = true;
      if (key === 'k' && !event.shiftKey) openLinkEditor();
      else if (key === 'e' && !event.shiftKey) editor.chain().focus().toggleCode().run();
      else if (key === 'x' && event.shiftKey) editor.chain().focus().toggleStrike().run();
      else if (key === 'q' && event.shiftKey) editor.chain().focus().toggleBlockquote().run();
      else handled = false;

      if (!handled) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleFormattingShortcut, { capture: true });
    return () => window.removeEventListener('keydown', handleFormattingShortcut, { capture: true });
  }, [disabled, editor, openLinkEditor]);

  useEffect(() => {
    if (!linkEditorOpen) return;
    const updatePosition = () => {
      const rect = linkButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverWidth = Math.min(332, window.innerWidth - 16);
      setLinkPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8)),
        top: rect.bottom + 6,
      });
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!linkButtonRef.current?.contains(target) && !linkPopoverRef.current?.contains(target)) {
        setLinkEditorOpen(false);
      }
    };
    updatePosition();
    const focusFrame = window.requestAnimationFrame(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    });
    window.addEventListener('resize', updatePosition);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [linkEditorOpen]);

  useEffect(() => {
    if (!blockMenuOpen) return;
    const updatePosition = () => {
      const rect = blockButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 136;
      setBlockMenuPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
        top: rect.bottom + 6,
      });
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!blockButtonRef.current?.contains(target) && !blockMenuRef.current?.contains(target)) {
        setBlockMenuOpen(false);
      }
    };
    updatePosition();
    const focusFrame = window.requestAnimationFrame(() => {
      blockMenuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    });
    window.addEventListener('resize', updatePosition);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [blockMenuOpen]);

  useEffect(() => {
    if (!openMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!openButtonRef.current?.contains(target) && !openMenuRef.current?.contains(target)) {
        setOpenMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuOpen(false);
        openButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenuOpen]);

  const applyLink = () => {
    if (!editor) return;
    const href = linkValue.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkEditorOpen(false);
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkEditorOpen(false);
  };

  const addImage = () => {
    if (!editor) return;
    const src = window.prompt(t('toolbar.imagePrompt'), 'https://');
    if (src?.trim()) editor.chain().focus().setImage({ src: src.trim() }).run();
  };

  const formatDisabled = disabled || !editor;
  const activeBlock = editor?.isActive('heading', { level: 1 })
    ? 1
    : editor?.isActive('heading', { level: 2 })
      ? 2
      : editor?.isActive('heading', { level: 3 })
        ? 3
        : 0;
  const blockOptions = [
    { value: 0, label: t('toolbar.paragraph') },
    { value: 1, label: t('toolbar.heading1') },
    { value: 2, label: t('toolbar.heading2') },
    { value: 3, label: t('toolbar.heading3') },
  ] as const;

  const applyBlock = (level: number) => {
    if (!editor) return;
    if (level === 0) editor.chain().focus().setParagraph().run();
    else
      editor
        .chain()
        .focus()
        .setHeading({ level: level as 1 | 2 | 3 })
        .run();
    setBlockMenuOpen(false);
    blockButtonRef.current?.focus();
  };

  const handleBlockMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setBlockMenuOpen(false);
      blockButtonRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(
      blockMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [],
    );
    const currentIndex = Math.max(0, options.indexOf(document.activeElement as HTMLButtonElement));
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1) % options.length
            : (currentIndex - 1 + options.length) % options.length;
    options[nextIndex]?.focus();
  };

  return (
    <div className={`${styles.toolbar} ${className ?? ''}`} data-tauri-drag-region="true">
      <div className={styles.group}>
        {(onOpenFolder || onOpenDocument) && (
          <button
            ref={openButtonRef}
            className="folderButton"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setOpenMenuPosition({ left: Math.max(8, rect.left), top: rect.bottom + 6 });
              setLinkEditorOpen(false);
              setBlockMenuOpen(false);
              setOpenMenuOpen((open) => !open);
            }}
            title={t('toolbar.open')}
            aria-label={t('toolbar.open')}
            aria-haspopup="menu"
            aria-expanded={openMenuOpen}
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
        <button
          ref={blockButtonRef}
          type="button"
          className={`${styles.blockMenuButton} ${blockMenuOpen ? styles.active : ''}`}
          onClick={() => {
            setLinkEditorOpen(false);
            setBlockMenuOpen((open) => !open);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setLinkEditorOpen(false);
              setBlockMenuOpen(true);
            }
          }}
          aria-label={t('toolbar.heading')}
          aria-haspopup="listbox"
          aria-expanded={blockMenuOpen}
          aria-controls={blockMenuOpen ? blockMenuId : undefined}
          title={t('toolbar.heading')}
          disabled={formatDisabled}
          {...noDrag}
        >
          <span>{blockOptions[activeBlock].label}</span>
          <LuChevronDown aria-hidden="true" />
        </button>
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
          ref={linkButtonRef}
          className={editor?.isActive('link') || linkEditorOpen ? styles.active : ''}
          aria-pressed={editor?.isActive('link') ?? false}
          onClick={openLinkEditor}
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
      {linkEditorOpen &&
        createPortal(
          <form
            ref={linkPopoverRef}
            className={styles.linkPopover}
            style={linkPosition}
            role="dialog"
            aria-label={t('toolbar.linkEditorTitle')}
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setLinkEditorOpen(false);
                linkButtonRef.current?.focus();
              }
            }}
          >
            <label className={styles.linkLabel} htmlFor={linkInputId}>
              {t('toolbar.linkPrompt')}
            </label>
            <div className={styles.linkEditorRow}>
              <input
                ref={linkInputRef}
                id={linkInputId}
                className={styles.linkInput}
                type="text"
                inputMode="url"
                name="link-url"
                autoComplete="off"
                spellCheck={false}
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                placeholder="https://example.com"
              />
              {editingLink && (
                <button
                  type="button"
                  className={styles.linkActionButton}
                  onClick={removeLink}
                  title={t('toolbar.removeLink')}
                  aria-label={t('toolbar.removeLink')}
                >
                  <LuUnlink aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                className={`${styles.linkActionButton} ${styles.applyLinkButton}`}
                title={t('toolbar.applyLink')}
                aria-label={t('toolbar.applyLink')}
              >
                <LuCheck aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.linkActionButton}
                onClick={() => {
                  setLinkEditorOpen(false);
                  linkButtonRef.current?.focus();
                }}
                title={t('toolbar.cancelLink')}
                aria-label={t('toolbar.cancelLink')}
              >
                <LuX aria-hidden="true" />
              </button>
            </div>
          </form>,
          document.body,
        )}
      {blockMenuOpen &&
        createPortal(
          <div
            ref={blockMenuRef}
            id={blockMenuId}
            className={styles.blockMenu}
            style={blockMenuPosition}
            role="listbox"
            aria-label={t('toolbar.heading')}
            onKeyDown={handleBlockMenuKeyDown}
          >
            {blockOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.blockMenuOption} ${
                  activeBlock === option.value ? styles.selectedBlockOption : ''
                }`}
                role="option"
                aria-selected={activeBlock === option.value}
                tabIndex={activeBlock === option.value ? 0 : -1}
                onClick={() => applyBlock(option.value)}
              >
                <span className={styles.optionCheck} aria-hidden="true">
                  {activeBlock === option.value && <LuCheck />}
                </span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      {openMenuOpen &&
        createPortal(
          <div
            ref={openMenuRef}
            className={styles.openMenu}
            role="menu"
            aria-label={t('toolbar.open')}
            style={openMenuPosition}
          >
            {onOpenDocument && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenuOpen(false);
                  onOpenDocument();
                }}
              >
                <LuFileText aria-hidden="true" />
                <span>{t('toolbar.openFile')}</span>
                <kbd aria-hidden="true">Ctrl+O</kbd>
              </button>
            )}
            {onOpenFolder && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenuOpen(false);
                  onOpenFolder();
                }}
              >
                <LuFolderOpen aria-hidden="true" />
                <span>{t('toolbar.openFolder')}</span>
                <kbd aria-hidden="true">Ctrl+Shift+O</kbd>
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Toolbar;
