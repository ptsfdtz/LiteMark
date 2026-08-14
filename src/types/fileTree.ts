export interface FileTreeNode {
  path: string;
  name: string;
  is_directory: boolean;
  extension: string | null;
  children: FileTreeNode[];
}

export type FileViewKind = 'markdown' | 'code' | 'image' | 'unsupported';

function getExtension(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? '';
  const lastDot = name.lastIndexOf('.');
  if (lastDot > 0) return name.slice(lastDot + 1).toLowerCase();
  if (lastDot === 0 && name.indexOf('.', 1) === -1) return name.slice(1).toLowerCase();
  return '';
}

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd', 'mdx']);
const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'webp']);
const CODE_EXTENSIONS = new Set([
  'c',
  'cc',
  'conf',
  'cpp',
  'cs',
  'css',
  'csv',
  'env',
  'go',
  'h',
  'hpp',
  'html',
  'ini',
  'java',
  'js',
  'json',
  'jsx',
  'log',
  'lua',
  'php',
  'properties',
  'py',
  'rb',
  'rs',
  'scss',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

export function getFileViewKind(path: string): FileViewKind {
  const extension = getExtension(path);
  if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (CODE_EXTENSIONS.has(extension)) return 'code';
  return 'unsupported';
}

export function getEditorLanguage(path: string): string {
  const extension = getExtension(path);
  const aliases: Record<string, string> = {
    cc: 'cpp',
    conf: 'ini',
    env: 'ini',
    h: 'cpp',
    hpp: 'cpp',
    jsx: 'javascript',
    json: 'javascript',
    log: 'plaintext',
    mdown: 'markdown',
    mdx: 'markdown',
    mkd: 'markdown',
    properties: 'ini',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sh: 'shell',
    ts: 'typescript',
    tsx: 'typescript',
    txt: 'plaintext',
    toml: 'ini',
    yml: 'yaml',
  };
  return aliases[extension] ?? (extension || 'plaintext');
}
