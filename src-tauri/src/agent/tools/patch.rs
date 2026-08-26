use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
pub(crate) struct ApplyPatchArgs {
    pub(crate) patch: String,
}

#[derive(Serialize)]
struct PatchResult {
    files: Vec<PatchedFile>,
}

#[derive(Serialize)]
struct PatchedFile {
    path: String,
    hunks: usize,
    added: usize,
    removed: usize,
    verification: Vec<String>,
}

struct FilePatch {
    path: String,
    hunks: Vec<Hunk>,
}
struct Hunk {
    old_start: Option<usize>,
    lines: Vec<PatchLine>,
}
enum PatchLine {
    Context(String),
    Add(String),
    Remove(String),
}

fn clean_header_path(value: &str) -> Result<String, String> {
    let value = value.split('\t').next().unwrap_or(value).trim();
    let value = value
        .strip_prefix("a/")
        .or_else(|| value.strip_prefix("b/"))
        .unwrap_or(value);
    if value == "/dev/null" {
        return Err("creating or deleting files via apply_patch is not supported; use write_file for new files.".into());
    }
    if value.is_empty() {
        return Err("patch file path is empty.".into());
    }
    Ok(value.to_string())
}

fn parse_range(header: &str) -> Result<usize, String> {
    let old = header
        .strip_prefix("@@ -")
        .and_then(|v| v.split(' ').next())
        .ok_or_else(|| format!("invalid hunk header: {header}"))?;
    old.split(',')
        .next()
        .unwrap_or(old)
        .parse::<usize>()
        .map_err(|_| format!("invalid hunk line number: {header}"))
}

fn parse(input: &str) -> Result<Vec<FilePatch>, String> {
    let lines: Vec<&str> = input.lines().collect();
    let mut files = Vec::new();
    let mut seen = HashSet::new();
    let mut i = 0;
    while i < lines.len() {
        if !lines[i].starts_with("--- ") {
            i += 1;
            continue;
        }
        let old_path = clean_header_path(&lines[i][4..])?;
        i += 1;
        if i >= lines.len() || !lines[i].starts_with("+++ ") {
            return Err(format!("missing +++ header after --- {old_path}"));
        }
        let new_path = clean_header_path(&lines[i][4..])?;
        if old_path != new_path {
            return Err("renaming files via apply_patch is not supported.".into());
        }
        if !seen.insert(old_path.clone()) {
            return Err(format!("duplicate patch target: {old_path}"));
        }
        i += 1;
        let mut hunks = Vec::new();
        while i < lines.len() && !lines[i].starts_with("--- ") {
            if lines[i] != "@@" && !lines[i].starts_with("@@ ") {
                i += 1;
                continue;
            }
            let old_start = if lines[i] == "@@" {
                None
            } else {
                Some(parse_range(lines[i])?)
            };
            i += 1;
            let mut patch_lines = Vec::new();
            while i < lines.len()
                && lines[i] != "@@"
                && !lines[i].starts_with("@@ ")
                && !lines[i].starts_with("--- ")
            {
                let line = lines[i];
                if line == "\\ No newline at end of file" {
                    i += 1;
                    continue;
                }
                let (prefix, text) =
                    line.split_at(line.char_indices().nth(1).map_or(line.len(), |(n, _)| n));
                match prefix {
                    " " => patch_lines.push(PatchLine::Context(text.to_string())),
                    "+" => patch_lines.push(PatchLine::Add(text.to_string())),
                    "-" => patch_lines.push(PatchLine::Remove(text.to_string())),
                    _ => return Err(format!("invalid patch line: {line}")),
                }
                i += 1;
            }
            if patch_lines.is_empty() {
                return Err(format!("empty hunk for {old_path}"));
            }
            hunks.push(Hunk {
                old_start,
                lines: patch_lines,
            });
        }
        if hunks.is_empty() {
            return Err(format!("patch for {old_path} contains no hunks"));
        }
        files.push(FilePatch {
            path: old_path,
            hunks,
        });
    }
    if files.is_empty() {
        return Err("patch contains no unified diff file headers.".into());
    }
    Ok(files)
}

fn locate_context_hunk(
    source: &[String],
    lines: &[PatchLine],
    path: &str,
) -> Result<usize, String> {
    let expected: Vec<&str> = lines
        .iter()
        .filter_map(|line| match line {
            PatchLine::Context(value) | PatchLine::Remove(value) => Some(value.as_str()),
            PatchLine::Add(_) => None,
        })
        .collect();
    if expected.is_empty() {
        return Err(format!(
            "cannot locate context-free hunk in {path}; include context or line numbers"
        ));
    }

    let matches: Vec<usize> = source
        .windows(expected.len())
        .enumerate()
        .filter_map(|(index, window)| {
            window
                .iter()
                .map(String::as_str)
                .eq(expected.iter().copied())
                .then_some(index)
        })
        .collect();
    match matches.as_slice() {
        [index] => Ok(*index),
        [] => Err(format!("patch context was not found in {path}")),
        _ => Err(format!(
            "patch context is ambiguous in {path}; include more context or line numbers"
        )),
    }
}

fn apply_hunks(
    content: &str,
    hunks: &[Hunk],
    path: &str,
) -> Result<(String, usize, usize, Vec<String>), String> {
    let trailing_newline = content.ends_with('\n');
    let mut source: Vec<String> = content.lines().map(str::to_string).collect();
    let mut offset: isize = 0;
    let mut added = 0;
    let mut removed = 0;
    let mut verification = Vec::new();
    for hunk in hunks {
        let index = match hunk.old_start {
            Some(old_start) => (old_start.saturating_sub(1) as isize + offset) as usize,
            None => locate_context_hunk(&source, &hunk.lines, path)?,
        };
        if index > source.len() {
            return Err(format!(
                "patch context is outside {path} at old line {}",
                hunk.old_start.unwrap_or_default()
            ));
        }
        let mut cursor = index;
        let mut replacement = Vec::new();
        let mut consumed = 0;
        for line in &hunk.lines {
            match line {
                PatchLine::Context(expected) => {
                    if source.get(cursor).map(String::as_str) != Some(expected.as_str()) {
                        return Err(format!(
                            "patch context mismatch in {path} at line {}: expected {:?}",
                            cursor + 1,
                            expected
                        ));
                    }
                    replacement.push(expected.clone());
                    cursor += 1;
                    consumed += 1;
                }
                PatchLine::Remove(expected) => {
                    if source.get(cursor).map(String::as_str) != Some(expected.as_str()) {
                        return Err(format!(
                            "patch removal mismatch in {path} at line {}: expected {:?}",
                            cursor + 1,
                            expected
                        ));
                    }
                    cursor += 1;
                    consumed += 1;
                    removed += 1;
                }
                PatchLine::Add(value) => {
                    replacement.push(value.clone());
                    added += 1;
                }
            }
        }
        let replacement_len = replacement.len();
        source.splice(index..index + consumed, replacement);
        offset += replacement_len as isize - consumed as isize;
        let end = (index + replacement_len).min(source.len());
        let preview_start = index.saturating_sub(1);
        verification.push(format!(
            "lines {}-{}: {}",
            preview_start + 1,
            end,
            source[preview_start..end].join("\n")
        ));
    }
    let mut output = source.join("\n");
    if trailing_newline {
        output.push('\n');
    }
    Ok((output, added, removed, verification))
}

pub(crate) fn target_paths(arguments: &str, work_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let args: ApplyPatchArgs =
        serde_json::from_str(arguments).map_err(|e| format!("invalid arguments: {e}"))?;
    parse(&args.patch)?
        .into_iter()
        .map(|file| super::filesystem::resolve_work_path(work_dir, &file.path))
        .collect()
}

pub(super) fn apply(arguments: &str, work_dir: Option<&Path>) -> Result<String, String> {
    let args: ApplyPatchArgs =
        serde_json::from_str(arguments).map_err(|e| format!("invalid arguments: {e}"))?;
    let root = work_dir.ok_or_else(|| "no working directory is set.".to_string())?;
    let patches = parse(&args.patch)?;
    let mut prepared = Vec::new();
    for file in patches {
        let path = super::filesystem::resolve_work_path(root, &file.path)?;
        let content = crate::document_storage::read_text_file(&path).map_err(|e| e.to_string())?;
        let (output, added, removed, verification) =
            apply_hunks(&content, &file.hunks, &file.path)?;
        prepared.push((
            path,
            output,
            PatchedFile {
                path: file.path,
                hunks: file.hunks.len(),
                added,
                removed,
                verification,
            },
        ));
    }
    for (path, output, _) in &prepared {
        crate::document_storage::atomic_write_text_file(path, output)
            .map_err(|e| format!("cannot apply patch to {}: {e}", path.display()))?;
    }
    for (path, output, _) in &prepared {
        let persisted = crate::document_storage::read_text_file(path)
            .map_err(|e| format!("patch verification failed for {}: {e}", path.display()))?;
        if &persisted != output {
            return Err(format!(
                "patch verification failed for {}: persisted content differs",
                path.display()
            ));
        }
    }
    serde_json::to_string(&PatchResult {
        files: prepared.into_iter().map(|(_, _, result)| result).collect(),
    })
    .map_err(|e| e.to_string())
}
