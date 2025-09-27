// src/components/Settings/Settings.tsx
import React, { useEffect, useState } from "react";
import styles from "./Settings.module.css";

interface SettingsProps {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ theme, setTheme, onClose }) => {
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    updateSystemTheme(mediaQuery);

    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  const getActiveTheme = () => {
    if (theme === "system") {
      return systemTheme;
    }
    return theme;
  };

  const activeTheme = getActiveTheme();

  // 根据当前实际主题确定哪个按钮应该应用hover样式
  const shouldHighlightLight = activeTheme === "light";
  const shouldHighlightDark = activeTheme === "dark";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>设置</h2>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>
        <div className={styles.content}>
          <div className={styles.settingGroup}>
            <div className={styles.switchContainer}>
              <div className={styles.switchWrapper}>
                {/* <div
                  className={`${styles.switchTrack} ${
                    activeTheme === "light"
                      ? styles.light
                      : activeTheme === "dark"
                      ? styles.dark
                      : styles.system
                  }`}
                >
                  <div className={`${styles.switchThumb}`}></div>
                </div> */}
              </div>
              <div className={styles.switchOptions}>
                <button
                  className={`${styles.switchButton} ${
                    // 在跟随系统模式下，如果系统是亮色，则应用hover样式
                    theme === "system" && shouldHighlightLight
                      ? styles.hoverIndicator
                      : theme === "light"
                      ? styles.active
                      : ""
                  }`}
                  onClick={() => setTheme("light")}
                  title="浅色主题"
                >
                  ☀️
                </button>
                <button
                  className={`${styles.switchButton} ${
                    theme === "system" ? styles.active : ""
                  }`}
                  onClick={() => setTheme("system")}
                  title="跟随系统"
                >
                  🔄
                </button>
                <button
                  className={`${styles.switchButton} ${
                    // 在跟随系统模式下，如果系统是暗色，则应用hover样式
                    theme === "system" && shouldHighlightDark
                      ? styles.hoverIndicator
                      : theme === "dark"
                      ? styles.active
                      : ""
                  }`}
                  onClick={() => setTheme("dark")}
                  title="深色主题"
                >
                  🌙
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
