// src/components/Preview/Preview.tsx
import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkEmoji from 'remark-emoji';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import './Preview.css';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import { useMathPreprocess } from './hooks/useMathPreprocess';
import { FaLink, FaUnlink, FaEdit, FaTimes } from 'react-icons/fa';
import { PreviewProps } from '@/types/preview';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useI18n } from '@/locales/useI18n';

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
      // previewMode = false,
      onExitPreviewMode,
      onEnterEditorMode,
      isPreviewOnly,
    },
    ref,
  ) => {
    const { t } = useI18n();
    const { preprocessMathChinese } = useMathPreprocess();
    const processedContent = preprocessMathChinese(processSpecialEmojis(content));
    useEffect(() => {
      (window as unknown as typeof globalThis & { hljs: typeof hljs }).hljs = hljs;
      const highlightCode = () => {
        document.querySelectorAll('pre code:not([data-highlighted])').forEach((block) => {
          try {
            hljs.highlightElement(block as HTMLElement);
          } catch (e) {
            console.warn('Highlight error:', e);
          }
        });
      };
      highlightCode();
      const timers = [
        setTimeout(highlightCode, 10),
        setTimeout(highlightCode, 100),
        setTimeout(highlightCode, 500),
      ];
      return () => {
        timers.forEach((timer) => clearTimeout(timer));
      };
    }, [content]);

    return (
      <div ref={ref} className="preview-container">
        {!isPreviewOnly && onEnterEditorMode && (
          <button
            className="previewModeButton enter"
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
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath, remarkEmoji]}
          rehypePlugins={[rehypeHighlight, rehypeRaw, rehypeKatex]}
          components={{
            img: ({ ...props }) => (
              <img
                {...props}
                src={resolveImageSrc(props.src, filePath)}
                style={{ maxWidth: '100%', height: 'auto' }}
                alt={props.alt || t('preview.imageAlt')}
              />
            ),
          }}
        >
          {processedContent}
        </ReactMarkdown>
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
