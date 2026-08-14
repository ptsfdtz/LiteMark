import React, { useMemo, useState } from 'react';
import {
  LuBraces,
  LuChevronDown,
  LuChevronRight,
  LuFile,
  LuFileCode2,
  LuFileJson,
  LuFileText,
  LuFolder,
  LuFolderOpen,
  LuImage,
  LuFolderPlus,
  LuPanelLeftClose,
  LuX,
} from 'react-icons/lu';
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
  onClose: () => void;
}

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
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => boolean | void | Promise<boolean | void>;
  unsupportedLabel: string;
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  depth,
  currentPath,
  expandedPaths,
  onToggle,
  onOpenFile,
  unsupportedLabel,
}) => {
  const expanded = node.is_directory && expandedPaths.has(node.path);
  const supported = node.is_directory || getFileViewKind(node.path) !== 'unsupported';
  const active = node.path === currentPath;

  return (
    <li role="treeitem" aria-expanded={node.is_directory ? expanded : undefined}>
      <button
        type="button"
        className={`${styles.treeRow} ${active ? styles.active : ''} ${
          supported ? '' : styles.unsupported
        }`}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
        onClick={() => {
          if (node.is_directory) onToggle(node.path);
          else if (supported) void onOpenFile(node.path);
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
              onToggle={onToggle}
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
  onClose,
}) => {
  const { t } = useI18n();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(() => new Set());
  const [confirmingRoot, setConfirmingRoot] = useState<string | null>(null);
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
          <LuFolderPlus />
        </button>
        <button
          type="button"
          className={styles.headerButton}
          onClick={onClose}
          title={t('explorer.hide')}
          aria-label={t('explorer.hide')}
        >
          <LuPanelLeftClose />
        </button>
      </div>
      <div className={styles.treeScroll}>
        {roots.map((root) => {
          const rootName =
            root.path
              .replace(/[\\/]+$/, '')
              .split(/[\\/]/)
              .pop() || root.path;
          const collapsed = collapsedRoots.has(root.path);
          return (
            <section className={styles.rootSection} key={root.path}>
              <div className={styles.rootHeader}>
                <button
                  type="button"
                  className={styles.rootButton}
                  onClick={() => toggleRoot(root.path)}
                  aria-expanded={!collapsed}
                  title={root.path}
                >
                  {collapsed ? <LuChevronRight /> : <LuChevronDown />}
                  {collapsed ? <LuFolder /> : <LuFolderOpen />}
                  <span>{rootName}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.headerButton} ${styles.removeButton}`}
                  onClick={() => setConfirmingRoot(root.path)}
                  title={t('explorer.removeFolder', { name: rootName })}
                  aria-label={t('explorer.removeFolder', { name: rootName })}
                >
                  <LuX />
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
                        onToggle={togglePath}
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
