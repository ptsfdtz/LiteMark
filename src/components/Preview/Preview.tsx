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
  ol: ({ node, ...props }) => <ol {...props} data-source-line={getSourceLine(node)} />,
  li: ({ node, ...props }) => <li {...props} data-source-line={getSourceLine(node)} />,
  pre: ({ node, ...props }) => <pre {...props} data-source-line={getSourceLine(node)} />,
  table: ({ node, ...props }) => <table {...props} data-source-line={getSourceLine(node)} />,
  thead: ({ node, ...props }) => <thead {...props} data-source-line={getSourceLine(node)} />,
  tbody: ({ node, ...props }) => <tbody {...props} data-source-line={getSourceLine(node)} />,
  tr: ({ node, ...props }) => <tr {...props} data-source-line={getSourceLine(node)} />,
  hr: ({ node, ...props }) => <hr {...props} data-source-line={getSourceLine(node)} />,
  div: ({ node, ...props }) => <div {...props} data-source-line={getSourceLine(node)} />,
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
      onExitPreviewMode,
      onEnterPreviewMode,
      onEnterEditorMode,
      isPreviewOnly,
    },
    ref,
  ) => {
    const { t } = useI18n();
    const { preprocessMathChinese } = useMathPreprocess();
    const processedContent = preprocessMathChinese(processSpecialEmojis(content));

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
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath, remarkEmoji]}
            rehypePlugins={[
              rehypeRaw,
              [rehypeSanitize, previewSanitizeSchema],
              rehypeKatex,
              rehypeHighlight,
            ]}
            components={{
              ...sourceLineComponents,
              pre: CodeBlock,
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
