const SCHEME_RE = /^([a-zA-Z][a-zA-Z\d+\-.]*):/;
const DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,[a-zA-Z0-9+/=]+$/i;

export const DEFAULT_ALLOWED_LINK_PROTOCOLS = ['http', 'https', 'mailto', 'file', 'asset', 'tauri'];
export const DEFAULT_ALLOWED_IMAGE_PROTOCOLS = [
  'http',
  'https',
  'file',
  'asset',
  'tauri',
  'blob',
  'data',
];

const sanitizeForProtocolCheck = (value: string) => {
  let sanitized = '';
  for (const ch of value.trim()) {
    const code = ch.charCodeAt(0);
    if (code <= 31 || code === 127) continue;
    if (/\s/.test(ch)) continue;
    sanitized += ch;
  }
  return sanitized.toLowerCase();
};

const isProtocolAllowed = (value: string, allowedProtocols: string[]) => {
  const match = value.match(SCHEME_RE);
  if (!match) {
    return true;
  }
  const protocol = match[1].toLowerCase();
  return allowedProtocols.includes(protocol);
};

export const isExternalLink = (href: string) =>
  /^https?:\/\//i.test(href) || href.startsWith('//') || /^mailto:/i.test(href);

export function sanitizeHref(
  href: string | undefined | null,
  allowedProtocols = DEFAULT_ALLOWED_LINK_PROTOCOLS,
): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;

  const checkValue = sanitizeForProtocolCheck(trimmed);
  if (
    checkValue.startsWith('javascript:') ||
    checkValue.startsWith('vbscript:') ||
    checkValue.startsWith('data:text/html')
  ) {
    return undefined;
  }

  if (!isProtocolAllowed(trimmed, allowedProtocols)) {
    return undefined;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return trimmed;
}

export function sanitizeImageSrc(
  src: string | undefined | null,
  allowedProtocols = DEFAULT_ALLOWED_IMAGE_PROTOCOLS,
): string | undefined {
  if (!src) return undefined;
  const trimmed = src.trim();
  if (!trimmed) return undefined;

  const checkValue = sanitizeForProtocolCheck(trimmed);
  if (checkValue.startsWith('javascript:') || checkValue.startsWith('vbscript:')) {
    return undefined;
  }

  if (checkValue.startsWith('data:')) {
    return DATA_IMAGE_RE.test(trimmed) ? trimmed : undefined;
  }

  if (!isProtocolAllowed(trimmed, allowedProtocols)) {
    return undefined;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return trimmed;
}
