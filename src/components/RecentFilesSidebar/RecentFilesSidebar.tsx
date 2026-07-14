import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './RecentFilesSidebar.module.css';
import { RecentFilesSidebarProps } from '@/types/recentFiles';
import { FaFolderOpen, FaFile, FaFileAlt, FaTimes, FaTrash } from 'react-icons/fa';
import { FaCheck } from 'react-icons/fa';
import { useI18n } from '@/locales/useI18n';

const RecentFilesSidebar: React.FC<RecentFilesSidebarProps> = ({
  files,
  onOpenDocument,
  onChooseDocument,
  onChooseDirectory,
  onCreateDocument,
  isOpen,
  onRequestClose,
  onCloseComplete,
  onRemoveRecentDocument,
  canRemoveDocuments = true,
}) => {
  const { locale, t } = useI18n();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  // 记录正在删除动画的文件路径
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 记录当前显示确认/取消按钮的文件路径
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const requestClose = useCallback(() => {
    setConfirmingId(null);
    setDeletingId(null);
    onRequestClose();
  }, [onRequestClose]);

  // Close when clicking outside the sidebar
  useEffect(() => {
    if (!isOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!sidebarRef.current) return;
      const target = e.target as Node;
      if (!sidebarRef.current.contains(target)) {
        requestClose();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isOpen, requestClose]);

  const handleOpenFile = useCallback(async () => {
    try {
      if (await onChooseDocument()) requestClose();
    } catch (err) {
      console.error('打开文件失败:', err);
    }
  }, [onChooseDocument, requestClose]);

  const handleNewFile = useCallback(async () => {
    try {
      if (await onCreateDocument()) requestClose();
    } catch (err) {
      console.error('新建文件失败:', err);
    }
  }, [onCreateDocument, requestClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault();
        void handleNewFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNewFile, isOpen]);

  const handleOpenDirectory = async () => {
    try {
      await onChooseDirectory();
    } catch (err) {
      console.error('打开文件夹失败:', err);
    }
  };
  return (
    <div
      ref={sidebarRef}
      className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}
      onTransitionEnd={(e) => {
        if (e.currentTarget !== e.target) return;
        if (!isOpen && onCloseComplete) onCloseComplete();
      }}
    >
      <div className={styles.header}>
        <button
          onClick={handleOpenDirectory}
          className={styles.openButton}
          title={t('recent.openFolder')}
          aria-label={t('recent.openFolder')}
        >
          <FaFolderOpen />
        </button>
        <button
          onClick={handleOpenFile}
          className={styles.openButton}
          title={t('recent.openFile')}
          aria-label={t('recent.openFile')}
        >
          <FaFile />
        </button>
        <button
          onClick={handleNewFile}
          className={styles.openButton}
          title={t('recent.newFile')}
          aria-label={t('recent.newFile')}
        >
          <FaFileAlt />
        </button>
        <button
          onClick={() => {
            requestClose();
          }}
          className={styles.closeButton}
          title={t('recent.close')}
          aria-label={t('recent.close')}
        >
          <FaTimes />
        </button>
      </div>
      <div className={styles.filesList}>
        {files.length === 0 ? (
          <div className={styles.noFiles}>{t('recent.empty')}</div>
        ) : (
          files.map((file) => {
            return (
              <div
                key={file.path}
                className={`${styles.fileItem} ${deletingId === file.path ? styles.deleting : ''}`}
              >
                <div
                  className={styles.fileContent}
                  onClick={() => {
                    void Promise.resolve(onOpenDocument(file.path)).then((opened) => {
                      if (opened) requestClose();
                    });
                  }}
                >
                  <div className={styles.fileName}>{file.name}</div>
                  <div className={styles.filePath}>{file.path}</div>
                  <div className={styles.fileModified}>
                    {file.modified.toLocaleString(
                      locale === 'en' ? 'en-US' : locale === 'ja' ? 'ja-JP' : 'zh-CN',
                    )}
                  </div>
                </div>
                {canRemoveDocuments &&
                  (confirmingId === file.path ? (
                    <span className={styles.confirmBtns}>
                      <button
                        className={styles.confirmButton}
                        title={t('recent.confirmDelete')}
                        aria-label={t('recent.confirmDeleteItem', { name: file.name })}
                        onClick={() => {
                          setDeletingId(file.path);
                          setConfirmingId(null);
                          setTimeout(() => {
                            setDeletingId(null);
                            void onRemoveRecentDocument?.(file.path);
                          }, 400);
                        }}
                        disabled={deletingId === file.path}
                      >
                        <FaCheck />
                      </button>
                      <button
                        className={styles.cancelButton}
                        title={t('recent.cancel')}
                        aria-label={t('recent.cancelDeleteItem', { name: file.name })}
                        onClick={() => setConfirmingId(null)}
                        disabled={deletingId === file.path}
                      >
                        <FaTimes />
                      </button>
                    </span>
                  ) : (
                    <button
                      className={styles.trashButton}
                      title={t('recent.delete')}
                      aria-label={t('recent.deleteItem', { name: file.name })}
                      onClick={() => setConfirmingId(file.path)}
                      disabled={deletingId === file.path}
                    >
                      <FaTrash />
                    </button>
                  ))}
              </div>
            );
          })
        )}
      </div>
      {/* 删除确认弹窗已移除，直接在列表项内显示确认/取消按钮 */}
    </div>
  );
};

export default RecentFilesSidebar;
