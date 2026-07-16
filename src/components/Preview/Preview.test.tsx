import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { openUrl } from '@tauri-apps/plugin-opener';

import { I18nProvider } from '@/locales';

import Preview from './Preview';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

const renderPreview = (content: string) =>
  render(
    <I18nProvider>
      <Preview content={content} />
    </I18nProvider>,
  );

const getRenderedOrderedListNumbers = (container: HTMLElement): number[] =>
  Array.from(container.querySelectorAll('ol')).flatMap((list) => {
    let nextValue = list.start;

    return Array.from(list.children).flatMap((child) => {
      if (!(child instanceof HTMLLIElement)) return [];

      const value = child.hasAttribute('value') ? child.value : nextValue;
      nextValue = value + 1;
      return value;
    });
  });

describe('Preview', () => {
  it('removes executable HTML from untrusted Markdown', () => {
    const { container, getByRole, getByText } = renderPreview(`
<script>window.previewWasCompromised = true</script>
<iframe src="https://example.com/embedded-content"></iframe>
<img src="https://example.com/image.png" onerror="alert('image')" alt="unsafe image">
<a href="javascript:alert('link')">unsafe link</a>
`);

    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    const image = getByRole('img', { name: 'unsafe image' });
    expect(image).not.toHaveAttribute('onerror');
    expect(image).not.toHaveAttribute('node');
    expect(getByText('unsafe link')).not.toHaveAttribute('href');
  });

  it('keeps math, syntax highlighting, and supported icon markup', () => {
    const { container } = renderPreview(`
:fa-github: :editormd-logo-2x:

Inline math: $x^2$

\`\`\`javascript
const answer = true;
\`\`\`
`);

    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(container.querySelector('code.hljs.language-javascript')).toBeInTheDocument();
    expect(container.querySelector('.hljs-keyword')).toHaveTextContent('const');
    expect(container.querySelector('i.fa.fa-github')).toBeInTheDocument();
    expect(container.querySelector('i.editormd-logo-2x')).toBeInTheDocument();
  });

  it('copies fenced code from its code block control', async () => {
    const user = userEvent.setup();
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });

    try {
      const { getByRole } = renderPreview('```typescript\nconst answer = true;\n```');
      const copyButton = getByRole('button', { name: 'Copy code' });

      expect(copyButton.querySelector('.code-copy-icon-copy')).toBeInTheDocument();
      expect(copyButton.querySelector('.code-copy-icon-check')).toBeInTheDocument();

      await user.click(copyButton);

      expect(clipboard.writeText).toHaveBeenCalledWith('const answer = true;\n');
      const copiedButton = getByRole('button', { name: 'Copied' });
      expect(copiedButton).toBe(copyButton);
      expect(copiedButton).toHaveClass('is-copied');
      expect(copiedButton.querySelector('.code-copy-icon-copy')).toBeInTheDocument();
      expect(copiedButton.querySelector('.code-copy-icon-check')).toBeInTheDocument();
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('preserves source line anchors for rendered Markdown blocks', () => {
    const { container } = renderPreview(
      '# Heading\n\nParagraph\n\n```typescript\nconst answer = true;\n```',
    );

    expect(container.querySelector('h1')).toHaveAttribute('data-source-line', '1');
    expect(container.querySelector('p')).toHaveAttribute('data-source-line', '3');
    expect(container.querySelector('pre')).toHaveAttribute('data-source-line', '5');
  });

  it('enables offscreen rendering containment for long documents', () => {
    const content = Array.from({ length: 500 }, (_, index) => `# Heading ${index + 1}`).join('\n');
    const { container } = renderPreview(content);

    expect(container.querySelector('[data-preview-content]')).toHaveClass('is-long-document');
  });

  it('keeps rendering after an unclosed fenced code marker', () => {
    const { getByRole, getByText } = renderPreview(
      ['## Before', '', '~~~~', '', '## After', '', 'Still visible'].join('\n'),
    );

    expect(getByText('~~~~')).toBeInTheDocument();
    expect(getByRole('heading', { name: 'After' })).toBeInTheDocument();
    expect(getByText('Still visible')).toBeInTheDocument();
  });

  it('navigates table-of-contents links to generated heading anchors', async () => {
    const user = userEvent.setup();
    const { container, getByRole } = renderPreview(
      [
        '## 目录',
        '',
        '- [标题测试](#标题测试)',
        '- [HTML 混排](#html-混排)',
        '',
        '# 标题测试',
        '',
        '## HTML 混排',
        '',
        '## 重复标题',
        '',
        '## 重复标题',
      ].join('\n'),
    );
    const target = getByRole('heading', { name: '标题测试' });
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    expect(target).toHaveAttribute('id', 'preview-heading-标题测试');
    expect(getByRole('heading', { name: 'HTML 混排' })).toHaveAttribute(
      'id',
      'preview-heading-html-混排',
    );
    expect(
      Array.from(container.querySelectorAll('h2')).filter((heading) =>
        heading.textContent?.includes('重复标题'),
      ),
    ).toEqual([
      expect.objectContaining({ id: 'preview-heading-重复标题' }),
      expect.objectContaining({ id: 'preview-heading-重复标题-1' }),
    ]);

    await user.click(getByRole('link', { name: '标题测试' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('opens external links outside the WebView', async () => {
    const { getByRole } = renderPreview('[Tauri](https://tauri.app/)');
    const link = getByRole('link', { name: 'Tauri' });

    expect(fireEvent.click(link)).toBe(false);
    expect(openUrl).toHaveBeenCalledWith('https://tauri.app/');
  });

  it('renders the explicit numbers from blank ordered list items', () => {
    const content = [
      '1.',
      '2.',
      '3.',
      '4.',
      '5.',
      '',
      '1.',
      '2.',
      '3.',
      '4.',
      '5.',
      '',
      '1.',
      '2.',
      '3.',
      '4.',
      '5.',
      '6.',
      '',
      '1.',
      '2.',
    ].join('\n');
    const { container } = renderPreview(content);

    expect(getRenderedOrderedListNumbers(container)).toEqual([
      1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6, 1, 2,
    ]);
  });

  it('preserves consecutive blank lines between ordered list items', () => {
    const { container } = renderPreview(['1.', '', '1.', '', '', '1.'].join('\n'));
    const items = container.querySelectorAll('ol > li');

    expect(items).toHaveLength(3);
    expect(items[0]).not.toHaveStyle({ paddingBlockStart: '1lh' });
    expect(items[1]).toHaveStyle({ paddingBlockStart: '1lh' });
    expect(items[2]).toHaveStyle({ paddingBlockStart: '2lh' });
  });

  it('preserves explicit numbers in nested and quoted ordered lists', () => {
    const { container } = renderPreview(
      [
        '4. Outer',
        '',
        '   9. Nested',
        '   11. Nested',
        '',
        '6. Outer',
        '',
        '> 7. Quoted',
        '> 9. Quoted',
      ].join('\n'),
    );

    expect(getRenderedOrderedListNumbers(container)).toEqual([4, 6, 9, 11, 7, 9]);
  });

  it('updates a task item through its source line when its preview checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onTaskToggle = vi.fn();
    const { getByRole } = render(
      <I18nProvider>
        <Preview content={'- [x] Finished\n- [ ] Pending'} onTaskToggle={onTaskToggle} />
      </I18nProvider>,
    );

    const completedTask = getByRole('checkbox', { name: 'Mark task incomplete' });
    const pendingTask = getByRole('checkbox', { name: 'Mark task complete' });

    expect(completedTask).toBeChecked();
    expect(completedTask).not.toBeDisabled();
    expect(pendingTask).not.toBeDisabled();

    await user.click(pendingTask);

    expect(onTaskToggle).toHaveBeenCalledWith(2, true);
  });

  it('offers both preview-only and editor-only focus modes', async () => {
    const user = userEvent.setup();
    const enterPreviewMode = vi.fn();
    const enterEditorMode = vi.fn();
    const { getByRole } = render(
      <I18nProvider>
        <Preview
          content=""
          onEnterPreviewMode={enterPreviewMode}
          onEnterEditorMode={enterEditorMode}
        />
      </I18nProvider>,
    );

    await user.click(getByRole('button', { name: 'Enter preview mode' }));
    await user.click(getByRole('button', { name: 'Enter edit mode' }));

    expect(enterPreviewMode).toHaveBeenCalledOnce();
    expect(enterEditorMode).toHaveBeenCalledOnce();
  });
});
