export interface RecentFile {
  id: string;
  name: string;
  path: string;
  modified: Date;
}
export interface RecentFilesSidebarProps {
    files: RecentFile[];
    onSelectFile: (file: RecentFile) => void;
    onClose?: () => void;
    isOpen: boolean;
    onRequestClose?: () => void;
    onCloseComplete?: () => void;
    onLoadFile?: (path: string, content: string) => void;
    onLoadDir?: (
      files: { id: string; name: string; path: string; modified: Date }[]
    ) => void;
    onNewFile?: (path: string, content: string) => void;
    onDeleteFile?: (id: string) => void;
    workDir?: string;
}