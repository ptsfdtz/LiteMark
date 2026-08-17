// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use document_storage::{FileInfo, FileTreeNode, StorageResult};
use std::env;
use std::path::{Path, PathBuf};
use tauri::Manager;

mod agent;
mod agent_completion;
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

/// Permanently delete one regular file. Directories and symlinks are rejected.
#[tauri::command]
fn delete_file(path: String) -> StorageResult<()> {
    document_storage::delete_file(Path::new(&path))
}

/// Permanently delete one real directory and its contents. Symlinks are rejected.
#[tauri::command]
fn delete_directory(path: String) -> StorageResult<()> {
    document_storage::delete_directory(Path::new(&path))
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

/// Recursively list files and folders for the workspace explorer.
#[tauri::command]
fn list_directory_tree(dir_path: String) -> StorageResult<Vec<FileTreeNode>> {
    document_storage::list_directory_tree(Path::new(&dir_path))
}

/// Allow one validated local image through Tauri's read-only asset protocol.
#[tauri::command]
fn prepare_image_preview(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let canonical_path = std::fs::canonicalize(&path).map_err(|error| error.to_string())?;
    if !canonical_path.is_file() || !document_storage::is_image_extension(&canonical_path) {
        return Err("The selected path is not a supported image file.".to_owned());
    }
    app.asset_protocol_scope()
        .allow_file(&canonical_path)
        .map_err(|error| error.to_string())?;
    Ok(canonical_path.to_string_lossy().into_owned())
}

/// Read one validated local PDF file and return its raw bytes for in-app preview.
#[tauri::command]
fn read_pdf_file(path: String) -> Result<tauri::ipc::Response, String> {
    let canonical_path = std::fs::canonicalize(&path).map_err(|error| error.to_string())?;
    if !canonical_path.is_file() || !document_storage::is_pdf_extension(&canonical_path) {
        return Err("The selected path is not a supported PDF file.".to_owned());
    }
    let bytes = std::fs::read(&canonical_path).map_err(|error| error.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// Write raw bytes to a file the user explicitly chose through the save dialog.
#[tauri::command]
fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(Path::new(&path), data).map_err(|error| error.to_string())
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            delete_file,
            delete_directory,
            create_untitled_file,
            list_text_files,
            list_directory_tree,
            prepare_image_preview,
            read_pdf_file,
            write_binary_file,
            rename_document,
            get_startup_file,
            agent_completion::request_agent_completion,
            agent::run_agent_turn,
            agent::cancel_agent_turn,
            agent::resolve_agent_permission
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
