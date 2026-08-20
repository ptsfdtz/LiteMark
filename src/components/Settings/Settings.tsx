// src/components/Settings/Settings.tsx
import React, { useEffect, useState, useRef } from 'react';
import styles from './Settings.module.css';
import { SettingsProps } from '@/types/settings';
import { open } from '@tauri-apps/plugin-dialog';
import {
  LuEye,
  LuEyeOff,
  LuFolderOpen,
  LuMonitor,
  LuMoon,
  LuSettings,
  LuSun,
  LuX,
} from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';

const Settings: React.FC<SettingsProps> = ({
  theme,
  setTheme,
  workDir,
  setWorkDir,
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
    key:
      | 'panelVisible'
      | 'enabled'
      | 'endpoint'
      | 'model'
      | 'apiKey'
      | 'instructions'
      | 'maxSteps'
      | 'autoApply'
      | 'confirmWrites',
    value: boolean | string | number,
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
        <div className={styles.headerTitle}>
          <LuSettings aria-hidden="true" />
          <span>{t('settings.title')}</span>
        </div>
        <button
          className={styles.closeButton}
          onClick={handleRequestClose}
          title={t('window.close')}
          aria-label={t('window.close')}
        >
          <LuX aria-hidden="true" />
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
                <LuSun />
              </button>
              <button
                className={`${styles.switchButton} ${theme === 'system' ? styles.active : ''}`}
                onClick={() => setTheme('system')}
                title={t('settings.themeSystem')}
                aria-label={t('settings.themeSystem')}
              >
                <LuMonitor />
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
                <LuMoon />
              </button>
            </div>
          </div>
        </div>
        <div className={styles.settingGroup}>
          <div className={styles.sectionLabel}>{t('settings.workDirTitle')}</div>
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
              <LuFolderOpen />
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
        <div className={`${styles.settingGroup} ${styles.agentGroup}`}>
          <div className={styles.editorRow}>
            <label className={styles.settingLabel} htmlFor="agentPanelToggle">
              {t('settings.agentPanel')}
            </label>
            <label className={styles.switch}>
              <input
                id="agentPanelToggle"
                type="checkbox"
                checked={agentSettings.panelVisible}
                onChange={(event) => updateAgentSettings('panelVisible', event.target.checked)}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
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
                placeholder="sk-…"
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
                {showApiKey ? <LuEyeOff /> : <LuEye />}
              </button>
            </div>
            <p className={styles.securityNote}>{t('settings.agentKeyStorage')}</p>
            <label className={styles.fieldLabel} htmlFor="agentInstructions">
              {t('settings.agentInstructions')}
            </label>
            <textarea
              id="agentInstructions"
              value={agentSettings.instructions}
              onChange={(event) => updateAgentSettings('instructions', event.target.value)}
              className={styles.textareaInput}
              placeholder={t('settings.agentInstructionsPlaceholder')}
              spellCheck={false}
              rows={2}
            />
            <label className={styles.fieldLabel} htmlFor="agentMaxSteps">
              {t('settings.agentMaxSteps')}
            </label>
            <input
              id="agentMaxSteps"
              type="number"
              min={1}
              max={32}
              value={agentSettings.maxSteps}
              onChange={(event) => updateAgentSettings('maxSteps', Number(event.target.value))}
              className={styles.textInput}
            />
            <div className={styles.editorRow}>
              <label className={styles.settingLabel} htmlFor="agentAutoApply">
                {t('settings.agentAutoApply')}
              </label>
              <label className={styles.switch}>
                <input
                  id="agentAutoApply"
                  type="checkbox"
                  checked={agentSettings.autoApply}
                  onChange={(event) => updateAgentSettings('autoApply', event.target.checked)}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <div className={styles.editorRow}>
              <label className={styles.settingLabel} htmlFor="agentConfirmWrites">
                {t('settings.agentConfirmWrites')}
              </label>
              <label className={styles.switch}>
                <input
                  id="agentConfirmWrites"
                  type="checkbox"
                  checked={agentSettings.confirmWrites}
                  onChange={(event) => updateAgentSettings('confirmWrites', event.target.checked)}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
