import type { Window as TauriWindow } from '@tauri-apps/api/window';

export type CloseRequestWindow = Pick<TauriWindow, 'destroy' | 'onCloseRequested'>;

export function registerWindowCloseGuard(
  window: CloseRequestWindow,
  canClose: () => Promise<boolean>,
  onError: (error: unknown) => void = console.error,
): () => void {
  let disposed = false;
  let disposeListener: (() => void) | undefined;

  void window
    .onCloseRequested(async (event) => {
      if (disposed) return;
      event.preventDefault();
      try {
        const closeAllowed = await canClose();
        if (!disposed && closeAllowed) await window.destroy();
      } catch (error) {
        onError(error);
      }
    })
    .then((dispose) => {
      if (disposed) dispose();
      else disposeListener = dispose;
    })
    .catch(onError);

  return () => {
    disposed = true;
    disposeListener?.();
  };
}
