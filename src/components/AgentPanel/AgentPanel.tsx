import React, { useEffect, useRef, useState } from 'react';
import { LuSend, LuSquare, LuTrash2, LuX } from 'react-icons/lu';
import styles from './AgentPanel.module.css';
import type { AgentSession } from '@/modules/agent/useAgentSession';
import { useI18n } from '@/locales/useI18n';
import type { TranslationKey } from '@/locales/config';
import { useResizablePanel } from '@/hooks/useResizablePanel';

interface AgentPanelProps {
  session: AgentSession;
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

const AgentPanel: React.FC<AgentPanelProps> = ({
  session,
  isConfigured,
  modelName,
  onClose,
  closing = false,
  onCloseComplete,
}) => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  const { items, status, error, send, stop, clear, applyEdit, respondPermission } = session;
  const running = status === 'running';
  const panelTitle = isConfigured && modelName.trim() ? modelName.trim() : t('agent.title');

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

  const handleSend = () => {
    if (!input.trim() || running || !isConfigured) return;
    void send(input);
    setInput('');
  };

  const localizeToolName = (name: string) => {
    const key = toolNameKeys[name];
    return key ? t(key) : name;
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
        <span className={styles.title} title={panelTitle}>
          {panelTitle}
        </span>
        <div className={styles.headerActions}>
          <button
            className={styles.headerButton}
            onClick={clear}
            title={t('agent.clear')}
            aria-label={t('agent.clear')}
            disabled={running || items.length === 0}
          >
            <LuTrash2 />
          </button>
          <button
            className={styles.headerButton}
            onClick={onClose}
            title={t('agent.close')}
            aria-label={t('agent.close')}
          >
            <LuX />
          </button>
        </div>
      </div>

      <div className={styles.messages} ref={listRef}>
        {!isConfigured && <div className={styles.notice}>{t('agent.notConfigured')}</div>}
        {items.map((item) => {
          switch (item.role) {
            case 'user':
              return (
                <div key={item.id} className={styles.userRow}>
                  <div className={styles.userBubble}>{item.content}</div>
                </div>
              );
            case 'assistant':
              return (
                <div key={item.id} className={styles.assistantRow}>
                  <div className={styles.assistantBubble}>
                    {item.content || (running && <span className={styles.typing}>…</span>)}
                  </div>
                </div>
              );
            case 'tool':
              return (
                <div key={item.id} className={styles.toolRow}>
                  <div className={styles.toolCard}>
                    <span className={styles.toolName}>{localizeToolName(item.name)}</span>
                    {item.error ? (
                      <span className={styles.toolError}>{item.error}</span>
                    ) : item.result !== undefined ? (
                      <span className={styles.toolResult}>{item.result}</span>
                    ) : (
                      <span className={styles.toolPending}>…</span>
                    )}
                  </div>
                </div>
              );
            case 'permission':
              return (
                <div key={item.id} className={styles.toolRow}>
                  <div className={styles.permissionCard}>
                    <div className={styles.permissionTitle}>
                      {t('agent.permissionTitle')}{' '}
                      <span className={styles.toolName}>{localizeToolName(item.name)}</span>
                    </div>
                    {item.pending ? (
                      <div className={styles.permissionActions}>
                        <button
                          className={styles.allowButton}
                          onClick={() => respondPermission(item.requestId, true)}
                        >
                          {t('agent.allow')}
                        </button>
                        <button
                          className={styles.allowButton}
                          onClick={() => respondPermission(item.requestId, true, true)}
                        >
                          {t('agent.alwaysAllow')}
                        </button>
                        <button
                          className={styles.denyButton}
                          onClick={() => respondPermission(item.requestId, false)}
                        >
                          {t('agent.deny')}
                        </button>
                      </div>
                    ) : (
                      <span className={styles.toolResult}>
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

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.composer}>
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
