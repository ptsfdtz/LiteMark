import { useEffect, useRef, useState } from 'react';
import { LuDownload, LuRefreshCw } from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';
import { checkForAppUpdate, restartAfterUpdate, type AppUpdate } from '@/modules/appUpdater';
import styles from './UpdateDialog.module.css';

interface UpdateDialogProps {
  hasUnsavedChanges: boolean;
}

type InstallState = 'ready' | 'downloading' | 'installing' | 'failed';

const UpdateDialog = ({ hasUnsavedChanges }: UpdateDialogProps) => {
  const { t } = useI18n();
  const checkedRef = useRef(false);
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [state, setState] = useState<InstallState>('ready');
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState<number | undefined>();

  useEffect(() => {
    if (checkedRef.current) return;
    const timeout = window.setTimeout(() => {
      if (checkedRef.current) return;
      checkedRef.current = true;
      void checkForAppUpdate()
        .then(setUpdate)
        .catch((error) => console.warn('Automatic update check failed:', error));
    }, 1_500);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!update || state !== 'ready') return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void update.close();
        setUpdate(null);
      }
    };
    window.addEventListener('keydown', dismissOnEscape);
    return () => window.removeEventListener('keydown', dismissOnEscape);
  }, [state, update]);

  if (!update) return null;

  const progress = total ? Math.min(100, Math.round((downloaded / total) * 100)) : undefined;
  const busy = state === 'downloading' || state === 'installing';

  const install = async () => {
    setState('downloading');
    setDownloaded(0);
    setTotal(undefined);
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') setTotal(event.data.contentLength);
        if (event.event === 'Progress') {
          setDownloaded((current) => current + event.data.chunkLength);
        }
        if (event.event === 'Finished') setState('installing');
      });
      await restartAfterUpdate();
    } catch (error) {
      console.error('Application update failed:', error);
      setState('failed');
    }
  };

  const dismiss = () => {
    void update.close();
    setUpdate(null);
  };

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="appUpdateTitle"
        aria-describedby="appUpdateDescription"
      >
        <div className={styles.icon} aria-hidden="true">
          {state === 'failed' ? <LuRefreshCw /> : <LuDownload />}
        </div>
        <div className={styles.content}>
          <h2 id="appUpdateTitle">{t('update.title')}</h2>
          <p id="appUpdateDescription">
            {state === 'failed'
              ? t('update.failed')
              : t('update.available', { version: update.version })}
          </p>
          {update.notes && state === 'ready' && <div className={styles.notes}>{update.notes}</div>}
          {hasUnsavedChanges && !busy && (
            <p className={styles.warning}>{t('update.saveBeforeInstall')}</p>
          )}
          {busy && (
            <div className={styles.progressArea} aria-live="polite">
              <div className={styles.progressLabel}>
                <span>
                  {state === 'installing' ? t('update.installing') : t('update.downloading')}
                </span>
                {progress !== undefined && state === 'downloading' && <span>{progress}%</span>}
              </div>
              <div
                className={`${styles.progressTrack} ${progress === undefined ? styles.indeterminate : ''}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={progress === undefined ? undefined : { width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={dismiss} disabled={busy}>
            {t('update.later')}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void install()}
            disabled={busy || hasUnsavedChanges}
            autoFocus
          >
            {state === 'failed' ? t('update.retry') : t('update.install')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateDialog;
