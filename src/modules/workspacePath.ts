export function normalizeWorkspacePath(path: string): string {
  let normalized = path.replace(/\\/g, '/');
  if (normalized.toLowerCase().startsWith('//?/unc/')) {
    normalized = `//${normalized.slice(8)}`;
  } else if (normalized.startsWith('//?/')) {
    normalized = normalized.slice(4);
  }
  return normalized.replace(/\/+$/, '').toLocaleLowerCase();
}

export function pathBelongsToDirectory(path: string | null, directory: string): boolean {
  if (!path) return false;
  const normalizedPath = normalizeWorkspacePath(path);
  const normalizedDirectory = normalizeWorkspacePath(directory);
  return (
    normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

export function workspacePathsEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (left == null || right == null) return left == null && right == null;
  return normalizeWorkspacePath(left) === normalizeWorkspacePath(right);
}

export function parentDirectory(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return separatorIndex > 0 ? path.slice(0, separatorIndex) : path;
}
