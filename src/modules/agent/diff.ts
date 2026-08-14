import type { DiffLine, DiffSummary } from './types';

export function summarizeDiff(before: string, after: string): DiffSummary {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  let prefix = 0;
  const maxPrefix = Math.min(beforeLines.length, afterLines.length);
  while (prefix < maxPrefix && beforeLines[prefix] === afterLines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  const maxSuffix = Math.min(beforeLines.length - prefix, afterLines.length - prefix);
  while (
    suffix < maxSuffix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    added: afterLines.length - prefix - suffix,
    removed: beforeLines.length - prefix - suffix,
  };
}

export function diffLines(before: string, after: string, context = 3): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  let prefix = 0;
  const maxPrefix = Math.min(beforeLines.length, afterLines.length);
  while (prefix < maxPrefix && beforeLines[prefix] === afterLines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  const maxSuffix = Math.min(beforeLines.length - prefix, afterLines.length - prefix);
  while (
    suffix < maxSuffix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const beforeEnd = beforeLines.length - suffix;
  const afterEnd = afterLines.length - suffix;

  const lines: DiffLine[] = [];
  for (let i = Math.max(0, prefix - context); i < prefix; i += 1) {
    lines.push({ type: 'context', text: beforeLines[i] });
  }
  for (let i = prefix; i < beforeEnd; i += 1) {
    lines.push({ type: 'remove', text: beforeLines[i] });
  }
  for (let i = prefix; i < afterEnd; i += 1) {
    lines.push({ type: 'add', text: afterLines[i] });
  }
  for (let i = afterEnd; i < Math.min(afterLines.length, afterEnd + context); i += 1) {
    lines.push({ type: 'context', text: afterLines[i] });
  }

  return lines;
}
