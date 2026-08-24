import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import UpdateDialog from '@/components/UpdateDialog/UpdateDialog';

const mocks = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  restartAfterUpdate: vi.fn(),
}));

vi.mock('@/modules/appUpdater', () => ({
  checkForAppUpdate: mocks.checkForAppUpdate,
  restartAfterUpdate: mocks.restartAfterUpdate,
}));

describe('UpdateDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    window.localStorage.setItem('litemark.locale', 'en');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('protects unsaved work before installing an available update', async () => {
    mocks.checkForAppUpdate.mockResolvedValue({
      version: '2.2.0',
      notes: 'A useful update',
      downloadAndInstall: vi.fn(),
      close: vi.fn(),
    });

    render(
      <StrictMode>
        <I18nProvider>
          <UpdateDialog hasUnsavedChanges />
        </I18nProvider>
      </StrictMode>,
    );
    await act(async () => vi.advanceTimersByTime(1_500));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByText('LiteMark 2.2.0 is ready to install. The app will restart.'),
    ).toBeVisible();
    expect(
      screen.getByText('Save your current changes before installing the update.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Update now' })).toBeDisabled();
  });

  it('downloads, installs, and restarts when the user accepts', async () => {
    const downloadAndInstall = vi.fn(async (onEvent) => {
      onEvent({ event: 'Started', data: { contentLength: 100 } });
      onEvent({ event: 'Progress', data: { chunkLength: 100 } });
      onEvent({ event: 'Finished' });
    });
    mocks.checkForAppUpdate.mockResolvedValue({
      version: '2.2.0',
      downloadAndInstall,
      close: vi.fn(),
    });
    mocks.restartAfterUpdate.mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <I18nProvider>
        <UpdateDialog hasUnsavedChanges={false} />
      </I18nProvider>,
    );
    await act(async () => vi.advanceTimersByTime(1_500));
    await user.click(await screen.findByRole('button', { name: 'Update now' }));

    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.restartAfterUpdate).toHaveBeenCalledOnce());
  });
});
