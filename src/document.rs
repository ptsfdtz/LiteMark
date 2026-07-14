use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const PREVIEW_DEBOUNCE: Duration = Duration::from_millis(180);

#[derive(Debug)]
pub struct Document {
    path: Option<PathBuf>,
    text: String,
    preview_text: String,
    dirty: bool,
    changed_at: Option<Instant>,
}

impl Default for Document {
    fn default() -> Self {
        Self {
            path: None,
            text: String::new(),
            preview_text: String::new(),
            dirty: false,
            changed_at: None,
        }
    }
}

impl Document {
    pub fn text_mut(&mut self) -> &mut String {
        &mut self.text
    }

    pub fn preview_text(&self) -> &str {
        &self.preview_text
    }

    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    pub fn title(&self) -> String {
        let name = self
            .path
            .as_deref()
            .and_then(Path::file_name)
            .and_then(|name| name.to_str())
            .unwrap_or("Untitled");
        format!("{}{} - LiteMark", if self.dirty { "*" } else { "" }, name)
    }

    pub fn mark_changed(&mut self) {
        self.dirty = true;
        self.changed_at = Some(Instant::now());
    }

    pub fn refresh_preview_if_due(&mut self) -> bool {
        let Some(changed_at) = self.changed_at else {
            return false;
        };
        if changed_at.elapsed() < PREVIEW_DEBOUNCE {
            return false;
        }
        self.preview_text.clone_from(&self.text);
        self.changed_at = None;
        true
    }

    pub fn open(path: PathBuf) -> std::io::Result<Self> {
        let text = std::fs::read_to_string(&path)?;
        Ok(Self {
            path: Some(path),
            preview_text: text.clone(),
            text,
            dirty: false,
            changed_at: None,
        })
    }

    pub fn save(&mut self) -> std::io::Result<()> {
        let path = self.path.as_deref().ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "document has no path")
        })?;
        std::fs::write(path, &self.text)?;
        self.dirty = false;
        Ok(())
    }

    pub fn save_as(&mut self, path: PathBuf) -> std::io::Result<()> {
        self.path = Some(path);
        self.save()
    }
}
