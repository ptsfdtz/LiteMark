import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';

const mocks = vi.hoisted(() => ({
  availableMonitors: vi.fn(),
  currentMonitor: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tauri-apps/api/window')>()),
  availableMonitors: mocks.availableMonitors,
  currentMonitor: mocks.currentMonitor,
}));

import { expandWindowForPanel, restoreWindowState } from '@/modules/windowState/windowState';

function storedWindow(overrides: Partial<Record<string, number | boolean>> = {}) {
  window.localStorage.setItem(
    'litemark.windowState.900x1200',
    JSON.stringify({ width: 900, height: 700, x: 100, y: 80, maximized: false, ...overrides }),
  );
}

function mockWindow() {
  return {
    center: vi.fn(async () => undefined),
    isMaximized: vi.fn(async () => false),
    maximize: vi.fn(async () => undefined),
    outerPosition: vi.fn(async () => new PhysicalPosition(0, 0)),
    outerSize: vi.fn(async () => new PhysicalSize(900, 700)),
    scaleFactor: vi.fn(async () => 1),
    setPosition: vi.fn(async () => undefined),
    setSize: vi.fn(async () => undefined),
  };
}

describe('window state restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.availableMonitors.mockResolvedValue([
      {
        name: 'Primary',
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1040 } },
        scaleFactor: 1,
      },
    ]);
    mocks.currentMonitor.mockResolvedValue({
      workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1040 } },
    });
  });

  it('restores a saved position that remains visible', async () => {
    storedWindow();
    const appWindow = mockWindow();

    await restoreWindowState(appWindow);

    expect(appWindow.setPosition).toHaveBeenCalledOnce();
    expect(appWindow.center).not.toHaveBeenCalled();
  });

  it('centers a window whose saved position is outside every display', async () => {
    storedWindow({ x: 4000, y: 3000 });
    const appWindow = mockWindow();

    await restoreWindowState(appWindow);

    expect(appWindow.setPosition).not.toHaveBeenCalled();
    expect(appWindow.center).toHaveBeenCalledOnce();
  });

  it('does not restore geometry saved by the previous window-state format', async () => {
    window.localStorage.setItem(
      'litemark.windowState',
      JSON.stringify({ width: 1500, height: 700, x: 0, y: 0, maximized: false }),
    );
    const appWindow = mockWindow();

    await restoreWindowState(appWindow);

    expect(appWindow.setSize).not.toHaveBeenCalled();
    expect(appWindow.setPosition).not.toHaveBeenCalled();
  });

  it('expands a normal window by the requested logical panel width', async () => {
    const appWindow = mockWindow();
    appWindow.outerSize.mockResolvedValue(new PhysicalSize(900, 700));
    appWindow.scaleFactor.mockResolvedValue(1.5);

    await expandWindowForPanel(appWindow, 252);

    expect(appWindow.setSize).toHaveBeenCalledWith(new PhysicalSize(1278, 700));
  });

  it('does not resize a maximized window', async () => {
    const appWindow = mockWindow();
    appWindow.isMaximized.mockResolvedValue(true);
    appWindow.scaleFactor.mockResolvedValue(1.5);

    await expandWindowForPanel(appWindow, 360);

    expect(appWindow.setSize).not.toHaveBeenCalled();
  });
});
