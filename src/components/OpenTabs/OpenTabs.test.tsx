import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import OpenTabs from './OpenTabs';

describe('OpenTabs', () => {
  it('keeps a trailing control available without open files', () => {
    render(
      <I18nProvider>
        <OpenTabs
          paths={[]}
          activePath={null}
          trailingControl={<button type="button">Open Agent sidebar</button>}
          onActivate={vi.fn()}
          onClose={vi.fn()}
          onCloseAll={vi.fn()}
          onCloseOthers={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(true)}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('button', { name: 'Open Agent sidebar' })).toBeInTheDocument();
  });

  it('shows file types, dirty state, and activates or closes a tab', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const onCloseAll = vi.fn();
    const onCloseOthers = vi.fn();
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
          onCloseAll={onCloseAll}
          onCloseOthers={onCloseOthers}
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

    fireEvent.contextMenu(screen.getByTitle(imagePath), { clientX: 32, clientY: 32 });
    const secondMenu = screen.getByRole('menu', { name: 'Actions for diagram.png' });
    await user.click(within(secondMenu).getByRole('menuitem', { name: 'Close Other Tabs' }));
    expect(onCloseOthers).toHaveBeenCalledWith(imagePath);

    fireEvent.contextMenu(screen.getByTitle(imagePath), { clientX: 32, clientY: 32 });
    const thirdMenu = screen.getByRole('menu', { name: 'Actions for diagram.png' });
    await user.click(within(thirdMenu).getByRole('menuitem', { name: 'Close All Tabs' }));
    expect(onCloseAll).toHaveBeenCalledOnce();
  });

  it('keeps closing tabs in place until their exit animation completes', () => {
    vi.useFakeTimers();
    const firstPath = 'C:\\notes\\first.md';
    const secondPath = 'C:\\notes\\second.md';
    const props = {
      activePath: secondPath,
      onActivate: vi.fn(),
      onClose: vi.fn(),
      onCloseAll: vi.fn(),
      onCloseOthers: vi.fn(),
      onDelete: vi.fn().mockResolvedValue(true),
    };
    const { container, rerender } = render(
      <I18nProvider>
        <OpenTabs paths={[firstPath, secondPath]} {...props} />
      </I18nProvider>,
    );

    rerender(
      <I18nProvider>
        <OpenTabs paths={[secondPath]} {...props} />
      </I18nProvider>,
    );

    const tabsDuringExit = container.querySelectorAll('[role="tab"]');
    expect(tabsDuringExit).toHaveLength(2);
    expect(tabsDuringExit[0]).toHaveAttribute('aria-hidden', 'true');
    expect(tabsDuringExit[0]).toHaveTextContent('first.md');

    act(() => vi.advanceTimersByTime(220));
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
    vi.useRealTimers();
  });
});
