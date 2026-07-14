import { describe, expect, it, vi } from 'vitest';

import type { MarkdownEditor } from '@/types/editor';

import { connectScrollSync, type ScrollSyncFrameScheduler } from './connectScrollSync';

interface EditorScrollEvent {
  scrollTop: number;
  scrollTopChanged: boolean;
}

const createFrameScheduler = () => {
  let nextFrameId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  const scheduler: ScrollSyncFrameScheduler = {
    requestFrame(callback) {
      const frameId = nextFrameId++;
      callbacks.set(frameId, callback);
      return frameId;
    },
    cancelFrame(frameId) {
      callbacks.delete(frameId);
    },
  };

  return {
    scheduler,
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(0));
    },
  };
};

const defineDimension = (
  element: HTMLElement,
  property: 'clientHeight' | 'scrollHeight',
  value: number,
) => {
  Object.defineProperty(element, property, { configurable: true, value });
};

const addPreviewAnchor = (
  preview: HTMLElement,
  getPreviewScrollTop: () => number,
  line: number,
  contentTop: number,
) => {
  const anchor = document.createElement('div');
  anchor.dataset.sourceLine = String(line);
  anchor.getBoundingClientRect = () =>
    ({
      top: contentTop - getPreviewScrollTop(),
      bottom: contentTop - getPreviewScrollTop(),
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: contentTop - getPreviewScrollTop(),
      toJSON: () => ({}),
    }) as DOMRect;
  preview.append(anchor);
};

describe('connectScrollSync', () => {
  it('interpolates source anchors, coalesces frames, and preserves immediate user handoff', () => {
    const preview = document.createElement('div');
    let previewScrollTop = 0;
    const previewWrites: number[] = [];
    Object.defineProperty(preview, 'scrollTop', {
      configurable: true,
      get: () => previewScrollTop,
      set: (value: number) => {
        previewScrollTop = value;
        previewWrites.push(value);
      },
    });
    defineDimension(preview, 'clientHeight', 400);
    defineDimension(preview, 'scrollHeight', 5000);
    preview.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 400,
        left: 0,
        right: 500,
        width: 500,
        height: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    for (const [line, top] of [
      [1, 0],
      [51, 200],
      [101, 2200],
      [151, 2500],
      [201, 4700],
    ] as const) {
      addPreviewAnchor(preview, () => previewScrollTop, line, top);
    }

    let editorScrollTop = 0;
    const editorEvents: { scroll: ((event: EditorScrollEvent) => void) | null } = {
      scroll: null,
    };
    const setEditorScrollTop = vi.fn((value: number) => {
      editorScrollTop = value;
      editorEvents.scroll?.({ scrollTop: value, scrollTopChanged: true });
    });
    const editor = {
      getModel: () => ({ getLineCount: () => 201 }),
      getScrollTop: () => editorScrollTop,
      getScrollHeight: () => 4020,
      getLayoutInfo: () => ({ height: 400 }),
      getTopForLineNumber: (line: number) => (line - 1) * 20,
      setScrollTop: setEditorScrollTop,
      onDidScrollChange: (listener: (event: EditorScrollEvent) => void) => {
        editorEvents.scroll = listener;
        return { dispose: vi.fn() };
      },
      onDidChangeModelContent: () => ({ dispose: vi.fn() }),
      onDidContentSizeChange: () => ({ dispose: vi.fn() }),
      onDidLayoutChange: () => ({ dispose: vi.fn() }),
      getDomNode: () => null,
    } as unknown as MarkdownEditor;
    const { scheduler, flush } = createFrameScheduler();

    const disconnect = connectScrollSync(editor, preview, {
      frameScheduler: scheduler,
      viewportAnchorRatio: 0,
    });
    flush();
    previewWrites.length = 0;

    for (const line of [76, 126, 176]) {
      editorScrollTop = (line - 1) * 20;
      editorEvents.scroll?.({ scrollTop: editorScrollTop, scrollTopChanged: true });
    }
    flush();

    expect(previewWrites).toEqual([3600]);

    preview.dispatchEvent(new Event('scroll'));
    expect(setEditorScrollTop).not.toHaveBeenCalled();

    preview.scrollTop = 3700;
    preview.dispatchEvent(new Event('scroll'));
    flush();

    expect(setEditorScrollTop).toHaveBeenCalledOnce();
    expect(setEditorScrollTop.mock.calls[0][0]).toBeCloseTo(3545.45, 1);

    disconnect();
  });
});
