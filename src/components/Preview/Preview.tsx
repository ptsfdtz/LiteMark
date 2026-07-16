// src/components/Preview/Preview.tsx
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkEmoji from 'remark-emoji';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import { slug } from 'github-slugger';
import './Preview.css';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import { useMathPreprocess } from './hooks/useMathPreprocess';
import { FaCheck, FaCopy, FaEdit, FaExpand, FaLink, FaTimes, FaUnlink } from 'react-icons/fa';
import { PreviewProps } from '@/types/preview';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useI18n } from '@/locales/useI18n';

const previewSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className', /^lang-./, 'no-highlight', 'nohighlight'],
    ],
    div: [...(defaultSchema.attributes?.div || []), ['className', 'math', 'math-display']],
    i: [
      ...(defaultSchema.attributes?.i || []),
      ['className', 'fa', /^fa-[\w-]+$/, 'editormd-logo', /^editormd-logo-[2-5]x$/],
      ['ariaHidden', 'true'],
    ],
    span: [...(defaultSchema.attributes?.span || []), ['className', 'math', 'math-inline']],
  },
};

const getSourceLine = (node: ExtraProps['node']) => node?.position?.start.line;
const HEADING_ID_PREFIX = 'preview-heading-';

const getHeadingTargetId = (href: string | undefined): string | undefined => {
  if (!href?.startsWith('#') || href.length === 1) return undefined;

  try {
    const headingSlug = slug(decodeURIComponent(href.slice(1)));
    return headingSlug ? `${HEADING_ID_PREFIX}${headingSlug}` : undefined;
  } catch {
    return undefined;
  }
};

const MarkdownSourceContext = React.createContext<readonly string[]>([]);
const OrderedListStartLineContext = React.createContext<number | undefined>(undefined);

const isBlankMarkdownSourceLine = (line: string): boolean =>
  line.replace(/^(?:[ \t]*>[ \t]?)+/, '').trim().length === 0;

const getBlankLinesBefore = (sourceLine: number, sourceLines: readonly string[]): number => {
  let lineIndex = sourceLine - 2;
  let blankLineCount = 0;

  while (lineIndex >= 0 && isBlankMarkdownSourceLine(sourceLines[lineIndex] ?? '')) {
    blankLineCount++;
    lineIndex--;
  }

  return blankLineCount;
};

const getOrderedListItemValue = (
  node: ExtraProps['node'],
  sourceLines: readonly string[],
): number | undefined => {
  const sourceLine = getSourceLine(node);
  const sourceColumn = node?.position?.start.column;
  if (sourceLine === undefined || sourceColumn === undefined) return undefined;

  const marker = sourceLines[sourceLine - 1]
    ?.slice(sourceColumn - 1)
    .match(/^(\d+)[.)](?:[ \t]+|$)/);
  if (!marker) return undefined;

  const value = Number(marker[1]);
  return Number.isSafeInteger(value) ? value : undefined;
};

interface TaskListItemContextValue {
  sourceLine: number | undefined;
  isTaskListItem: boolean;
}

const TaskListItemContext = React.createContext<TaskListItemContextValue>({
  sourceLine: undefined,
  isTaskListItem: false,
});

interface MarkdownTextNode {
  value?: string;
  children?: MarkdownTextNode[];
}

const getMarkdownText = (node: MarkdownTextNode | undefined): string =>
  node?.value ?? node?.children?.map(getMarkdownText).join('') ?? '';

const copyText = async (text: string): Promise<boolean> => {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the legacy API for webviews without clipboard permission.
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

type CodeBlockProps = React.ComponentPropsWithoutRef<'pre'> & ExtraProps;
type ListItemProps = React.ComponentPropsWithoutRef<'li'> & ExtraProps;
type OrderedListProps = React.ComponentPropsWithoutRef<'ol'> & ExtraProps;
type PreviewAnchorProps = React.ComponentPropsWithoutRef<'a'>;
type TaskListItemCheckboxProps = React.ComponentPropsWithoutRef<'input'> & {
  onTaskToggle?: (sourceLine: number, checked: boolean) => void;
};

const CodeBlock = ({ node, children, ...props }: CodeBlockProps) => {
  const { t } = useI18n();
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);
  const copiedResetTimer = useRef<number | null>(null);
  const sourceLine = getSourceLine(node);
  const code = getMarkdownText(node as unknown as MarkdownTextNode);
  const codeBlockId = `${sourceLine ?? 'unknown'}:${code}`;
  const copied = copiedCodeBlock === codeBlockId;

  useEffect(
    () => () => {
      if (copiedResetTimer.current !== null) clearTimeout(copiedResetTimer.current);
    },
    [],
  );

  const handleCopyCode = async () => {
    if (!(await copyText(code))) return;

    setCopiedCodeBlock(codeBlockId);
    if (copiedResetTimer.current !== null) clearTimeout(copiedResetTimer.current);
    copiedResetTimer.current = window.setTimeout(() => {
      setCopiedCodeBlock(null);
      copiedResetTimer.current = null;
    }, 1800);
  };

  return (
    <div className="code-block" data-source-line={sourceLine}>
      <button
        type="button"
        className={`code-copy-button${copied ? ' is-copied' : ''}`}
        onClick={() => void handleCopyCode()}
        title={t(copied ? 'preview.codeCopied' : 'preview.copyCode')}
        aria-label={t(copied ? 'preview.codeCopied' : 'preview.copyCode')}
      >
        <span className="code-copy-icon" aria-hidden="true">
          <FaCopy className="code-copy-icon-copy" />
          <FaCheck className="code-copy-icon-check" />
        </span>
      </button>
      <span className="code-copy-status" role="status">
        {copied ? t('preview.codeCopied') : ''}
      </span>
      <pre {...props} data-source-line={sourceLine}>
        {children}
      </pre>
    </div>
  );
};

const PreviewAnchor = ({ href, onClick, ...props }: PreviewAnchorProps) => {
  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const targetId = getHeadingTargetId(href);
    const preview = event.currentTarget.closest('.preview-container');
    const target = targetId ? event.currentTarget.ownerDocument.getElementById(targetId) : null;
    if (!preview || !target || !preview.contains(target)) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  };

  return <a {...props} href={href} onClick={handleClick} />;
};

const SourceLinkedOrderedList = ({ node, ...props }: OrderedListProps) => {
  const sourceLine = getSourceLine(node);

  return (
    <OrderedListStartLineContext.Provider value={sourceLine}>
      <ol {...props} data-source-line={sourceLine} />
    </OrderedListStartLineContext.Provider>
  );
};

const SourceLinkedListItem = ({ node, className, ...props }: ListItemProps) => {
  const sourceLines = React.useContext(MarkdownSourceContext);
  const orderedListStartLine = React.useContext(OrderedListStartLineContext);
  const sourceLine = getSourceLine(node);
  const value = getOrderedListItemValue(node, sourceLines);
  const blankLineCount =
    value !== undefined &&
    sourceLine !== undefined &&
    orderedListStartLine !== undefined &&
    sourceLine !== orderedListStartLine
      ? getBlankLinesBefore(sourceLine, sourceLines)
      : 0;
  const style =
    blankLineCount > 0 ? { ...props.style, paddingBlockStart: `${blankLineCount}lh` } : props.style;
  const isTaskListItem = className?.split(/\s+/).includes('task-list-item') ?? false;

  return (
    <TaskListItemContext.Provider value={{ sourceLine, isTaskListItem }}>
      <li
        {...props}
        className={className}
        style={style}
        value={value ?? props.value}
        data-source-line={sourceLine}
      />
    </TaskListItemContext.Provider>
  );
};

const TaskListItemCheckbox = ({
  checked,
  disabled,
  onChange,
  onTaskToggle,
  type,
  ...props
}: TaskListItemCheckboxProps) => {
  const { t } = useI18n();
  const { sourceLine, isTaskListItem } = React.useContext(TaskListItemContext);
  const taskSourceLine =
    typeof sourceLine === 'number' && Number.isInteger(sourceLine) && sourceLine > 0
      ? sourceLine
      : undefined;

  if (type !== 'checkbox' || !isTaskListItem || taskSourceLine === undefined || !onTaskToggle) {
    return (
      <input {...props} type={type} checked={checked} disabled={disabled} onChange={onChange} />
    );
  }

  return (
    <input
      {...props}
      type="checkbox"
      checked={Boolean(checked)}
      disabled={false}
      aria-label={t(checked ? 'preview.markTaskIncomplete' : 'preview.markTaskComplete')}
      onChange={(event) => onTaskToggle(taskSourceLine, event.currentTarget.checked)}
    />
  );
};

const sourceLineComponents: Components = {
  h1: ({ node, ...props }) => <h1 {...props} data-source-line={getSourceLine(node)} />,
  h2: ({ node, ...props }) => <h2 {...props} data-source-line={getSourceLine(node)} />,
  h3: ({ node, ...props }) => <h3 {...props} data-source-line={getSourceLine(node)} />,
  h4: ({ node, ...props }) => <h4 {...props} data-source-line={getSourceLine(node)} />,
  h5: ({ node, ...props }) => <h5 {...props} data-source-line={getSourceLine(node)} />,
  h6: ({ node, ...props }) => <h6 {...props} data-source-line={getSourceLine(node)} />,
  p: ({ node, ...props }) => <p {...props} data-source-line={getSourceLine(node)} />,
  blockquote: ({ node, ...props }) => (
    <blockquote {...props} data-source-line={getSourceLine(node)} />
  ),
  ul: ({ node, ...props }) => <ul {...props} data-source-line={getSourceLine(node)} />,
  ol: SourceLinkedOrderedList,
  li: SourceLinkedListItem,
  pre: ({ node, ...props }) => <pre {...props} data-source-line={getSourceLine(node)} />,
  table: ({ node, ...props }) => <table {...props} data-source-line={getSourceLine(node)} />,
  thead: ({ node, ...props }) => <thead {...props} data-source-line={getSourceLine(node)} />,
  tbody: ({ node, ...props }) => <tbody {...props} data-source-line={getSourceLine(node)} />,
  tr: ({ node, ...props }) => <tr {...props} data-source-line={getSourceLine(node)} />,
  hr: ({ node, ...props }) => <hr {...props} data-source-line={getSourceLine(node)} />,
  div: ({ node, ...props }) => <div {...props} data-source-line={getSourceLine(node)} />,
};

const escapeUnclosedFencedCodeBlocks = (content: string): string => {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  while (true) {
    let openFence:
      | { character: string; length: number; lineIndex: number; indentLength: number }
      | undefined;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const match = lines[lineIndex].match(/^( {0,3})(`{3,}|~{3,})(.*)$/);
      if (!match) continue;

      const fence = match[2];
      const character = fence[0];
      const suffix = match[3];

      if (!openFence) {
        if (character === '`' && suffix.includes('`')) continue;
        openFence = {
          character,
          length: fence.length,
          lineIndex,
          indentLength: match[1].length,
        };
        continue;
      }

      if (
        character === openFence.character &&
        fence.length >= openFence.length &&
        suffix.trim().length === 0
      ) {
        openFence = undefined;
      }
    }

    if (!openFence) return lines.join(lineEnding);

    const openingLine = lines[openFence.lineIndex];
    lines[openFence.lineIndex] =
      openingLine.slice(0, openFence.indentLength) +
      '\\' +
      openingLine.slice(openFence.indentLength);
  }
};

const processSpecialEmojis = (content: string): string => {
  return content
    .replace(/:fa-([\w-]+):/g, '<i class="fa fa-$1" aria-hidden="true"></i>')
    .replace(/:editormd-logo(-\dx)?:/g, '<i class="editormd-logo$1" aria-hidden="true"></i>');
};

const isRemoteSrc = (src: string) => /^(https?:|data:|blob:|asset:|tauri:|file:)/i.test(src);

const isWindowsPath = (path: string) => /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\');

const splitSrc = (src: string) => {
  const queryIndex = src.indexOf('?');
  const hashIndex = src.indexOf('#');
  const cutIndex = Math.min(
    queryIndex >= 0 ? queryIndex : Number.POSITIVE_INFINITY,
    hashIndex >= 0 ? hashIndex : Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(cutIndex)) {
    return { path: src, suffix: '' };
  }
  return { path: src.slice(0, cutIndex), suffix: src.slice(cutIndex) };
};

const resolveImageSrc = (src: string | undefined, filePath?: string | null) => {
  if (!src || !filePath || isRemoteSrc(src)) return src || '';
  const { path: rawPath, suffix } = splitSrc(src);
  const windows = isWindowsPath(filePath);
  const isAbsolute = windows
    ? /^[a-zA-Z]:[\\/]/.test(rawPath) || rawPath.startsWith('\\\\')
    : rawPath.startsWith('/');

  if (isAbsolute) {
    return `${convertFileSrc(rawPath)}${suffix}`;
  }

  const baseDir = filePath.replace(/[/\\][^/\\]+$/, '');
  if (!baseDir) return src;

  const baseUrl = `file:///${baseDir.replace(/\\/g, '/')}/`;
  const url = new URL(rawPath, baseUrl);
  let resolvedPath = decodeURIComponent(url.pathname);
  if (windows) {
    if (/^\/[a-zA-Z]:/.test(resolvedPath)) {
      resolvedPath = resolvedPath.slice(1);
    }
    resolvedPath = resolvedPath.replace(/\//g, '\\');
  }
  return `${convertFileSrc(resolvedPath)}${suffix}`;
};

const Preview = React.forwardRef<HTMLDivElement, PreviewProps>(
  (
    {
      content,
      filePath,
      scrollSyncEnabled = true,
      onScrollSyncToggle,
      onTaskToggle,
      onExitPreviewMode,
      onEnterPreviewMode,
      onEnterEditorMode,
      isPreviewOnly,
    },
    ref,
  ) => {
    const { t } = useI18n();
    const { preprocessMathChinese } = useMathPreprocess();
    const processedContent = preprocessMathChinese(
      processSpecialEmojis(escapeUnclosedFencedCodeBlocks(content)),
    );
    const sourceLines = processedContent.split(/\r?\n/);

    return (
      <div ref={ref} className="preview-container">
        {!isPreviewOnly && onEnterPreviewMode && (
          <button
            className="previewModeButton previewOnly"
            onClick={onEnterPreviewMode}
            title={t('preview.enterPreviewMode')}
            aria-label={t('preview.enterPreviewMode')}
          >
            <FaExpand />
          </button>
        )}
        {!isPreviewOnly && onEnterEditorMode && (
          <button
            className="previewModeButton editorOnly"
            onClick={onEnterEditorMode}
            title={t('preview.enterEditMode')}
            aria-label={t('preview.enterEditMode')}
          >
            <FaEdit />
          </button>
        )}
        {isPreviewOnly && onExitPreviewMode && (
          <button
            className="previewModeButton exit"
            onClick={onExitPreviewMode}
            title={t('preview.exitPreviewMode')}
            aria-label={t('preview.exitPreviewMode')}
          >
            <FaTimes />
          </button>
        )}
        <div className="preview-content" data-preview-content>
          <MarkdownSourceContext.Provider value={sourceLines}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkEmoji]}
              rehypePlugins={[
                rehypeRaw,
                [rehypeSanitize, previewSanitizeSchema],
                [rehypeSlug, { prefix: HEADING_ID_PREFIX }],
                rehypeKatex,
                rehypeHighlight,
              ]}
              components={{
                ...sourceLineComponents,
                pre: CodeBlock,
                a: (componentProps) => {
                  const props = { ...componentProps };
                  delete props.node;
                  return <PreviewAnchor {...props} />;
                },
                input: (componentProps) => {
                  const props = { ...componentProps };
                  delete props.node;
                  return <TaskListItemCheckbox {...props} onTaskToggle={onTaskToggle} />;
                },
                img: (componentProps) => {
                  const props = { ...componentProps };
                  const sourceLine = getSourceLine(props.node);
                  delete props.node;
                  return (
                    <img
                      {...props}
                      data-source-line={sourceLine}
                      src={resolveImageSrc(props.src, filePath)}
                      style={{ maxWidth: '100%', height: 'auto' }}
                      alt={props.alt || t('preview.imageAlt')}
                    />
                  );
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </MarkdownSourceContext.Provider>
        </div>
        {onScrollSyncToggle && (
          <button
            className={`scrollSyncButton ${scrollSyncEnabled ? 'active' : ''}`}
            onClick={onScrollSyncToggle}
            title={
              scrollSyncEnabled ? t('preview.disableScrollSync') : t('preview.enableScrollSync')
            }
            aria-label={
              scrollSyncEnabled ? t('preview.disableScrollSync') : t('preview.enableScrollSync')
            }
          >
            {scrollSyncEnabled ? <FaLink /> : <FaUnlink />}
          </button>
        )}
      </div>
    );
  },
);

Preview.displayName = 'Preview';

export default Preview;
