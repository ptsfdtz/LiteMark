import React from 'react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  LuCode,
  LuCopy,
  LuFileText,
  LuFileType,
  LuFolderOpen,
  LuImage,
  LuTrash2,
  LuX,
} from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';
import { getFileViewKind } from '@/types/fileTree';
import styles from './OpenTabs.module.css';
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import { LuFilePlus2, LuRotateCcw } from 'react-icons/lu';

interface OpenTabsProps {
  paths: string[];
  activePath: string | null;
  dirtyPath?: string | null;
  leadingControl?: React.ReactNode;
  trailingControl?: React.ReactNode;
  onActivate(path: string): void;
  onClose(path: string): void;
  onCloseAll(): void;
  onCloseOthers(path: string): void;
  onDelete(path: string): Promise<boolean>;
  onCreate?: () => void;
  onReopen?: (path: string) => void;
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

const copyText = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
};

const OpenTabs: React.FC<OpenTabsProps> = ({
  paths,
  activePath,
  dirtyPath,
  leadingControl,
  trailingControl,
  onActivate,
  onClose,
  onCloseAll,
  onCloseOthers,
  onDelete,
  onCreate,
  onReopen,
}) => {
  const { t } = useI18n();
  const tabScrollerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ clientX: number; scrollLeft: number } | null>(null);
  // Keep removed tabs at their original positions until their exit transition finishes.
  const [renderedPaths, setRenderedPaths] = React.useState(paths);
  const [closingPaths, setClosingPaths] = React.useState<string[]>([]);
  const [contextMenu, setContextMenu] = React.useState<{
    path: string;
    x: number;
    y: number;
  } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState<string | null>(null);
  const [barMenu, setBarMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [lastClosedPath, setLastClosedPath] = React.useState<string | null>(null);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  const prevPathsRef = React.useRef(paths);

  React.useLayoutEffect(() => {
    const previous = prevPathsRef.current;
    prevPathsRef.current = paths;
    if (previous === paths) return;
    const removed = previous.filter((path) => !paths.includes(path));
    const added = paths.filter((path) => !previous.includes(path));
    if (removed.length > 0 && added.length === 0) {
      setLastClosedPath(removed[removed.length - 1]);
    }
    // Renames and "save as" swap one path for another; only animate real closes.
    if (removed.length > 0 && added.length === 0) {
      setClosingPaths((current) => [
        ...current,
        ...removed.filter((path) => !current.includes(path)),
      ]);
      setRenderedPaths((current) => {
        const retained = current.filter(
          (path) => paths.includes(path) || removed.includes(path) || closingPaths.includes(path),
        );
        return [...retained, ...paths.filter((path) => !retained.includes(path))];
      });
    } else {
      setClosingPaths([]);
      setRenderedPaths(paths);
    }
  }, [closingPaths, paths]);

  React.useEffect(() => {
    if (closingPaths.length === 0) return;
    const timeout = window.setTimeout(() => {
      setClosingPaths([]);
      setRenderedPaths(paths);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [closingPaths, paths]);

  React.useEffect(() => {
    const scroller = tabScrollerRef.current;
    if (!scroller) return;

    const updateThumb = () => {
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const overflowing = maxScroll > 1;
      const width = overflowing
        ? Math.max(24, (scroller.clientWidth / scroller.scrollWidth) * scroller.clientWidth)
        : 0;
      const travel = Math.max(0, scroller.clientWidth - width);
      const left = maxScroll > 0 ? (scroller.scrollLeft / maxScroll) * travel : 0;
      scroller.dataset.overflowing = String(overflowing);
      scroller.style.setProperty('--tab-scroll-width', `${width}px`);
      scroller.style.setProperty('--tab-scroll-left', `${left}px`);
    };

    updateThumb();
    scroller.addEventListener('scroll', updateThumb, { passive: true });
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateThumb);
    resizeObserver?.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', updateThumb);
      resizeObserver?.disconnect();
    };
  }, [renderedPaths]);

  React.useEffect(() => {
    if (!contextMenu) return;
    const dismiss = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', dismiss);
    window.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      window.removeEventListener('keydown', dismissOnEscape);
    };
  }, [contextMenu]);

  if (renderedPaths.length === 0 && !leadingControl && !trailingControl) return null;

  return (
    <div
      className={styles.tabBar}
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).closest(`.${styles.tab}`)) return;
        event.preventDefault();
        setBarMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {leadingControl && <div className={styles.leadingControl}>{leadingControl}</div>}
      <div
        className={styles.tabScroller}
        ref={tabScrollerRef}
        role="tablist"
        aria-label={t('tabs.openFiles')}
      >
        {renderedPaths.map((path) => {
          const active = path === activePath;
          const dirty = path === dirtyPath;
          const closing = closingPaths.includes(path);
          const kind = getFileViewKind(path);
          const Icon =
            kind === 'image'
              ? LuImage
              : kind === 'pdf'
                ? LuFileType
                : kind === 'code'
                  ? LuCode
                  : LuFileText;
          const name = fileName(path);

          return (
            <div
              className={`${styles.tab} ${active ? styles.active : ''} ${closing ? styles.closing : ''}`}
              key={path}
              role="tab"
              aria-selected={active}
              aria-hidden={closing || undefined}
            >
              <button
                type="button"
                className={styles.activateButton}
                onClick={() => onActivate(path)}
                title={path}
                tabIndex={active ? 0 : -1}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({
                    path,
                    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 232)),
                    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 356)),
                  });
                }}
              >
                <Icon className={styles.fileIcon} aria-hidden="true" />
                <span className={styles.name}>{name}</span>
                {dirty && <span className={styles.dirtyDot} title={t('file.unsaved')} />}
              </button>
              <button
                type="button"
                className={styles.closeButton}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(path);
                }}
                title={t('tabs.close', { name })}
                aria-label={t('tabs.close', { name })}
              >
                <LuX aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      {trailingControl && <div className={styles.trailingControl}>{trailingControl}</div>}
      <span
        className={styles.scrollThumb}
        aria-hidden="true"
        onPointerDown={(event) => {
          const scroller = tabScrollerRef.current;
          if (!scroller) return;
          dragRef.current = { clientX: event.clientX, scrollLeft: scroller.scrollLeft };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const scroller = tabScrollerRef.current;
          const drag = dragRef.current;
          if (!scroller || !drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const thumbWidth = event.currentTarget.offsetWidth;
          const travel = Math.max(1, scroller.clientWidth - thumbWidth);
          const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
          scroller.scrollLeft =
            drag.scrollLeft + ((event.clientX - drag.clientX) / travel) * maxScroll;
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      />
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          role="menu"
          aria-label={t('tabs.actions', { name: fileName(contextMenu.path) })}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              const { path } = contextMenu;
              setContextMenu(null);
              onClose(path);
            }}
          >
            <LuX aria-hidden="true" />
            <span>{t('tabs.closeTab')}</span>
            <kbd aria-hidden="true">Ctrl+W</kbd>
          </button>
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            disabled={paths.length <= 1}
            onClick={() => {
              const { path } = contextMenu;
              setContextMenu(null);
              onCloseOthers(path);
            }}
          >
            <LuX aria-hidden="true" />
            <span>{t('tabs.closeOthers')}</span>
          </button>
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              onCloseAll();
            }}
          >
            <LuX aria-hidden="true" />
            <span>{t('tabs.closeAll')}</span>
          </button>
          <div className={styles.contextMenuDivider} role="separator" />
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              void revealItemInDir(contextMenu.path).catch((error) => {
                console.error('Failed to reveal file:', error);
              });
            }}
          >
            <LuFolderOpen aria-hidden="true" />
            <span>{t('explorer.revealInFileExplorer')}</span>
          </button>
          <div className={styles.contextMenuDivider} role="separator" />
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              void copyText(contextMenu.path);
            }}
          >
            <LuCopy aria-hidden="true" />
            <span>{t('explorer.copyAbsolutePath')}</span>
          </button>
          <div className={styles.contextMenuDivider} role="separator" />
          <button
            type="button"
            className={`${styles.contextMenuItem} ${styles.deleteMenuItem}`}
            role="menuitem"
            onClick={() => {
              setConfirmingDelete(contextMenu.path);
              setContextMenu(null);
            }}
          >
            <LuTrash2 aria-hidden="true" />
            <span>{t('explorer.deleteFile')}</span>
          </button>
        </div>
      )}
      {barMenu && (
        <ContextMenu
          x={barMenu.x}
          y={barMenu.y}
          label={t('tabs.barActions')}
          onClose={() => setBarMenu(null)}
          items={[
            {
              id: 'new',
              label: t('explorer.newFile'),
              icon: <LuFilePlus2 />,
              disabled: !onCreate,
              onSelect: onCreate,
            },
            {
              id: 'reopen',
              label: t('tabs.reopenClosed'),
              icon: <LuRotateCcw />,
              disabled: !lastClosedPath || !onReopen,
              onSelect: () => lastClosedPath && onReopen?.(lastClosedPath),
            },
            {
              id: 'close-all',
              label: t('tabs.closeAll'),
              icon: <LuX />,
              disabled: paths.length === 0,
              onSelect: onCloseAll,
            },
          ]}
        />
      )}
      {confirmingDelete && (
        <div className={styles.deleteDialogBackdrop} role="presentation">
          <div
            className={styles.deleteDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deleteTabFileTitle"
            aria-describedby="deleteTabFileDescription"
          >
            <h2 id="deleteTabFileTitle">{t('explorer.confirmDeleteTitle')}</h2>
            <p id="deleteTabFileDescription">
              {t('explorer.confirmDeleteDescription', { name: fileName(confirmingDelete) })}
            </p>
            <div className={styles.deleteDialogActions}>
              <button type="button" onClick={() => setConfirmingDelete(null)} autoFocus>
                {t('explorer.cancelDelete')}
              </button>
              <button
                type="button"
                className={styles.deleteConfirmButton}
                onClick={() => {
                  const path = confirmingDelete;
                  setConfirmingDelete(null);
                  void onDelete(path);
                }}
              >
                {t('explorer.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenTabs;
