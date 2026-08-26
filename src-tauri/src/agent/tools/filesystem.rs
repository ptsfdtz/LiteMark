use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

#[derive(Deserialize)]
pub(crate) struct WriteFileArgs {
    pub(crate) path: String,
    pub(crate) content: String,
}

#[derive(Deserialize)]
pub(crate) struct WriteFilesArgs {
    pub(crate) files: Vec<WriteFileArgs>,
}

#[derive(Deserialize)]
struct ReadFileArgs {
    path: String,
}

#[derive(Deserialize)]
struct ReadFilesArgs {
    paths: Vec<String>,
}

#[derive(Serialize)]
struct ReadFileResult {
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    truncated: bool,
}

#[derive(Serialize)]
struct ReadFilesResult {
    files: Vec<ReadFileResult>,
    truncated: bool,
}

#[derive(Serialize)]
struct WrittenFileResult {
    path: String,
    characters: usize,
}

#[derive(Serialize)]
struct WriteFilesResult {
    files: Vec<WrittenFileResult>,
}

pub(crate) fn resolve_work_path(work_dir: &Path, requested: &str) -> Result<PathBuf, String> {
    if requested.trim().is_empty() {
        return Err("path must not be empty.".to_string());
    }
    let requested_path = Path::new(requested);
    let candidate = if requested_path.is_absolute() {
        requested_path.to_path_buf()
    } else {
        work_dir.join(requested_path)
    };
    let canonical_work = work_dir
        .canonicalize()
        .map_err(|error| format!("cannot resolve the working directory: {error}"))?;
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|_| format!("file not found: {requested}"))?;
    if !canonical_candidate.starts_with(&canonical_work) {
        return Err("path is outside the working directory.".to_string());
    }
    if !crate::document_storage::is_text_extension(&canonical_candidate) {
        return Err("only text files (.md, .markdown, .txt) can be read.".to_string());
    }
    Ok(canonical_candidate)
}

pub(crate) fn resolve_workspace_scope(work_dir: &Path, requested: &str) -> Result<PathBuf, String> {
    if requested.trim().is_empty() {
        return Err("path must not be empty.".to_string());
    }
    let requested = Path::new(requested);
    let candidate = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        work_dir.join(requested)
    };
    let root = work_dir
        .canonicalize()
        .map_err(|e| format!("cannot resolve the working directory: {e}"))?;
    let resolved = candidate
        .canonicalize()
        .map_err(|_| format!("path not found: {}", requested.display()))?;
    if !resolved.starts_with(root) {
        return Err("path is outside the working directory.".into());
    }
    Ok(resolved)
}

pub(crate) fn resolve_work_path_for_write(
    work_dir: &Path,
    requested: &str,
) -> Result<PathBuf, String> {
    if requested.trim().is_empty() {
        return Err("path must not be empty.".to_string());
    }
    let requested_path = Path::new(requested);
    if !requested_path.is_absolute()
        && requested_path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("path is outside the working directory.".to_string());
    }
    let candidate = if requested_path.is_absolute() {
        requested_path.to_path_buf()
    } else {
        work_dir.join(requested_path)
    };
    let canonical_work = work_dir
        .canonicalize()
        .map_err(|error| format!("cannot resolve the working directory: {error}"))?;
    let parent = candidate
        .parent()
        .ok_or_else(|| "invalid file path.".to_string())?;

    // Validate the nearest existing ancestor before creating anything. This prevents
    // rejected paths from leaving directories outside the workspace behind.
    let mut existing_ancestor = parent;
    while !existing_ancestor.exists() {
        existing_ancestor = existing_ancestor
            .parent()
            .ok_or_else(|| "cannot resolve the target directory.".to_string())?;
    }
    let canonical_ancestor = existing_ancestor
        .canonicalize()
        .map_err(|error| format!("cannot resolve the target directory: {error}"))?;
    if !canonical_ancestor.starts_with(&canonical_work) {
        return Err("path is outside the working directory.".to_string());
    }
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create the target directory: {error}"))?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("cannot resolve the target directory: {error}"))?;
    if !canonical_parent.starts_with(&canonical_work) {
        return Err("path is outside the working directory.".to_string());
    }
    let file_name = candidate
        .file_name()
        .ok_or_else(|| "invalid file name.".to_string())?;
    let resolved = canonical_parent.join(file_name);
    if resolved.is_dir() {
        return Err("path is a directory.".to_string());
    }
    if !crate::document_storage::is_text_extension(&resolved) {
        return Err("only text files (.md, .markdown, .txt) can be written.".to_string());
    }
    Ok(resolved)
}

pub(super) fn list(work_dir: Option<&Path>) -> Result<String, String> {
    let directory = work_dir.ok_or("no working directory is set.".to_string())?;
    let files =
        crate::document_storage::list_text_files(directory).map_err(|error| error.to_string())?;
    if files.is_empty() {
        return Ok("No documents found in the working directory.".to_string());
    }
    Ok(files
        .iter()
        .map(|file| format!("- {}", file.name))
        .collect::<Vec<_>>()
        .join("\n"))
}

pub(super) fn read(arguments: &str, work_dir: Option<&Path>) -> Result<String, String> {
    let args: ReadFileArgs =
        serde_json::from_str(arguments).map_err(|error| format!("invalid arguments: {error}"))?;
    let directory = work_dir.ok_or("no working directory is set.".to_string())?;
    let path = resolve_work_path(directory, &args.path)?;
    crate::document_storage::read_text_file(&path).map_err(|error| error.to_string())
}

pub(super) fn read_many(arguments: &str, work_dir: Option<&Path>) -> Result<String, String> {
    let args: ReadFilesArgs =
        serde_json::from_str(arguments).map_err(|error| format!("invalid arguments: {error}"))?;
    if args.paths.is_empty() {
        return Err("paths must contain at least one file.".to_string());
    }
    if args.paths.len() > super::MAX_BATCH_READ_FILES {
        return Err(format!(
            "at most {} files can be read at once.",
            super::MAX_BATCH_READ_FILES
        ));
    }

    let directory = work_dir.ok_or("no working directory is set.".to_string())?;
    let mut seen = HashSet::new();
    let mut remaining = super::MAX_READ_CHARS;
    let mut batch_truncated = false;
    let mut files = Vec::with_capacity(args.paths.len());

    for requested in args.paths {
        if !seen.insert(requested.clone()) {
            return Err(format!("duplicate path: {requested}"));
        }

        let result = resolve_work_path(directory, &requested).and_then(|path| {
            crate::document_storage::read_text_file(&path).map_err(|e| e.to_string())
        });
        match result {
            Ok(content) => {
                let content_length = content.chars().count();
                let truncated = content_length > remaining;
                let content = if truncated {
                    content.chars().take(remaining).collect()
                } else {
                    content
                };
                remaining = remaining.saturating_sub(content.chars().count());
                batch_truncated |= truncated;
                files.push(ReadFileResult {
                    path: requested,
                    content: Some(content),
                    error: None,
                    truncated,
                });
            }
            Err(error) => files.push(ReadFileResult {
                path: requested,
                content: None,
                error: Some(error),
                truncated: false,
            }),
        }
    }

    serde_json::to_string(&ReadFilesResult {
        files,
        truncated: batch_truncated,
    })
    .map_err(|error| format!("cannot serialize batch read result: {error}"))
}

pub(super) fn write(arguments: &str, work_dir: Option<&Path>) -> Result<String, String> {
    let args: WriteFileArgs =
        serde_json::from_str(arguments).map_err(|error| format!("invalid arguments: {error}"))?;
    let directory = work_dir.ok_or("no working directory is set.".to_string())?;
    let path = resolve_work_path_for_write(directory, &args.path)?;
    crate::document_storage::atomic_write_text_file(&path, &args.content)
        .map_err(|error| error.to_string())?;
    let persisted = crate::document_storage::read_text_file(&path)
        .map_err(|error| format!("write verification failed: {error}"))?;
    if persisted != args.content {
        return Err("write verification failed: persisted content differs".to_string());
    }
    Ok(format!(
        "File written: {} ({} characters).",
        path.to_string_lossy(),
        args.content.chars().count()
    ))
}

pub(super) fn write_many(arguments: &str, work_dir: Option<&Path>) -> Result<String, String> {
    let args: WriteFilesArgs =
        serde_json::from_str(arguments).map_err(|error| format!("invalid arguments: {error}"))?;
    if args.files.is_empty() {
        return Err("files must contain at least one file.".to_string());
    }
    if args.files.len() > super::MAX_BATCH_WRITE_FILES {
        return Err(format!(
            "at most {} files can be written at once.",
            super::MAX_BATCH_WRITE_FILES
        ));
    }
    let directory = work_dir.ok_or("no working directory is set.".to_string())?;
    let mut seen = HashSet::new();
    let mut targets = Vec::with_capacity(args.files.len());
    for file in args.files {
        if !seen.insert(file.path.clone()) {
            return Err(format!("duplicate path: {}", file.path));
        }
        let path = resolve_work_path_for_write(directory, &file.path)?;
        targets.push((file, path));
    }

    let originals = targets
        .iter()
        .map(|(_, path)| {
            if path.exists() {
                crate::document_storage::read_text_file(path)
                    .map(Some)
                    .map_err(|error| error.to_string())
            } else {
                Ok(None)
            }
        })
        .collect::<Result<Vec<_>, String>>()?;

    for (written_count, (file, path)) in targets.iter().enumerate() {
        if let Err(error) = crate::document_storage::atomic_write_text_file(path, &file.content) {
            for ((_, written_path), original) in targets.iter().zip(&originals).take(written_count)
            {
                match original {
                    Some(content) => {
                        let _ =
                            crate::document_storage::atomic_write_text_file(written_path, content);
                    }
                    None => {
                        let _ = std::fs::remove_file(written_path);
                    }
                }
            }
            return Err(error.to_string());
        }
    }

    let files = targets
        .into_iter()
        .map(|(file, path)| WrittenFileResult {
            path: path.to_string_lossy().to_string(),
            characters: file.content.chars().count(),
        })
        .collect();
    serde_json::to_string(&WriteFilesResult { files })
        .map_err(|error| format!("cannot serialize batch write result: {error}"))
}
