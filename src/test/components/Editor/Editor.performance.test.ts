import { describe, expect, it } from 'vitest';
import {
  LARGE_MARKDOWN_BYTES,
  LARGE_MARKDOWN_LINES,
  isLargeMarkdownDocument,
} from '@/modules/markdownEditing/largeDocument';

describe('large Markdown detection', () => {
  it('keeps ordinary documents in WYSIWYG mode', () => {
    expect(isLargeMarkdownDocument('# Title\n\nShort document')).toBe(false);
  });

  it('uses source mode for documents at the byte or line threshold', () => {
    expect(isLargeMarkdownDocument('x'.repeat(LARGE_MARKDOWN_BYTES))).toBe(true);
    expect(isLargeMarkdownDocument('\n'.repeat(LARGE_MARKDOWN_LINES - 1))).toBe(true);
  });
});
