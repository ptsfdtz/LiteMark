// src/components/SettingsButton/SettingsButton.tsx
import React from 'react';
import styles from './SettingsButton.module.css';
import { LuSettings } from 'react-icons/lu';
import { SettingsButtonProps } from '@/types/settings';
import { useI18n } from '@/locales/useI18n';

const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick, title, className }) => {
  const { t } = useI18n();
  const resolvedTitle = title || t('settings.open');
  return (
    <button
      onClick={onClick}
      className={`${styles.settingsButton} ${className}`}
      title={resolvedTitle}
      aria-label={resolvedTitle}
      data-tauri-drag-region="false"
    >
      <LuSettings />
    </button>
  );
};

export default SettingsButton;
