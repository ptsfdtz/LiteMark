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
