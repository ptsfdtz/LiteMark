import type { MarkdownEditor } from '@/types/editor';

export interface ScrollSyncFrameScheduler {
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(frameId: number): void;
}

interface ScrollSyncOptions {
  frameScheduler?: ScrollSyncFrameScheduler;
  viewportAnchorRatio?: number;
}

interface SourceAnchor {
  line: number;
  offset: number;
}

type ScrollSource = 'editor' | 'preview';

const SCROLL_EPSILON = 1.5;

const defaultFrameScheduler: ScrollSyncFrameScheduler = {
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const interpolateOffsetForLine = (anchors: SourceAnchor[], line: number) => {
  if (line <= anchors[0].line) return anchors[0].offset;
  const lastAnchor = anchors[anchors.length - 1];
  if (line >= lastAnchor.line) return lastAnchor.offset;

  let lowerIndex = 0;
  let upperIndex = anchors.length - 1;
  while (lowerIndex + 1 < upperIndex) {
    const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
    if (anchors[middleIndex].line <= line) lowerIndex = middleIndex;
    else upperIndex = middleIndex;
  }

  const lower = anchors[lowerIndex];
  const upper = anchors[upperIndex];
  const progress = (line - lower.line) / (upper.line - lower.line);
  return lower.offset + progress * (upper.offset - lower.offset);
};

const interpolateLineForOffset = (anchors: SourceAnchor[], offset: number) => {
  if (offset <= anchors[0].offset) return anchors[0].line;
  const lastAnchor = anchors[anchors.length - 1];
  if (offset >= lastAnchor.offset) return lastAnchor.line;

  let lowerIndex = 0;
  let upperIndex = anchors.length - 1;
  while (lowerIndex + 1 < upperIndex) {
    const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
    if (anchors[middleIndex].offset <= offset) lowerIndex = middleIndex;
    else upperIndex = middleIndex;
  }

  const lower = anchors[lowerIndex];
  const upper = anchors[upperIndex];
  const distance = upper.offset - lower.offset;
  if (distance <= 0) return upper.line;
  const progress = (offset - lower.offset) / distance;
  return lower.line + progress * (upper.line - lower.line);
};

const editorOffsetToSourceLine = (editor: MarkdownEditor, offset: number, lineCount: number) => {
  const scrollHeight = editor.getScrollHeight();
  const boundedOffset = clamp(offset, 0, scrollHeight);
  if (boundedOffset <= 0) return 1;
  if (boundedOffset >= scrollHeight) return lineCount + 1;

  let lowerLine = 1;
  let upperLine = lineCount;
  while (lowerLine < upperLine) {
    const middleLine = Math.ceil((lowerLine + upperLine) / 2);
    if (editor.getTopForLineNumber(middleLine) <= boundedOffset) lowerLine = middleLine;
    else upperLine = middleLine - 1;
  }

  const nextLine = lowerLine + 1;
  const lowerOffset = editor.getTopForLineNumber(lowerLine);
  const upperOffset = nextLine <= lineCount ? editor.getTopForLineNumber(nextLine) : scrollHeight;
  const distance = upperOffset - lowerOffset;
  if (distance <= 0) return lowerLine;
  return lowerLine + (boundedOffset - lowerOffset) / distance;
};

const sourceLineToEditorOffset = (
  editor: MarkdownEditor,
  sourceLine: number,
  lineCount: number,
) => {
  const boundedLine = clamp(sourceLine, 1, lineCount + 1);
  if (boundedLine >= lineCount + 1) return editor.getScrollHeight();

  const lowerLine = Math.floor(boundedLine);
  const upperLine = lowerLine + 1;
  const lowerOffset = editor.getTopForLineNumber(lowerLine);
  const upperOffset =
    upperLine <= lineCount ? editor.getTopForLineNumber(upperLine) : editor.getScrollHeight();
  return lowerOffset + (boundedLine - lowerLine) * (upperOffset - lowerOffset);
};

const collectPreviewAnchors = (preview: HTMLElement, lineCount: number): SourceAnchor[] => {
  const previewRect = preview.getBoundingClientRect();
  const anchors: SourceAnchor[] = [
    { line: 1, offset: 0 },
    { line: lineCount + 1, offset: preview.scrollHeight },
  ];

  preview.querySelectorAll<HTMLElement>('[data-source-line]').forEach((element) => {
    if (element.closest('[data-footnotes]')) return;

    const line = Number(element.dataset.sourceLine);
    if (!Number.isInteger(line) || line < 1 || line > lineCount) return;

    const offset = element.getBoundingClientRect().top - previewRect.top + preview.scrollTop;
    if (!Number.isFinite(offset)) return;
    anchors.push({ line, offset: clamp(offset, 0, preview.scrollHeight) });
  });

  anchors.sort((left, right) => left.line - right.line || left.offset - right.offset);

  const byLine: SourceAnchor[] = [];
  for (const anchor of anchors) {
    const previous = byLine[byLine.length - 1];
    if (previous?.line === anchor.line) {
      previous.offset = Math.min(previous.offset, anchor.offset);
      continue;
    }
    byLine.push({ ...anchor });
  }

  let previousOffset = 0;
  return byLine.map((anchor) => {
    const normalized = { ...anchor, offset: Math.max(previousOffset, anchor.offset) };
    previousOffset = normalized.offset;
    return normalized;
  });
};

export function connectScrollSync(
  editor: MarkdownEditor,
  preview: HTMLElement,
  options: ScrollSyncOptions = {},
) {
  const frameScheduler = options.frameScheduler ?? defaultFrameScheduler;
  const viewportAnchorRatio = clamp(options.viewportAnchorRatio ?? 0, 0, 1);
  let cachedAnchors: SourceAnchor[] | null = null;
  let cachedLineCount = 0;
  let scheduledFrame: number | null = null;
  let scheduledSource: ScrollSource | null = null;
  let lastSource: ScrollSource = 'editor';
  let expectedEditorScrollTop: number | null = null;
  let expectedPreviewScrollTop: number | null = null;
  let disposed = false;

  const getLineCount = () => Math.max(editor.getModel()?.getLineCount() ?? 1, 1);

  const getPreviewAnchors = (lineCount: number) => {
    if (!cachedAnchors || cachedLineCount !== lineCount) {
      cachedAnchors = collectPreviewAnchors(preview, lineCount);
      cachedLineCount = lineCount;
    }
    return cachedAnchors;
  };

  const syncEditorToPreview = () => {
    const editorHeight = editor.getLayoutInfo().height;
    const editorMaxScrollTop = Math.max(editor.getScrollHeight() - editorHeight, 0);
    const previewMaxScrollTop = Math.max(preview.scrollHeight - preview.clientHeight, 0);
    const editorScrollTop = editor.getScrollTop();
    let targetScrollTop: number;

    if (editorScrollTop <= SCROLL_EPSILON) targetScrollTop = 0;
    else if (editorScrollTop >= editorMaxScrollTop - SCROLL_EPSILON) {
      targetScrollTop = previewMaxScrollTop;
    } else {
      const lineCount = getLineCount();
      const editorAnchorOffset = editorScrollTop + editorHeight * viewportAnchorRatio;
      const sourceLine = editorOffsetToSourceLine(editor, editorAnchorOffset, lineCount);
      const previewAnchorOffset = interpolateOffsetForLine(
        getPreviewAnchors(lineCount),
        sourceLine,
      );
      targetScrollTop = previewAnchorOffset - preview.clientHeight * viewportAnchorRatio;
    }

    targetScrollTop = clamp(targetScrollTop, 0, previewMaxScrollTop);
    if (Math.abs(preview.scrollTop - targetScrollTop) <= SCROLL_EPSILON) {
      expectedPreviewScrollTop = null;
      return;
    }
    expectedPreviewScrollTop = targetScrollTop;
    preview.scrollTop = targetScrollTop;
  };

  const syncPreviewToEditor = () => {
    const editorHeight = editor.getLayoutInfo().height;
    const editorMaxScrollTop = Math.max(editor.getScrollHeight() - editorHeight, 0);
    const previewMaxScrollTop = Math.max(preview.scrollHeight - preview.clientHeight, 0);
    const previewScrollTop = preview.scrollTop;
    let targetScrollTop: number;

    if (previewScrollTop <= SCROLL_EPSILON) targetScrollTop = 0;
    else if (previewScrollTop >= previewMaxScrollTop - SCROLL_EPSILON) {
      targetScrollTop = editorMaxScrollTop;
    } else {
      const lineCount = getLineCount();
      const previewAnchorOffset = previewScrollTop + preview.clientHeight * viewportAnchorRatio;
      const sourceLine = interpolateLineForOffset(
        getPreviewAnchors(lineCount),
        previewAnchorOffset,
      );
      const editorAnchorOffset = sourceLineToEditorOffset(editor, sourceLine, lineCount);
      targetScrollTop = editorAnchorOffset - editorHeight * viewportAnchorRatio;
    }

    targetScrollTop = clamp(targetScrollTop, 0, editorMaxScrollTop);
    if (Math.abs(editor.getScrollTop() - targetScrollTop) <= SCROLL_EPSILON) {
      expectedEditorScrollTop = null;
      return;
    }
    expectedEditorScrollTop = targetScrollTop;
    editor.setScrollTop(targetScrollTop);
  };

  const scheduleSync = (source: ScrollSource, updateLastSource = true) => {
    if (disposed) return;
    if (updateLastSource) lastSource = source;
    scheduledSource = source;
    if (scheduledFrame !== null) return;

    scheduledFrame = frameScheduler.requestFrame(() => {
      scheduledFrame = null;
      const sourceToSync = scheduledSource;
      scheduledSource = null;
      if (sourceToSync === 'editor') syncEditorToPreview();
      else if (sourceToSync === 'preview') syncPreviewToEditor();
    });
  };

  const invalidatePreviewAnchors = () => {
    cachedAnchors = null;
    scheduleSync(lastSource, false);
  };

  const editorScrollDisposable = editor.onDidScrollChange((event) => {
    if (!event.scrollTopChanged) return;
    const actualScrollTop = editor.getScrollTop();
    if (
      expectedEditorScrollTop !== null &&
      Math.abs(actualScrollTop - expectedEditorScrollTop) <= SCROLL_EPSILON
    ) {
      expectedEditorScrollTop = null;
      return;
    }
    expectedEditorScrollTop = null;
    scheduleSync('editor');
  });
  const modelDisposable = editor.onDidChangeModelContent(invalidatePreviewAnchors);
  const contentSizeDisposable = editor.onDidContentSizeChange(() =>
    scheduleSync(lastSource, false),
  );
  const layoutDisposable = editor.onDidLayoutChange(() => scheduleSync(lastSource, false));

  const handlePreviewScroll = () => {
    const actualScrollTop = preview.scrollTop;
    if (
      expectedPreviewScrollTop !== null &&
      Math.abs(actualScrollTop - expectedPreviewScrollTop) <= SCROLL_EPSILON
    ) {
      expectedPreviewScrollTop = null;
      return;
    }
    expectedPreviewScrollTop = null;
    scheduleSync('preview');
  };
  preview.addEventListener('scroll', handlePreviewScroll, { passive: true });

  const claimEditorInput = () => {
    expectedEditorScrollTop = null;
    lastSource = 'editor';
  };
  const claimPreviewInput = () => {
    expectedPreviewScrollTop = null;
    lastSource = 'preview';
  };
  const editorElement = editor.getDomNode();
  const inputEvents = ['wheel', 'pointerdown', 'touchstart'] as const;
  inputEvents.forEach((eventName) => {
    editorElement?.addEventListener(eventName, claimEditorInput, { passive: true });
    preview.addEventListener(eventName, claimPreviewInput, { passive: true });
  });

  const mutationObserver = new MutationObserver(invalidatePreviewAnchors);
  mutationObserver.observe(preview, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-source-line', 'src'],
  });

  const handlePreviewLoad = () => invalidatePreviewAnchors();
  preview.addEventListener('load', handlePreviewLoad, true);

  const previewContent = preview.querySelector<HTMLElement>('[data-preview-content]') ?? preview;
  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => invalidatePreviewAnchors());
  resizeObserver?.observe(previewContent);

  scheduleSync('editor');

  return () => {
    disposed = true;
    if (scheduledFrame !== null) frameScheduler.cancelFrame(scheduledFrame);
    editorScrollDisposable.dispose();
    modelDisposable.dispose();
    contentSizeDisposable.dispose();
    layoutDisposable.dispose();
    preview.removeEventListener('scroll', handlePreviewScroll);
    inputEvents.forEach((eventName) => {
      editorElement?.removeEventListener(eventName, claimEditorInput);
      preview.removeEventListener(eventName, claimPreviewInput);
    });
    preview.removeEventListener('load', handlePreviewLoad, true);
    mutationObserver.disconnect();
    resizeObserver?.disconnect();
  };
}
