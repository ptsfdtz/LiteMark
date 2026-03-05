import { describe, expect, it } from 'vitest';
import { sanitizeHref, sanitizeImageSrc } from './security';

describe('sanitizeHref', () => {
  it('allows safe absolute links', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeHref('mailto:team@example.com')).toBe('mailto:team@example.com');
  });

  it('allows relative links and anchors', () => {
    expect(sanitizeHref('/docs/start')).toBe('/docs/start');
    expect(sanitizeHref('#chapter-1')).toBe('#chapter-1');
    expect(sanitizeHref('../guide')).toBe('../guide');
  });

  it('normalizes protocol-relative links to https', () => {
    expect(sanitizeHref('//cdn.example.com/pkg.js')).toBe('https://cdn.example.com/pkg.js');
  });

  it('blocks dangerous schemes', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeHref(' jAvA\nsCript:alert(1) ')).toBeUndefined();
    expect(sanitizeHref('vbscript:msgbox(1)')).toBeUndefined();
    expect(sanitizeHref('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined();
  });

  it('blocks unknown schemes by default', () => {
    expect(sanitizeHref('ftp://example.com/file.txt')).toBeUndefined();
  });
});

describe('sanitizeImageSrc', () => {
  it('allows safe image sources', () => {
    expect(sanitizeImageSrc('https://example.com/image.png')).toBe('https://example.com/image.png');
    expect(sanitizeImageSrc('asset://localhost/image.png')).toBe('asset://localhost/image.png');
  });

  it('allows base64 data images only', () => {
    const pngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
    expect(sanitizeImageSrc(pngData)).toBe(pngData);
    expect(sanitizeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined();
  });

  it('blocks script-like schemes', () => {
    expect(sanitizeImageSrc('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeImageSrc('vbscript:msgbox(1)')).toBeUndefined();
  });
});
