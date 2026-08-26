use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
struct SearchFilesArgs {
    query: String,
    limit: Option<usize>,
}

#[derive(Deserialize)]
struct GrepArgs {
    query: String,
    path: Option<String>,
    case_sensitive: Option<bool>,
    context_lines: Option<usize>,
    limit: Option<usize>,
}

#[derive(Serialize)]
struct SearchResult<T> {
    matches: Vec<T>,
    truncated: bool,
}

#[derive(Serialize)]
struct FileMatch {
    path: String,
}

#[derive(Serialize)]
struct TextMatch {
    path: String,
    line: usize,
    text: String,
    context: Vec<ContextLine>,
}

#[derive(Serialize)]
struct ContextLine {
    line: usize,
    text: String,
}

fn text_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    fn visit(root: &Path, dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
        for entry in std::fs::read_dir(dir).map_err(|e| format!("cannot read directory: {e}"))? {
            let entry = entry.map_err(|e| format!("cannot read directory entry: {e}"))?;
            let path = entry.path();
            if path.is_dir() {
                if path
                    .file_name()
                    .and_then(|v| v.to_str())
                    .is_some_and(|v| matches!(v, ".git" | "node_modules" | "target"))
                {
                    continue;
                }
                visit(root, &path, files)?;
            } else if crate::document_storage::is_text_extension(&path) {
                let canonical = path
                    .canonicalize()
                    .map_err(|e| format!("cannot resolve file: {e}"))?;
                if canonical.starts_with(root) {
                    files.push(canonical);
                }
            }
        }
        Ok(())
    }
    let root = root
        .canonicalize()
        .map_err(|e| format!("cannot resolve the working directory: {e}"))?;
    let mut files = Vec::new();
    visit(&root, &root, &mut files)?;
    files.sort();
    Ok(files)
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn wildcard_match(pattern: &str, value: &str) -> bool {
    let (p, v) = (pattern.as_bytes(), value.as_bytes());
    let (mut pi, mut vi, mut star, mut mark) = (0, 0, None, 0);
    while vi < v.len() {
        if pi < p.len() && (p[pi] == b'?' || p[pi] == v[vi]) {
            pi += 1;
            vi += 1;
        } else if pi < p.len() && p[pi] == b'*' {
            star = Some(pi);
            pi += 1;
            mark = vi;
        } else if let Some(s) = star {
            pi = s + 1;
            mark += 1;
            vi = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == b'*' {
        pi += 1;
    }
    pi == p.len()
}

pub(super) fn search_files(arguments: &str, work_dir: Option<&Path>) -> Result<String, String> {
    let args: SearchFilesArgs =
        serde_json::from_str(arguments).map_err(|e| format!("invalid arguments: {e}"))?;
    let root = work_dir
        .ok_or_else(|| "no working directory is set.".to_string())?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let query = args.query.trim().to_lowercase();
    if query.is_empty() {
        return Err("query must not be empty.".into());
    }
    let limit = args.limit.unwrap_or(100).clamp(1, 200);
    let wildcard = query.contains(['*', '?']);
    let all = text_files(&root)?;
    let mut matches = Vec::new();
    for path in all {
        let rel = relative(&root, &path);
        let candidate = rel.to_lowercase();
        if (wildcard && wildcard_match(&query, &candidate))
            || (!wildcard && candidate.contains(&query))
        {
            if matches.len() == limit {
                break;
            }
            matches.push(FileMatch { path: rel });
        }
    }
    let truncated = matches.len() == limit;
    serde_json::to_string(&SearchResult { matches, truncated }).map_err(|e| e.to_string())
}

pub(super) fn grep_text(arguments: &str, work_dir: Option<&Path>) -> Result<String, String> {
    let args: GrepArgs =
        serde_json::from_str(arguments).map_err(|e| format!("invalid arguments: {e}"))?;
    let root = work_dir
        .ok_or_else(|| "no working directory is set.".to_string())?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if args.query.is_empty() {
        return Err("query must not be empty.".into());
    }
    let scope = match args.path.as_deref() {
        Some(path) => super::filesystem::resolve_workspace_scope(&root, path)?,
        None => root.clone(),
    };
    let files = if scope.is_file() {
        if !crate::document_storage::is_text_extension(&scope) {
            return Err("only text files (.md, .markdown, .txt) can be searched.".into());
        }
        vec![scope]
    } else {
        text_files(&scope)?
    };
    let needle = if args.case_sensitive.unwrap_or(false) {
        args.query.clone()
    } else {
        args.query.to_lowercase()
    };
    let context_count = args.context_lines.unwrap_or(1).min(5);
    let limit = args.limit.unwrap_or(100).clamp(1, 200);
    let mut matches = Vec::new();
    'files: for path in files {
        let content = crate::document_storage::read_text_file(&path).map_err(|e| e.to_string())?;
        let lines: Vec<&str> = content.lines().collect();
        for (index, line) in lines.iter().enumerate() {
            let haystack = if args.case_sensitive.unwrap_or(false) {
                (*line).to_string()
            } else {
                line.to_lowercase()
            };
            if haystack.contains(&needle) {
                if matches.len() == limit {
                    break 'files;
                }
                let start = index.saturating_sub(context_count);
                let end = (index + context_count + 1).min(lines.len());
                let context = (start..end)
                    .filter(|i| *i != index)
                    .map(|i| ContextLine {
                        line: i + 1,
                        text: lines[i].to_string(),
                    })
                    .collect();
                matches.push(TextMatch {
                    path: relative(&root, &path),
                    line: index + 1,
                    text: (*line).to_string(),
                    context,
                });
            }
        }
    }
    let truncated = matches.len() == limit;
    serde_json::to_string(&SearchResult { matches, truncated }).map_err(|e| e.to_string())
}
