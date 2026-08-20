use serde::Deserialize;
use std::path::{Component, Path, PathBuf};

#[derive(Deserialize)]
pub(crate) struct WriteFileArgs {
    pub(crate) path: String,
    pub(crate) content: String,
}

#[derive(Deserialize)]
struct ReadFileArgs {
    path: String,
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
