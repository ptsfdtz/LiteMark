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

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub modified_ms: i64,
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
mod tests {
    use super::atomic_write_text_file;
    use super::create_untitled_file;
    use super::document_parent;
    use super::read_text_file;
    use super::rename_document;
    use super::StorageErrorCategory;
    use std::fs;
    use std::path::Path;

    #[cfg(unix)]
    use super::rename_via_hard_link;
    #[cfg(unix)]
    use std::io;

    #[test]
    fn creating_an_untitled_document_writes_content_and_preserves_existing_files() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let existing_path = directory.path().join("untitled.md");
        fs::write(&existing_path, "existing content").expect("seed existing document");

        let created_path =
            create_untitled_file(directory.path(), "# New document\n").expect("create document");

        assert_ne!(created_path, existing_path);
        assert_eq!(
            fs::read_to_string(existing_path).expect("read existing document"),
            "existing content"
        );
        assert_eq!(
            fs::read_to_string(created_path).expect("read new document"),
            "# New document\n"
        );
    }

    #[test]
    fn bare_document_paths_use_the_current_directory_as_their_parent() {
        assert_eq!(
            document_parent(Path::new("document.md")).expect("document parent"),
            Path::new(".")
        );
    }

    #[test]
    fn saving_replaces_the_document_atomically() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let document_path = directory.path().join("document.md");
        let old_document_link = directory.path().join("old-document.md");
        fs::write(&document_path, "old content").expect("seed document");
        fs::hard_link(&document_path, &old_document_link).expect("link old document");

        atomic_write_text_file(&document_path, "new content").expect("save document");

        assert_eq!(
            fs::read_to_string(&document_path).expect("read replaced document"),
            "new content"
        );
        assert_eq!(
            fs::read_to_string(old_document_link).expect("read old document link"),
            "old content"
        );
        assert_eq!(
            fs::read_dir(directory.path())
                .expect("read directory")
                .count(),
            2
        );
    }

    #[test]
    fn saving_does_not_treat_invalid_metadata_errors_as_a_missing_document() {
        let invalid_path = std::path::Path::new("invalid\0document.md");

        let error = atomic_write_text_file(invalid_path, "content")
            .expect_err("an invalid path must not be treated as a new document");

        assert_eq!(error.category, StorageErrorCategory::InvalidPath);
    }

    #[cfg(unix)]
    #[test]
    fn saving_preserves_unix_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().expect("temporary directory");
        let document_path = directory.path().join("document.md");
        fs::write(&document_path, "old content").expect("seed document");
        fs::set_permissions(&document_path, fs::Permissions::from_mode(0o640))
            .expect("set document permissions");

        atomic_write_text_file(&document_path, "new content").expect("save document");

        let mode = fs::metadata(&document_path)
            .expect("document metadata")
            .permissions()
            .mode()
            & 0o777;
        assert_eq!(mode, 0o640);
    }

    #[cfg(unix)]
    #[test]
    fn saving_through_a_symlink_updates_its_target() {
        use std::os::unix::fs::symlink;

        let directory = tempfile::tempdir().expect("temporary directory");
        let target_path = directory.path().join("target.md");
        let link_path = directory.path().join("link.md");
        fs::write(&target_path, "old content").expect("seed target document");
        symlink(&target_path, &link_path).expect("create document symlink");

        atomic_write_text_file(&link_path, "new content").expect("save through symlink");

        assert!(fs::symlink_metadata(&link_path)
            .expect("symlink metadata")
            .file_type()
            .is_symlink());
        assert_eq!(
            fs::read_to_string(target_path).expect("read symlink target"),
            "new content"
        );
    }

    #[test]
    fn missing_documents_have_a_stable_serializable_error() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let missing_path = directory.path().join("missing.md");

        let error = read_text_file(&missing_path).expect_err("missing document must fail");

        assert_eq!(
            serde_json::to_value(error).expect("serialize storage error"),
            serde_json::json!({
                "category": "not_found",
                "message": "Document not found."
            })
        );
    }

    #[test]
    fn renaming_a_document_uses_a_file_name_and_returns_the_new_path() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let current_path = directory.path().join("current.md");
        fs::write(&current_path, "document content").expect("seed document");

        let renamed_path = rename_document(&current_path, "renamed.md").expect("rename document");

        assert_eq!(renamed_path, directory.path().join("renamed.md"));
        assert!(!current_path.exists());
        assert_eq!(
            fs::read_to_string(renamed_path).expect("read renamed document"),
            "document content"
        );
    }

    #[test]
    fn renaming_rejects_empty_or_path_like_names() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let current_path = directory.path().join("current.md");
        fs::write(&current_path, "document content").expect("seed document");

        for invalid_name in ["", ".", "..", "nested/name.md", "nested\\name.md"] {
            let error = rename_document(&current_path, invalid_name)
                .expect_err("path-like name must be rejected");

            assert_eq!(
                serde_json::to_value(error).expect("serialize storage error"),
                serde_json::json!({
                    "category": "invalid_name",
                    "message": "Invalid document name."
                })
            );
            assert_eq!(
                fs::read_to_string(&current_path).expect("read original document"),
                "document content"
            );
        }
    }

    #[test]
    fn renaming_never_overwrites_an_existing_document() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let current_path = directory.path().join("current.md");
        let existing_path = directory.path().join("existing.md");
        fs::write(&current_path, "current content").expect("seed current document");
        fs::write(&existing_path, "existing content").expect("seed existing document");

        let error = rename_document(&current_path, "existing.md")
            .expect_err("existing document must not be overwritten");

        assert_eq!(
            serde_json::to_value(error).expect("serialize storage error"),
            serde_json::json!({
                "category": "already_exists",
                "message": "A document with that name already exists."
            })
        );
        assert_eq!(
            fs::read_to_string(current_path).expect("read current document"),
            "current content"
        );
        assert_eq!(
            fs::read_to_string(existing_path).expect("read existing document"),
            "existing content"
        );
    }

    #[cfg(unix)]
    #[test]
    fn hard_link_rename_fallback_moves_without_replacing() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let current_path = directory.path().join("current.md");
        let renamed_path = directory.path().join("renamed.md");
        fs::write(&current_path, "document content").expect("seed document");

        rename_via_hard_link(&current_path, &renamed_path).expect("fallback rename document");

        assert!(!current_path.exists());
        assert_eq!(
            fs::read_to_string(renamed_path).expect("read renamed document"),
            "document content"
        );
    }

    #[cfg(unix)]
    #[test]
    fn hard_link_rename_fallback_preserves_an_existing_destination() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let current_path = directory.path().join("current.md");
        let existing_path = directory.path().join("existing.md");
        fs::write(&current_path, "current content").expect("seed current document");
        fs::write(&existing_path, "existing content").expect("seed existing document");

        let error = rename_via_hard_link(&current_path, &existing_path)
            .expect_err("fallback must not replace an existing document");

        assert_eq!(error.kind(), io::ErrorKind::AlreadyExists);
        assert_eq!(
            fs::read_to_string(current_path).expect("read current document"),
            "current content"
        );
        assert_eq!(
            fs::read_to_string(existing_path).expect("read existing document"),
            "existing content"
        );
    }

    #[cfg(any(target_vendor = "apple", target_os = "linux", target_os = "android"))]
    #[test]
    fn rename_fallback_only_handles_unsupported_noreplace_errors() {
        use super::rename_noreplace_is_unsupported;
        use rustix::io::Errno;

        for unsupported_error in [Errno::NOSYS, Errno::INVAL, Errno::NOTSUP, Errno::OPNOTSUPP] {
            assert!(rename_noreplace_is_unsupported(unsupported_error));
        }

        for operation_error in [Errno::EXIST, Errno::ACCES, Errno::NOENT] {
            assert!(!rename_noreplace_is_unsupported(operation_error));
        }
    }
}
