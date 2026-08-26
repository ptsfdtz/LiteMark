use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use super::protocol::FileChange;

#[derive(Default)]
pub(crate) struct WriteJournal {
    originals: HashMap<PathBuf, Option<String>>,
    committed: bool,
}

impl WriteJournal {
    pub(crate) fn capture(&mut self, path: &Path) -> Result<(), String> {
        if self.originals.contains_key(path) {
            return Ok(());
        }
        let original = if path.exists() {
            Some(crate::document_storage::read_text_file(path).map_err(|error| error.to_string())?)
        } else {
            None
        };
        self.originals.insert(path.to_path_buf(), original);
        Ok(())
    }

    pub(crate) fn commit(&mut self) {
        self.committed = true;
    }

    pub(crate) fn checkpoint(
        mut self,
        id: String,
        work_dir: &Path,
    ) -> Result<Vec<FileChange>, String> {
        let mut changes = Vec::new();
        for (path, original) in &self.originals {
            let after = if path.exists() {
                crate::document_storage::read_text_file(path).map_err(|e| e.to_string())?
            } else {
                String::new()
            };
            let before = original.clone().unwrap_or_default();
            if before == after {
                continue;
            }
            let (added, removed) = line_stats(&before, &after);
            changes.push(FileChange {
                path: path
                    .strip_prefix(work_dir)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .replace('\\', "/"),
                added,
                removed,
                status: if original.is_none() {
                    "created".into()
                } else if !path.exists() {
                    "deleted".into()
                } else {
                    "modified".into()
                },
                before,
                after,
            });
        }
        changes.sort_by(|a, b| a.path.cmp(&b.path));
        if !changes.is_empty() {
            checkpoints()
                .lock()
                .map_err(|_| "checkpoint store is unavailable".to_string())?
                .insert(
                    id,
                    Checkpoint {
                        work_dir: work_dir.to_path_buf(),
                        originals: std::mem::take(&mut self.originals),
                    },
                );
        }
        self.committed = true;
        Ok(changes)
    }
}

struct Checkpoint {
    work_dir: PathBuf,
    originals: HashMap<PathBuf, Option<String>>,
}
static CHECKPOINTS: OnceLock<Mutex<HashMap<String, Checkpoint>>> = OnceLock::new();
fn checkpoints() -> &'static Mutex<HashMap<String, Checkpoint>> {
    CHECKPOINTS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub(crate) fn ensure_no_pending_checkpoint(work_dir: &Path) -> Result<(), String> {
    let root = work_dir.canonicalize().map_err(|e| e.to_string())?;
    let store = checkpoints()
        .lock()
        .map_err(|_| "checkpoint store is unavailable".to_string())?;
    if store
        .values()
        .any(|checkpoint| checkpoint.work_dir.canonicalize().ok().as_ref() == Some(&root))
    {
        return Err("this workspace has unresolved agent changes; accept or revert them before starting another write task".into());
    }
    Ok(())
}

fn line_stats(before: &str, after: &str) -> (usize, usize) {
    let a: Vec<&str> = before.lines().collect();
    let b: Vec<&str> = after.lines().collect();
    let prefix = a.iter().zip(&b).take_while(|(x, y)| x == y).count();
    let suffix = a[prefix..]
        .iter()
        .rev()
        .zip(b[prefix..].iter().rev())
        .take_while(|(x, y)| x == y)
        .count();
    (
        b.len().saturating_sub(prefix + suffix),
        a.len().saturating_sub(prefix + suffix),
    )
}

pub(crate) fn accept_checkpoint(id: &str) -> Result<(), String> {
    checkpoints()
        .lock()
        .map_err(|_| "checkpoint store is unavailable".to_string())?
        .remove(id)
        .ok_or_else(|| "checkpoint not found or already resolved".to_string())?;
    Ok(())
}

pub(crate) fn revert_checkpoint(id: &str) -> Result<Vec<String>, String> {
    let checkpoint = checkpoints()
        .lock()
        .map_err(|_| "checkpoint store is unavailable".to_string())?
        .remove(id)
        .ok_or_else(|| "checkpoint not found or already resolved".to_string())?;
    let mut restored = Vec::new();
    for (path, original) in checkpoint.originals {
        match original {
            Some(content) => crate::document_storage::atomic_write_text_file(&path, &content)
                .map_err(|e| e.to_string())?,
            None if path.exists() => std::fs::remove_file(&path).map_err(|e| e.to_string())?,
            None => {}
        }
        restored.push(path.to_string_lossy().to_string());
    }
    Ok(restored)
}

impl Drop for WriteJournal {
    fn drop(&mut self) {
        if self.committed {
            return;
        }
        for (path, original) in &self.originals {
            match original {
                Some(content) => {
                    let _ = crate::document_storage::atomic_write_text_file(path, content);
                }
                None => {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
    }
}
