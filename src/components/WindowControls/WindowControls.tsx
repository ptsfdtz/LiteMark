// src/components/WindowControls/WindowControls.tsx
import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FaTimes, FaMinus, FaRegSquare } from 'react-icons/fa';
import styles from './WindowControls.module.css';

const WindowControls: React.FC = () => {
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
        aria-label="最小化"
        title="最小化"
        onClick={handleMinimize}
        data-tauri-drag-region="false"
      >
        <FaMinus />
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="最大化"
        title="最大化"
        onClick={handleToggleMaximize}
        data-tauri-drag-region="false"
      >
        <FaRegSquare />
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.close}`}
        aria-label="关闭"
        title="关闭"
        onClick={handleClose}
        data-tauri-drag-region="false"
      >
        <FaTimes />
      </button>
    </div>
  );
};

export default WindowControls;
