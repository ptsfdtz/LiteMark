use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const MAX_RECENT_FILES: usize = 50;

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
pub enum Theme {
    Light,
    Dark,
    #[default]
    System,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct Settings {
    pub theme: Theme,
    pub recent_files: Vec<PathBuf>,
    pub editor_width: f32,
}

impl Settings {
    pub fn load(storage: Option<&dyn eframe::Storage>) -> Self {
        storage
            .and_then(|storage| storage.get_string(eframe::APP_KEY))
            .and_then(|value| serde_json::from_str(&value).ok())
            .map(|mut settings: Self| {
                if !(0.2..=0.8).contains(&settings.editor_width) {
                    settings.editor_width = 0.5;
                }
                settings
            })
            .unwrap_or_else(|| Self {
                editor_width: 0.5,
                ..Default::default()
            })
    }

    pub fn remember(&mut self, path: PathBuf) {
        self.recent_files.retain(|candidate| candidate != &path);
        self.recent_files.insert(0, path);
        self.recent_files.truncate(MAX_RECENT_FILES);
    }
}
