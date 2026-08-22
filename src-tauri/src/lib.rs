// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use document_storage::{DirectoryEntries, FileInfo, FileTreeNode, StorageResult};
use std::env;
use std::path::{Path, PathBuf};
use tauri::Manager;

mod agent;
mod agent_completion;
mod document_storage;

fn restore_main_window(app: &tauri::AppHandle) {
    let window = app.get_webview_window("main").or_else(|| {
        let config = app
            .config()
            .app
            .windows
            .iter()
            .find(|config| config.label == "main")?;
        tauri::WebviewWindowBuilder::from_config(app, config)
            .ok()?
            .build()
            .ok()
    });

    if let Some(window) = window {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Read a UTF-8 text file from an absolute path and return its contents.
#[tauri::command]
async fn read_text_file(path: String) -> StorageResult<String> {
    tauri::async_runtime::spawn_blocking(move || document_storage::read_text_file(Path::new(&path)))
        .await
        .map_err(|_| document_storage::StorageError::io())?
}

/// Atomically replace a UTF-8 text file, creating parent directories if needed.
#[tauri::command]
async fn write_text_file(path: String, content: String) -> StorageResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::atomic_write_text_file(Path::new(&path), &content)
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
}

/// Permanently delete one regular file. Directories and symlinks are rejected.
#[tauri::command]
async fn delete_file(path: String) -> StorageResult<()> {
    tauri::async_runtime::spawn_blocking(move || document_storage::delete_file(Path::new(&path)))
        .await
        .map_err(|_| document_storage::StorageError::io())?
}

/// Permanently delete one real directory and its contents. Symlinks are rejected.
#[tauri::command]
async fn delete_directory(path: String) -> StorageResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::delete_directory(Path::new(&path))
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
}

/// Create a markdown document with initial content without replacing an existing one.
#[tauri::command]
async fn create_untitled_file(dir_path: String, content: String) -> StorageResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::create_untitled_file(Path::new(&dir_path), &content)
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
}

/// Create a uniquely named child directory without replacing an existing entry.
#[tauri::command]
async fn create_untitled_directory(parent_path: String, name: String) -> StorageResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::create_untitled_directory(Path::new(&parent_path), &name)
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
}

/// List markdown/text files in a directory (non-recursive), sorted by modified time desc.
#[tauri::command]
async fn list_text_files(dir_path: String) -> StorageResult<Vec<FileInfo>> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::list_text_files(Path::new(&dir_path))
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
}

/// Recursively list files and folders for the workspace explorer.
#[tauri::command]
async fn list_directory_tree(dir_path: String) -> StorageResult<Vec<FileTreeNode>> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::list_directory_tree(Path::new(&dir_path))
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
}

#[tauri::command]
async fn list_directory_entries(dir_path: String) -> StorageResult<DirectoryEntries> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::list_directory_entries(Path::new(&dir_path))
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
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
async fn rename_document(path: String, new_name: String) -> StorageResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::rename_document(Path::new(&path), &new_name)
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
}

#[tauri::command]
async fn rename_directory(path: String, new_name: String) -> StorageResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        document_storage::rename_directory(Path::new(&path), &new_name)
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|_| document_storage::StorageError::io())?
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
            restore_main_window(app);
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
            create_untitled_directory,
            list_text_files,
            list_directory_tree,
            list_directory_entries,
            prepare_image_preview,
            read_pdf_file,
            write_binary_file,
            rename_document,
            rename_directory,
            get_startup_file,
            agent_completion::request_agent_completion,
            agent::commands::run_agent_turn,
            agent::commands::cancel_agent_turn,
            agent::commands::resolve_agent_permission
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
