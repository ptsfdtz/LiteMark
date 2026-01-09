// src/components/WindowControls/WindowControls.tsx
import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FaTimes, FaMinus, FaRegSquare } from 'react-icons/fa';
import styles from './WindowControls.module.css';
import { useI18n } from '@/locales/useI18n';

const WindowControls: React.FC = () => {
  const { t } = useI18n();
  const handleMinimize = () => {
    const appWindow = getCurrentWindow();
    void appWindow.minimize();
  };

  const handleToggleMaximize = () => {
    const appWindow = getCurrentWindow();
    void appWindow.toggleMaximize();
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
        aria-label={t('window.maximize')}
        title={t('window.maximize')}
        onClick={handleToggleMaximize}
        data-tauri-drag-region="false"
      >
        <FaRegSquare />
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
