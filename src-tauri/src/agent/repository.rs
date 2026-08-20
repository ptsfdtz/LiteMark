use std::collections::HashMap;
use std::path::{Path, PathBuf};

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
