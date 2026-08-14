import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuBraces,
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuFile,
  LuFileCode2,
  LuFileJson,
  LuFileText,
  LuFolder,
  LuFolderOpen,
  LuImage,
  LuFolderPlus,
  LuPanelLeftClose,
  LuTrash2,
  LuX,
} from 'react-icons/lu';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type { FileTreeNode } from '@/types/fileTree';
import { getFileViewKind } from '@/types/fileTree';
import { useI18n } from '@/locales/useI18n';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import styles from './FileExplorer.module.css';

export interface FileExplorerRoot {
  path: string;
  nodes: FileTreeNode[];
}

interface FileExplorerProps {
  roots: FileExplorerRoot[];
  currentPath: string | null;
  onOpenFile: (path: string) => boolean | void | Promise<boolean | void>;
  onChooseDirectory: () => void | Promise<void>;
  onRemoveDirectory: (path: string) => void;
  onReorderDirectory: (
    sourcePath: string,
    targetPath: string,
    position: 'before' | 'after',
  ) => void;
  onDeleteFile: (path: string) => Promise<boolean>;
  onClose: () => void;
}

interface FileActionTarget {
  path: string;
  name: string;
  supported: boolean;
}

interface FileContextMenu extends FileActionTarget {
  x: number;
  y: number;
  relativePath: string;
}

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back for webviews without clipboard permission.
  }

  if (typeof document.execCommand !== 'function') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
};

const getWorkspaceRelativePath = (path: string, roots: FileExplorerRoot[]): string => {
  const normalizedPath = path
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLocaleLowerCase();
  const root = roots
    .filter((candidate) => {
      const normalizedRoot = candidate.path
        .replace(/[\\/]+$/, '')
        .replace(/\\/g, '/')
        .toLocaleLowerCase();
      return normalizedPath.startsWith(`${normalizedRoot}/`);
    })
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (!root) return path;

  return path.slice(root.path.replace(/[\\/]+$/, '').length).replace(/^[\\/]+/, '') || path;
};

const codeExtensions = new Set([
  'c',
  'cc',
  'cpp',
  'cs',
  'css',
  'go',
  'h',
  'hpp',
  'html',
  'java',
  'js',
  'jsx',
  'lua',
  'php',
  'py',
  'rb',
  'rs',
  'scss',
  'sh',
  'sql',
  'ts',
  'tsx',
  'xml',
]);

function FileIcon({ extension }: { extension: string | null }) {
  if (extension === 'md' || extension === 'markdown' || extension === 'mdx') {
    return <LuFileText className={styles.markdownIcon} />;
  }
  if (extension === 'json') return <LuFileJson className={styles.dataIcon} />;
  if (extension === 'yaml' || extension === 'yml' || extension === 'toml') {
    return <LuBraces className={styles.dataIcon} />;
  }
  if (extension && codeExtensions.has(extension)) {
    return <LuFileCode2 className={styles.codeIcon} />;
  }
  if (extension && ['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(extension)) {
    return <LuImage className={styles.mediaIcon} />;
  }
  return <LuFile />;
}

interface TreeItemProps {
  node: FileTreeNode;
  depth: number;
  currentPath: string | null;
  expandedPaths: Set<string>;
  selectedFilePath: string | null;
  onToggle: (path: string) => void;
  onSelectFile: (file: FileActionTarget) => void;
  onShowContextMenu: (file: Omit<FileContextMenu, 'relativePath'>) => void;
  onOpenFile: (path: string) => boolean | void | Promise<boolean | void>;
  unsupportedLabel: string;
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  depth,
  currentPath,
  expandedPaths,
  selectedFilePath,
  onToggle,
  onSelectFile,
  onShowContextMenu,
  onOpenFile,
  unsupportedLabel,
}) => {
  const expanded = node.is_directory && expandedPaths.has(node.path);
  const supported = node.is_directory || getFileViewKind(node.path) !== 'unsupported';
  const active = node.path === currentPath;
  const selected = !node.is_directory && node.path === selectedFilePath;

  return (
    <li
      role="treeitem"
      aria-expanded={node.is_directory ? expanded : undefined}
      aria-selected={!node.is_directory ? selected : undefined}
    >
      <button
        type="button"
        className={`${styles.treeRow} ${active ? styles.active : ''} ${selected ? styles.selected : ''} ${
          supported ? '' : styles.unsupported
        }`}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
        onClick={() => {
          if (node.is_directory) onToggle(node.path);
          else {
            onSelectFile({ path: node.path, name: node.name, supported });
            if (supported) void onOpenFile(node.path);
          }
        }}
        onContextMenu={(event) => {
          if (node.is_directory) return;
          event.preventDefault();
          const file = { path: node.path, name: node.name, supported };
          onSelectFile(file);
          onShowContextMenu({ ...file, x: event.clientX, y: event.clientY });
        }}
        aria-current={active ? 'page' : undefined}
        aria-disabled={!supported}
        title={supported ? node.name : `${node.name} - ${unsupportedLabel}`}
      >
        <span className={styles.chevron} aria-hidden="true">
          {node.is_directory && (expanded ? <LuChevronDown /> : <LuChevronRight />)}
        </span>
        <span className={styles.itemIcon} aria-hidden="true">
          {node.is_directory ? (
            expanded ? (
              <LuFolderOpen />
            ) : (
              <LuFolder />
            )
          ) : (
            <FileIcon extension={node.extension} />
          )}
        </span>
        <span className={styles.itemName}>{node.name}</span>
      </button>
      {node.is_directory && expanded && node.children.length > 0 && (
        <ul role="group" className={styles.treeGroup}>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              expandedPaths={expandedPaths}
              selectedFilePath={selectedFilePath}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
              onShowContextMenu={onShowContextMenu}
              onOpenFile={onOpenFile}
              unsupportedLabel={unsupportedLabel}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({
  roots,
  currentPath,
  onOpenFile,
  onChooseDirectory,
  onRemoveDirectory,
  onReorderDirectory,
  onDeleteFile,
  onClose,
}) => {
  const { t } = useI18n();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(() => new Set());
  const [confirmingRoot, setConfirmingRoot] = useState<string | null>(null);
  const [draggedRoot, setDraggedRoot] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    path: string;
    position: 'before' | 'after';
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileActionTarget | null>(null);
  const [contextMenu, setContextMenu] = useState<FileContextMenu | null>(null);
  const [confirmingFile, setConfirmingFile] = useState<FileActionTarget | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const { width, resizing, onResizeStart, onResizeKeyDown } = useResizablePanel({
    storageKey: 'litemark.explorerWidth',
    initialWidth: 252,
    minWidth: 180,
    maxWidth: 480,
    maxViewportRatio: 0.4,
    edge: 'right',
  });

  const visibleExpandedPaths = useMemo(() => {
    if (!currentPath) return expandedPaths;
    const ancestors: string[] = [];
    const findCurrentPath = (items: FileTreeNode[]): boolean => {
      for (const item of items) {
        if (item.path === currentPath) return true;
        if (item.is_directory && findCurrentPath(item.children)) {
          ancestors.push(item.path);
          return true;
        }
      }
      return false;
    };
    if (!roots.some((root) => findCurrentPath(root.nodes))) return expandedPaths;
    return new Set([...expandedPaths, ...ancestors]);
  }, [currentPath, expandedPaths, roots]);

  const togglePath = (path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleRoot = (path: string) => {
    setCollapsedRoots((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const clearRootDrag = () => {
    setDraggedRoot(null);
    setDropTarget(null);
  };

  const requestFileDeletion = (file: FileActionTarget) => {
    setContextMenu(null);
    setConfirmingFile(file);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const closeContextMenu = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    const closeOnResize = () => setContextMenu(null);
    document.addEventListener('mousedown', closeContextMenu);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize, { once: true });
    return () => {
      document.removeEventListener('mousedown', closeContextMenu);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [contextMenu]);

  return (
    <aside className={styles.explorer} aria-label={t('explorer.title')} style={{ width }}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t('explorer.title')}</span>
        <button
          type="button"
          className={styles.headerButton}
          onClick={() => void onChooseDirectory()}
          title={t('explorer.addFolder')}
          aria-label={t('explorer.addFolder')}
        >
          <LuFolderPlus aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.headerButton}
          onClick={onClose}
          title={t('explorer.hide')}
          aria-label={t('explorer.hide')}
        >
          <LuPanelLeftClose aria-hidden="true" />
        </button>
      </div>
      <div
        className={styles.treeScroll}
        onKeyDown={(event) => {
          if (event.key !== 'Delete' || !selectedFile) return;
          event.preventDefault();
          requestFileDeletion(selectedFile);
        }}
      >
        {roots.map((root) => {
          const rootName =
            root.path
              .replace(/[\\/]+$/, '')
              .split(/[\\/]/)
              .pop() || root.path;
          const collapsed = collapsedRoots.has(root.path);
          return (
            <section className={styles.rootSection} key={root.path}>
              <div
                className={`${styles.rootHeader} ${
                  dropTarget?.path === root.path
                    ? dropTarget.position === 'before'
                      ? styles.dropBefore
                      : styles.dropAfter
                    : ''
                }`}
                onDragOver={(event) => {
                  if (!draggedRoot || draggedRoot === root.path) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const position =
                    event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                  setDropTarget({ path: root.path, position });
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDropTarget((current) => (current?.path === root.path ? null : current));
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedRoot && dropTarget?.path === root.path) {
                    onReorderDirectory(draggedRoot, root.path, dropTarget.position);
                  }
                  clearRootDrag();
                }}
              >
                <button
                  type="button"
                  className={`${styles.rootButton} ${
                    draggedRoot === root.path ? styles.dragging : ''
                  }`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', root.path);
                    setDraggedRoot(root.path);
                  }}
                  onDragEnd={clearRootDrag}
                  onClick={() => toggleRoot(root.path)}
                  aria-expanded={!collapsed}
                  title={root.path}
                >
                  {collapsed ? (
                    <LuChevronRight aria-hidden="true" />
                  ) : (
                    <LuChevronDown aria-hidden="true" />
                  )}
                  {collapsed ? (
                    <LuFolder aria-hidden="true" />
                  ) : (
                    <LuFolderOpen aria-hidden="true" />
                  )}
                  <span>{rootName}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.headerButton} ${styles.removeButton}`}
                  onClick={() => setConfirmingRoot(root.path)}
                  title={t('explorer.removeFolder', { name: rootName })}
                  aria-label={t('explorer.removeFolder', { name: rootName })}
                >
                  <LuX aria-hidden="true" />
                </button>
              </div>
              {confirmingRoot === root.path && (
                <div
                  className={styles.removeConfirmation}
                  role="alertdialog"
                  aria-label={t('explorer.confirmRemoveTitle', { name: rootName })}
                >
                  <span className={styles.confirmationText}>
                    {t('explorer.confirmRemoveDescription', { name: rootName })}
                  </span>
                  <div className={styles.confirmationActions}>
                    <button
                      type="button"
                      className={styles.cancelRemoveButton}
                      onClick={() => setConfirmingRoot(null)}
                    >
                      {t('explorer.cancelRemove')}
                    </button>
                    <button
                      type="button"
                      className={styles.confirmRemoveButton}
                      onClick={() => {
                        setConfirmingRoot(null);
                        onRemoveDirectory(root.path);
                      }}
                    >
                      {t('explorer.confirmRemove')}
                    </button>
                  </div>
                </div>
              )}
              {!collapsed &&
                (root.nodes.length === 0 ? (
                  <div className={styles.empty}>{t('explorer.empty')}</div>
                ) : (
                  <ul role="tree" className={styles.tree} aria-label={rootName}>
                    {root.nodes.map((node) => (
                      <TreeItem
                        key={node.path}
                        node={node}
                        depth={0}
                        currentPath={currentPath}
                        expandedPaths={visibleExpandedPaths}
                        selectedFilePath={selectedFile?.path ?? null}
                        onToggle={togglePath}
                        onSelectFile={setSelectedFile}
                        onShowContextMenu={(file) => {
                          const x = Math.max(8, Math.min(file.x, window.innerWidth - 232));
                          const y = Math.max(8, Math.min(file.y, window.innerHeight - 208));
                          setContextMenu({
                            ...file,
                            x,
                            y,
                            relativePath: getWorkspaceRelativePath(file.path, roots),
                          });
                        }}
                        onOpenFile={onOpenFile}
                        unsupportedLabel={t('explorer.unsupported')}
                      />
                    ))}
                  </ul>
                ))}
            </section>
          );
        })}
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          role="menu"
          aria-label={t('explorer.fileActions', { name: contextMenu.name })}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            disabled={!contextMenu.supported}
            onClick={() => {
              setContextMenu(null);
              void onOpenFile(contextMenu.path);
            }}
          >
            <LuFile aria-hidden="true" />
            <span>{t('explorer.openFile')}</span>
          </button>
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              void revealItemInDir(contextMenu.path).catch((error) => {
                console.error('Failed to reveal file:', error);
              });
            }}
          >
            <LuFolderOpen aria-hidden="true" />
            <span>{t('explorer.revealInFileExplorer')}</span>
          </button>
          <div className={styles.contextMenuDivider} role="separator" />
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              void copyText(contextMenu.path);
            }}
          >
            <LuCopy aria-hidden="true" />
            <span>{t('explorer.copyAbsolutePath')}</span>
          </button>
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              void copyText(contextMenu.relativePath);
            }}
          >
            <LuCopy aria-hidden="true" />
            <span>{t('explorer.copyRelativePath')}</span>
          </button>
          <div className={styles.contextMenuDivider} role="separator" />
          <button
            type="button"
            className={`${styles.contextMenuItem} ${styles.deleteMenuItem}`}
            role="menuitem"
            onClick={() => requestFileDeletion(contextMenu)}
          >
            <LuTrash2 aria-hidden="true" />
            <span>{t('explorer.deleteFile')}</span>
            <kbd aria-hidden="true">Del</kbd>
          </button>
        </div>
      )}
      {confirmingFile && (
        <div className={styles.deleteDialogBackdrop} role="presentation">
          <div
            className={styles.deleteDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deleteFileTitle"
            aria-describedby="deleteFileDescription"
          >
            <h2 id="deleteFileTitle">{t('explorer.confirmDeleteTitle')}</h2>
            <p id="deleteFileDescription">
              {t('explorer.confirmDeleteDescription', { name: confirmingFile.name })}
            </p>
            <div className={styles.deleteDialogActions}>
              <button type="button" onClick={() => setConfirmingFile(null)} autoFocus>
                {t('explorer.cancelDelete')}
              </button>
              <button
                type="button"
                className={styles.deleteConfirmButton}
                onClick={() => {
                  const file = confirmingFile;
                  setConfirmingFile(null);
                  void onDeleteFile(file.path).then((deleted) => {
                    if (deleted) setSelectedFile(null);
                  });
                }}
              >
                {t('explorer.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className={`${styles.resizeHandle} ${resizing ? styles.resizing : ''}`}
        role="separator"
        aria-label={t('explorer.resize')}
        aria-orientation="vertical"
        aria-valuemin={180}
        aria-valuemax={480}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onResizeStart}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
  );
};

export default FileExplorer;
