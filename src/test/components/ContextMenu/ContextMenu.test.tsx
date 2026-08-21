import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ContextMenu from '@/components/ContextMenu/ContextMenu';

describe('ContextMenu', () => {
  it('supports selection, disabled items, keyboard navigation, and escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <ContextMenu
        x={20}
        y={20}
        label="Actions"
        onClose={onClose}
        items={[
          { id: 'first', label: 'First', onSelect },
          { id: 'disabled', label: 'Disabled', disabled: true },
          { id: 'separator', separator: true },
          { id: 'last', label: 'Last' },
        ]}
      />,
    );

    expect(screen.getByRole('menuitem', { name: 'First' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Last' })).toHaveFocus();
    await user.click(screen.getByRole('menuitem', { name: 'First' }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
