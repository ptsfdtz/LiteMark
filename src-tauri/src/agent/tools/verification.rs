use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Clone, Copy)]
pub(crate) enum CheckKind {
    All,
    Links,
    Headings,
    DuplicateTitles,
    BrokenReferences,
}

#[derive(Deserialize)]
struct CheckArgs {
    paths: Option<Vec<String>>,
}

#[derive(Serialize)]
struct Report {
    ok: bool,
    files_checked: usize,
    errors: usize,
    warnings: usize,
    findings: Vec<Finding>,
}

#[derive(Serialize)]
struct Finding {
    severity: &'static str,
    code: &'static str,
    path: String,
    line: usize,
    message: String,
}

fn markdown_files(root: &Path, args: CheckArgs) -> Result<Vec<PathBuf>, String> {
    if let Some(paths) = args.paths {
        if paths.len() > 50 {
            return Err("at most 50 files can be checked at once.".into());
        }
        return paths
            .into_iter()
            .map(|p| {
                let path = super::filesystem::resolve_work_path(root, &p)?;
                if !path
                    .extension()
                    .and_then(|v| v.to_str())
                    .is_some_and(|v| matches!(v.to_ascii_lowercase().as_str(), "md" | "markdown"))
                {
                    return Err(format!(
                        "Markdown verification only supports .md and .markdown files: {p}"
                    ));
                }
                Ok(path)
            })
            .collect();
    }
    fn visit(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
        for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
            let path = entry.map_err(|e| e.to_string())?.path();
            if path.is_dir() {
                if path
                    .file_name()
                    .and_then(|v| v.to_str())
                    .is_some_and(|v| matches!(v, ".git" | "node_modules" | "target"))
                {
                    continue;
                }
                visit(&path, out)?;
            } else if path
                .extension()
                .and_then(|v| v.to_str())
                .is_some_and(|v| matches!(v.to_ascii_lowercase().as_str(), "md" | "markdown"))
            {
                out.push(path);
            }
        }
        Ok(())
    }
    let mut files = Vec::new();
    visit(root, &mut files)?;
    files.sort();
    Ok(files)
}

fn slug(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .filter_map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                Some(c)
            } else if c.is_whitespace() {
                Some('-')
            } else {
                None
            }
        })
        .collect()
}

fn rel(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

pub(crate) fn check(
    arguments: &str,
    work_dir: Option<&Path>,
    kind: CheckKind,
) -> Result<String, String> {
    let args: CheckArgs =
        serde_json::from_str(arguments).map_err(|e| format!("invalid arguments: {e}"))?;
    let root = work_dir
        .ok_or_else(|| "no working directory is set.".to_string())?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let files = markdown_files(&root, args)?;
    let link_re = Regex::new(r#"!?\[[^\]]*\]\(([^)]+)\)"#).unwrap();
    let mut findings = Vec::new();
    let mut titles: HashMap<String, Vec<(String, usize)>> = HashMap::new();
    let mut heading_cache: HashMap<PathBuf, HashSet<String>> = HashMap::new();
    let mut contents = Vec::new();
    for path in &files {
        let content = crate::document_storage::read_text_file(path).map_err(|e| e.to_string())?;
        let mut headings = HashSet::new();
        let mut previous_level = 0;
        let mut seen = HashSet::new();
        let relative = rel(&root, path);
        for (index, line) in content.lines().enumerate() {
            if let Some(raw) = line.strip_prefix('#') {
                let hashes = line.len() - raw.len();
                if hashes <= 6 && raw.starts_with(' ') {
                    let title = raw.trim().to_string();
                    let anchor = slug(&title);
                    headings.insert(anchor.clone());
                    if matches!(kind, CheckKind::All | CheckKind::Headings) {
                        if previous_level > 0 && hashes > previous_level + 1 {
                            findings.push(Finding {
                                severity: "warning",
                                code: "heading-level-skip",
                                path: relative.clone(),
                                line: index + 1,
                                message: format!(
                                    "heading jumps from level {previous_level} to {hashes}"
                                ),
                            });
                        }
                        if !seen.insert(anchor) {
                            findings.push(Finding {
                                severity: "warning",
                                code: "duplicate-heading",
                                path: relative.clone(),
                                line: index + 1,
                                message: format!("duplicate heading: {title}"),
                            });
                        }
                    }
                    previous_level = hashes;
                    if hashes == 1 {
                        titles
                            .entry(title.to_lowercase())
                            .or_default()
                            .push((relative.clone(), index + 1));
                    }
                }
            }
        }
        heading_cache.insert(path.canonicalize().map_err(|e| e.to_string())?, headings);
        contents.push((path.clone(), relative, content));
    }
    if matches!(kind, CheckKind::All | CheckKind::DuplicateTitles) {
        for (title, locations) in titles {
            if locations.len() > 1 {
                for (path, line) in locations {
                    findings.push(Finding {
                        severity: "warning",
                        code: "duplicate-title",
                        path,
                        line,
                        message: format!("top-level title appears in multiple files: {title}"),
                    });
                }
            }
        }
    }
    if matches!(
        kind,
        CheckKind::All | CheckKind::Links | CheckKind::BrokenReferences
    ) {
        for (path, relative, content) in &contents {
            for (index, line) in content.lines().enumerate() {
                for captures in link_re.captures_iter(line) {
                    let raw = captures[1].trim().trim_matches(['<', '>']);
                    if raw.is_empty() {
                        findings.push(Finding {
                            severity: "error",
                            code: "empty-link",
                            path: relative.clone(),
                            line: index + 1,
                            message: "link target is empty".into(),
                        });
                        continue;
                    }
                    if raw.starts_with(['/', '\\'])
                        || raw.contains("://")
                        || raw.starts_with("mailto:")
                    {
                        continue;
                    }
                    let (target, anchor) = raw
                        .split_once('#')
                        .map_or((raw, None), |(a, b)| (a, Some(b)));
                    let decoded = target.replace("%20", " ");
                    let target_path = if decoded.is_empty() {
                        path.clone()
                    } else {
                        path.parent().unwrap_or(&root).join(decoded)
                    };
                    let resolved = match target_path.canonicalize() {
                        Ok(p) if p.starts_with(&root) => p,
                        _ => {
                            findings.push(Finding {
                                severity: "error",
                                code: "broken-reference",
                                path: relative.clone(),
                                line: index + 1,
                                message: format!("local target not found: {raw}"),
                            });
                            continue;
                        }
                    };
                    if let Some(anchor) = anchor {
                        let anchors = heading_cache.get(&resolved).cloned().unwrap_or_else(|| {
                            std::fs::read_to_string(&resolved)
                                .ok()
                                .map(|text| {
                                    text.lines()
                                        .filter_map(|line| {
                                            let body = line.trim_start_matches('#');
                                            (body.len() != line.len() && body.starts_with(' '))
                                                .then(|| slug(body.trim()))
                                        })
                                        .collect()
                                })
                                .unwrap_or_default()
                        });
                        if !anchors.contains(&slug(anchor)) {
                            findings.push(Finding {
                                severity: "error",
                                code: "broken-anchor",
                                path: relative.clone(),
                                line: index + 1,
                                message: format!("heading anchor not found: {raw}"),
                            });
                        }
                    }
                }
            }
        }
    }
    findings.sort_by(|a, b| a.path.cmp(&b.path).then(a.line.cmp(&b.line)));
    let errors = findings.iter().filter(|f| f.severity == "error").count();
    let warnings = findings.len() - errors;
    serde_json::to_string(&Report {
        ok: errors == 0,
        files_checked: files.len(),
        errors,
        warnings,
        findings,
    })
    .map_err(|e| e.to_string())
}
