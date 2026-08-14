import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import OpenTabs from './OpenTabs';

describe('OpenTabs', () => {
  it('shows file types, dirty state, and activates or closes a tab', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const markdownPath = 'C:\\notes\\a-very-long-document-name-that-needs-ellipsis.md';
    const imagePath = 'C:\\notes\\diagram.png';

    render(
      <I18nProvider>
        <OpenTabs
          paths={[markdownPath, imagePath]}
          activePath={markdownPath}
          dirtyPath={markdownPath}
          onActivate={onActivate}
          onClose={onClose}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      'a-very-long-document-name-that-needs-ellipsis.md',
    );
    expect(screen.getByTitle('Unsaved changes')).toBeInTheDocument();

    await user.click(screen.getByTitle(imagePath));
    expect(onActivate).toHaveBeenCalledWith(imagePath);

    await user.click(screen.getByRole('button', { name: 'Close diagram.png' }));
    expect(onClose).toHaveBeenCalledWith(imagePath);
  });
});
