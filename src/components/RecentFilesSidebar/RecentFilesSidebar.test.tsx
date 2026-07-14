import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecentFilesSidebar from './RecentFilesSidebar';

vi.mock('@/locales/useI18n', () => ({
  useI18n: () => ({ locale: 'en', t: (key: string) => key }),
}));

describe('Recent Documents sidebar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stays open when opening a Document is cancelled', async () => {
    const onChooseDocument = vi.fn(async () => false);
    const onRequestClose = vi.fn();
    render(
      <RecentFilesSidebar
        files={[]}
        isOpen
        onOpenDocument={vi.fn(async () => true)}
        onChooseDocument={onChooseDocument}
        onChooseDirectory={vi.fn()}
        onCreateDocument={vi.fn(async () => true)}
        onRequestClose={onRequestClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'recent.openFile' }));
    await waitFor(() => expect(onChooseDocument).toHaveBeenCalled());

    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
