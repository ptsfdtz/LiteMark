import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import type { FileTreeNode } from '@/types/fileTree';
import FileExplorer from '@/components/FileExplorer/FileExplorer';

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
    const onRefresh = vi.fn();
    const onLoadDirectory = vi.fn().mockResolvedValue(undefined);
    const onRemoveDirectory = vi.fn();
    const onReorderDirectory = vi.fn();
    const onDeleteFile = vi.fn().mockResolvedValue(true);
    const onCreateFile = vi.fn().mockResolvedValue(true);
    const onCreateDirectory = vi.fn().mockResolvedValue('C:\\workspace\\docs\\New Folder');
    const onRenameDirectory = vi.fn().mockResolvedValue('C:\\workspace\\renamed');
    const onDeleteDirectory = vi.fn().mockResolvedValue(true);
    const onRemoveStandaloneFile = vi.fn().mockResolvedValue(undefined);
    const standaloneFile = { path: 'C:\\scratch\\draft.md', name: 'draft.md' };

    render(
      <I18nProvider>
        <FileExplorer
          roots={[
            { path: 'C:\\workspace', nodes: tree },
            { path: 'C:\\notes', nodes: secondTree },
          ]}
          standaloneFiles={[standaloneFile]}
          currentPath={null}
          onOpenFile={onOpenFile}
          onChooseDirectory={onChooseDirectory}
          onRefresh={onRefresh}
          onLoadDirectory={onLoadDirectory}
          onRemoveDirectory={onRemoveDirectory}
          onReorderDirectory={onReorderDirectory}
          onDeleteFile={onDeleteFile}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onRenameDirectory={onRenameDirectory}
          onDeleteDirectory={onDeleteDirectory}
          onRemoveStandaloneFile={onRemoveStandaloneFile}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'docs' }));
    expect(onLoadDirectory).toHaveBeenCalledWith('C:\\workspace\\docs');
    await user.click(screen.getByRole('button', { name: 'guide.md' }));

    expect(onOpenFile).toHaveBeenCalledWith('C:\\workspace\\docs\\guide.md');
    await user.click(screen.getByRole('button', { name: 'logo.png' }));
    expect(onOpenFile).toHaveBeenCalledWith('C:\\workspace\\logo.png');

    await user.click(screen.getByRole('button', { name: 'Add folder' }));
    expect(onChooseDirectory).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Refresh explorer' }));
    expect(onRefresh).toHaveBeenCalledOnce();

    expect(screen.getByRole('button', { name: 'draft.md' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove draft.md from explorer' }));
    expect(onRemoveStandaloneFile).toHaveBeenCalledWith(standaloneFile.path);

    await user.click(screen.getByRole('button', { name: 'notes' }));
    expect(screen.queryByRole('button', { name: 'readme.md' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'notes' }));
    expect(screen.getByRole('button', { name: 'readme.md' })).toBeInTheDocument();

    const docsButton = screen.getByRole('button', { name: 'docs' });
    const docsGroup = docsButton.nextElementSibling as HTMLDivElement;
    const notesRootButton = screen.getByRole('button', { name: 'notes' });
    const notesRootGroup = notesRootButton.parentElement?.parentElement?.querySelector(
      `:scope > div[aria-hidden]`,
    ) as HTMLDivElement;
    await user.click(screen.getByRole('button', { name: 'Collapse all folders' }));
    expect(docsGroup).toHaveAttribute('aria-hidden', 'true');
    expect(notesRootButton).toHaveAttribute('aria-expanded', 'false');
    expect(notesRootGroup).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByRole('button', { name: 'workspace' }));
    await user.click(screen.getByRole('button', { name: 'docs' }));

    const workspaceButton = screen.getByRole('button', { name: 'workspace' });
    const notesButton = screen.getByRole('button', { name: 'notes' });
    const notesHeader = notesButton.parentElement as HTMLDivElement;
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      setData: vi.fn(),
    };
    vi.spyOn(notesHeader, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 34,
      left: 0,
      right: 252,
      width: 252,
      height: 34,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.dragStart(workspaceButton, { dataTransfer });
    fireEvent.dragOver(notesHeader, { clientY: 30, dataTransfer });
    fireEvent.drop(notesHeader, { clientY: 30, dataTransfer });
    expect(onReorderDirectory).toHaveBeenCalledWith('C:\\workspace', 'C:\\notes', 'after');

    const logoButton = screen.getByRole('button', { name: 'logo.png' });
    await user.click(logoButton);
    await user.keyboard('{Delete}');
    const keyboardDeleteDialog = screen.getByRole('alertdialog', { name: 'Delete file?' });
    await user.click(within(keyboardDeleteDialog).getByRole('button', { name: 'Cancel' }));

    fireEvent.contextMenu(logoButton, { clientX: 32, clientY: 32 });
    const contextMenu = screen.getByRole('menu', { name: 'Actions for logo.png' });
    await user.click(within(contextMenu).getByRole('menuitem', { name: 'Delete' }));
    const deleteDialog = screen.getByRole('alertdialog', { name: 'Delete file?' });
    await user.click(within(deleteDialog).getByRole('button', { name: 'Delete' }));
    expect(onDeleteFile).toHaveBeenCalledWith('C:\\workspace\\logo.png');

    fireEvent.contextMenu(screen.getByRole('button', { name: 'docs' }), {
      clientX: 32,
      clientY: 32,
    });
    const folderMenu = screen.getByRole('menu', { name: 'Actions for docs' });
    expect(within(folderMenu).getByRole('menuitem', { name: 'New File' })).toBeInTheDocument();
    await user.click(within(folderMenu).getByRole('menuitem', { name: 'New Folder' }));
    expect(onCreateDirectory).toHaveBeenCalledWith('C:\\workspace\\docs');

    fireEvent.contextMenu(screen.getByRole('button', { name: 'docs' }), {
      clientX: 32,
      clientY: 32,
    });
    const reopenedFolderMenu = screen.getByRole('menu', { name: 'Actions for docs' });
    expect(
      within(reopenedFolderMenu).getByRole('menuitem', { name: 'Copy Absolute Path' }),
    ).toBeInTheDocument();
    await user.click(within(reopenedFolderMenu).getByRole('menuitem', { name: 'Rename Folder' }));
    const folderNameInput = screen.getByRole('textbox', { name: 'docs' });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'renamed{Enter}');
    expect(onRenameDirectory).toHaveBeenCalledWith('C:\\workspace\\docs', 'renamed');

    fireEvent.contextMenu(screen.getByRole('button', { name: 'docs' }), {
      clientX: 32,
      clientY: 32,
    });
    await user.click(
      within(screen.getByRole('menu', { name: 'Actions for docs' })).getByRole('menuitem', {
        name: 'Delete Folder',
      }),
    );
    const deleteFolderDialog = screen.getByRole('alertdialog', { name: 'Delete folder?' });
    await user.click(within(deleteFolderDialog).getByRole('button', { name: 'Delete' }));
    expect(onDeleteDirectory).toHaveBeenCalledWith('C:\\workspace\\docs');

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
