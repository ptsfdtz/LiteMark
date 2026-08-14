import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import { getImagePreviewSource } from '@/modules/imagePreview';
import ImagePreview from './ImagePreview';

vi.mock('@/modules/imagePreview', () => ({
  getImagePreviewSource: vi.fn(),
}));

const mockedGetImagePreviewSource = vi.mocked(getImagePreviewSource);

describe('ImagePreview', () => {
  beforeEach(() => {
    window.localStorage.setItem('litemark.locale', 'en');
    mockedGetImagePreviewSource.mockResolvedValue('asset://preview/image.png');
  });

  it('loads a local image and supports zoom and fit controls', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <ImagePreview filePath={'C:\\art\\image.png'} />
      </I18nProvider>,
    );

    await waitFor(() =>
      expect(mockedGetImagePreviewSource).toHaveBeenCalledWith('C:\\art\\image.png'),
    );
    const image = await screen.findByRole('img', { name: 'image.png' });
    Object.defineProperties(image, {
      naturalWidth: { value: 1200 },
      naturalHeight: { value: 800 },
    });
    fireEvent.load(image);

    expect(screen.getByText('1200 × 800')).toBeInTheDocument();
    expect(screen.getByText('Fit')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('115%')).toBeInTheDocument();
    expect(image).toHaveStyle({ width: '1380px', height: '920px' });

    await user.click(screen.getByRole('button', { name: 'Fit to window' }));
    expect(screen.getByText('Fit')).toBeInTheDocument();
  });

  it('shows an in-app error state when the image cannot be prepared', async () => {
    mockedGetImagePreviewSource.mockRejectedValueOnce(new Error('missing'));
    render(
      <I18nProvider>
        <ImagePreview filePath={'C:\\art\\missing.png'} />
      </I18nProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this image');
  });
});
