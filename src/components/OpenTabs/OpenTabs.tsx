import React from 'react';
import { LuCode, LuFileText, LuImage, LuX } from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';
import { getFileViewKind } from '@/types/fileTree';
import styles from './OpenTabs.module.css';

interface OpenTabsProps {
  paths: string[];
  activePath: string | null;
  dirtyPath?: string | null;
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
  onActivate,
  onClose,
}) => {
  const { t } = useI18n();
  const tabScrollerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ clientX: number; scrollLeft: number } | null>(null);

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
  }, [paths]);

  if (paths.length === 0) return null;

  return (
    <div className={styles.tabBar} role="tablist" aria-label={t('tabs.openFiles')}>
      <div className={styles.tabScroller} ref={tabScrollerRef}>
        {paths.map((path) => {
          const active = path === activePath;
          const dirty = path === dirtyPath;
          const kind = getFileViewKind(path);
          const Icon = kind === 'image' ? LuImage : kind === 'code' ? LuCode : LuFileText;
          const name = fileName(path);

          return (
            <div
              className={`${styles.tab} ${active ? styles.active : ''}`}
              key={path}
              role="tab"
              aria-selected={active}
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
