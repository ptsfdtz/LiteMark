import { convertFileSrc } from '@tauri-apps/api/core';

const isRemoteSrc = (src: string) => /^(https?:|data:|blob:|asset:|tauri:|file:)/i.test(src);

const isWindowsPath = (path: string) => /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\');

const splitSrc = (src: string) => {
  const queryIndex = src.indexOf('?');
  const hashIndex = src.indexOf('#');
  const cutIndex = Math.min(
    queryIndex >= 0 ? queryIndex : Number.POSITIVE_INFINITY,
    hashIndex >= 0 ? hashIndex : Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(cutIndex)) return { path: src, suffix: '' };
  return { path: src.slice(0, cutIndex), suffix: src.slice(cutIndex) };
};

export function resolveImageSrc(src: string | undefined, filePath?: string | null): string {
  if (!src || !filePath || isRemoteSrc(src)) return src || '';
  const { path: rawPath, suffix } = splitSrc(src);
  const windows = isWindowsPath(filePath);
  const isAbsolute = windows
    ? /^[a-zA-Z]:[\\/]/.test(rawPath) || rawPath.startsWith('\\\\')
    : rawPath.startsWith('/');

  if (isAbsolute) return `${convertFileSrc(rawPath)}${suffix}`;

  const baseDir = filePath.replace(/[/\\][^/\\]+$/, '');
  if (!baseDir) return src;

  const baseUrl = `file:///${baseDir.replace(/\\/g, '/')}/`;
  const url = new URL(rawPath, baseUrl);
  let resolvedPath = decodeURIComponent(url.pathname);
  if (windows) {
    if (/^\/[a-zA-Z]:/.test(resolvedPath)) resolvedPath = resolvedPath.slice(1);
    resolvedPath = resolvedPath.replace(/\//g, '\\');
  }
  return `${convertFileSrc(resolvedPath)}${suffix}`;
}

export function resolveLocalImagePath(
  src: string | undefined,
  filePath?: string | null,
): string | undefined {
  if (!src || !filePath || isRemoteSrc(src)) return undefined;
  const { path: rawPath } = splitSrc(src);
  const windows = isWindowsPath(filePath);
  if (windows && (/^[a-zA-Z]:[\\/]/.test(rawPath) || rawPath.startsWith('\\\\'))) {
    return rawPath.replace(/\//g, '\\');
  }
  if (!windows && rawPath.startsWith('/')) return rawPath;
  const separator = windows ? '\\' : '/';
  const baseDir = filePath.replace(/[/\\][^/\\]+$/, '');
  const parts = `${baseDir}${separator}${rawPath}`.split(/[/\\]/);
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === '..') normalized.pop();
    else if (part && part !== '.') normalized.push(part);
  }
  return windows ? normalized.join('\\') : `/${normalized.join('/')}`;
}
