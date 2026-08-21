import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuChevronLeft,
  LuChevronRight,
  LuCopy,
  LuFolderOpen,
  LuFileX2,
  LuMaximize2,
  LuZoomIn,
  LuZoomOut,
} from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';
import { loadPdfDocument, type PdfDocumentHandle, type PdfPageSize } from '@/modules/pdfPreview';
import styles from './PdfPreview.module.css';
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

interface PdfPreviewProps {
  filePath: string;
  className?: string;
}

const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const VIEWPORT_PADDING = 48;

const PdfPreviewContent: React.FC<PdfPreviewProps> = ({ filePath, className }) => {
  const { t } = useI18n();
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentHandle | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PdfPageSize | null>(null);
  const [viewportSize, setViewportSize] = useState<PdfPageSize>({ width: 0, height: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  useEffect(() => {
    let active = true;
    let handle: PdfDocumentHandle | null = null;
    loadPdfDocument(filePath)
      .then((loaded) => {
        if (active) {
          handle = loaded;
          setPdfDocument(loaded);
          setLoading(false);
        } else {
          void loaded.destroy();
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setFailed(true);
        }
      });
    return () => {
      active = false;
      void handle?.destroy();
    };
  }, [filePath]);

  useEffect(() => {
    if (!pdfDocument) return;
    let active = true;
    void pdfDocument.getPageSize(page).then((size) => {
      if (active) setPageSize(size);
    });
    return () => {
      active = false;
    };
  }, [pdfDocument, page]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (fit && pageSize && viewportSize.width > 0 && viewportSize.height > 0) {
      const availableWidth = Math.max(viewportSize.width - VIEWPORT_PADDING, 1);
      const availableHeight = Math.max(viewportSize.height - VIEWPORT_PADDING, 1);
      return Math.min(availableWidth / pageSize.width, availableHeight / pageSize.height);
    }
    return zoom;
  }, [fit, pageSize, viewportSize, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdfDocument || !canvas || !pageSize || scale <= 0) return;
    let cancelled = false;
    pdfDocument.renderPage(page, canvas, scale).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof Error && error.name === 'RenderingCancelledException') return;
      setFailed(true);
    });
    return () => {
      cancelled = true;
      pdfDocument.cancelRender();
    };
  }, [pdfDocument, page, pageSize, scale]);

  const changeZoom = (delta: number) => {
    setFit(false);
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + delta)));
  };

  const changePage = (delta: number) => {
    if (!pdfDocument) return;
    setPage((current) => Math.min(pdfDocument.pageCount, Math.max(1, current + delta)));
  };

  return (
    <div
      className={`${styles.preview} ${className ?? ''}`}
      data-tour="editor"
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className={styles.previewBar}>
        <div className={styles.documentMeta}>
          <span className={styles.fileName} title={filePath}>
            {fileName}
          </span>
          {pdfDocument && (
            <span className={styles.pageIndicator}>
              {page} / {pdfDocument.pageCount}
            </span>
          )}
        </div>
        <div className={styles.previewActions}>
          <button
            type="button"
            onClick={() => changePage(-1)}
            title={t('pdf.previousPage')}
            aria-label={t('pdf.previousPage')}
            disabled={!pdfDocument || page <= 1}
          >
            <LuChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => changePage(1)}
            title={t('pdf.nextPage')}
            aria-label={t('pdf.nextPage')}
            disabled={!pdfDocument || page >= pdfDocument.pageCount}
          >
            <LuChevronRight aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => changeZoom(-ZOOM_STEP)}
            title={t('pdf.zoomOut')}
            aria-label={t('pdf.zoomOut')}
            disabled={zoom <= MIN_ZOOM && !fit}
          >
            <LuZoomOut aria-hidden="true" />
          </button>
          <span className={styles.zoomValue}>
            {fit ? t('pdf.fit') : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            type="button"
            onClick={() => changeZoom(ZOOM_STEP)}
            title={t('pdf.zoomIn')}
            aria-label={t('pdf.zoomIn')}
            disabled={zoom >= MAX_ZOOM && !fit}
          >
            <LuZoomIn aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setFit(true)}
            title={t('pdf.fitWindow')}
            aria-label={t('pdf.fitWindow')}
          >
            <LuMaximize2 aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={styles.viewport} ref={viewportRef}>
        {loading && !failed && <div className={styles.status}>{t('pdf.loading')}</div>}
        {failed ? (
          <div className={styles.error} role="alert">
            <LuFileX2 aria-hidden="true" />
            <span>{t('pdf.loadFailed')}</span>
          </div>
        ) : (
          pdfDocument && (
            <div className={styles.pageFrame}>
              <canvas ref={canvasRef} className={styles.pageCanvas} />
            </div>
          )
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          label={t('pdf.contextActions')}
          onClose={() => setContextMenu(null)}
          items={[
            {
              id: 'previous',
              label: t('pdf.previousPage'),
              icon: <LuChevronLeft />,
              disabled: !pdfDocument || page <= 1,
              onSelect: () => changePage(-1),
            },
            {
              id: 'next',
              label: t('pdf.nextPage'),
              icon: <LuChevronRight />,
              disabled: !pdfDocument || page >= pdfDocument.pageCount,
              onSelect: () => changePage(1),
            },
            {
              id: 'zoom-out',
              label: t('pdf.zoomOut'),
              icon: <LuZoomOut />,
              onSelect: () => changeZoom(-ZOOM_STEP),
            },
            {
              id: 'zoom-in',
              label: t('pdf.zoomIn'),
              icon: <LuZoomIn />,
              onSelect: () => changeZoom(ZOOM_STEP),
            },
            {
              id: 'fit',
              label: t('pdf.fitWindow'),
              icon: <LuMaximize2 />,
              onSelect: () => setFit(true),
            },
            { id: 'separator', separator: true },
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
    </div>
  );
};

const PdfPreview: React.FC<PdfPreviewProps> = (props) => (
  <PdfPreviewContent key={props.filePath} {...props} />
);

export default PdfPreview;
