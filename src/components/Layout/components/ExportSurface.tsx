import React, { useRef, useState } from 'react';
import { LuFolderOutput, LuX } from 'react-icons/lu';
import Preview from '@/components/Preview/Preview';
import { useI18n } from '@/locales/useI18n';
import styles from './ExportSurface.module.css';

export type ExportMode = 'png' | 'pdf';

interface ExportSurfaceProps {
  content: string;
  filePath: string | null;
  mode: ExportMode;
  onExport: (element: HTMLElement) => Promise<void>;
  onClose: () => void;
}

const ExportSurface: React.FC<ExportSurfaceProps> = ({
  content,
  filePath,
  mode,
  onExport,
  onClose,
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!surfaceRef.current || exporting) return;
    setExporting(true);
    try {
      await onExport(surfaceRef.current);
    } finally {
      setExporting(false);
    }
  };

  const format = mode === 'pdf' ? 'PDF' : 'PNG';
  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('export.previewTitle')}
      >
        <header className={styles.header}>
          <div>
            <h2>{t('export.previewTitle')}</h2>
            <span>{t('export.format', { format })}</span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            title={t('export.cancel')}
            aria-label={t('export.cancel')}
          >
            <LuX aria-hidden="true" />
          </button>
        </header>
        <div className={styles.viewport}>
          <div ref={surfaceRef} className={styles.page}>
            <Preview content={content} filePath={filePath} isPreviewOnly />
          </div>
        </div>
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={exporting}
          >
            {t('export.cancel')}
          </button>
          <button
            type="button"
            className={styles.exportButton}
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            <LuFolderOutput aria-hidden="true" />
            <span>{exporting ? t('export.preparing') : t('export.chooseFolder')}</span>
          </button>
        </footer>
      </section>
    </div>
  );
};

export default ExportSurface;
