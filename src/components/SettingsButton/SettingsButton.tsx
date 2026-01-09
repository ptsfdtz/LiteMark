// src/components/SettingsButton/SettingsButton.tsx
import React from 'react';
import styles from './SettingsButton.module.css';
import { FaCog } from 'react-icons/fa'; // 引入设置图标
import { SettingsButtonProps } from '../../types/settings';
import { useI18n } from '../../locales';

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
      <FaCog size={20} />
    </button>
  );
};

export default SettingsButton;
