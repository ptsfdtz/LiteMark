use serde::Serialize;
use std::cmp::Reverse;
use std::fmt;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

pub type StorageResult<T> = Result<T, StorageError>;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StorageErrorCategory {
    NotFound,
    AlreadyExists,
    PermissionDenied,
    InvalidName,
    InvalidPath,
    Io,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct StorageError {
    pub category: StorageErrorCategory,
    pub message: &'static str,
}

impl StorageError {
    fn new(category: StorageErrorCategory) -> Self {
        let message = match category {
            StorageErrorCategory::NotFound => "Document not found.",
            StorageErrorCategory::AlreadyExists => "A document with that name already exists.",
            StorageErrorCategory::PermissionDenied => "Permission denied.",
            StorageErrorCategory::InvalidName => "Invalid document name.",
            StorageErrorCategory::InvalidPath => "Invalid document path.",
            StorageErrorCategory::Io => "Document storage operation failed.",
        };

        Self { category, message }
    }

    pub(crate) fn io() -> Self {
        Self::new(StorageErrorCategory::Io)
    }
}

impl From<io::Error> for StorageError {
    fn from(error: io::Error) -> Self {
        let category = match error.kind() {
            io::ErrorKind::NotFound => StorageErrorCategory::NotFound,
            io::ErrorKind::AlreadyExists => StorageErrorCategory::AlreadyExists,
            io::ErrorKind::PermissionDenied => StorageErrorCategory::PermissionDenied,
            io::ErrorKind::InvalidInput => StorageErrorCategory::InvalidPath,
            _ => StorageErrorCategory::Io,
        };

        Self::new(category)
    }
}

impl fmt::Display for StorageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for StorageError {}

pub fn read_text_file(path: &Path) -> StorageResult<String> {
    fs::read_to_string(path).map_err(StorageError::from)
}

pub fn delete_file(path: &Path) -> StorageResult<()> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_file() {
        return Err(StorageError::new(StorageErrorCategory::InvalidPath));
    }

    let parent = document_parent(path)?;
    fs::remove_file(path)?;
    sync_directory(parent)?;
    Ok(())
}

/// Permanently remove a real directory and all of its contents. Symlinks are
/// deliberately rejected so a workspace action cannot traverse a link target.
pub fn delete_directory(path: &Path) -> StorageResult<()> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_dir() {
        return Err(StorageError::new(StorageErrorCategory::InvalidPath));
    }

    let parent = document_parent(path)?;
    fs::remove_dir_all(path)?;
    sync_directory(parent)?;
    Ok(())
}

pub fn is_image_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "avif" | "bmp" | "gif" | "jpeg" | "jpg" | "png" | "webp"
            )
        })
}

pub fn is_pdf_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub modified_ms: i64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct FileTreeNode {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub extension: Option<String>,
    pub children: Vec<FileTreeNode>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct DirectoryEntries {
    pub entries: Vec<FileTreeNode>,
    pub truncated: bool,
}

const IGNORED_DIRECTORY_NAMES: &[&str] = &[
    ".git",
    ".cache",
    ".next",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
];

const MAX_TREE_DEPTH: usize = 32;
const MAX_TREE_ENTRIES: usize = 10_000;
const MAX_DIRECTORY_ENTRIES: usize = 2_000;

fn should_ignore_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| IGNORED_DIRECTORY_NAMES.contains(&name))
}

fn scan_tree_level(
    directory: &Path,
    depth: usize,
    entry_count: &mut usize,
) -> StorageResult<Vec<FileTreeNode>> {
    if depth > MAX_TREE_DEPTH || *entry_count >= MAX_TREE_ENTRIES {
        return Ok(Vec::new());
    }

    let mut nodes = Vec::new();
    for entry in fs::read_dir(directory)? {
        if *entry_count >= MAX_TREE_ENTRIES {
            break;
        }

        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }

        let is_directory = file_type.is_dir();
        if is_directory && should_ignore_directory(&path) {
            continue;
        }

        *entry_count += 1;
        let children = if is_directory {
            scan_tree_level(&path, depth + 1, entry_count).unwrap_or_default()
        } else {
            Vec::new()
        };
        nodes.push(FileTreeNode {
            path: path.to_string_lossy().into_owned(),
            name: path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_owned(),
            is_directory,
            extension: path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.to_ascii_lowercase()),
            children,
        });
    }

    nodes.sort_by(|left, right| {
        right
            .is_directory
            .cmp(&left.is_directory)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(nodes)
}

pub fn list_directory_tree(directory: &Path) -> StorageResult<Vec<FileTreeNode>> {
    let mut entry_count = 0;
    scan_tree_level(directory, 0, &mut entry_count)
}

pub fn list_directory_entries(directory: &Path) -> StorageResult<DirectoryEntries> {
    let mut entries = Vec::new();
    let mut truncated = false;

    for entry in fs::read_dir(directory)? {
        if entries.len() >= MAX_DIRECTORY_ENTRIES {
            truncated = true;
            break;
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }
        let is_directory = file_type.is_dir();
        if is_directory && should_ignore_directory(&path) {
            continue;
        }
        entries.push(FileTreeNode {
            path: path.to_string_lossy().into_owned(),
            name: path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_owned(),
            is_directory,
            extension: path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.to_ascii_lowercase()),
            children: Vec::new(),
        });
    }

    entries.sort_by(|left, right| {
        right
            .is_directory
            .cmp(&left.is_directory)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(DirectoryEntries { entries, truncated })
}

pub fn is_text_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "markdown" | "txt"
            )
        })
}

pub fn list_text_files(directory: &Path) -> StorageResult<Vec<FileInfo>> {
    let mut documents = Vec::new();

    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || !is_text_extension(&path) {
            continue;
        }

        let metadata = entry.metadata()?;
        let modified = metadata
            .modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        documents.push(FileInfo {
            path: path.to_string_lossy().into_owned(),
            name: path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_owned(),
            modified_ms: modified
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64,
        });
    }

    documents.sort_by_key(|entry| Reverse(entry.modified_ms));
    Ok(documents)
}

fn document_parent(path: &Path) -> StorageResult<&Path> {
    let parent = path
        .parent()
        .ok_or_else(|| StorageError::new(StorageErrorCategory::InvalidPath))?;

    if parent.as_os_str().is_empty() {
        Ok(Path::new("."))
    } else {
        Ok(parent)
    }
}

pub fn create_untitled_file(directory: &Path, content: &str) -> StorageResult<PathBuf> {
    for suffix in 0_u64.. {
        let file_name = if suffix == 0 {
            "untitled.md".to_string()
        } else {
            format!("untitled-{suffix}.md")
        };
        let candidate = directory.join(file_name);

        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(mut file) => {
                if let Err(error) = file
                    .write_all(content.as_bytes())
                    .and_then(|()| file.sync_all())
                {
                    drop(file);
                    let _ = fs::remove_file(&candidate);
                    return Err(error.into());
                }

                drop(file);
                if let Err(error) = sync_directory(directory) {
                    let _ = fs::remove_file(&candidate);
                    return Err(error.into());
                }
                return Ok(candidate);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }

    unreachable!("the untitled suffix space is exhausted")
}

pub fn atomic_write_text_file(path: &Path, content: &str) -> StorageResult<()> {
    let write_path = match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => fs::canonicalize(path)?,
        Ok(_) => path.to_path_buf(),
        Err(error) if error.kind() == io::ErrorKind::NotFound => path.to_path_buf(),
        Err(error) => return Err(error.into()),
    };
    let parent = document_parent(&write_path)?;
    fs::create_dir_all(parent)?;
    let existing_permissions = match fs::metadata(&write_path) {
        Ok(metadata) => Some(metadata.permissions()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.into()),
    };

    let mut temporary_file = tempfile::NamedTempFile::new_in(parent)?;
    temporary_file.write_all(content.as_bytes())?;
    if let Some(permissions) = existing_permissions {
        temporary_file.as_file().set_permissions(permissions)?;
    }
    temporary_file.as_file().sync_all()?;
    let persisted_file = temporary_file
        .persist(&write_path)
        .map_err(|error| StorageError::from(error.error))?;
    drop(persisted_file);
    sync_directory(parent)?;

    Ok(())
}

#[cfg(unix)]
fn sync_directory(directory: &Path) -> io::Result<()> {
    fs::File::open(directory)?.sync_all()
}

#[cfg(not(unix))]
fn sync_directory(_directory: &Path) -> io::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn rename_via_hard_link(current_path: &Path, renamed_path: &Path) -> io::Result<()> {
    fs::hard_link(current_path, renamed_path)?;
    if let Err(remove_error) = fs::remove_file(current_path) {
        // Another process may have removed the source after the link succeeded.
        // In that case the destination is the remaining name for this file.
        if remove_error.kind() == io::ErrorKind::NotFound {
            return Ok(());
        }
        if let Err(rollback_error) = fs::remove_file(renamed_path) {
            return Err(io::Error::new(
                remove_error.kind(),
                format!(
                    "failed to remove the source after linking: {remove_error}; \
                     failed to remove the destination link during rollback: {rollback_error}"
                ),
            ));
        }
        return Err(remove_error);
    }
    Ok(())
}

#[cfg(any(target_vendor = "apple", target_os = "linux", target_os = "android"))]
fn rename_noreplace_is_unsupported(error: rustix::io::Errno) -> bool {
    error == rustix::io::Errno::NOSYS
        || error == rustix::io::Errno::INVAL
        || error == rustix::io::Errno::NOTSUP
        || error == rustix::io::Errno::OPNOTSUPP
}

#[cfg(any(target_vendor = "apple", target_os = "linux", target_os = "android"))]
fn rename_without_replacing(current_path: &Path, renamed_path: &Path) -> io::Result<()> {
    use rustix::fs::{renameat_with, RenameFlags, CWD};

    match renameat_with(CWD, current_path, CWD, renamed_path, RenameFlags::NOREPLACE) {
        Ok(()) => Ok(()),
        Err(error) if rename_noreplace_is_unsupported(error) => {
            rename_via_hard_link(current_path, renamed_path)
        }
        Err(error) => Err(error.into()),
    }
}

#[cfg(windows)]
fn rename_without_replacing(current_path: &Path, renamed_path: &Path) -> io::Result<()> {
    use std::iter;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::MoveFileW;

    let current_path: Vec<u16> = current_path
        .as_os_str()
        .encode_wide()
        .chain(iter::once(0))
        .collect();
    let renamed_path: Vec<u16> = renamed_path
        .as_os_str()
        .encode_wide()
        .chain(iter::once(0))
        .collect();

    // MoveFileW fails with ERROR_ALREADY_EXISTS and never replaces the target.
    if unsafe { MoveFileW(current_path.as_ptr(), renamed_path.as_ptr()) } == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(all(
    unix,
    not(any(target_vendor = "apple", target_os = "linux", target_os = "android"))
))]
fn rename_without_replacing(current_path: &Path, renamed_path: &Path) -> io::Result<()> {
    rename_via_hard_link(current_path, renamed_path)
}

#[cfg(not(any(unix, windows)))]
fn rename_without_replacing(current_path: &Path, renamed_path: &Path) -> io::Result<()> {
    if renamed_path.exists() {
        return Err(io::Error::from(io::ErrorKind::AlreadyExists));
    }
    fs::rename(current_path, renamed_path)
}

pub fn rename_document(current_path: &Path, new_name: &str) -> StorageResult<PathBuf> {
    if new_name.trim().is_empty()
        || matches!(new_name, "." | "..")
        || new_name.contains(['/', '\\', '\0'])
    {
        return Err(StorageError::new(StorageErrorCategory::InvalidName));
    }

    let parent = document_parent(current_path)?;
    let renamed_path = parent.join(new_name);

    rename_without_replacing(current_path, &renamed_path)?;
    sync_directory(parent)?;

    Ok(renamed_path)
}

#[cfg(test)]
#[path = "../test/document_storage.rs"]
mod tests;
