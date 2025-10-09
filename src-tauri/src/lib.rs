// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;
use std::fs::{read_to_string, write};
use std::path::{Path, PathBuf};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Read a UTF-8 text file from an absolute path and return its contents.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(path);
    read_to_string(file_path).map_err(|err| err.to_string())
}

/// Write UTF-8 text content to an absolute path, creating parent directories if needed.
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if let Some(parent_dir) = file_path.parent() {
        std::fs::create_dir_all(parent_dir).map_err(|err| err.to_string())?;
    }
    write(file_path, content).map_err(|err| err.to_string())
}

#[derive(Serialize)]
struct FileInfo {
    path: String,
    name: String,
    modified_ms: i64,
}

fn is_text_extension(path: &Path) -> bool {
    match path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
    {
        Some(ext) => matches!(ext.as_str(), "md" | "markdown" | "txt"),
        None => false,
    }
}

/// List markdown/text files in a directory (non-recursive), sorted by modified time desc.
#[tauri::command]
fn list_text_files(dir_path: String) -> Result<Vec<FileInfo>, String> {
    let dir = PathBuf::from(dir_path);
    let mut entries: Vec<FileInfo> = Vec::new();
    let read_dir = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry_res in read_dir {
        let entry = entry_res.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() || !is_text_extension(&path) {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let modified = metadata
            .modified()
            .unwrap_or_else(|_| std::time::SystemTime::UNIX_EPOCH);
        let modified_ms = modified
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        entries.push(FileInfo {
            path: path.to_string_lossy().to_string(),
            name,
            modified_ms,
        });
    }
    entries.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(entries)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            read_text_file,
            write_text_file,
            list_text_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
