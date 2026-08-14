import { describe, expect, it } from 'vitest';
import { getEditorLanguage, getFileViewKind } from './fileTree';

describe('file type routing', () => {
  it('routes markdown to WYSIWYG and source files to the code editor', () => {
    expect(getFileViewKind('README.md')).toBe('markdown');
    expect(getFileViewKind('notes.mdx')).toBe('markdown');
    expect(getFileViewKind('src/App.tsx')).toBe('code');
    expect(getFileViewKind('config.yaml')).toBe('code');
    expect(getFileViewKind('photo.png')).toBe('image');
    expect(getFileViewKind('cover.WEBP')).toBe('image');
  });

  it('maps common extensions to Monaco language identifiers', () => {
    expect(getEditorLanguage('component.tsx')).toBe('typescript');
    expect(getEditorLanguage('script.py')).toBe('python');
    expect(getEditorLanguage('.env')).toBe('ini');
    expect(getEditorLanguage('README')).toBe('plaintext');
  });
});
