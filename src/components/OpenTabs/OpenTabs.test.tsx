import { fireEvent, render, screen, within } from '@testing-library/react';
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
    const onDelete = vi.fn().mockResolvedValue(true);
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
          onDelete={onDelete}
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

    fireEvent.contextMenu(screen.getByTitle(markdownPath), { clientX: 32, clientY: 32 });
    const menu = screen.getByRole('menu', {
      name: 'Actions for a-very-long-document-name-that-needs-ellipsis.md',
    });
    await user.click(within(menu).getByRole('menuitem', { name: 'Close Tab' }));
    expect(onClose).toHaveBeenCalledWith(markdownPath);
  });
});
