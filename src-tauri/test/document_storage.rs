use super::atomic_write_text_file;
use super::create_untitled_directory;
use super::create_untitled_file;
use super::delete_directory;
use super::delete_file;
use super::document_parent;
use super::is_image_extension;
use super::is_pdf_extension;
use super::list_directory_entries;
use super::list_directory_tree;
use super::read_text_file;
use super::rename_directory;
use super::rename_document;
use super::StorageErrorCategory;
use std::fs;
use std::path::Path;

#[cfg(unix)]
use super::rename_via_hard_link;
#[cfg(unix)]
use std::io;

#[test]
fn image_preview_extensions_are_explicitly_allowlisted() {
    assert!(is_image_extension(Path::new("cover.PNG")));
    assert!(is_image_extension(Path::new("photo.webp")));
    assert!(is_image_extension(Path::new("frame.avif")));
    assert!(!is_image_extension(Path::new("illustration.svg")));
    assert!(!is_image_extension(Path::new("notes.md")));
}

#[test]
fn pdf_preview_extension_is_explicitly_allowlisted() {
    assert!(is_pdf_extension(Path::new("paper.pdf")));
    assert!(is_pdf_extension(Path::new("Report.PDF")));
    assert!(!is_pdf_extension(Path::new("notes.md")));
    assert!(!is_pdf_extension(Path::new("archive.pdfx")));
}

#[test]
fn creating_an_untitled_document_writes_content_and_preserves_existing_files() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let existing_path = directory.path().join("untitled.md");
    fs::write(&existing_path, "existing content").expect("seed existing document");

    let created_path =
        create_untitled_file(directory.path(), "# New document\n").expect("create document");

    assert_ne!(created_path, existing_path);
    assert_eq!(
        fs::read_to_string(existing_path).expect("read existing document"),
        "existing content"
    );
    assert_eq!(
        fs::read_to_string(created_path).expect("read new document"),
        "# New document\n"
    );
}

#[test]
fn creating_an_untitled_directory_preserves_existing_entries() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let existing_path = directory.path().join("New Folder");
    fs::create_dir(&existing_path).expect("seed existing directory");

    let created_path =
        create_untitled_directory(directory.path(), "New Folder").expect("create directory");

    assert_eq!(created_path, directory.path().join("New Folder-1"));
    assert!(existing_path.is_dir());
    assert!(created_path.is_dir());
}

#[test]
fn creating_an_untitled_directory_rejects_nested_names() {
    let directory = tempfile::tempdir().expect("temporary directory");

    let error = create_untitled_directory(directory.path(), "../outside")
        .expect_err("nested names must be rejected");

    assert_eq!(error.category, StorageErrorCategory::InvalidPath);
    assert!(!directory.path().join("outside").exists());
}

#[test]
fn renaming_a_directory_never_overwrites_existing_entries() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let source = directory.path().join("source");
    let existing = directory.path().join("existing");
    fs::create_dir(&source).expect("create source directory");
    fs::create_dir(&existing).expect("create existing directory");

    let error = rename_directory(&source, "existing").expect_err("must not overwrite");
    assert_eq!(error.category, StorageErrorCategory::AlreadyExists);
    assert!(source.is_dir());
    assert!(existing.is_dir());

    let renamed = rename_directory(&source, "renamed").expect("rename directory");
    assert_eq!(renamed, directory.path().join("renamed"));
    assert!(renamed.is_dir());
    assert!(!source.exists());
}

#[test]
fn deleting_a_file_removes_it_without_allowing_directories() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let file_path = directory.path().join("remove.md");
    let child_directory = directory.path().join("keep");
    fs::write(&file_path, "delete me").expect("seed document");
    fs::create_dir(&child_directory).expect("create directory");

    delete_file(&file_path).expect("delete document");
    assert!(!file_path.exists());
    assert_eq!(
        delete_file(&child_directory)
            .expect_err("directories must not be deleted")
            .category,
        StorageErrorCategory::InvalidPath
    );
    assert!(child_directory.exists());
}

#[test]
fn deleting_a_directory_is_recursive_and_rejects_files() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let target = directory.path().join("remove");
    let nested = target.join("nested");
    let file = directory.path().join("keep.md");
    fs::create_dir_all(&nested).expect("create nested directory");
    fs::write(nested.join("document.md"), "delete me").expect("seed nested document");
    fs::write(&file, "keep me").expect("seed file");

    delete_directory(&target).expect("delete directory");
    assert!(!target.exists());
    assert_eq!(
        delete_directory(&file)
            .expect_err("files must not be deleted as directories")
            .category,
        StorageErrorCategory::InvalidPath
    );
    assert!(file.exists());
}

#[test]
fn directory_tree_is_recursive_sorted_and_skips_dependency_directories() {
    let directory = tempfile::tempdir().expect("temporary directory");
    fs::create_dir(directory.path().join("docs")).expect("create docs");
    fs::create_dir(directory.path().join("node_modules")).expect("create dependencies");
    fs::write(directory.path().join("readme.md"), "# Readme").expect("write markdown");
    fs::write(directory.path().join("docs").join("guide.txt"), "Guide")
        .expect("write nested document");
    fs::write(
        directory.path().join("node_modules").join("hidden.js"),
        "hidden",
    )
    .expect("write ignored file");

    let tree = list_directory_tree(directory.path()).expect("scan directory tree");

    assert_eq!(tree.len(), 2);
    assert_eq!(tree[0].name, "docs");
    assert!(tree[0].is_directory);
    assert_eq!(tree[0].children[0].name, "guide.txt");
    assert_eq!(tree[1].name, "readme.md");
    assert_eq!(tree[1].extension.as_deref(), Some("md"));
}

#[test]
fn directory_entries_are_lazy_and_report_truncation() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let nested = directory.path().join("docs");
    fs::create_dir(&nested).expect("create nested directory");
    fs::write(nested.join("guide.md"), "Guide").expect("write nested document");

    let result = list_directory_entries(directory.path()).expect("list one directory level");

    assert!(!result.truncated);
    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].name, "docs");
    assert!(result.entries[0].children.is_empty());
}

#[test]
#[ignore = "explicit 100k-file performance test"]
fn scans_a_hundred_thousand_file_directory_with_a_bounded_result() {
    use std::time::Instant;

    const FILE_COUNT: usize = 100_000;
    let directory = tempfile::tempdir().expect("temporary directory");
    let creation_started = Instant::now();
    for index in 0..FILE_COUNT {
        fs::File::create(directory.path().join(format!("file-{index:06}.md")))
            .expect("create benchmark file");
    }
    let creation_elapsed = creation_started.elapsed();

    let scan_started = Instant::now();
    let result = list_directory_entries(directory.path()).expect("scan large directory");
    let scan_elapsed = scan_started.elapsed();

    assert!(result.truncated);
    assert_eq!(result.entries.len(), 2_000);
    eprintln!(
        "100k directory: create={creation_elapsed:?}, scan={scan_elapsed:?}, returned={}",
        result.entries.len()
    );
}

#[test]
fn bare_document_paths_use_the_current_directory_as_their_parent() {
    assert_eq!(
        document_parent(Path::new("document.md")).expect("document parent"),
        Path::new(".")
    );
}

#[test]
fn saving_replaces_the_document_atomically() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let document_path = directory.path().join("document.md");
    let old_document_link = directory.path().join("old-document.md");
    fs::write(&document_path, "old content").expect("seed document");
    fs::hard_link(&document_path, &old_document_link).expect("link old document");

    atomic_write_text_file(&document_path, "new content").expect("save document");

    assert_eq!(
        fs::read_to_string(&document_path).expect("read replaced document"),
        "new content"
    );
    assert_eq!(
        fs::read_to_string(old_document_link).expect("read old document link"),
        "old content"
    );
    assert_eq!(
        fs::read_dir(directory.path())
            .expect("read directory")
            .count(),
        2
    );
}

#[test]
fn saving_does_not_treat_invalid_metadata_errors_as_a_missing_document() {
    let invalid_path = std::path::Path::new("invalid\0document.md");

    let error = atomic_write_text_file(invalid_path, "content")
        .expect_err("an invalid path must not be treated as a new document");

    assert_eq!(error.category, StorageErrorCategory::InvalidPath);
}

#[cfg(unix)]
#[test]
fn saving_preserves_unix_permissions() {
    use std::os::unix::fs::PermissionsExt;

    let directory = tempfile::tempdir().expect("temporary directory");
    let document_path = directory.path().join("document.md");
    fs::write(&document_path, "old content").expect("seed document");
    fs::set_permissions(&document_path, fs::Permissions::from_mode(0o640))
        .expect("set document permissions");

    atomic_write_text_file(&document_path, "new content").expect("save document");

    let mode = fs::metadata(&document_path)
        .expect("document metadata")
        .permissions()
        .mode()
        & 0o777;
    assert_eq!(mode, 0o640);
}

#[cfg(unix)]
#[test]
fn saving_through_a_symlink_updates_its_target() {
    use std::os::unix::fs::symlink;

    let directory = tempfile::tempdir().expect("temporary directory");
    let target_path = directory.path().join("target.md");
    let link_path = directory.path().join("link.md");
    fs::write(&target_path, "old content").expect("seed target document");
    symlink(&target_path, &link_path).expect("create document symlink");

    atomic_write_text_file(&link_path, "new content").expect("save through symlink");

    assert!(fs::symlink_metadata(&link_path)
        .expect("symlink metadata")
        .file_type()
        .is_symlink());
    assert_eq!(
        fs::read_to_string(target_path).expect("read symlink target"),
        "new content"
    );
}

#[test]
fn missing_documents_have_a_stable_serializable_error() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let missing_path = directory.path().join("missing.md");

    let error = read_text_file(&missing_path).expect_err("missing document must fail");

    assert_eq!(
        serde_json::to_value(error).expect("serialize storage error"),
        serde_json::json!({
            "category": "not_found",
            "message": "Document not found."
        })
    );
}

#[test]
fn renaming_a_document_uses_a_file_name_and_returns_the_new_path() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let current_path = directory.path().join("current.md");
    fs::write(&current_path, "document content").expect("seed document");

    let renamed_path = rename_document(&current_path, "renamed.md").expect("rename document");

    assert_eq!(renamed_path, directory.path().join("renamed.md"));
    assert!(!current_path.exists());
    assert_eq!(
        fs::read_to_string(renamed_path).expect("read renamed document"),
        "document content"
    );
}

#[test]
fn renaming_rejects_empty_or_path_like_names() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let current_path = directory.path().join("current.md");
    fs::write(&current_path, "document content").expect("seed document");

    for invalid_name in ["", ".", "..", "nested/name.md", "nested\\name.md"] {
        let error = rename_document(&current_path, invalid_name)
            .expect_err("path-like name must be rejected");

        assert_eq!(
            serde_json::to_value(error).expect("serialize storage error"),
            serde_json::json!({
                "category": "invalid_name",
                "message": "Invalid document name."
            })
        );
        assert_eq!(
            fs::read_to_string(&current_path).expect("read original document"),
            "document content"
        );
    }
}

#[test]
fn renaming_never_overwrites_an_existing_document() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let current_path = directory.path().join("current.md");
    let existing_path = directory.path().join("existing.md");
    fs::write(&current_path, "current content").expect("seed current document");
    fs::write(&existing_path, "existing content").expect("seed existing document");

    let error = rename_document(&current_path, "existing.md")
        .expect_err("existing document must not be overwritten");

    assert_eq!(
        serde_json::to_value(error).expect("serialize storage error"),
        serde_json::json!({
            "category": "already_exists",
            "message": "A document with that name already exists."
        })
    );
    assert_eq!(
        fs::read_to_string(current_path).expect("read current document"),
        "current content"
    );
    assert_eq!(
        fs::read_to_string(existing_path).expect("read existing document"),
        "existing content"
    );
}

#[cfg(unix)]
#[test]
fn hard_link_rename_fallback_moves_without_replacing() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let current_path = directory.path().join("current.md");
    let renamed_path = directory.path().join("renamed.md");
    fs::write(&current_path, "document content").expect("seed document");

    rename_via_hard_link(&current_path, &renamed_path).expect("fallback rename document");

    assert!(!current_path.exists());
    assert_eq!(
        fs::read_to_string(renamed_path).expect("read renamed document"),
        "document content"
    );
}

#[cfg(unix)]
#[test]
fn hard_link_rename_fallback_preserves_an_existing_destination() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let current_path = directory.path().join("current.md");
    let existing_path = directory.path().join("existing.md");
    fs::write(&current_path, "current content").expect("seed current document");
    fs::write(&existing_path, "existing content").expect("seed existing document");

    let error = rename_via_hard_link(&current_path, &existing_path)
        .expect_err("fallback must not replace an existing document");

    assert_eq!(error.kind(), io::ErrorKind::AlreadyExists);
    assert_eq!(
        fs::read_to_string(current_path).expect("read current document"),
        "current content"
    );
    assert_eq!(
        fs::read_to_string(existing_path).expect("read existing document"),
        "existing content"
    );
}

#[cfg(any(target_vendor = "apple", target_os = "linux", target_os = "android"))]
#[test]
fn rename_fallback_only_handles_unsupported_noreplace_errors() {
    use super::rename_noreplace_is_unsupported;
    use rustix::io::Errno;

    for unsupported_error in [Errno::NOSYS, Errno::INVAL, Errno::NOTSUP, Errno::OPNOTSUPP] {
        assert!(rename_noreplace_is_unsupported(unsupported_error));
    }

    for operation_error in [Errno::EXIST, Errno::ACCESS, Errno::NOENT] {
        assert!(!rename_noreplace_is_unsupported(operation_error));
    }
}
