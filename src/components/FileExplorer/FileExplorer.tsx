import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuBraces,
  LuChevronsUp,
  LuChevronRight,
  LuCopy,
  LuFile,
  LuFileCode2,
  LuFilePlus,
  LuFileJson,
  LuFileText,
  LuFileType,
  LuFolder,
  LuFolderOpen,
  LuImage,
  LuFolderPlus,
  LuPanelLeftClose,
  LuPenLine,
  LuRefreshCw,
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
  truncated?: boolean;
}

export interface FileExplorerStandaloneFile {
  path: string;
  name: string;
}

interface FileExplorerProps {
  roots: FileExplorerRoot[];
  standaloneFiles: FileExplorerStandaloneFile[];
  currentPath: string | null;
  onOpenFile: (path: string) => boolean | void | Promise<boolean | void>;
  onChooseDirectory: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onLoadDirectory?: (path: string) => Promise<void>;
  onRemoveDirectory: (path: string) => void;
  onReorderDirectory: (
    sourcePath: string,
    targetPath: string,
    position: 'before' | 'after',
  ) => void;
  onDeleteFile: (path: string) => Promise<boolean>;
  onCreateFile: (directory: string) => Promise<boolean>;
  onCreateDirectory: (directory: string) => Promise<string | null>;
  onRenameDirectory: (path: string, newName: string) => Promise<string | null>;
  onDeleteDirectory: (path: string) => Promise<boolean>;
  onRemoveStandaloneFile: (path: string) => void | Promise<void>;
  onClose: () => void;
  /** When true the panel plays its close animation before unmounting. */
  closing?: boolean;
  /** Fired once the close animation finished and the panel can unmount. */
  onCloseComplete?: () => void;
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

interface FolderActionTarget {
  path: string;
  name: string;
}

interface FolderContextMenu extends FolderActionTarget {
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

const normalizeExplorerPath = (path: string) =>
  path
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLocaleLowerCase();

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
      return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
    })
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (!root) return path;

  return path.slice(root.path.replace(/[\\/]+$/, '').length).replace(/^[\\/]+/, '') || '.';
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
  if (extension === 'pdf') return <LuFileType className={styles.mediaIcon} />;
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
  onShowFolderContextMenu: (folder: Omit<FolderContextMenu, 'relativePath'>) => void;
  onOpenFile: (path: string) => boolean | void | Promise<boolean | void>;
  onLoadDirectory: (path: string) => Promise<void>;
  loadingPaths: Set<string>;
  unsupportedLabel: string;
  renamingFolderPath: string | null;
  onRenameFolder: (path: string, newName: string) => Promise<boolean>;
  onCancelRenameFolder: () => void;
}

const FolderNameInput: React.FC<{
  name: string;
  onSubmit: (name: string) => Promise<boolean>;
  onCancel: () => void;
}> = ({ name, onSubmit, onCancel }) => {
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = async () => {
    if (finishedRef.current) return;
    const nextName = value.trim();
    if (!nextName || nextName === name) {
      finishedRef.current = true;
      onCancel();
      return;
    }
    finishedRef.current = true;
    if (!(await onSubmit(nextName))) {
      finishedRef.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <input
      ref={inputRef}
      className={styles.folderNameInput}
      value={value}
      aria-label={name}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void submit()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') void submit();
        if (event.key === 'Escape') {
          finishedRef.current = true;
          onCancel();
        }
      }}
    />
  );
};

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  depth,
  currentPath,
  expandedPaths,
  selectedFilePath,
  onToggle,
  onSelectFile,
  onShowContextMenu,
  onShowFolderContextMenu,
  onOpenFile,
  onLoadDirectory,
  loadingPaths,
  unsupportedLabel,
  renamingFolderPath,
  onRenameFolder,
  onCancelRenameFolder,
}) => {
  const { t } = useI18n();
  const expanded = node.is_directory && expandedPaths.has(node.path);
  const supported = node.is_directory || getFileViewKind(node.path) !== 'unsupported';
  const active = node.path === currentPath;
  const selected = !node.is_directory && node.path === selectedFilePath;
  const renaming = node.is_directory && node.path === renamingFolderPath;

  return (
    <li
      role="treeitem"
      aria-expanded={node.is_directory ? expanded : undefined}
      aria-selected={!node.is_directory ? selected : undefined}
    >
      {renaming ? (
        <div className={styles.treeRow} style={{ paddingLeft: `${10 + depth * 16}px` }}>
          <span className={styles.chevron} aria-hidden="true">
            <LuChevronRight
              className={`${styles.chevronIcon} ${expanded ? styles.chevronOpen : ''}`}
            />
          </span>
          <span className={styles.itemIcon} aria-hidden="true">
            {expanded ? <LuFolderOpen /> : <LuFolder />}
          </span>
          <FolderNameInput
            name={node.name}
            onSubmit={(name) => onRenameFolder(node.path, name)}
            onCancel={onCancelRenameFolder}
          />
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.treeRow} ${active ? styles.active : ''} ${selected ? styles.selected : ''} ${
            supported ? '' : styles.unsupported
          }`}
          style={{ paddingLeft: `${10 + depth * 16}px` }}
          onClick={() => {
            if (node.is_directory) {
              onToggle(node.path);
              if (!expanded && !node.children_loaded && !loadingPaths.has(node.path)) {
                void onLoadDirectory(node.path);
              }
            } else {
              onSelectFile({ path: node.path, name: node.name, supported });
              if (supported) void onOpenFile(node.path);
            }
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            if (node.is_directory) {
              onShowFolderContextMenu({
                path: node.path,
                name: node.name,
                x: event.clientX,
                y: event.clientY,
              });
              return;
            }
            const file = { path: node.path, name: node.name, supported };
            onSelectFile(file);
            onShowContextMenu({ ...file, x: event.clientX, y: event.clientY });
          }}
          aria-current={active ? 'page' : undefined}
          aria-disabled={!supported}
          title={supported ? node.name : `${node.name} - ${unsupportedLabel}`}
        >
          <span className={styles.chevron} aria-hidden="true">
            {node.is_directory &&
              (loadingPaths.has(node.path) ? (
                <LuRefreshCw className={styles.loadingIcon} />
              ) : (
                <LuChevronRight
                  className={`${styles.chevronIcon} ${expanded ? styles.chevronOpen : ''}`}
                />
              ))}
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
      )}
      {node.is_directory && (
        <div
          className={`${styles.groupWrapper} ${expanded ? styles.groupOpen : ''}`}
          aria-hidden={!expanded}
        >
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
                onShowFolderContextMenu={onShowFolderContextMenu}
                onOpenFile={onOpenFile}
                onLoadDirectory={onLoadDirectory}
                loadingPaths={loadingPaths}
                unsupportedLabel={unsupportedLabel}
                renamingFolderPath={renamingFolderPath}
                onRenameFolder={onRenameFolder}
                onCancelRenameFolder={onCancelRenameFolder}
              />
            ))}
            {node.children_loaded && node.children.length === 0 && (
              <li className={styles.empty}>
                {node.truncated ? t('explorer.truncated') : t('explorer.empty')}
              </li>
            )}
            {node.truncated && node.children.length > 0 && (
              <li className={styles.treeNotice}>{t('explorer.truncated')}</li>
            )}
          </ul>
        </div>
      )}
    </li>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({
  roots,
  standaloneFiles,
  currentPath,
  onOpenFile,
  onChooseDirectory,
  onRefresh,
  onLoadDirectory,
  onRemoveDirectory,
  onReorderDirectory,
  onDeleteFile,
  onCreateFile,
  onCreateDirectory,
  onRenameDirectory,
  onDeleteDirectory,
  onRemoveStandaloneFile,
  onClose,
  closing = false,
  onCloseComplete,
}) => {
  const { t } = useI18n();
  const asideRef = useRef<HTMLElement | null>(null);
  // Slide in from zero width on mount.
  const [entered, setEntered] = useState(false);
  const closeCompleteRef = useRef(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
  const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(() => new Set());
  const [confirmingRoot, setConfirmingRoot] = useState<string | null>(null);
  const [draggedRoot, setDraggedRoot] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    path: string;
    position: 'before' | 'after';
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileActionTarget | null>(null);
  const [contextMenu, setContextMenu] = useState<FileContextMenu | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenu | null>(null);
  const [confirmingFile, setConfirmingFile] = useState<FileActionTarget | null>(null);
  const [confirmingFolder, setConfirmingFolder] = useState<FolderActionTarget | null>(null);
  const [renamingFolderPath, setRenamingFolderPath] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const { width, resizing, onResizeStart, onResizeKeyDown } = useResizablePanel({
    storageKey: 'litemark.explorerWidth',
    initialWidth: 252,
    minWidth: 180,
    maxWidth: 480,
    maxViewportRatio: 0.4,
    edge: 'right',
  });

  useEffect(() => {
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, []);

  // Unmount after the close animation; the timeout covers reduced-motion
  // environments where no transitionend event fires.
  useEffect(() => {
    if (!closing || !onCloseComplete) return;
    const timeout = window.setTimeout(() => {
      if (closeCompleteRef.current) return;
      closeCompleteRef.current = true;
      onCloseComplete();
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [closing, onCloseComplete]);

  const handlePanelTransitionEnd = (event: React.TransitionEvent) => {
    if (!closing || !onCloseComplete) return;
    if (event.target !== asideRef.current || event.propertyName !== 'width') return;
    if (closeCompleteRef.current) return;
    closeCompleteRef.current = true;
    onCloseComplete();
  };

  const panelWidth = closing || !entered ? 0 : width;

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

  const loadDirectory = async (path: string) => {
    setLoadingPaths((current) => new Set(current).add(path));
    try {
      await onLoadDirectory?.(path);
    } finally {
      setLoadingPaths((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    }
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

  const requestFolderDeletion = (folder: FolderActionTarget) => {
    setFolderContextMenu(null);
    setConfirmingFolder(folder);
  };

  useEffect(() => {
    if (!contextMenu && !folderContextMenu) return;
    const closeContextMenu = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) {
        setContextMenu(null);
        setFolderContextMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setFolderContextMenu(null);
      }
    };
    const closeOnResize = () => {
      setContextMenu(null);
      setFolderContextMenu(null);
    };
    document.addEventListener('mousedown', closeContextMenu);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize, { once: true });
    return () => {
      document.removeEventListener('mousedown', closeContextMenu);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [contextMenu, folderContextMenu]);

  return (
    <aside
      ref={asideRef}
      className={`${styles.explorer} ${resizing ? styles.resizing : ''} ${closing ? styles.closing : ''}`}
      aria-label={t('explorer.title')}
      style={{ width: panelWidth }}
      onTransitionEnd={handlePanelTransitionEnd}
    >
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
          onClick={() => void onRefresh()}
          title={t('explorer.refresh')}
          aria-label={t('explorer.refresh')}
        >
          <LuRefreshCw aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.headerButton}
          onClick={() => {
            setExpandedPaths(new Set());
            setCollapsedRoots(new Set(roots.map((root) => root.path)));
          }}
          title={t('explorer.collapseAll')}
          aria-label={t('explorer.collapseAll')}
        >
          <LuChevronsUp aria-hidden="true" />
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
        onContextMenu={(event) => {
          if (event.target !== event.currentTarget || roots.length === 0) return;
          event.preventDefault();
          const root = roots[0];
          const name =
            root.path
              .replace(/[\\/]+$/, '')
              .split(/[\\/]/)
              .pop() || root.path;
          setContextMenu(null);
          setFolderContextMenu({
            path: root.path,
            name,
            x: event.clientX,
            y: event.clientY,
            relativePath: '.',
          });
        }}
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
                  onContextMenu={(event) => {
                    event.preventDefault();
                    const x = Math.max(8, Math.min(event.clientX, window.innerWidth - 232));
                    const y = Math.max(8, Math.min(event.clientY, window.innerHeight - 248));
                    setContextMenu(null);
                    setFolderContextMenu({
                      path: root.path,
                      name: rootName,
                      x,
                      y,
                      relativePath: getWorkspaceRelativePath(root.path, roots),
                    });
                  }}
                  aria-expanded={!collapsed}
                  title={root.path}
                >
                  <LuChevronRight
                    className={`${styles.chevronIcon} ${collapsed ? '' : styles.chevronOpen}`}
                    aria-hidden="true"
                  />
                  {collapsed ? (
                    <LuFolder aria-hidden="true" />
                  ) : (
                    <LuFolderOpen aria-hidden="true" />
                  )}
                  <span>{rootName}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.headerButton} ${styles.itemRemoveButton}`}
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
              <div
                className={`${styles.groupWrapper} ${collapsed ? '' : styles.groupOpen}`}
                aria-hidden={collapsed}
              >
                {root.nodes.length === 0 ? (
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
                          setFolderContextMenu(null);
                          setContextMenu({
                            ...file,
                            x,
                            y,
                            relativePath: getWorkspaceRelativePath(file.path, roots),
                          });
                        }}
                        onShowFolderContextMenu={(folder) => {
                          const x = Math.max(8, Math.min(folder.x, window.innerWidth - 232));
                          const y = Math.max(8, Math.min(folder.y, window.innerHeight - 248));
                          setContextMenu(null);
                          setFolderContextMenu({
                            ...folder,
                            x,
                            y,
                            relativePath: getWorkspaceRelativePath(folder.path, roots),
                          });
                        }}
                        onOpenFile={onOpenFile}
                        onLoadDirectory={loadDirectory}
                        loadingPaths={loadingPaths}
                        unsupportedLabel={t('explorer.unsupported')}
                        renamingFolderPath={renamingFolderPath}
                        onRenameFolder={async (path, name) => {
                          const renamedPath = await onRenameDirectory(path, name);
                          if (!renamedPath) return false;
                          setRenamingFolderPath(null);
                          return true;
                        }}
                        onCancelRenameFolder={() => setRenamingFolderPath(null)}
                      />
                    ))}
                    {root.truncated && (
                      <li className={styles.treeNotice}>{t('explorer.truncated')}</li>
                    )}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
        {standaloneFiles.length > 0 && (
          <section className={styles.standaloneSection}>
            <ul role="tree" className={styles.tree} aria-label={t('explorer.standaloneFiles')}>
              {standaloneFiles.map((file) => {
                const supported = getFileViewKind(file.path) !== 'unsupported';
                const selected = selectedFile?.path === file.path;
                const active = currentPath === file.path;
                const extension = file.name.split('.').pop()?.toLowerCase() ?? null;
                return (
                  <li
                    key={file.path}
                    className={`${styles.standaloneRow} ${
                      active ? styles.standaloneActive : selected ? styles.standaloneSelected : ''
                    }`}
                    role="treeitem"
                  >
                    <button
                      type="button"
                      className={`${styles.treeRow} ${active ? styles.active : ''} ${
                        selected ? styles.selected : ''
                      } ${supported ? '' : styles.unsupported}`}
                      onClick={() => {
                        const target = { path: file.path, name: file.name, supported };
                        setSelectedFile(target);
                        if (supported) void onOpenFile(file.path);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        const x = Math.max(8, Math.min(event.clientX, window.innerWidth - 232));
                        const y = Math.max(8, Math.min(event.clientY, window.innerHeight - 208));
                        setFolderContextMenu(null);
                        setSelectedFile({ path: file.path, name: file.name, supported });
                        setContextMenu({
                          path: file.path,
                          name: file.name,
                          supported,
                          x,
                          y,
                          relativePath: getWorkspaceRelativePath(file.path, roots),
                        });
                      }}
                      title={file.path}
                      aria-current={active ? 'page' : undefined}
                      aria-disabled={!supported}
                    >
                      <span className={styles.chevron} aria-hidden="true" />
                      <span className={styles.itemIcon} aria-hidden="true">
                        <FileIcon extension={extension} />
                      </span>
                      <span className={styles.itemName}>{file.name}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.headerButton} ${styles.itemRemoveButton}`}
                      onClick={() => void onRemoveStandaloneFile(file.path)}
                      title={t('explorer.removeStandaloneFile', { name: file.name })}
                      aria-label={t('explorer.removeStandaloneFile', { name: file.name })}
                    >
                      <LuX aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
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
      {folderContextMenu && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          role="menu"
          aria-label={t('explorer.folderActions', { name: folderContextMenu.name })}
          style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
        >
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              const folder = folderContextMenu;
              setFolderContextMenu(null);
              void onCreateFile(folder.path);
            }}
          >
            <LuFilePlus aria-hidden="true" />
            <span>{t('explorer.newFile')}</span>
          </button>
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              const folder = folderContextMenu;
              setFolderContextMenu(null);
              void onCreateDirectory(folder.path).then((createdPath) => {
                if (!createdPath) return;
                setExpandedPaths((current) => new Set(current).add(folder.path));
                setCollapsedRoots((current) => {
                  const next = new Set(current);
                  next.delete(folder.path);
                  return next;
                });
                setRenamingFolderPath(createdPath);
              });
            }}
          >
            <LuFolderPlus aria-hidden="true" />
            <span>{t('explorer.newFolder')}</span>
          </button>
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            disabled={roots.some(
              (root) =>
                normalizeExplorerPath(root.path) === normalizeExplorerPath(folderContextMenu.path),
            )}
            onClick={() => {
              setRenamingFolderPath(folderContextMenu.path);
              setFolderContextMenu(null);
            }}
          >
            <LuPenLine aria-hidden="true" />
            <span>{t('explorer.renameFolder')}</span>
          </button>
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              setFolderContextMenu(null);
              void revealItemInDir(folderContextMenu.path).catch((error) => {
                console.error('Failed to reveal folder:', error);
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
              setFolderContextMenu(null);
              void copyText(folderContextMenu.path);
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
              setFolderContextMenu(null);
              void copyText(folderContextMenu.relativePath);
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
            onClick={() => requestFolderDeletion(folderContextMenu)}
          >
            <LuTrash2 aria-hidden="true" />
            <span>{t('explorer.deleteFolder')}</span>
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
      {confirmingFolder && (
        <div className={styles.deleteDialogBackdrop} role="presentation">
          <div
            className={styles.deleteDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deleteFolderTitle"
            aria-describedby="deleteFolderDescription"
          >
            <h2 id="deleteFolderTitle">{t('explorer.confirmDeleteFolderTitle')}</h2>
            <p id="deleteFolderDescription">
              {t('explorer.confirmDeleteFolderDescription', { name: confirmingFolder.name })}
            </p>
            <div className={styles.deleteDialogActions}>
              <button type="button" onClick={() => setConfirmingFolder(null)} autoFocus>
                {t('explorer.cancelDelete')}
              </button>
              <button
                type="button"
                className={styles.deleteConfirmButton}
                onClick={() => {
                  const folder = confirmingFolder;
                  setConfirmingFolder(null);
                  void onDeleteDirectory(folder.path).then((deleted) => {
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
