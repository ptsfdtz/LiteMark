import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import type { FileTreeNode } from '@/types/fileTree';
import FileExplorer from './FileExplorer';

const tree: FileTreeNode[] = [
  {
    path: 'C:\\workspace\\docs',
    name: 'docs',
    is_directory: true,
    extension: null,
    children: [
      {
        path: 'C:\\workspace\\docs\\guide.md',
        name: 'guide.md',
        is_directory: false,
        extension: 'md',
        children: [],
      },
    ],
  },
  {
    path: 'C:\\workspace\\logo.png',
    name: 'logo.png',
    is_directory: false,
    extension: 'png',
    children: [],
  },
];

const secondTree: FileTreeNode[] = [
  {
    path: 'C:\\notes\\readme.md',
    name: 'readme.md',
    is_directory: false,
    extension: 'md',
    children: [],
  },
];

describe('FileExplorer', () => {
  it('manages multiple collapsible folder roots and opens supported files', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    window.localStorage.removeItem('litemark.explorerWidth');
    const user = userEvent.setup();
    const onOpenFile = vi.fn();
    const onChooseDirectory = vi.fn();
    const onRemoveDirectory = vi.fn();

    render(
      <I18nProvider>
        <FileExplorer
          roots={[
            { path: 'C:\\workspace', nodes: tree },
            { path: 'C:\\notes', nodes: secondTree },
          ]}
          currentPath={null}
          onOpenFile={onOpenFile}
          onChooseDirectory={onChooseDirectory}
          onRemoveDirectory={onRemoveDirectory}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'docs' }));
    await user.click(screen.getByRole('button', { name: 'guide.md' }));

    expect(onOpenFile).toHaveBeenCalledWith('C:\\workspace\\docs\\guide.md');
    await user.click(screen.getByRole('button', { name: 'logo.png' }));
    expect(onOpenFile).toHaveBeenCalledWith('C:\\workspace\\logo.png');

    await user.click(screen.getByRole('button', { name: 'Add folder' }));
    expect(onChooseDirectory).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'notes' }));
    expect(screen.queryByRole('button', { name: 'readme.md' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'notes' }));
    expect(screen.getByRole('button', { name: 'readme.md' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove notes from explorer' }));
    expect(onRemoveDirectory).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Confirm removal of notes' })).toHaveTextContent(
      'Files on disk will not be deleted',
    );
    await user.click(screen.getByRole('button', { name: /^Remove$/ }));
    expect(onRemoveDirectory).toHaveBeenCalledWith('C:\\notes');

    const resizeHandle = screen.getByRole('separator', { name: 'Resize file explorer' });
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '252');
    resizeHandle.focus();
    await user.keyboard('{ArrowRight}');
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '264');
  });
});
