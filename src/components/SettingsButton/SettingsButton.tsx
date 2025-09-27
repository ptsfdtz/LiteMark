import React from "react";
import styles from "./SettingsButton.module.css";
import { FaCog } from "react-icons/fa"; // 引入设置图标

interface SettingsButtonProps {
  onClick: () => void;
  title?: string;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({
  onClick,
  title = "设置",
}) => {
  return (
    <button onClick={onClick} className={styles.settingsButton} title={title}>
      <FaCog size={20} />
    </button>
  );
};

export default SettingsButton;
