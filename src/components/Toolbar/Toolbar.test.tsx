import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import type { WysiwygEditor } from '@/types/editor';
import Toolbar from './Toolbar';

function createEditor() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.focus = vi.fn(() => chain);
  chain.extendMarkRange = vi.fn(() => chain);
  chain.setLink = vi.fn(() => chain);
  chain.unsetLink = vi.fn(() => chain);
  chain.setParagraph = vi.fn(() => chain);
  chain.setHeading = vi.fn(() => chain);
  chain.run = vi.fn(() => true);

  const editor = {
    on: vi.fn(),
    off: vi.fn(),
    chain: vi.fn(() => chain),
    can: vi.fn(() => ({ undo: () => false, redo: () => false })),
    isFocused: true,
    isActive: vi.fn(() => false),
    getAttributes: vi.fn(() => ({})),
  } as unknown as WysiwygEditor;
  return { editor, chain };
}

describe('Toolbar links', () => {
  it('opens an in-app link editor instead of a browser prompt', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(
      <I18nProvider>
        <Toolbar editor={createEditor().editor} />
      </I18nProvider>,
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(prompt).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Edit link' })).toBeInTheDocument();
  });

  it('uses an in-app heading menu and applies the selected heading level', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const { editor, chain } = createEditor();

    render(
      <I18nProvider>
        <Toolbar editor={editor} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Heading (Ctrl+Alt+1/2/3)' }));
    expect(screen.getByRole('listbox', { name: 'Heading (Ctrl+Alt+1/2/3)' })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Heading 2' }));
    expect(chain.setHeading).toHaveBeenCalledWith({ level: 2 });
  });
});
