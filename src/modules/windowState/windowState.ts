import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { currentMonitor, type Window as TauriWindow } from '@tauri-apps/api/window';

const STORAGE_KEY = 'litemark.windowState';
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
  'isMaximized' | 'maximize' | 'outerPosition' | 'outerSize' | 'setPosition' | 'setSize'
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

export async function restoreWindowState(appWindow: StatefulWindow): Promise<void> {
  const state = loadStoredState();
  if (!state) return;

  await appWindow.setSize(new PhysicalSize(state.width, state.height));
  await appWindow.setPosition(new PhysicalPosition(state.x, state.y));
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

export async function expandWindowForDocumentWidth(
  appWindow: ExpandableWindow,
  currentDocumentWidth: number,
  minimumDocumentWidth: number,
): Promise<void> {
  if (currentDocumentWidth >= minimumDocumentWidth || (await appWindow.isMaximized())) return;

  const [size, scaleFactor, monitor] = await Promise.all([
    appWindow.outerSize(),
    appWindow.scaleFactor(),
    currentMonitor(),
  ]);
  const requiredExtraWidth = Math.ceil((minimumDocumentWidth - currentDocumentWidth) * scaleFactor);
  const monitorWidth = monitor?.workArea.size.width ?? Number.POSITIVE_INFINITY;
  const nextWidth = Math.min(size.width + requiredExtraWidth, monitorWidth);
  if (nextWidth <= size.width) return;

  await appWindow.setSize(new PhysicalSize(nextWidth, size.height));
}
