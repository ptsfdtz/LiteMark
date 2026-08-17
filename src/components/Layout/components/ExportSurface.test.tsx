import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import ExportSurface from './ExportSurface';

describe('ExportSurface', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a visible preview and exports the rendered page on request', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const onExport = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider>
        <ExportSurface
          content={'# Export me'}
          filePath={'C:\\docs\\note.md'}
          mode="png"
          onExport={onExport}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(await screen.findByText('Export me')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Export preview' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Choose output folder' }));
    expect(onExport).toHaveBeenCalledOnce();
    const surface = onExport.mock.calls[0][0] as HTMLElement;
    expect(surface.textContent).toContain('Export me');
  });
});
