import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import { loadPdfDocument, type PdfDocumentHandle } from '@/modules/pdfPreview';
import PdfPreview from './PdfPreview';

vi.mock('@/modules/pdfPreview', () => ({
  loadPdfDocument: vi.fn(),
}));

const mockedLoadPdfDocument = vi.mocked(loadPdfDocument);

function createDocumentHandle(pageCount = 3): PdfDocumentHandle {
  return {
    pageCount,
    getPageSize: vi.fn().mockResolvedValue({ width: 600, height: 800 }),
    renderPage: vi.fn().mockResolvedValue(undefined),
    cancelRender: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PdfPreview', () => {
  beforeEach(() => {
    window.localStorage.setItem('litemark.locale', 'en');
    mockedLoadPdfDocument.mockReset();
  });

  it('loads a local PDF and renders the current page on a canvas', async () => {
    const handle = createDocumentHandle();
    mockedLoadPdfDocument.mockResolvedValue(handle);
    render(
      <I18nProvider>
        <PdfPreview filePath={'C:\\docs\\paper.pdf'} />
      </I18nProvider>,
    );

    await waitFor(() => expect(mockedLoadPdfDocument).toHaveBeenCalledWith('C:\\docs\\paper.pdf'));
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('paper.pdf')).toBeInTheDocument();
    await waitFor(() =>
      expect(handle.renderPage).toHaveBeenCalledWith(1, expect.any(HTMLCanvasElement), 1),
    );
  });

  it('supports page navigation within the document bounds', async () => {
    const user = userEvent.setup();
    const handle = createDocumentHandle();
    mockedLoadPdfDocument.mockResolvedValue(handle);
    render(
      <I18nProvider>
        <PdfPreview filePath={'C:\\docs\\paper.pdf'} />
      </I18nProvider>,
    );

    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    await waitFor(() =>
      expect(handle.renderPage).toHaveBeenCalledWith(2, expect.any(HTMLCanvasElement), 1),
    );

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
  });

  it('supports zoom and fit controls', async () => {
    const user = userEvent.setup();
    mockedLoadPdfDocument.mockResolvedValue(createDocumentHandle());
    render(
      <I18nProvider>
        <PdfPreview filePath={'C:\\docs\\paper.pdf'} />
      </I18nProvider>,
    );

    expect(await screen.findByText('Fit')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('115%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fit to window' }));
    expect(screen.getByText('Fit')).toBeInTheDocument();
  });

  it('shows an in-app error state when the PDF cannot be loaded', async () => {
    mockedLoadPdfDocument.mockRejectedValueOnce(new Error('missing'));
    render(
      <I18nProvider>
        <PdfPreview filePath={'C:\\docs\\missing.pdf'} />
      </I18nProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this PDF');
  });
});
