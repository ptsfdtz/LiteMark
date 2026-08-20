import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import EditorImpl from '@/components/Editor/EditorImpl';
import type { WysiwygEditor } from '@/types/editor';

describe('EditorImpl', () => {
  it('highlights fenced code blocks in the Markdown editor', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const { container } = render(
      <I18nProvider>
        <EditorImpl value={'```python\nprint(a)\n```'} onChange={vi.fn()} />
      </I18nProvider>,
    );

    await screen.findByLabelText('Markdown WYSIWYG editor');
    expect(container.querySelector('pre code .hljs-built_in')).toHaveTextContent('print');
  });

  it('renders inline and block LaTeX math with KaTeX and keeps the Markdown source', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const editorRef = createRef<WysiwygEditor>();
    const { container } = render(
      <I18nProvider>
        <EditorImpl
          ref={editorRef}
          value={'Inline $x^2 + y^2 = z^2$ math\n\n$$\\int_0^1 x\\,dx = \\frac{1}{2}$$\n'}
          onChange={vi.fn()}
        />
      </I18nProvider>,
    );

    await screen.findByLabelText('Markdown WYSIWYG editor');
    await waitFor(() =>
      expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2),
    );
    expect(container.querySelector('span[data-type="inline-math"]')).toBeInTheDocument();
    expect(container.querySelector('div[data-type="block-math"]')).toBeInTheDocument();

    const markdown = editorRef.current?.getMarkdown() ?? '';
    expect(markdown).toContain('$x^2 + y^2 = z^2$');
    expect(markdown).toContain('$$');
    expect(markdown).toContain('\\int_0^1 x\\,dx = \\frac{1}{2}');
  });

  it('shows the raw LaTeX source instead of crashing on invalid math', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const { container } = render(
      <I18nProvider>
        <EditorImpl value={'Broken $\\notacommand{$ math\n'} onChange={vi.fn()} />
      </I18nProvider>,
    );

    await screen.findByLabelText('Markdown WYSIWYG editor');
    await waitFor(() =>
      expect(container.querySelector('span[data-type="inline-math"]')).toBeInTheDocument(),
    );
  });

  it('exits a level-one heading when Enter creates the next block', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const onChange = vi.fn();
    const editorRef = createRef<WysiwygEditor>();
    const { container } = render(
      <I18nProvider>
        <EditorImpl ref={editorRef} value={'# Hello'} onChange={onChange} />
      </I18nProvider>,
    );

    const editor = await screen.findByLabelText('Markdown WYSIWYG editor');
    act(() => editorRef.current?.commands.focus('end'));
    fireEvent.keyDown(editor, { key: 'Enter' });
    act(() => editorRef.current?.commands.insertContent('Next paragraph'));

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')?.textContent).toBe('Hello');
    expect(container.querySelector('h1 + p')?.textContent).toBe('Next paragraph');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringMatching(/^# Hello\n\nNext paragraph\n+$/),
    );
  });

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
