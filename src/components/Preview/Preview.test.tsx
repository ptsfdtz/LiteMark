import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/locales';

import Preview from './Preview';

const renderPreview = (content: string) =>
  render(
    <I18nProvider>
      <Preview content={content} />
    </I18nProvider>,
  );

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
