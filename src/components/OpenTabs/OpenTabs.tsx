import React from 'react';
import { LuCode, LuFileText, LuImage, LuX } from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';
import { getFileViewKind } from '@/types/fileTree';
import styles from './OpenTabs.module.css';

interface OpenTabsProps {
  paths: string[];
  activePath: string | null;
  dirtyPath?: string | null;
  leadingControl?: React.ReactNode;
  onActivate(path: string): void;
  onClose(path: string): void;
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

const OpenTabs: React.FC<OpenTabsProps> = ({
  paths,
  activePath,
  dirtyPath,
  leadingControl,
  onActivate,
  onClose,
}) => {
  const { t } = useI18n();
  const tabScrollerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ clientX: number; scrollLeft: number } | null>(null);
  // Tabs that disappeared from `paths` stay rendered briefly to animate out.
  const [closingPaths, setClosingPaths] = React.useState<string[]>([]);
  const prevPathsRef = React.useRef(paths);

  React.useEffect(() => {
    const previous = prevPathsRef.current;
    prevPathsRef.current = paths;
    if (previous === paths) return;
    const removed = previous.filter((path) => !paths.includes(path));
    const added = paths.filter((path) => !previous.includes(path));
    // Renames and "save as" swap one path for another; only animate real closes.
    if (removed.length > 0 && added.length === 0) {
      setClosingPaths((current) => [
        ...current,
        ...removed.filter((path) => !current.includes(path)),
      ]);
    }
  }, [paths]);

  React.useEffect(() => {
    if (closingPaths.length === 0) return;
    const timeout = window.setTimeout(() => setClosingPaths([]), 220);
    return () => window.clearTimeout(timeout);
  }, [closingPaths]);

  const displayPaths = React.useMemo(() => {
    if (closingPaths.length === 0) return paths;
    const merged = [...paths];
    for (const path of closingPaths) {
      if (!merged.includes(path)) merged.push(path);
    }
    return merged;
  }, [paths, closingPaths]);

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
  }, [displayPaths]);

  if (displayPaths.length === 0 && !leadingControl) return null;

  return (
    <div className={styles.tabBar}>
      {leadingControl && <div className={styles.leadingControl}>{leadingControl}</div>}
      <div
        className={styles.tabScroller}
        ref={tabScrollerRef}
        role="tablist"
        aria-label={t('tabs.openFiles')}
      >
        {displayPaths.map((path) => {
          const active = path === activePath;
          const dirty = path === dirtyPath;
          const closing = closingPaths.includes(path);
          const kind = getFileViewKind(path);
          const Icon = kind === 'image' ? LuImage : kind === 'code' ? LuCode : LuFileText;
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
    </div>
  );
};

export default OpenTabs;
