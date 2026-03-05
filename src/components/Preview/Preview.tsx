// src/components/Preview/Preview.tsx
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import './Preview.css';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import { useMathPreprocess } from './hooks/useMathPreprocess';
import { FaLink, FaUnlink, FaEdit, FaTimes } from 'react-icons/fa';
import { PreviewProps } from '@/types/preview';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useI18n } from '@/locales/useI18n';
import {
  createMarkdownPipeline,
  isExternalLink,
  sanitizeHref,
  sanitizeImageSrc,
} from '@/shared/markdown';

const processSpecialEmojis = (content: string, allowRawHtml: boolean): string => {
  if (!allowRawHtml) return content;
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
    const pipeline = useMemo(() => createMarkdownPipeline(), []);
    const processedContent = useMemo(
      () => preprocessMathChinese(processSpecialEmojis(content, pipeline.security.allowRawHtml)),
      [content, preprocessMathChinese, pipeline.security.allowRawHtml],
    );

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
          remarkPlugins={pipeline.remarkPlugins as []}
          rehypePlugins={pipeline.rehypePlugins as []}
          components={{
            a: ({ href, children, ...props }) => {
              const safeHref = sanitizeHref(href, pipeline.security.allowedLinkProtocols);
              if (!safeHref) {
                return <span>{children}</span>;
              }
              const external = isExternalLink(safeHref);
              return (
                <a
                  {...props}
                  href={safeHref}
                  target={external ? '_blank' : props.target}
                  rel={external ? 'noopener noreferrer nofollow' : props.rel}
                >
                  {children}
                </a>
              );
            },
            img: ({ ...props }) => {
              const resolvedSrc = resolveImageSrc(props.src, filePath);
              const safeSrc = sanitizeImageSrc(
                resolvedSrc,
                pipeline.security.allowedImageProtocols,
              );
              if (!safeSrc) return null;
              return <img {...props} src={safeSrc} alt={props.alt || t('preview.imageAlt')} />;
            },
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
