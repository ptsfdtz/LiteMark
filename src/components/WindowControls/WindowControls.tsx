// src/components/WindowControls/WindowControls.tsx
import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FaMinus, FaRegSquare, FaRegWindowRestore, FaTimes } from 'react-icons/fa';
import styles from './WindowControls.module.css';
import { useI18n } from '@/locales/useI18n';

const WindowControls: React.FC = () => {
  const { t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const syncMaximizedState = async () => {
      const maximized = await appWindow.isMaximized();
      if (!disposed) setIsMaximized(maximized);
    };

    void syncMaximizedState();
    void appWindow
      .onResized(() => {
        void syncMaximizedState();
      })
      .then((stopListening) => {
        if (disposed) stopListening();
        else unlisten = stopListening;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const handleMinimize = () => {
    const appWindow = getCurrentWindow();
    void appWindow.minimize();
  };

  const handleToggleMaximize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  const handleClose = () => {
    const appWindow = getCurrentWindow();
    void appWindow.close();
  };

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        aria-label={t('window.minimize')}
        title={t('window.minimize')}
        onClick={handleMinimize}
        data-tauri-drag-region="false"
      >
        <FaMinus />
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label={t(isMaximized ? 'window.restore' : 'window.maximize')}
        title={t(isMaximized ? 'window.restore' : 'window.maximize')}
        onClick={() => void handleToggleMaximize()}
        data-tauri-drag-region="false"
      >
        {isMaximized ? <FaRegWindowRestore /> : <FaRegSquare />}
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.close}`}
        aria-label={t('window.close')}
        title={t('window.close')}
        onClick={handleClose}
        data-tauri-drag-region="false"
      >
        <FaTimes />
      </button>
    </div>
  );
};

export default WindowControls;
