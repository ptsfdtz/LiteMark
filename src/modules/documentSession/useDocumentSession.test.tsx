import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useDocumentSession, {
  type DocumentSessionDependencies,
  type RecentDocument,
} from './useDocumentSession';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function dependencies(
  loadRecentDocuments: DocumentSessionDependencies['recentDocuments']['load'],
): DocumentSessionDependencies {
  return {
    storage: {
      getStartupDocument: vi.fn(async () => null),
      read: vi.fn(async () => ''),
      write: vi.fn(async () => undefined),
      createUntitled: vi.fn(async () => 'untitled.md'),
      rename: vi.fn(async (path) => path),
      list: vi.fn(async () => []),
    },
    recentDocuments: {
      load: loadRecentDocuments,
      save: vi.fn(async () => undefined),
    },
    confirmDiscard: vi.fn(async () => true),
  };
}

describe('Document Session', () => {
  it('preserves persisted Recent Documents while startup hydration is pending', async () => {
    const loading = deferred<RecentDocument[]>();
    const deps = dependencies(() => loading.promise);
    const existing: RecentDocument = {
      name: 'existing.md',
      path: 'C:\\notes\\existing.md',
      modified: new Date('2026-07-14T00:00:00.000Z'),
    };

    const { result } = renderHook(() => useDocumentSession(deps));

    expect(result.current.ready).toBe(false);
    expect(deps.recentDocuments.save).not.toHaveBeenCalled();

    await act(async () => loading.resolve([existing]));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.recentDocuments).toEqual([existing]);
    expect(deps.recentDocuments.save).not.toHaveBeenCalled();
  });

  it('becomes ready with an empty session when startup hydration fails', async () => {
    const deps = dependencies(async () => {
      throw new Error('recent store unavailable');
    });
    const { result } = renderHook(() => useDocumentSession(deps));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.currentDocumentPath).toBeNull();
    expect(result.current.content).toBe('');
    expect(result.current.recentDocuments).toEqual([]);
  });

  it('preserves Recent Documents when the restored Document is missing', async () => {
    const existing: RecentDocument = {
      name: 'missing.md',
      path: 'C:\\notes\\missing.md',
      modified: new Date('2026-07-14T00:00:00.000Z'),
    };
    const deps = dependencies(async () => [existing]);
    vi.mocked(deps.storage.read).mockRejectedValue(new Error('document missing'));
    const { result } = renderHook(() => useDocumentSession(deps));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.currentDocumentPath).toBeNull();
    expect(result.current.recentDocuments).toEqual([existing]);
  });

  it('does not replace user content when startup hydration finishes late', async () => {
    const startupRead = deferred<string>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.getStartupDocument).mockResolvedValue('C:\\notes\\startup.md');
    vi.mocked(deps.storage.read).mockReturnValue(startupRead.promise);
    const { result } = renderHook(() => useDocumentSession(deps));

    await waitFor(() => expect(deps.storage.read).toHaveBeenCalled());
    act(() => result.current.setContent('# Draft typed during startup\n'));
    await act(async () => startupRead.resolve('# Startup document\n'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.currentDocumentPath).toBeNull();
    expect(result.current.content).toBe('# Draft typed during startup\n');
    expect(result.current.isDirty).toBe(true);
  });

  it('does not replace a newly created Document when startup hydration finishes late', async () => {
    const startupRead = deferred<string>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.getStartupDocument).mockResolvedValue('C:\\notes\\startup.md');
    vi.mocked(deps.storage.read).mockReturnValue(startupRead.promise);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\untitled.md');
    const { result } = renderHook(() => useDocumentSession(deps));

    await waitFor(() => expect(deps.storage.read).toHaveBeenCalled());
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# New document\n');
    });
    await act(async () => startupRead.resolve('# Startup document\n'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.currentDocumentPath).toBe('C:\\notes\\untitled.md');
    expect(result.current.content).toBe('# New document\n');
    expect(result.current.isDirty).toBe(false);
  });

  it('merges Recent Documents recorded while Recent hydration is pending', async () => {
    const loading = deferred<RecentDocument[]>();
    const existing: RecentDocument = {
      name: 'existing.md',
      path: 'C:\\notes\\existing.md',
      modified: new Date('2026-07-13T00:00:00.000Z'),
    };
    const deps = dependencies(() => loading.promise);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\new.md');
    const { result } = renderHook(() => useDocumentSession(deps));

    await act(async () => {
      await result.current.createDocument('C:\\notes', '# New\n');
    });
    await act(async () => loading.resolve([existing]));

    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(() =>
      expect(result.current.recentDocuments.map((document) => document.path)).toEqual([
        'C:\\notes\\new.md',
        'C:\\notes\\existing.md',
      ]),
    );
    expect(deps.recentDocuments.save).toHaveBeenLastCalledWith(result.current.recentDocuments);
  });

  it('keeps a Dirty Document when the user rejects discarding it', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.confirmDiscard).mockResolvedValue(false);
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setContent('unsaved draft'));
    expect(result.current.isDirty).toBe(true);

    let created = true;
    await act(async () => {
      created = await result.current.createDocument('C:\\notes', '# New Document\n');
    });

    expect(created).toBe(false);
    expect(result.current.content).toBe('unsaved draft');
    expect(deps.storage.createUntitled).not.toHaveBeenCalled();
  });

  it('uses the unique path returned for a newly created Document', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\untitled-2.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.createDocument('C:\\notes', '# New Document\n');
    });

    expect(result.current.currentDocumentPath).toBe('C:\\notes\\untitled-2.md');
    expect(result.current.content).toBe('# New Document\n');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.recentDocuments[0]).toEqual(
      expect.objectContaining({
        name: 'untitled-2.md',
        path: 'C:\\notes\\untitled-2.md',
      }),
    );
    expect(deps.recentDocuments.save).toHaveBeenCalledWith(result.current.recentDocuments);
  });

  it('keeps a Document dirty when saving to disk fails', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\draft.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Draft\n');
    });
    act(() => result.current.setContent('# Unsaved change\n'));
    vi.mocked(deps.storage.write).mockRejectedValue(new Error('disk full'));

    await expect(
      act(async () => {
        await result.current.saveDocument();
      }),
    ).rejects.toThrow('disk full');

    expect(result.current.isDirty).toBe(true);
    expect(result.current.content).toBe('# Unsaved change\n');
  });

  it('saves the latest edit made in the same event batch', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\draft.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Initial\n');
    });

    let saving!: Promise<boolean>;
    act(() => {
      result.current.setContent('# Latest edit\n');
      saving = result.current.saveDocument();
    });
    await act(async () => {
      await saving;
    });

    expect(deps.storage.write).toHaveBeenCalledWith('C:\\notes\\draft.md', '# Latest edit\n');
    expect(result.current.isDirty).toBe(false);
  });

  it('writes concurrent saves in request order so the latest content wins', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\draft.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Initial\n');
    });
    vi.mocked(deps.storage.write)
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);

    act(() => result.current.setContent('# First save\n'));
    let savingFirst!: Promise<boolean>;
    act(() => {
      savingFirst = result.current.saveDocument();
    });
    act(() => result.current.setContent('# Second save\n'));
    let savingSecond!: Promise<boolean>;
    act(() => {
      savingSecond = result.current.saveDocument();
    });

    expect(deps.storage.write).toHaveBeenCalledTimes(1);
    expect(deps.storage.write).toHaveBeenNthCalledWith(1, 'C:\\notes\\draft.md', '# First save\n');

    await act(async () => firstWrite.resolve());
    await waitFor(() => expect(deps.storage.write).toHaveBeenCalledTimes(2));
    expect(deps.storage.write).toHaveBeenNthCalledWith(2, 'C:\\notes\\draft.md', '# Second save\n');
    await act(async () => secondWrite.resolve());

    await expect(savingFirst).resolves.toBe(true);
    await expect(savingSecond).resolves.toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  it('does not apply an old save completion to a newly opened Document', async () => {
    const pendingWrite = deferred<void>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\first.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# First\n');
    });
    act(() => result.current.setContent('# First changed\n'));
    vi.mocked(deps.storage.write).mockReturnValue(pendingWrite.promise);

    let saving!: Promise<boolean>;
    act(() => {
      saving = result.current.saveDocument();
    });
    vi.mocked(deps.storage.read).mockResolvedValue('# Second\n');
    await act(async () => {
      await result.current.openDocument('C:\\notes\\second.md');
    });
    await act(async () => pendingWrite.resolve());
    await expect(saving).resolves.toBe(true);

    expect(result.current.currentDocumentPath).toBe('C:\\notes\\second.md');
    expect(result.current.content).toBe('# Second\n');
    expect(result.current.isDirty).toBe(false);
  });

  it('opens a Document as one clean session and records it as recent', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.read).mockResolvedValue('# Existing\n');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.openDocument('C:\\notes\\existing.md');
    });

    expect(result.current.currentDocumentPath).toBe('C:\\notes\\existing.md');
    expect(result.current.content).toBe('# Existing\n');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.recentDocuments[0]?.path).toBe('C:\\notes\\existing.md');
    expect(deps.recentDocuments.save).toHaveBeenCalledWith(result.current.recentDocuments);
  });

  it('keeps a successful open successful when Recent persistence fails', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.read).mockResolvedValue('# Existing\n');
    vi.mocked(deps.recentDocuments.save).mockRejectedValue(new Error('recent store unavailable'));
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let opened = false;
    await act(async () => {
      opened = await result.current.openDocument('C:\\notes\\existing.md');
    });

    expect(opened).toBe(true);
    expect(result.current.currentDocumentPath).toBe('C:\\notes\\existing.md');
    expect(result.current.content).toBe('# Existing\n');
    expect(result.current.isDirty).toBe(false);
  });

  it('keeps the last requested Document when reads finish out of order', async () => {
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.read).mockImplementation((path) =>
      path.endsWith('first.md') ? firstRead.promise : secondRead.promise,
    );
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let firstOpen!: Promise<boolean>;
    let secondOpen!: Promise<boolean>;
    act(() => {
      firstOpen = result.current.openDocument('C:\\notes\\first.md');
      secondOpen = result.current.openDocument('C:\\notes\\second.md');
    });

    await act(async () => secondRead.resolve('# Second\n'));
    await expect(secondOpen).resolves.toBe(true);
    await act(async () => firstRead.resolve('# First\n'));
    await expect(firstOpen).resolves.toBe(false);

    expect(result.current.currentDocumentPath).toBe('C:\\notes\\second.md');
    expect(result.current.content).toBe('# Second\n');
    expect(result.current.isDirty).toBe(false);
  });

  it('keeps edits made while a Document is still opening', async () => {
    const pendingRead = deferred<string>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.read).mockReturnValue(pendingRead.promise);
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let opening!: Promise<boolean>;
    act(() => {
      opening = result.current.openDocument('C:\\notes\\slow.md');
    });
    act(() => result.current.setContent('# Keep this draft\n'));
    await act(async () => pendingRead.resolve('# Slow document\n'));

    await expect(opening).resolves.toBe(false);
    expect(result.current.currentDocumentPath).toBeNull();
    expect(result.current.content).toBe('# Keep this draft\n');
    expect(result.current.isDirty).toBe(true);
  });

  it('does not adopt a Save As path until the disk write succeeds', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.write).mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setContent('# Unsaved\n'));

    await expect(
      act(async () => {
        await result.current.saveDocumentAs('C:\\notes\\new.md');
      }),
    ).rejects.toThrow('permission denied');

    expect(result.current.currentDocumentPath).toBeNull();
    expect(result.current.isDirty).toBe(true);
    expect(result.current.recentDocuments).toEqual([]);
  });

  it('does not replace a Save As path when startup hydration finishes late', async () => {
    const startupRead = deferred<string>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.getStartupDocument).mockResolvedValue('C:\\notes\\startup.md');
    vi.mocked(deps.storage.read).mockReturnValue(startupRead.promise);
    const { result } = renderHook(() => useDocumentSession(deps));

    await waitFor(() => expect(deps.storage.read).toHaveBeenCalled());
    await act(async () => {
      await result.current.saveDocumentAs('C:\\notes\\saved.md');
    });
    await act(async () => startupRead.resolve('# Startup document\n'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.currentDocumentPath).toBe('C:\\notes\\saved.md');
    expect(result.current.content).toBe('');
    expect(result.current.isDirty).toBe(false);
  });

  it('queues Save As behind an in-flight save', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\draft.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Initial\n');
    });
    vi.mocked(deps.storage.write)
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    act(() => result.current.setContent('# First save\n'));

    let saving!: Promise<boolean>;
    let savingAs!: Promise<boolean>;
    act(() => {
      saving = result.current.saveDocument();
    });
    act(() => result.current.setContent('# Save as\n'));
    act(() => {
      savingAs = result.current.saveDocumentAs('C:\\notes\\saved-as.md');
    });

    expect(deps.storage.write).toHaveBeenCalledTimes(1);
    await act(async () => firstWrite.resolve());
    await waitFor(() => expect(deps.storage.write).toHaveBeenCalledTimes(2));
    expect(deps.storage.write).toHaveBeenLastCalledWith('C:\\notes\\saved-as.md', '# Save as\n');
    await act(async () => secondWrite.resolve());

    await expect(saving).resolves.toBe(true);
    await expect(savingAs).resolves.toBe(true);
    expect(result.current.currentDocumentPath).toBe('C:\\notes\\saved-as.md');
    expect(result.current.isDirty).toBe(false);
  });

  it('opens the startup Document before the session becomes ready', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.getStartupDocument).mockResolvedValue('C:\\notes\\startup.md');
    vi.mocked(deps.storage.read).mockResolvedValue('# Startup\n');

    const { result } = renderHook(() => useDocumentSession(deps));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.currentDocumentPath).toBe('C:\\notes\\startup.md');
    expect(result.current.content).toBe('# Startup\n');
    expect(result.current.isDirty).toBe(false);
    await waitFor(() =>
      expect(result.current.recentDocuments[0]).toEqual(
        expect.objectContaining({
          name: 'startup.md',
          path: 'C:\\notes\\startup.md',
        }),
      ),
    );
    expect(deps.recentDocuments.save).toHaveBeenCalledWith(result.current.recentDocuments);
  });

  it('does not replay startup hydration when dependency callbacks change', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.getStartupDocument).mockResolvedValue('C:\\notes\\startup.md');
    vi.mocked(deps.storage.read).mockResolvedValue('# Startup\n');
    const { result, rerender } = renderHook(
      ({ currentDependencies }) => useDocumentSession(currentDependencies),
      { initialProps: { currentDependencies: deps } },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setContent('# Unsaved translation-era edit\n'));

    rerender({
      currentDependencies: {
        ...deps,
        onInitializationError: vi.fn(),
        onRecentDocumentsError: vi.fn(),
      },
    });
    await act(async () => Promise.resolve());

    expect(result.current.currentDocumentPath).toBe('C:\\notes\\startup.md');
    expect(result.current.content).toBe('# Unsaved translation-era edit\n');
    expect(result.current.isDirty).toBe(true);
  });

  it('adopts the path returned by a successful Document rename', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\untitled.md');
    vi.mocked(deps.storage.rename).mockResolvedValue('C:\\notes\\journal.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Journal\n');
    });

    await act(async () => {
      await result.current.renameDocument('journal.md');
    });

    expect(deps.storage.rename).toHaveBeenCalledWith('C:\\notes\\untitled.md', 'journal.md');
    expect(result.current.currentDocumentPath).toBe('C:\\notes\\journal.md');
    expect(result.current.recentDocuments.map((document) => document.path)).toEqual([
      'C:\\notes\\journal.md',
    ]);
  });

  it('waits for an in-flight save before renaming the Document', async () => {
    const pendingWrite = deferred<void>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\draft.md');
    vi.mocked(deps.storage.rename).mockResolvedValue('C:\\notes\\renamed.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Draft\n');
    });
    act(() => result.current.setContent('# Changed\n'));
    vi.mocked(deps.storage.write).mockReturnValue(pendingWrite.promise);

    let saving!: Promise<boolean>;
    let renaming!: Promise<boolean>;
    act(() => {
      saving = result.current.saveDocument();
      renaming = result.current.renameDocument('renamed.md');
    });

    expect(deps.storage.rename).not.toHaveBeenCalled();
    await act(async () => pendingWrite.resolve());
    await expect(saving).resolves.toBe(true);
    await expect(renaming).resolves.toBe(true);
    expect(deps.storage.rename).toHaveBeenCalledWith('C:\\notes\\draft.md', 'renamed.md');
    expect(result.current.currentDocumentPath).toBe('C:\\notes\\renamed.md');
  });

  it('saves to the renamed path when save is queued after rename', async () => {
    const pendingRename = deferred<string>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\draft.md');
    vi.mocked(deps.storage.rename).mockReturnValue(pendingRename.promise);
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Draft\n');
    });
    act(() => result.current.setContent('# Changed\n'));

    let renaming!: Promise<boolean>;
    let saving!: Promise<boolean>;
    act(() => {
      renaming = result.current.renameDocument('renamed.md');
      saving = result.current.saveDocument();
    });

    expect(deps.storage.write).not.toHaveBeenCalled();
    await act(async () => pendingRename.resolve('C:\\notes\\renamed.md'));
    await expect(renaming).resolves.toBe(true);
    await expect(saving).resolves.toBe(true);
    expect(deps.storage.write).toHaveBeenCalledWith('C:\\notes\\renamed.md', '# Changed\n');
  });

  it('renames the Save As path when rename is queued behind Save As', async () => {
    const pendingSaveAs = deferred<void>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\draft.md');
    vi.mocked(deps.storage.write).mockReturnValue(pendingSaveAs.promise);
    vi.mocked(deps.storage.rename).mockResolvedValue('C:\\notes\\renamed.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Draft\n');
    });

    let savingAs!: Promise<boolean>;
    let renaming!: Promise<boolean>;
    act(() => {
      savingAs = result.current.saveDocumentAs('C:\\notes\\saved-as.md');
      renaming = result.current.renameDocument('renamed.md');
    });
    expect(deps.storage.rename).not.toHaveBeenCalled();

    await act(async () => pendingSaveAs.resolve());
    await expect(savingAs).resolves.toBe(true);
    await expect(renaming).resolves.toBe(true);

    expect(deps.storage.rename).toHaveBeenCalledWith('C:\\notes\\saved-as.md', 'renamed.md');
    expect(result.current.currentDocumentPath).toBe('C:\\notes\\renamed.md');
    expect(result.current.isDirty).toBe(false);
  });

  it('removes Recent Document history without closing the current session', async () => {
    const existing: RecentDocument = {
      name: 'existing.md',
      path: 'C:\\notes\\existing.md',
      modified: new Date('2026-07-14T00:00:00.000Z'),
    };
    const deps = dependencies(async () => [existing]);
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.removeRecentDocument(existing.path);
    });

    expect(result.current.recentDocuments).toEqual([]);
    expect(result.current.currentDocumentPath).toBe(existing.path);
    expect(deps.recentDocuments.save).toHaveBeenLastCalledWith([]);
  });

  it('keeps Recent Document history when removing it cannot be persisted', async () => {
    const existing: RecentDocument = {
      name: 'existing.md',
      path: 'C:\\notes\\existing.md',
      modified: new Date('2026-07-14T00:00:00.000Z'),
    };
    const deps = dependencies(async () => [existing]);
    vi.mocked(deps.recentDocuments.save).mockRejectedValue(new Error('recent store unavailable'));
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let removalError: unknown;
    await act(async () => {
      try {
        await result.current.removeRecentDocument(existing.path);
      } catch (error) {
        removalError = error;
      }
    });

    expect(removalError).toEqual(new Error('recent store unavailable'));
    expect(result.current.recentDocuments).toEqual([existing]);
  });

  it('keeps directory results separate from Recent Document history', async () => {
    const existing: RecentDocument = {
      name: 'a.md',
      path: 'C:\\notes\\a.md',
      modified: new Date('2026-07-13T00:00:00.000Z'),
    };
    const scanned: RecentDocument[] = [
      { ...existing, modified: new Date('2026-07-14T00:00:00.000Z') },
      {
        name: 'b.md',
        path: 'C:\\notes\\b.md',
        modified: new Date('2026-07-12T00:00:00.000Z'),
      },
    ];
    const deps = dependencies(async () => [existing]);
    vi.mocked(deps.storage.list).mockResolvedValue(scanned);
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.loadDirectory('C:\\notes');
    });

    expect(result.current.directoryDocuments).toEqual(scanned);
    expect(result.current.recentDocuments).toEqual([existing]);
    expect(deps.recentDocuments.save).not.toHaveBeenCalled();
  });

  it('keeps the last requested directory when scans finish out of order', async () => {
    const firstScan = deferred<RecentDocument[]>();
    const secondScan = deferred<RecentDocument[]>();
    const firstDocument: RecentDocument = {
      name: 'first.md',
      path: 'C:\\first\\first.md',
      modified: new Date('2026-07-13T00:00:00.000Z'),
    };
    const secondDocument: RecentDocument = {
      name: 'second.md',
      path: 'C:\\second\\second.md',
      modified: new Date('2026-07-14T00:00:00.000Z'),
    };
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.list).mockImplementation((directory) =>
      directory.endsWith('first') ? firstScan.promise : secondScan.promise,
    );
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let loadingFirst!: Promise<void>;
    let loadingSecond!: Promise<void>;
    act(() => {
      loadingFirst = result.current.loadDirectory('C:\\first');
      loadingSecond = result.current.loadDirectory('C:\\second');
    });
    await act(async () => secondScan.resolve([secondDocument]));
    await loadingSecond;
    await act(async () => firstScan.resolve([firstDocument]));
    await loadingFirst;

    expect(result.current.directoryDocuments).toEqual([secondDocument]);
  });

  it('clears directory results to return to Recent Documents', async () => {
    const scanned: RecentDocument = {
      name: 'available.md',
      path: 'C:\\notes\\available.md',
      modified: new Date('2026-07-14T00:00:00.000Z'),
    };
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.list).mockResolvedValue([scanned]);
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => result.current.loadDirectory('C:\\notes'));

    act(() => result.current.clearDirectoryDocuments());

    expect(result.current.directoryDocuments).toBeNull();
  });

  it('blocks closing a Dirty Document when discard is rejected', async () => {
    const deps = dependencies(async () => []);
    vi.mocked(deps.confirmDiscard).mockResolvedValue(false);
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setContent('unsaved'));

    let canClose = true;
    await act(async () => {
      canClose = await result.current.canClose();
    });

    expect(canClose).toBe(false);
  });

  it('waits for an in-flight save before deciding whether the session can close', async () => {
    const pendingWrite = deferred<void>();
    const deps = dependencies(async () => []);
    vi.mocked(deps.storage.createUntitled).mockResolvedValue('C:\\notes\\draft.md');
    const { result } = renderHook(() => useDocumentSession(deps));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createDocument('C:\\notes', '# Draft\n');
    });
    act(() => result.current.setContent('# Changed\n'));
    vi.mocked(deps.storage.write).mockReturnValue(pendingWrite.promise);

    let saving!: Promise<boolean>;
    let closing!: Promise<boolean>;
    act(() => {
      saving = result.current.saveDocument();
      closing = result.current.canClose();
    });

    expect(deps.confirmDiscard).not.toHaveBeenCalled();
    await act(async () => pendingWrite.resolve());
    await expect(saving).resolves.toBe(true);
    await expect(closing).resolves.toBe(true);
    expect(deps.confirmDiscard).not.toHaveBeenCalled();
  });
});
