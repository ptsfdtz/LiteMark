import { describe, expect, it } from 'vitest';
import { mergeDirectoryEntries, replaceDirectoryChildren } from '@/modules/directoryTree';
import type { FileTreeNode } from '@/types/fileTree';

function file(path: string): FileTreeNode {
  return {
    path,
    name: path.split(/[\\/]/).pop() ?? path,
    is_directory: false,
    extension: 'md',
    children: [],
    children_loaded: true,
  };
}

function directory(path: string, children: FileTreeNode[] = []): FileTreeNode {
  return {
    path,
    name: path.split(/[\\/]/).pop() ?? path,
    is_directory: true,
    extension: null,
    children,
    children_loaded: children.length > 0,
  };
}

describe('directory tree updates', () => {
  it('preserves loaded descendants when refreshing a parent directory', () => {
    const existing = [directory('C:\\workspace\\motor', [file('C:\\workspace\\motor\\a.md')])];
    const incoming = [directory('C:\\workspace\\motor'), file('C:\\workspace\\new.md')];

    expect(mergeDirectoryEntries(existing, incoming)).toEqual([
      directory('C:\\workspace\\motor', [file('C:\\workspace\\motor\\a.md')]),
      file('C:\\workspace\\new.md'),
    ]);
  });

  it('updates only the refreshed directory and retains its loaded child folders', () => {
    const tree = [
      directory('C:\\workspace\\motor', [
        directory('C:\\workspace\\motor\\parts', [file('C:\\workspace\\motor\\parts\\joint.md')]),
        file('C:\\workspace\\motor\\old.md'),
      ]),
    ];
    const refreshed = [
      directory('C:\\workspace\\motor\\parts'),
      file('C:\\workspace\\motor\\new.md'),
    ];

    expect(replaceDirectoryChildren(tree, 'C:\\workspace\\motor', refreshed, false)).toEqual([
      {
        ...directory('C:\\workspace\\motor', [
          directory('C:\\workspace\\motor\\parts', [file('C:\\workspace\\motor\\parts\\joint.md')]),
          file('C:\\workspace\\motor\\new.md'),
        ]),
        truncated: false,
      },
    ]);
  });
});
