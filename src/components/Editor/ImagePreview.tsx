import React, { useEffect, useState } from 'react';
import { LuImageOff, LuMaximize2, LuZoomIn, LuZoomOut } from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';
import { getImagePreviewSource } from '@/modules/imagePreview';
import styles from './ImagePreview.module.css';

interface ImagePreviewProps {
  filePath: string;
  className?: string;
}

const ZOOM_STEP = 0.15;

const ImagePreviewContent: React.FC<ImagePreviewProps> = ({ filePath, className }) => {
  const { t } = useI18n();
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  useEffect(() => {
    let active = true;
    void getImagePreviewSource(filePath)
      .then((nextSource) => {
        if (active) setSource(nextSource);
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [filePath]);

  const changeZoom = (delta: number) => {
    setFit(false);
    setZoom((current) => Math.min(4, Math.max(0.1, current + delta)));
  };

  return (
    <div className={`${styles.preview} ${className ?? ''}`} data-tour="editor">
      <div className={styles.previewBar}>
        <div className={styles.imageMeta}>
          <span className={styles.fileName} title={filePath}>
            {fileName}
          </span>
          {dimensions.width > 0 && (
            <span className={styles.dimensions}>
              {dimensions.width} × {dimensions.height}
            </span>
          )}
        </div>
        <div className={styles.previewActions}>
          <button
            type="button"
            onClick={() => changeZoom(-ZOOM_STEP)}
            title={t('image.zoomOut')}
            aria-label={t('image.zoomOut')}
            disabled={zoom <= 0.1 && !fit}
          >
            <LuZoomOut aria-hidden="true" />
          </button>
          <span className={styles.zoomValue}>
            {fit ? t('image.fit') : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            type="button"
            onClick={() => changeZoom(ZOOM_STEP)}
            title={t('image.zoomIn')}
            aria-label={t('image.zoomIn')}
            disabled={zoom >= 4 && !fit}
          >
            <LuZoomIn aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setFit(true)}
            title={t('image.fitWindow')}
            aria-label={t('image.fitWindow')}
          >
            <LuMaximize2 aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={styles.imageViewport}>
        {loading && !failed && <div className={styles.status}>{t('image.loading')}</div>}
        {failed ? (
          <div className={styles.error} role="alert">
            <LuImageOff aria-hidden="true" />
            <span>{t('image.loadFailed')}</span>
          </div>
        ) : (
          source && (
            <img
              className={fit ? styles.fitImage : styles.zoomedImage}
              src={source}
              alt={fileName}
              draggable={false}
              style={
                fit || dimensions.width === 0
                  ? undefined
                  : {
                      width: `${Math.round(dimensions.width * zoom)}px`,
                      height: `${Math.round(dimensions.height * zoom)}px`,
                    }
              }
              onLoad={(event) => {
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
                setLoading(false);
              }}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
          )
        )}
      </div>
    </div>
  );
};

const ImagePreview: React.FC<ImagePreviewProps> = (props) => (
  <ImagePreviewContent key={props.filePath} {...props} />
);

export default ImagePreview;
