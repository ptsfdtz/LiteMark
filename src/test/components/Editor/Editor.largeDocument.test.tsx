import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import Editor from '@/components/Editor/Editor';
import { LARGE_MARKDOWN_BYTES } from '@/modules/markdownEditing/largeDocument';

vi.mock('@/components/Editor/CodeEditor', () => ({
  default: () => <div data-testid="source-editor" />,
}));

describe('Editor large-document mode', () => {
  it('routes a 1 MiB Markdown document to the source editor', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const content = `# Large document\n${'x'.repeat(LARGE_MARKDOWN_BYTES)}`;

    render(
      <I18nProvider>
        <Editor value={content} onChange={vi.fn()} filePath="large.md" />
      </I18nProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('high-performance source editor');
    expect(await screen.findByTestId('source-editor')).toBeInTheDocument();
    expect(screen.queryByLabelText('Markdown WYSIWYG editor')).not.toBeInTheDocument();
  });

  it('routes a 100,000-line Markdown document to the source editor', async () => {
    const content = 'line\n'.repeat(100_000);
    expect(content.length).toBeLessThan(LARGE_MARKDOWN_BYTES);

    render(
      <I18nProvider>
        <Editor value={content} onChange={vi.fn()} filePath="many-lines.md" />
      </I18nProvider>,
    );

    expect(await screen.findByTestId('source-editor')).toBeInTheDocument();
    expect(screen.queryByLabelText('Markdown WYSIWYG editor')).not.toBeInTheDocument();
  });
});
