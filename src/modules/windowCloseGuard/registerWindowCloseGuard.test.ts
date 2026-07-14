import { describe, expect, it, vi } from 'vitest';
import { registerWindowCloseGuard, type CloseRequestWindow } from './registerWindowCloseGuard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('Window Close Guard', () => {
  it('disposes a listener whose registration finishes after cleanup', async () => {
    const registration = deferred<() => void>();
    const disposeListener = vi.fn();
    const window: CloseRequestWindow = {
      onCloseRequested: vi.fn(() => registration.promise),
      destroy: vi.fn(async () => undefined),
    };

    const cleanup = registerWindowCloseGuard(window, async () => true);
    cleanup();
    registration.resolve(disposeListener);
    await registration.promise;
    await Promise.resolve();

    expect(disposeListener).toHaveBeenCalledTimes(1);
  });

  it('does not destroy the window when cleanup happens during the close decision', async () => {
    const decision = deferred<boolean>();
    let closeHandler!: Parameters<CloseRequestWindow['onCloseRequested']>[0];
    const window: CloseRequestWindow = {
      onCloseRequested: vi.fn(async (handler) => {
        closeHandler = handler;
        return vi.fn();
      }),
      destroy: vi.fn(async () => undefined),
    };
    const cleanup = registerWindowCloseGuard(window, () => decision.promise);
    await Promise.resolve();

    const closing = closeHandler({
      preventDefault: vi.fn(),
    } as unknown as Parameters<typeof closeHandler>[0]);
    cleanup();
    decision.resolve(true);
    await closing;

    expect(window.destroy).not.toHaveBeenCalled();
  });
});
