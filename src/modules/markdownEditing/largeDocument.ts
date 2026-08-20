export const LARGE_MARKDOWN_BYTES = 1024 * 1024;
export const LARGE_MARKDOWN_LINES = 20_000;

export function isLargeMarkdownDocument(value: string): boolean {
  if (value.length >= LARGE_MARKDOWN_BYTES) return true;
  let lines = 1;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 10 && ++lines >= LARGE_MARKDOWN_LINES) return true;
  }
  return false;
}
