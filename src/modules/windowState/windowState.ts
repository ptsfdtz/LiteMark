import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import {
  availableMonitors,
  currentMonitor,
  type Window as TauriWindow,
} from '@tauri-apps/api/window';

// Keep this suffix aligned with tauri.conf.json so a changed default is not
// immediately overwritten by geometry saved for an older default.
const STORAGE_KEY = 'litemark.windowState.900x1200';
const MIN_WIDTH = 600;
const MIN_HEIGHT = 600;

interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

type StatefulWindow = Pick<
  TauriWindow,
  'center' | 'isMaximized' | 'maximize' | 'outerPosition' | 'outerSize' | 'setPosition' | 'setSize'
>;

type ExpandableWindow = Pick<TauriWindow, 'isMaximized' | 'outerSize' | 'scaleFactor' | 'setSize'>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function loadStoredState(): WindowState | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as unknown;
    if (!stored || typeof stored !== 'object') return null;
    const value = stored as Record<string, unknown>;
    if (
      !isFiniteNumber(value.width) ||
      !isFiniteNumber(value.height) ||
      !isFiniteNumber(value.x) ||
      !isFiniteNumber(value.y) ||
      typeof value.maximized !== 'boolean'
    ) {
      return null;
    }
    return {
      width: Math.max(MIN_WIDTH, value.width),
      height: Math.max(MIN_HEIGHT, value.height),
      x: value.x,
      y: value.y,
      maximized: value.maximized,
    };
  } catch {
    return null;
  }
}

function saveStoredState(state: WindowState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Window geometry is a convenience setting and must not block the app.
  }
}

function isVisibleOnCurrentDisplays(
  state: WindowState,
  monitors: Awaited<ReturnType<typeof availableMonitors>>,
): boolean {
  return monitors.some((monitor) => {
    const workArea = monitor.workArea;
    const left = Math.max(state.x, workArea.position.x);
    const top = Math.max(state.y, workArea.position.y);
    const right = Math.min(state.x + state.width, workArea.position.x + workArea.size.width);
    const bottom = Math.min(state.y + state.height, workArea.position.y + workArea.size.height);
    return right - left >= 120 && bottom - top >= 48;
  });
}

export async function restoreWindowState(appWindow: StatefulWindow): Promise<void> {
  const state = loadStoredState();
  if (!state) return;

  await appWindow.setSize(new PhysicalSize(state.width, state.height));
  const monitors = await availableMonitors();
  if (isVisibleOnCurrentDisplays(state, monitors)) {
    await appWindow.setPosition(new PhysicalPosition(state.x, state.y));
  } else {
    await appWindow.center();
  }
  if (state.maximized) await appWindow.maximize();
}

export async function persistWindowState(appWindow: StatefulWindow): Promise<void> {
  const maximized = await appWindow.isMaximized();
  if (maximized) {
    const existing = loadStoredState();
    if (existing) saveStoredState({ ...existing, maximized: true });
    return;
  }

  const [size, position] = await Promise.all([appWindow.outerSize(), appWindow.outerPosition()]);
  saveStoredState({
    width: Math.max(MIN_WIDTH, size.width),
    height: Math.max(MIN_HEIGHT, size.height),
    x: position.x,
    y: position.y,
    maximized: false,
  });
}

export async function expandWindowForPanel(
  appWindow: ExpandableWindow,
  panelWidth: number,
): Promise<void> {
  if (panelWidth <= 0 || (await appWindow.isMaximized())) return;

  const [size, scaleFactor, monitor] = await Promise.all([
    appWindow.outerSize(),
    appWindow.scaleFactor(),
    currentMonitor(),
  ]);
  const extraWidth = Math.ceil(panelWidth * scaleFactor);
  const maximumWidth = monitor?.workArea.size.width ?? Number.POSITIVE_INFINITY;
  const nextWidth = Math.min(size.width + extraWidth, maximumWidth);
  if (nextWidth > size.width) {
    await appWindow.setSize(new PhysicalSize(nextWidth, size.height));
  }
}
