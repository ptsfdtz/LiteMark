import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  isTauri: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mocks.relaunch }));

import { checkForAppUpdate, restartAfterUpdate } from '@/modules/appUpdater';

describe('app updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips update checks outside Tauri', async () => {
    mocks.isTauri.mockReturnValue(false);

    await expect(checkForAppUpdate()).resolves.toBeNull();
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it('exposes a signed Tauri update and its install operations', async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    mocks.isTauri.mockReturnValue(true);
    mocks.check.mockResolvedValue({
      version: '2.2.0',
      body: 'Release notes',
      downloadAndInstall,
      close,
    });

    const update = await checkForAppUpdate();
    const onEvent = vi.fn();

    expect(mocks.check).toHaveBeenCalledWith({ timeout: 15_000 });
    expect(update).toMatchObject({ version: '2.2.0', notes: 'Release notes' });
    await update?.downloadAndInstall(onEvent);
    await update?.close();
    expect(downloadAndInstall).toHaveBeenCalledWith(onEvent);
    expect(close).toHaveBeenCalledOnce();
  });

  it('relaunches after an update is installed', async () => {
    mocks.relaunch.mockResolvedValue(undefined);

    await restartAfterUpdate();

    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });
});
