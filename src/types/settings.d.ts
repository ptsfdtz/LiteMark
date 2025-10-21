export interface SettingsProps {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  workDir: string;
  setWorkDir: (dir: string) => void;
  onClose?: () => void;
  onRequestClose?: () => void;
  onCloseComplete?: () => void;
  isClosing?: boolean;
}