import type { RecentDocument } from '@/modules/documentSession/useDocumentSession';

export interface RecentFilesSidebarProps {
  files: RecentDocument[];
  onOpenDocument: (path: string) => boolean | Promise<boolean>;
  onChooseDocument: () => boolean | Promise<boolean>;
  onChooseDirectory: () => void | Promise<void>;
  onCreateDocument: () => boolean | Promise<boolean>;
  isOpen: boolean;
  onRequestClose: () => void;
  onCloseComplete?: () => void;
  onRemoveRecentDocument?: (path: string) => void | Promise<void>;
  canRemoveDocuments?: boolean;
}
