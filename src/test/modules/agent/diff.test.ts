import { describe, expect, it } from 'vitest';
import { diffLines, summarizeDiff } from '@/modules/agent/diff';

describe('summarizeDiff', () => {
  it('reports no changes for identical text', () => {
    expect(summarizeDiff('a\nb\nc', 'a\nb\nc')).toEqual({ added: 0, removed: 0 });
  });

  it('counts added and removed lines around a shared prefix and suffix', () => {
    expect(summarizeDiff('a\nb\nc\nd', 'a\nx\ny\nd')).toEqual({ added: 2, removed: 2 });
  });

  it('handles a full rewrite', () => {
    expect(summarizeDiff('one', 'two\nthree')).toEqual({ added: 2, removed: 1 });
  });

  it('handles appending lines', () => {
    expect(summarizeDiff('a\nb', 'a\nb\nc')).toEqual({ added: 1, removed: 0 });
  });
});

describe('diffLines', () => {
  it('marks removed and added lines', () => {
    const lines = diffLines('a\nb\nc\nd', 'a\nx\ny\nd');
    expect(lines).toEqual([
      { type: 'context', text: 'a' },
      { type: 'remove', text: 'b' },
      { type: 'remove', text: 'c' },
      { type: 'add', text: 'x' },
      { type: 'add', text: 'y' },
      { type: 'context', text: 'd' },
    ]);
  });

  it('limits surrounding context lines', () => {
    const before = ['0', '1', '2', '3', '4', '5'].join('\n');
    const after = ['0', '1', '2', 'CHANGED', '4', '5'].join('\n');

    const lines = diffLines(before, after, 1);

    expect(lines).toEqual([
      { type: 'context', text: '2' },
      { type: 'remove', text: '3' },
      { type: 'add', text: 'CHANGED' },
      { type: 'context', text: '4' },
    ]);
  });

  it('returns only additions for appended content', () => {
    const lines = diffLines('a', 'a\nb');
    expect(lines).toEqual([
      { type: 'context', text: 'a' },
      { type: 'add', text: 'b' },
    ]);
  });
});
