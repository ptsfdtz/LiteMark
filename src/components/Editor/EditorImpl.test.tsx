import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import EditorImpl from './EditorImpl';

describe('EditorImpl', () => {
  it('does not report programmatic document changes as user edits', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const onChange = vi.fn();
    const { rerender } = render(
      <I18nProvider>
        <EditorImpl value={'# First\n\n1. one\n2. two\n'} onChange={onChange} />
      </I18nProvider>,
    );

    await screen.findByLabelText('Markdown WYSIWYG editor');
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <I18nProvider>
        <EditorImpl value={'# Second\n\n- alpha\n- beta\n'} onChange={onChange} />
      </I18nProvider>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Markdown WYSIWYG editor')).toHaveTextContent('Second'),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
