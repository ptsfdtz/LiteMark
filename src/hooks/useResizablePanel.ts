import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEventHandler, PointerEventHandler } from 'react';

interface ResizablePanelOptions {
  storageKey: string;
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  maxViewportRatio: number;
  edge: 'left' | 'right';
}

interface ResizablePanelResult {
  width: number;
  resizing: boolean;
  onResizeStart: PointerEventHandler<HTMLDivElement>;
  onResizeKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

function getStoredWidth(storageKey: string, fallback: number): number {
  try {
    const value = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export function useResizablePanel({
  storageKey,
  initialWidth,
  minWidth,
  maxWidth,
  maxViewportRatio,
  edge,
}: ResizablePanelOptions): ResizablePanelResult {
  const getMaximum = useCallback(
    () => Math.max(minWidth, Math.min(maxWidth, window.innerWidth * maxViewportRatio)),
    [maxViewportRatio, maxWidth, minWidth],
  );
  const clamp = useCallback(
    (value: number) => Math.round(Math.min(getMaximum(), Math.max(minWidth, value))),
    [getMaximum, minWidth],
  );
  const [width, setWidth] = useState(() => clamp(getStoredWidth(storageKey, initialWidth)));
  const [resizing, setResizing] = useState(false);
  const cleanupResizeRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      cleanupResizeRef.current?.();
    },
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(width));
    } catch {
      // Width persistence is optional in restricted browser environments.
    }
  }, [storageKey, width]);

  useEffect(() => {
    const handleWindowResize = () => setWidth((current) => clamp(current));
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [clamp]);

  const onResizeStart: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      cleanupResizeRef.current?.();
      const startX = event.clientX;
      const startWidth = width;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      setResizing(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = edge === 'right' ? moveEvent.clientX - startX : startX - moveEvent.clientX;
        setWidth(clamp(startWidth + delta));
      };
      let finished = false;
      const cleanup = (updateState: boolean) => {
        if (finished) return;
        finished = true;
        if (updateState) setResizing(false);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerEnd);
        window.removeEventListener('pointercancel', handlePointerEnd);
        window.removeEventListener('blur', handlePointerEnd);
        cleanupResizeRef.current = null;
      };
      const handlePointerEnd = () => cleanup(true);
      cleanupResizeRef.current = () => cleanup(false);

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerEnd);
      window.addEventListener('pointercancel', handlePointerEnd);
      window.addEventListener('blur', handlePointerEnd);
    },
    [clamp, edge, width],
  );

  const onResizeKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const panelDirection = edge === 'right' ? direction : -direction;
      setWidth((current) => clamp(current + panelDirection * 12));
    },
    [clamp, edge],
  );

  return { width, resizing, onResizeStart, onResizeKeyDown };
}
