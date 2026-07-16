// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use document_storage::{FileInfo, StorageResult};
use std::env;
use std::path::{Path, PathBuf};

mod document_storage;

/// Read a UTF-8 text file from an absolute path and return its contents.
#[tauri::command]
fn read_text_file(path: String) -> StorageResult<String> {
    document_storage::read_text_file(Path::new(&path))
}

/// Atomically replace a UTF-8 text file, creating parent directories if needed.
#[tauri::command]
fn write_text_file(path: String, content: String) -> StorageResult<()> {
    document_storage::atomic_write_text_file(Path::new(&path), &content)
}

/// Create a markdown document with initial content without replacing an existing one.
#[tauri::command]
fn create_untitled_file(dir_path: String, content: String) -> StorageResult<String> {
    document_storage::create_untitled_file(Path::new(&dir_path), &content)
        .map(|path| path.to_string_lossy().into_owned())
}

/// List markdown/text files in a directory (non-recursive), sorted by modified time desc.
#[tauri::command]
fn list_text_files(dir_path: String) -> StorageResult<Vec<FileInfo>> {
    document_storage::list_text_files(Path::new(&dir_path))
}

/// Rename a document within its current directory without replacing another file.
#[tauri::command]
fn rename_document(path: String, new_name: String) -> StorageResult<String> {
    document_storage::rename_document(Path::new(&path), &new_name)
        .map(|path| path.to_string_lossy().into_owned())
}

/// Return the first CLI argument that looks like a markdown/text file path.
#[tauri::command]
fn get_startup_file() -> Option<String> {
    for arg in env::args().skip(1) {
        let path = PathBuf::from(&arg);
        if path.is_file() && document_storage::is_text_extension(&path) {
            return Some(path.to_string_lossy().to_string());
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            create_untitled_file,
            list_text_files,
            rename_document,
            get_startup_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
