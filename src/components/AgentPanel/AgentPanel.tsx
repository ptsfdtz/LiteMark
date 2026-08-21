import React, { useEffect, useRef, useState } from 'react';
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowLeft,
  LuCheck,
  LuCopy,
  LuCode,
  LuChevronRight,
  LuHistory,
  LuMessageSquare,
  LuPenLine,
  LuPlus,
  LuRotateCcw,
  LuSend,
  LuShieldCheck,
  LuSquare,
  LuTrash2,
  LuX,
} from 'react-icons/lu';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { openUrl } from '@tauri-apps/plugin-opener';
import styles from './AgentPanel.module.css';
import type { AgentSession } from '@/modules/agent/useAgentSession';
import type { AgentConversationSummary } from '@/modules/agent/agentConversationStore';
import { useI18n } from '@/locales/useI18n';
import type { TranslationKey } from '@/locales/config';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import ContextMenu from '@/components/ContextMenu/ContextMenu';

interface AgentPanelProps {
  session: AgentSession;
  conversations: AgentConversationSummary[];
  activeConversationId: string;
  scopeKind: 'project' | 'file';
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onArchiveConversation?: (id: string) => void;
  onRestoreConversation?: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onInsertCode?: (code: string) => void;
  isConfigured: boolean;
  modelName: string;
  onClose: () => void;
  /** When true the panel plays its close animation before unmounting. */
  closing?: boolean;
  /** Fired once the close animation finished and the panel can unmount. */
  onCloseComplete?: () => void;
}

const toolNameKeys: Record<string, TranslationKey> = {
  read_document: 'agent.tool.readDocument',
  rewrite_document: 'agent.tool.rewriteDocument',
  replace_in_document: 'agent.tool.replaceDocument',
  list_documents: 'agent.tool.listDocuments',
  read_file: 'agent.tool.readFile',
  write_file: 'agent.tool.writeFile',
};

const SYSTEM_URL_PATTERN = /^(?:https?:\/\/|mailto:|tel:)/i;

const agentMarkdownComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        if (!href || !SYSTEM_URL_PATTERN.test(href)) return;
        void openUrl(href).catch((error: unknown) => {
          console.error('Failed to open agent link:', error);
        });
      }}
    >
      {children}
    </a>
  ),
  img: ({ alt }) => <span className={styles.imageAlt}>{alt || ''}</span>,
};

const AgentMarkdown: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
    components={agentMarkdownComponents}
  >
    {content}
  </ReactMarkdown>
);

interface ToolDisclosureProps {
  name: string;
  result?: string;
  error?: string;
  completedLabel: string;
  failedLabel: string;
  runningLabel: string;
}

const ToolDisclosure: React.FC<ToolDisclosureProps> = ({
  name,
  result,
  error,
  completedLabel,
  failedLabel,
  runningLabel,
}) => {
  const [expanded, setExpanded] = useState(false);
  const finished = error !== undefined || result !== undefined;
  const stateLabel = error ? failedLabel : finished ? completedLabel : runningLabel;

  return (
    <div className={styles.toolCard}>
      {finished ? (
        <button
          type="button"
          className={styles.toolSummary}
          aria-label={`${name}, ${stateLabel}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className={styles.toolName}>{name}</span>
          <span className={`${styles.toolState} ${error ? styles.failed : ''}`}>{stateLabel}</span>
          <LuChevronRight
            className={`${styles.toolChevron} ${expanded ? styles.expanded : ''}`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className={styles.toolSummary}>
          <span className={styles.toolName}>{name}</span>
          <span className={styles.toolState}>{stateLabel}</span>
          <span className={styles.toolPending} aria-hidden="true">
            …
          </span>
        </div>
      )}
      {finished && (
        <div
          className={`${styles.toolDisclosure} ${expanded ? styles.expanded : ''}`}
          aria-hidden={!expanded}
        >
          <div className={styles.toolDisclosureInner}>
            <div className={error ? styles.toolError : styles.toolResult}>{error || result}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const AgentPanel: React.FC<AgentPanelProps> = ({
  session,
  conversations,
  activeConversationId,
  scopeKind,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onArchiveConversation = () => undefined,
  onRestoreConversation = () => undefined,
  onDeleteConversation,
  onInsertCode,
  isConfigured,
  modelName,
  onClose,
  closing = false,
  onCloseComplete,
}) => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [view, setView] = useState<'home' | 'conversation' | 'archive'>('home');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingConversationTitle, setEditingConversationTitle] = useState('');
  const [conversationMenu, setConversationMenu] = useState<{
    id: string;
    title: string;
    archived: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [messageMenu, setMessageMenu] = useState<{
    content: string;
    role: 'user' | 'assistant';
    x: number;
    y: number;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationTitleInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement | null>(null);
  // Slide in from zero width on mount.
  const [entered, setEntered] = useState(false);
  const closeCompleteRef = useRef(false);
  const { width, resizing, onResizeStart, onResizeKeyDown } = useResizablePanel({
    storageKey: 'litemark.agentPanelWidth',
    initialWidth: 360,
    minWidth: 260,
    maxWidth: 560,
    maxViewportRatio: 0.45,
    edge: 'left',
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

  const { items, status, error, activeRun, send, resume, stop, applyEdit, respondPermission } =
    session;
  const running = status === 'running';
  const panelTitle = isConfigured && modelName.trim() ? modelName.trim() : t('agent.title');
  const scopeLabel = scopeKind === 'project' ? t('agent.scope.project') : t('agent.scope.file');

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [items, running]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    if (!input) {
      textarea.style.height = '36px';
      return;
    }
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [input]);

  useEffect(() => {
    if (!editingConversationId) return;
    conversationTitleInputRef.current?.focus();
    conversationTitleInputRef.current?.select();
  }, [editingConversationId]);

  const handleSend = () => {
    if (!input.trim() || running || !isConfigured) return;
    void send(input);
    setInput('');
  };

  const localizeToolName = (name: string) => {
    const key = toolNameKeys[name];
    return key ? t(key) : name;
  };

  const startRenameConversation = (id: string, title: string) => {
    if (running) return;
    setEditingConversationId(id);
    setEditingConversationTitle(title);
  };

  const finishRenameConversation = () => {
    if (!editingConversationId) return;
    onRenameConversation(editingConversationId, editingConversationTitle);
    setEditingConversationId(null);
  };

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const recentConversations = conversations
    .filter((conversation) => !conversation.archivedAt && conversation.title.trim())
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const archivedConversations = conversations
    .filter((conversation) => conversation.archivedAt)
    .sort((left, right) => (right.archivedAt ?? 0) - (left.archivedAt ?? 0));

  const createConversation = () => {
    if (running) return;
    onCreateConversation();
    setView('conversation');
  };

  const selectConversation = (id: string) => {
    if (running) return;
    onSelectConversation(id);
    setView('conversation');
  };

  const archiveConversation = (id: string) => {
    if (running) return;
    onArchiveConversation(id);
    setView('home');
  };

  const restoreConversation = (id: string) => {
    if (running) return;
    onRestoreConversation(id);
    setView('conversation');
  };

  return (
    <aside
      ref={asideRef}
      className={`${styles.panel} ${resizing ? styles.resizing : ''} ${closing ? styles.closing : ''}`}
      data-tauri-drag-region="false"
      style={{ width: panelWidth }}
      onTransitionEnd={handlePanelTransitionEnd}
    >
      <div
        className={`${styles.resizeHandle} ${resizing ? styles.resizing : ''}`}
        role="separator"
        aria-label={t('agent.resize')}
        aria-orientation="vertical"
        aria-valuemin={260}
        aria-valuemax={560}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onResizeStart}
        onKeyDown={onResizeKeyDown}
      />
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          {view !== 'home' && (
            <button
              className={styles.headerButton}
              onClick={() => setView('home')}
              title={t('agent.backToChats')}
              aria-label={t('agent.backToChats')}
              disabled={running}
            >
              <LuArrowLeft />
            </button>
          )}
          <span
            className={styles.title}
            title={view === 'conversation' ? activeConversation?.title || panelTitle : undefined}
          >
            {view === 'home'
              ? t('agent.chats')
              : view === 'archive'
                ? t('agent.archivedChats')
                : activeConversation?.title || t('agent.newChat')}
          </span>
          <button
            className={styles.closeTitleButton}
            onClick={onClose}
            title={t('agent.close')}
            aria-label={t('agent.close')}
          >
            <LuX />
          </button>
          {view === 'conversation' && <span className={styles.scope}>{scopeLabel}</span>}
        </div>
        <div className={styles.headerActions}>
          {view === 'home' && (
            <button
              className={styles.headerButton}
              onClick={() => setView('archive')}
              title={t('agent.archivedChats')}
              aria-label={t('agent.archivedChats')}
              disabled={running}
            >
              <LuHistory />
            </button>
          )}
          {view === 'conversation' && activeConversation && (
            <button
              className={styles.headerButton}
              onClick={() => archiveConversation(activeConversation.id)}
              title={t('agent.archiveChat')}
              aria-label={t('agent.archiveChat')}
              disabled={running}
            >
              <LuArchive />
            </button>
          )}
          <button
            className={styles.headerButton}
            onClick={createConversation}
            title={t('agent.newChat')}
            aria-label={t('agent.newChat')}
            disabled={running}
          >
            <LuPenLine />
          </button>
        </div>
      </div>

      <div className={styles.chatHome} hidden={view === 'conversation'}>
        <div
          className={styles.chatHomeList}
          role="list"
          aria-label={view === 'archive' ? t('agent.archivedChats') : t('agent.chats')}
        >
          {(view === 'archive' ? archivedConversations : recentConversations).map(
            (conversation) => {
              const title = conversation.title || t('agent.newChat');
              return (
                <div key={conversation.id} className={styles.chatHomeRow} role="listitem">
                  {editingConversationId === conversation.id ? (
                    <input
                      ref={conversationTitleInputRef}
                      className={styles.conversationTitleInput}
                      value={editingConversationTitle}
                      onChange={(event) => setEditingConversationTitle(event.target.value)}
                      onBlur={finishRenameConversation}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') finishRenameConversation();
                        if (event.key === 'Escape') setEditingConversationId(null);
                      }}
                      aria-label={t('agent.renameChat')}
                    />
                  ) : (
                    <button
                      className={styles.chatHomeConversation}
                      onClick={() =>
                        view === 'archive'
                          ? restoreConversation(conversation.id)
                          : selectConversation(conversation.id)
                      }
                      onDoubleClick={() => startRenameConversation(conversation.id, title)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setConversationMenu({
                          id: conversation.id,
                          title,
                          archived: view === 'archive',
                          x: event.clientX,
                          y: event.clientY,
                        });
                      }}
                      title={title}
                      disabled={running}
                    >
                      <LuMessageSquare aria-hidden="true" />
                      <span>{title}</span>
                    </button>
                  )}
                  <div className={styles.chatRowActions}>
                    {view === 'archive' ? (
                      <>
                        <button
                          className={styles.rowIconButton}
                          onClick={() => restoreConversation(conversation.id)}
                          title={t('agent.restoreChat')}
                          aria-label={`${t('agent.restoreChat')}: ${title}`}
                          disabled={running}
                        >
                          <LuArchiveRestore />
                        </button>
                        <button
                          className={styles.rowIconButton}
                          onClick={() => {
                            if (window.confirm(t('agent.deleteChatConfirm'))) {
                              onDeleteConversation(conversation.id);
                            }
                          }}
                          title={t('agent.deleteChat')}
                          aria-label={`${t('agent.deleteChat')}: ${title}`}
                          disabled={running}
                        >
                          <LuTrash2 />
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.rowIconButton}
                        onClick={() => archiveConversation(conversation.id)}
                        title={t('agent.archiveChat')}
                        aria-label={`${t('agent.archiveChat')}: ${title}`}
                        disabled={running}
                      >
                        <LuArchive />
                      </button>
                    )}
                  </div>
                </div>
              );
            },
          )}
          {(view === 'archive' ? archivedConversations : recentConversations).length === 0 && (
            <div className={styles.chatHomeEmpty}>
              <LuMessageSquare aria-hidden="true" />
              <span>{view === 'archive' ? t('agent.noArchivedChats') : t('agent.noChats')}</span>
            </div>
          )}
        </div>
        {view === 'home' && (
          <button
            type="button"
            className={styles.startChatButton}
            onClick={createConversation}
            disabled={running}
          >
            <LuPlus aria-hidden="true" />
            {t('agent.startNewChat')}
          </button>
        )}
      </div>

      <div className={styles.messages} hidden={view !== 'conversation'} ref={listRef}>
        {!isConfigured && <div className={styles.notice}>{t('agent.notConfigured')}</div>}
        {activeRun?.status === 'interrupted' && (
          <div className={styles.interruptedRun} role="status">
            <div className={styles.interruptedRunText}>
              <strong>{t('agent.interruptedTitle')}</strong>
              <span title={activeRun.goal}>{activeRun.goal}</span>
            </div>
            <button
              type="button"
              className={styles.resumeButton}
              onClick={() => void resume()}
              disabled={running || !isConfigured}
              title={t('agent.resume')}
            >
              <LuRotateCcw aria-hidden="true" />
              {t('agent.resume')}
            </button>
          </div>
        )}
        {items.map((item) => {
          switch (item.role) {
            case 'user':
              return (
                <div key={item.id} className={styles.userRow}>
                  <div
                    className={styles.userBubble}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMessageMenu({
                        content: item.content,
                        role: 'user',
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                  >
                    {item.content}
                  </div>
                </div>
              );
            case 'assistant':
              return (
                <div key={item.id} className={styles.assistantRow}>
                  <div
                    className={styles.assistantBubble}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMessageMenu({
                        content: item.content,
                        role: 'assistant',
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                  >
                    {item.content ? (
                      <AgentMarkdown content={item.content} />
                    ) : (
                      running && <span className={styles.typing}>…</span>
                    )}
                  </div>
                </div>
              );
            case 'tool':
              return (
                <div key={item.id} className={styles.toolRow}>
                  <ToolDisclosure
                    name={localizeToolName(item.name)}
                    result={item.result}
                    error={item.error}
                    completedLabel={t('agent.tool.completed')}
                    failedLabel={t('agent.tool.failed')}
                    runningLabel={t('agent.tool.running')}
                  />
                </div>
              );
            case 'permission':
              return (
                <div key={item.id} className={styles.toolRow}>
                  <div className={styles.permissionCard}>
                    <div className={styles.permissionTitle}>
                      <span>{t('agent.permissionTitle')}</span>
                      <span className={styles.permissionToolName}>
                        {localizeToolName(item.name)}
                      </span>
                    </div>
                    {item.pending ? (
                      <div className={styles.permissionActions}>
                        <button
                          className={styles.allowButton}
                          onClick={() => respondPermission(item.requestId, true)}
                        >
                          <LuCheck aria-hidden="true" />
                          {t('agent.allow')}
                        </button>
                        <button
                          className={styles.alwaysAllowButton}
                          onClick={() => respondPermission(item.requestId, true, true)}
                        >
                          <LuShieldCheck aria-hidden="true" />
                          {t('agent.alwaysAllow')}
                        </button>
                        <button
                          className={styles.denyButton}
                          onClick={() => respondPermission(item.requestId, false)}
                        >
                          <LuX aria-hidden="true" />
                          {t('agent.deny')}
                        </button>
                      </div>
                    ) : (
                      <span className={`${styles.toolResult} ${styles.permissionResolution}`}>
                        {item.decision === 'allow' ? t('agent.allow') : t('agent.deny')}
                      </span>
                    )}
                  </div>
                </div>
              );
            case 'edit':
              return (
                <div key={item.id} className={styles.toolRow}>
                  <div className={styles.editCard}>
                    <div className={styles.editHeader}>
                      <span className={styles.editSummary}>
                        {t(item.applied ? 'agent.editApplied' : 'agent.editPending', {
                          added: item.summary.added,
                          removed: item.summary.removed,
                        })}
                      </span>
                      {!item.applied && (
                        <button className={styles.applyButton} onClick={() => applyEdit(item.id)}>
                          {t('agent.apply')}
                        </button>
                      )}
                    </div>
                    <details className={styles.diffDetails}>
                      <summary className={styles.diffSummary}>{t('agent.diffDetails')}</summary>
                      <pre className={styles.diffBlock}>
                        {item.diff.map((line, index) => (
                          <span key={index} className={styles[`diff-${line.type}`]}>
                            {line.text || ' '}
                            {'\n'}
                          </span>
                        ))}
                      </pre>
                    </details>
                  </div>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>

      {conversationMenu && (
        <ContextMenu
          x={conversationMenu.x}
          y={conversationMenu.y}
          label={t('agent.chatActions')}
          onClose={() => setConversationMenu(null)}
          items={[
            {
              id: 'open',
              label: t(conversationMenu.archived ? 'agent.restoreChat' : 'agent.openChat'),
              icon: conversationMenu.archived ? <LuArchiveRestore /> : <LuMessageSquare />,
              disabled: running,
              onSelect: () =>
                conversationMenu.archived
                  ? restoreConversation(conversationMenu.id)
                  : selectConversation(conversationMenu.id),
            },
            {
              id: 'rename',
              label: t('agent.renameChat'),
              icon: <LuPenLine />,
              disabled: running,
              onSelect: () => startRenameConversation(conversationMenu.id, conversationMenu.title),
            },
            {
              id: 'archive',
              label: t(conversationMenu.archived ? 'agent.restoreChat' : 'agent.archiveChat'),
              icon: conversationMenu.archived ? <LuArchiveRestore /> : <LuArchive />,
              disabled: running,
              onSelect: () =>
                conversationMenu.archived
                  ? restoreConversation(conversationMenu.id)
                  : archiveConversation(conversationMenu.id),
            },
            { id: 'separator', separator: true },
            {
              id: 'delete',
              label: t('agent.deleteChat'),
              icon: <LuTrash2 />,
              danger: true,
              disabled: running,
              onSelect: () => {
                if (window.confirm(t('agent.deleteChatConfirm')))
                  onDeleteConversation(conversationMenu.id);
              },
            },
          ]}
        />
      )}
      {messageMenu && (
        <ContextMenu
          x={messageMenu.x}
          y={messageMenu.y}
          label={t('agent.messageActions')}
          onClose={() => setMessageMenu(null)}
          items={[
            {
              id: 'copy',
              label: t('agent.copyMessage'),
              icon: <LuCopy />,
              onSelect: () => void navigator.clipboard.writeText(messageMenu.content),
            },
            {
              id: 'copy-markdown',
              label: t('agent.copyAsMarkdown'),
              icon: <LuCopy />,
              onSelect: () => void navigator.clipboard.writeText(messageMenu.content),
            },
            {
              id: 'resend',
              label: t('agent.resendMessage'),
              icon: <LuRotateCcw />,
              disabled: messageMenu.role !== 'user' || running,
              onSelect: () => setInput(messageMenu.content),
            },
            {
              id: 'insert-code',
              label: t('agent.insertCode'),
              icon: <LuCode />,
              disabled: !onInsertCode || !/```[^\n]*\n[\s\S]*?```/.test(messageMenu.content),
              onSelect: () => {
                const code = messageMenu.content.match(/```[^\n]*\n([\s\S]*?)```/)?.[1];
                if (code) onInsertCode?.(code.replace(/\n$/, ''));
              },
            },
          ]}
        />
      )}

      {view === 'conversation' && error && <div className={styles.error}>{error}</div>}

      <div className={styles.composer} hidden={view !== 'conversation'}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder={t('agent.placeholder')}
          rows={1}
          disabled={running || !isConfigured}
        />
        {running ? (
          <button
            className={styles.stopButton}
            onClick={stop}
            title={t('agent.stop')}
            aria-label={t('agent.stop')}
          >
            <LuSquare />
          </button>
        ) : (
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!input.trim() || !isConfigured}
            title={t('agent.send')}
            aria-label={t('agent.send')}
          >
            <LuSend />
          </button>
        )}
      </div>
    </aside>
  );
};

export default AgentPanel;
