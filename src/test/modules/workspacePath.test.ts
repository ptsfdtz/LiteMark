import { describe, expect, it } from 'vitest';
import { normalizeWorkspacePath, pathBelongsToDirectory } from '@/modules/workspacePath';

describe('workspace paths', () => {
  it('treats Windows extended-length paths as their normal drive paths', () => {
    expect(normalizeWorkspacePath('\\\\?\\C:\\Users\\user\\Documents\\notes\\matlab')).toBe(
      'c:/users/user/documents/notes/matlab',
    );
    expect(
      pathBelongsToDirectory(
        '\\\\?\\C:\\Users\\user\\Documents\\notes\\matlab\\01_基础语法.md',
        'C:\\Users\\user\\Documents\\notes',
      ),
    ).toBe(true);
  });

  it('normalizes extended UNC paths without changing their share boundary', () => {
    expect(normalizeWorkspacePath('\\\\?\\UNC\\server\\share\\notes\\file.md')).toBe(
      '//server/share/notes/file.md',
    );
    expect(
      pathBelongsToDirectory(
        '\\\\?\\UNC\\server\\share\\notes\\file.md',
        '\\\\server\\share\\notes',
      ),
    ).toBe(true);
  });

  it('does not confuse sibling directories with descendants', () => {
    expect(
      pathBelongsToDirectory(
        'C:\\Users\\user\\Documents\\notes-old\\file.md',
        'C:\\Users\\user\\Documents\\notes',
      ),
    ).toBe(false);
  });
});
