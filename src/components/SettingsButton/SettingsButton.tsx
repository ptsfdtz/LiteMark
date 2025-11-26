// src/components/SettingsButton/SettingsButton.tsx
import React from 'react';
import styles from './SettingsButton.module.css';
import { FaCog } from 'react-icons/fa'; // 引入设置图标
import { SettingsButtonProps } from '../../types/settings';

const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick, title = '设置', className }) => {
  return (
    <button onClick={onClick} className={`${styles.settingsButton} ${className}`} title={title}>
      <FaCog size={20} />
    </button>
  );
};

export default SettingsButton;
