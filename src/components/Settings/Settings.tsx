// src/components/Settings/Settings.tsx
import React, { useEffect, useState, useRef } from 'react';
import styles from './Settings.module.css';
import { SettingsProps } from '@/types/settings';
import { open } from '@tauri-apps/plugin-dialog';
import { FiEye, FiEyeOff, FiSun, FiMoon, FiRepeat, FiMoreHorizontal } from 'react-icons/fi';
import { FaCog, FaTimes } from 'react-icons/fa';
import { useI18n } from '@/locales/useI18n';

const Settings: React.FC<SettingsProps> = ({
  theme,
  setTheme,
  workDir,
  setWorkDir,
  minimapEnabled,
  setMinimapEnabled,
  agentSettings,
  setAgentSettings,
  onClose,
  onCloseComplete,
  onRequestClose,
  isClosing: externalIsClosing,
}) => {
  const { locale, setLocale, t } = useI18n();
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
  const [showApiKey, setShowApiKey] = useState(false);

  const updateAgentSettings = (
    key: 'enabled' | 'endpoint' | 'model' | 'apiKey',
    value: boolean | string,
  ) => {
    setAgentSettings({ ...agentSettings, [key]: value });
  };

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
        <button
          className={styles.closeButton}
          onClick={handleRequestClose}
          title={t('window.close')}
          aria-label={t('window.close')}
        >
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
                title={t('settings.themeLight')}
                aria-label={t('settings.themeLight')}
              >
                <FiSun size={18} />
              </button>
              <button
                className={`${styles.switchButton} ${theme === 'system' ? styles.active : ''}`}
                onClick={() => setTheme('system')}
                title={t('settings.themeSystem')}
                aria-label={t('settings.themeSystem')}
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
                title={t('settings.themeDark')}
                aria-label={t('settings.themeDark')}
              >
                <FiMoon size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className={styles.settingGroup}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('settings.workDirTitle')}</div>
          <div className={styles.workDirRow}>
            <input
              type="text"
              value={workDir}
              readOnly
              className={styles.workDirInput}
              placeholder={t('settings.workDirPlaceholder')}
            />
            <button
              type="button"
              onClick={handleChooseWorkDir}
              className={styles.workDirBtn}
              title={t('settings.chooseWorkDir')}
              aria-label={t('settings.chooseWorkDir')}
            >
              <FiMoreHorizontal size={22} />
            </button>
          </div>
        </div>
        <div className={styles.settingGroup}>
          <div className={styles.languageTitle}>{t('settings.language')}</div>
          <div className={styles.languageButtons}>
            <button
              type="button"
              className={`${styles.languageButton} ${
                locale === 'zh-CN' ? styles.languageButtonActive : ''
              }`}
              onClick={() => setLocale('zh-CN')}
              title={t('settings.langZh')}
              aria-label={t('settings.langZh')}
            >
              {t('settings.langZh')}
            </button>
            <button
              type="button"
              className={`${styles.languageButton} ${
                locale === 'en' ? styles.languageButtonActive : ''
              }`}
              onClick={() => setLocale('en')}
              title={t('settings.langEn')}
              aria-label={t('settings.langEn')}
            >
              {t('settings.langEn')}
            </button>
            <button
              type="button"
              className={`${styles.languageButton} ${
                locale === 'ja' ? styles.languageButtonActive : ''
              }`}
              onClick={() => setLocale('ja')}
              title={t('settings.langJa')}
              aria-label={t('settings.langJa')}
            >
              {t('settings.langJa')}
            </button>
          </div>
        </div>
        <div className={styles.settingGroup}>
          <div className={styles.editorRow}>
            <label className={styles.minimapLabel} htmlFor="minimapToggle">
              {t('settings.minimap')}
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
        <div className={`${styles.settingGroup} ${styles.agentGroup}`}>
          <div className={styles.editorRow}>
            <label className={styles.settingLabel} htmlFor="agentToggle">
              {t('settings.agentCompletion')}
            </label>
            <label className={styles.switch}>
              <input
                id="agentToggle"
                type="checkbox"
                checked={agentSettings.enabled}
                onChange={(event) => updateAgentSettings('enabled', event.target.checked)}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          <div className={styles.agentFields}>
            <label className={styles.fieldLabel} htmlFor="agentEndpoint">
              {t('settings.agentEndpoint')}
            </label>
            <input
              id="agentEndpoint"
              type="url"
              inputMode="url"
              value={agentSettings.endpoint}
              onChange={(event) => updateAgentSettings('endpoint', event.target.value)}
              className={styles.textInput}
              placeholder="https://api.openai.com/v1/chat/completions"
              spellCheck={false}
            />
            <label className={styles.fieldLabel} htmlFor="agentModel">
              {t('settings.agentModel')}
            </label>
            <input
              id="agentModel"
              type="text"
              value={agentSettings.model}
              onChange={(event) => updateAgentSettings('model', event.target.value)}
              className={styles.textInput}
              placeholder="gpt-4o-mini"
              spellCheck={false}
            />
            <label className={styles.fieldLabel} htmlFor="agentApiKey">
              {t('settings.agentApiKey')}
            </label>
            <div className={styles.apiKeyRow}>
              <input
                id="agentApiKey"
                type={showApiKey ? 'text' : 'password'}
                value={agentSettings.apiKey}
                onChange={(event) => updateAgentSettings('apiKey', event.target.value)}
                className={styles.textInput}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.revealButton}
                onClick={() => setShowApiKey((visible) => !visible)}
                title={t(showApiKey ? 'settings.hideApiKey' : 'settings.showApiKey')}
                aria-label={t(showApiKey ? 'settings.hideApiKey' : 'settings.showApiKey')}
              >
                {showApiKey ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            <p className={styles.securityNote}>{t('settings.agentKeyStorage')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
