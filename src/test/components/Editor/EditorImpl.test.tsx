import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import EditorImpl from '@/components/Editor/EditorImpl';
import type { WysiwygEditor } from '@/types/editor';

vi.mock('@tauri-apps/api/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tauri-apps/api/core')>()),
  convertFileSrc: (path: string) => `asset://localhost/${path.replace(/\\/g, '/')}`,
}));

describe('EditorImpl', () => {
  it('renders HTML images inside Markdown table cells', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const onChange = vi.fn();
    const markdown = [
      '| Light | Dark |',
      '| :---: | :---: |',
      '| <img src="assets/preview-light.png" width="480"> | <img src="assets/preview-dark.png" width="480"> |',
    ].join('\n');
    const { container, rerender } = render(
      <I18nProvider>
        <EditorImpl
          value={markdown}
          filePath={'C:\\workspace\\LiteMark\\README.md'}
          onChange={onChange}
        />
      </I18nProvider>,
    );

    await screen.findByLabelText('Markdown WYSIWYG editor');
    const tableImages = container.querySelectorAll('td img:not(.ProseMirror-separator)');
    expect(tableImages).toHaveLength(2);
    expect(tableImages[0]).toHaveAttribute(
      'src',
      expect.stringContaining('C:/workspace/LiteMark/assets/preview-light.png'),
    );
    expect(tableImages[0]).toHaveAttribute('data-original-src', 'assets/preview-light.png');
    expect(tableImages[1]).toHaveAttribute(
      'src',
      expect.stringContaining('C:/workspace/LiteMark/assets/preview-dark.png'),
    );
    expect(tableImages[1]).toHaveAttribute('data-original-src', 'assets/preview-dark.png');
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <I18nProvider>
        <EditorImpl value={markdown} filePath={'D:\\documents\\README.md'} onChange={onChange} />
      </I18nProvider>,
    );

    await waitFor(() =>
      expect(container.querySelector('td img:not(.ProseMirror-separator)')).toHaveAttribute(
        'src',
        expect.stringContaining('D:/documents/assets/preview-light.png'),
      ),
    );
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <I18nProvider>
        <EditorImpl value="" filePath={null} onChange={onChange} />
      </I18nProvider>,
    );

    expect(await screen.findByLabelText('Markdown WYSIWYG editor')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

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
