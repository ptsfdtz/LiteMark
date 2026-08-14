// src/components/WindowControls/WindowControls.tsx
import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';
import { LuCopy, LuMinus, LuSquare, LuX } from 'react-icons/lu';
import styles from './WindowControls.module.css';
import { useI18n } from '@/locales/useI18n';

const WindowControls: React.FC = () => {
  const { t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);
  const nativeWindow = isTauri() || import.meta.env.MODE === 'test';

  useEffect(() => {
    if (!nativeWindow) return;
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
  }, [nativeWindow]);

  const handleMinimize = () => {
    if (!nativeWindow) return;
    const appWindow = getCurrentWindow();
    void appWindow.minimize();
  };

  const handleToggleMaximize = async () => {
    if (!nativeWindow) return;
    const appWindow = getCurrentWindow();
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  const handleClose = () => {
    if (!nativeWindow) return;
    const appWindow = getCurrentWindow();
    void appWindow.close();
  };

  if (!nativeWindow) return null;

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
        <LuMinus />
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label={t(isMaximized ? 'window.restore' : 'window.maximize')}
        title={t(isMaximized ? 'window.restore' : 'window.maximize')}
        onClick={() => void handleToggleMaximize()}
        data-tauri-drag-region="false"
      >
        {isMaximized ? <LuCopy /> : <LuSquare />}
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.close}`}
        aria-label={t('window.close')}
        title={t('window.close')}
        onClick={handleClose}
        data-tauri-drag-region="false"
      >
        <LuX />
      </button>
    </div>
  );
};

export default WindowControls;
