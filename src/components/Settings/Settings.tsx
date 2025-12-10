// src/components/Settings/Settings.tsx
import React, { useEffect, useState, useRef } from 'react';
import styles from './Settings.module.css';
import { SettingsProps } from '../../types/settings';
import { open } from '@tauri-apps/plugin-dialog';
import { FiSun, FiMoon, FiRepeat, FiMoreHorizontal } from 'react-icons/fi';
import { FaCog, FaTimes } from 'react-icons/fa';

const Settings: React.FC<SettingsProps> = ({
  theme,
  setTheme,
  workDir,
  setWorkDir,
  minimapEnabled,
  setMinimapEnabled,
  onClose,
  onCloseComplete,
  onRequestClose,
  isClosing: externalIsClosing,
}) => {
  // 选择个人工作文件夹
  const handleChooseWorkDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      setWorkDir(selected);
    }
  };
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [isOpenLocal, setIsOpenLocal] = useState<boolean>(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    updateSystemTheme(mediaQuery);

    mediaQuery.addEventListener('change', updateSystemTheme);
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  const getActiveTheme = () => {
    if (theme === 'system') return systemTheme;
    return theme;
  };

  const activeTheme = getActiveTheme();
  const shouldHighlightLight = activeTheme === 'light';
  const shouldHighlightDark = activeTheme === 'dark';

  useEffect(() => {
    if (externalIsClosing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpenLocal(false);
      setIsClosing(true);
    }
  }, [externalIsClosing]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOpenLocal(false);
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setIsOpenLocal(true));
    });
    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    if (!isOpenLocal) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!modalRef.current) return;
      const target = e.target as Node;
      if (!modalRef.current.contains(target)) {
        if (onRequestClose) onRequestClose();
        else {
          setIsOpenLocal(false);
          setIsClosing(true);
        }
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isOpenLocal, onRequestClose]);

  const handleRequestClose = () => {
    setIsOpenLocal(false);
    setIsClosing(true);
    if (onRequestClose) onRequestClose();
  };

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== modalRef.current) return;
    if (isClosing) {
      if (onCloseComplete) onCloseComplete();
      if (onClose) onClose();
    }
  };

  return (
    <div
      ref={modalRef}
      className={`${styles.modal} ${
        isClosing ? styles.closed : isOpenLocal ? styles.open : styles.closed
      }`}
      onClick={(e) => e.stopPropagation()}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className={styles.header}>
        <FaCog size={20} />
        <button className={styles.closeButton} onClick={handleRequestClose}>
          <FaTimes />
        </button>
      </div>
      <div className={styles.content}>
        <div className={styles.settingGroup}>
          <div className={styles.switchContainer}>
            <div className={styles.switchWrapper}></div>
            <div className={styles.switchOptions}>
              <button
                className={`${styles.switchButton} ${
                  theme === 'system' && shouldHighlightLight
                    ? styles.hoverIndicator
                    : theme === 'light'
                      ? styles.active
                      : ''
                }`}
                onClick={() => setTheme('light')}
                title="浅色主题"
              >
                <FiSun size={18} />
              </button>
              <button
                className={`${styles.switchButton} ${theme === 'system' ? styles.active : ''}`}
                onClick={() => setTheme('system')}
                title="跟随系统"
              >
                <FiRepeat size={18} />
              </button>
              <button
                className={`${styles.switchButton} ${
                  theme === 'system' && shouldHighlightDark
                    ? styles.hoverIndicator
                    : theme === 'dark'
                      ? styles.active
                      : ''
                }`}
                onClick={() => setTheme('dark')}
                title="深色主题"
              >
                <FiMoon size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className={styles.settingGroup}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>个人工作文件夹</div>
          <div className={styles.workDirRow}>
            <input
              type="text"
              value={workDir}
              readOnly
              className={styles.workDirInput}
              placeholder="未设置"
            />
            <button
              type="button"
              onClick={handleChooseWorkDir}
              className={styles.workDirBtn}
              title="选择工作文件夹"
            >
              <FiMoreHorizontal size={22} />
            </button>
          </div>
        </div>
        <div className={styles.settingGroup}>
          <div className={styles.editorRow}>
            <label className={styles.minimapLabel} htmlFor="minimapToggle">
              代码缩略图
            </label>
            <label className={styles.switch}>
              <input
                id="minimapToggle"
                type="checkbox"
                checked={!!minimapEnabled}
                onChange={() => {
                  if (setMinimapEnabled) setMinimapEnabled(!minimapEnabled);
                }}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
