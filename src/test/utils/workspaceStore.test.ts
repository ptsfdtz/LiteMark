import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: { load: mocks.load },
}));

import { loadExplorerVisible, saveExplorerVisible } from '@/utils/workspaceStore';

describe('workspace explorer visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue({ get: mocks.get, set: mocks.set, save: mocks.save });
    mocks.set.mockResolvedValue(undefined);
    mocks.save.mockResolvedValue(undefined);
  });

  it('defaults to closed when no state has been saved', async () => {
    mocks.get.mockResolvedValue(undefined);

    await expect(loadExplorerVisible()).resolves.toBe(false);
  });

  it('restores an explicitly opened explorer', async () => {
    mocks.get.mockResolvedValue(true);

    await expect(loadExplorerVisible()).resolves.toBe(true);
    expect(mocks.get).toHaveBeenCalledWith('explorerVisible');
  });

  it('persists the latest explorer visibility', async () => {
    await saveExplorerVisible(true);

    expect(mocks.set).toHaveBeenCalledWith('explorerVisible', true);
    expect(mocks.save).toHaveBeenCalledOnce();
  });
});
