import { act, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/locales';

import WindowControls from './WindowControls';

const windowMocks = vi.hoisted(() => ({
  getCurrentWindow: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: windowMocks.getCurrentWindow,
}));

describe('WindowControls', () => {
  let maximized = false;
  let resizeHandler: (() => void) | undefined;
  let unlisten: ReturnType<typeof vi.fn>;
  let toggleMaximize: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.setItem('litemark.locale', 'en');
    maximized = false;
    resizeHandler = undefined;
    unlisten = vi.fn();
    toggleMaximize = vi.fn(async () => {
      maximized = !maximized;
    });

    windowMocks.getCurrentWindow.mockReturnValue({
      minimize: vi.fn(),
      toggleMaximize,
      close: vi.fn(),
      isMaximized: vi.fn(async () => maximized),
      onResized: vi.fn(async (handler: () => void) => {
        resizeHandler = handler;
        return unlisten;
      }),
    });
  });

  it('uses a restore control while maximized and syncs external window changes', async () => {
    maximized = true;
    const user = userEvent.setup();
    const { findByRole, getByRole, unmount } = render(
      <I18nProvider>
        <WindowControls />
      </I18nProvider>,
    );

    const restoreButton = await findByRole('button', { name: 'Restore window' });
    const restoreIconPath = restoreButton.querySelector('path')?.getAttribute('d');
    await user.click(restoreButton);

    await waitFor(() => {
      expect(getByRole('button', { name: 'Maximize' })).toBeInTheDocument();
    });
    expect(
      getByRole('button', { name: 'Maximize' }).querySelector('path')?.getAttribute('d'),
    ).not.toBe(restoreIconPath);
    expect(toggleMaximize).toHaveBeenCalledOnce();

    await waitFor(() => expect(resizeHandler).toBeDefined());
    maximized = true;
    await act(async () => {
      resizeHandler?.();
    });

    await findByRole('button', { name: 'Restore window' });
    unmount();
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
