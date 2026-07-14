import { beforeEach, describe, expect, it, vi } from 'vitest';
import tauriConfig from '../../../src-tauri/tauri.conf.json';

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  monaco: { editor: { create: vi.fn() } },
}));

vi.mock('@monaco-editor/react', () => ({ loader: { config: mocks.config } }));
vi.mock('monaco-editor/esm/vs/editor/editor.api.js', () => mocks.monaco);
vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({
  default: class LocalEditorWorker {},
}));
vi.mock('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js', () => ({}));

import { configureMonaco } from './configureMonaco';

describe('local Monaco runtime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the bundled editor and worker under a local-only script policy', () => {
    configureMonaco();

    expect(mocks.config).toHaveBeenCalledWith({ monaco: mocks.monaco });
    expect(self.MonacoEnvironment?.getWorker?.('', 'markdown')).toBeDefined();

    for (const policy of [tauriConfig.app.security.csp, tauriConfig.app.security.devCsp]) {
      expect(policy['script-src']).toBe("'self'");
      expect(policy['worker-src']).toBe("'self'");
      expect(policy['img-src'].split(' ')).not.toContain('http:');
      expect(policy['img-src'].split(' ')).not.toContain('https:');
    }
  });
});
