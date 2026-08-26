use super::{
    cancellation_registry, execute_tool, normalize_tool_call_ids, record_tool_failure,
    register_permission_request, resolve_agent_permission, take_sse_block,
    validate_document_target, validate_plan, AgentPlanStep, ChatMessage, FunctionCall,
    PlanStepStatus, RunRegistration, ToolCall, WorkspaceWriteGuard, WriteJournal, MAX_READ_CHARS,
};
use serde_json::json;
use std::collections::HashMap;
use std::fs;

#[test]
fn rewrites_the_document() {
    let mut document = String::from("old");
    let result = execute_tool(
        "rewrite_document",
        r#"{"content":"new"}"#,
        &mut document,
        None,
    );
    assert_eq!(result.as_deref(), Ok("Document rewritten (3 characters)."));
    assert_eq!(document, "new");
}

#[test]
fn replaces_a_unique_occurrence() {
    let mut document = String::from("hello world");
    let result = execute_tool(
        "replace_in_document",
        r#"{"old_string":"world","new_string":"there"}"#,
        &mut document,
        None,
    );
    assert_eq!(result.as_deref(), Ok("Replaced 1 occurrence."));
    assert_eq!(document, "hello there");
}

#[test]
fn rejects_ambiguous_replacements() {
    let mut document = String::from("a a a");
    let result = execute_tool(
        "replace_in_document",
        r#"{"old_string":"a","new_string":"b"}"#,
        &mut document,
        None,
    );
    assert!(result.is_err());
    assert_eq!(document, "a a a");
}

#[test]
fn rejects_missing_old_string() {
    let mut document = String::from("hello");
    let result = execute_tool(
        "replace_in_document",
        r#"{"old_string":"nope","new_string":"x"}"#,
        &mut document,
        None,
    );
    assert!(result.is_err());
}

#[test]
fn reads_the_current_document() {
    let mut document = String::from("content");
    let result = execute_tool("read_document", "{}", &mut document, None);
    assert_eq!(result.as_deref(), Ok("content"));
}

#[test]
fn caps_read_document_output() {
    let mut document = "x".repeat(MAX_READ_CHARS + 100);
    let result = execute_tool("read_document", "{}", &mut document, None).expect("read document");
    assert!(result.ends_with("[document truncated]"));
    assert_eq!(
        result.chars().count(),
        MAX_READ_CHARS + "\n\n[document truncated]".len()
    );
}

#[test]
fn lists_documents_in_the_working_directory() {
    let directory = tempfile::tempdir().expect("temporary directory");
    fs::write(directory.path().join("a.md"), "a").expect("seed a.md");
    fs::write(directory.path().join("b.txt"), "b").expect("seed b.txt");
    fs::write(directory.path().join("ignore.bin"), "binary").expect("seed ignore.bin");

    let mut document = String::new();
    let result = execute_tool(
        "list_documents",
        "{}",
        &mut document,
        Some(directory.path()),
    );

    let listing = result.expect("list documents");
    assert!(listing.contains("a.md"));
    assert!(listing.contains("b.txt"));
    assert!(!listing.contains("ignore.bin"));
}

#[test]
fn reads_a_file_within_the_working_directory() {
    let directory = tempfile::tempdir().expect("temporary directory");
    fs::write(directory.path().join("note.md"), "# note").expect("seed note.md");

    let mut document = String::new();
    let result = execute_tool(
        "read_file",
        r#"{"path":"note.md"}"#,
        &mut document,
        Some(directory.path()),
    );

    assert_eq!(result.as_deref(), Ok("# note"));
}

#[test]
fn rejects_paths_outside_the_working_directory() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let outside = tempfile::tempdir().expect("outside directory");
    let outside_file = outside.path().join("secret.md");
    fs::write(&outside_file, "secret").expect("seed secret.md");

    let mut document = String::new();
    let result = execute_tool(
        "read_file",
        &json!({ "path": outside_file.to_string_lossy() }).to_string(),
        &mut document,
        Some(directory.path()),
    );

    assert!(result.is_err());
}

#[test]
fn requires_a_working_directory_for_directory_tools() {
    let mut document = String::new();
    assert!(execute_tool("list_documents", "{}", &mut document, None).is_err());
    assert!(execute_tool("read_file", r#"{"path":"a.md"}"#, &mut document, None).is_err());
    assert!(execute_tool(
        "write_file",
        r#"{"path":"a.md","content":"x"}"#,
        &mut document,
        None
    )
    .is_err());
}

#[test]
fn writes_a_file_within_the_working_directory() {
    let directory = tempfile::tempdir().expect("temporary directory");

    let mut document = String::new();
    let result = execute_tool(
        "write_file",
        r##"{"path":"notes/summary.md","content":"# summary"}"##,
        &mut document,
        Some(directory.path()),
    );

    assert!(result.is_ok());
    let written =
        fs::read_to_string(directory.path().join("notes/summary.md")).expect("read written file");
    assert_eq!(written, "# summary");
    assert!(
        document.is_empty(),
        "write_file must not touch the current document"
    );
}

#[test]
fn rejects_document_edits_targeting_a_different_project_file() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let current = directory.path().join("matlab").join("01_basics.md");
    let requested = directory.path().join("matlab").join("02_simulink.md");
    fs::create_dir_all(current.parent().expect("matlab directory")).expect("create directory");
    fs::write(&current, "# basics").expect("seed current document");
    fs::write(&requested, "# simulink").expect("seed requested document");

    let arguments = json!({
        "path": "matlab/02_simulink.md",
        "content": "# changed"
    })
    .to_string();
    let result = validate_document_target(
        &arguments,
        Some(current.to_string_lossy().as_ref()),
        Some(directory.path()),
    );

    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(&current).expect("read current"),
        "# basics"
    );
    assert_eq!(
        fs::read_to_string(&requested).expect("read requested"),
        "# simulink"
    );
}

#[test]
fn accepts_the_current_document_target_without_a_project_workspace() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let current = directory.path().join("standalone.md");
    fs::write(&current, "# standalone").expect("seed current document");
    let arguments = json!({
        "path": current,
        "content": "# changed"
    })
    .to_string();

    assert!(
        validate_document_target(&arguments, Some(current.to_string_lossy().as_ref()), None,)
            .is_ok()
    );
}

#[test]
fn rejects_write_paths_outside_the_working_directory() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let outside = tempfile::tempdir().expect("outside directory");

    let mut document = String::new();
    let result = execute_tool(
        "write_file",
        &json!({ "path": outside.path().join("evil.md").to_string_lossy(), "content": "x" })
            .to_string(),
        &mut document,
        Some(directory.path()),
    );

    assert!(result.is_err());
}

#[test]
fn rejected_write_does_not_create_directories_outside_the_working_directory() {
    let workspace = tempfile::tempdir().expect("workspace");
    let outside = tempfile::tempdir().expect("outside");
    let target = outside.path().join("must-not-exist").join("note.md");
    let mut document = String::new();

    let result = execute_tool(
        "write_file",
        &serde_json::json!({ "path": target, "content": "no" }).to_string(),
        &mut document,
        Some(workspace.path()),
    );

    assert!(result.is_err());
    assert!(!outside.path().join("must-not-exist").exists());
}

#[test]
fn cancellation_is_scoped_to_one_run() {
    let first = RunRegistration::register("run-first".to_string()).expect("first run");
    let second = RunRegistration::register("run-second".to_string()).expect("second run");
    let first_flag = cancellation_registry()
        .lock()
        .expect("registry")
        .get("run-first")
        .cloned()
        .expect("first flag");

    first_flag.store(true, std::sync::atomic::Ordering::SeqCst);

    assert!(first.cancelled());
    assert!(!second.cancelled());
}

#[test]
fn workspace_write_lock_is_exclusive_and_released() {
    let workspace = tempfile::tempdir().expect("workspace");
    let first = WorkspaceWriteGuard::acquire(workspace.path(), "run-first")
        .expect("first writer acquires lock");
    assert!(WorkspaceWriteGuard::acquire(workspace.path(), "run-second").is_err());

    drop(first);
    assert!(WorkspaceWriteGuard::acquire(workspace.path(), "run-second").is_ok());
}

#[test]
fn write_journal_rolls_back_and_can_commit() {
    let workspace = tempfile::tempdir().expect("workspace");
    let existing = workspace.path().join("existing.md");
    let created = workspace.path().join("created.md");
    fs::write(&existing, "original").expect("seed file");

    {
        let mut journal = WriteJournal::default();
        journal.capture(&existing).expect("capture existing");
        journal.capture(&created).expect("capture missing");
        fs::write(&existing, "changed").expect("change existing");
        fs::write(&created, "new").expect("create file");
    }
    assert_eq!(fs::read_to_string(&existing).expect("restored"), "original");
    assert!(!created.exists());

    {
        let mut journal = WriteJournal::default();
        journal.capture(&existing).expect("capture existing");
        fs::write(&existing, "committed").expect("change existing");
        journal.commit();
    }
    assert_eq!(
        fs::read_to_string(existing).expect("committed"),
        "committed"
    );
}

#[test]
fn validates_explicit_plans() {
    let valid = vec![
        AgentPlanStep {
            id: "read".to_string(),
            description: "Read the document".to_string(),
            status: PlanStepStatus::Completed,
        },
        AgentPlanStep {
            id: "edit".to_string(),
            description: "Edit the document".to_string(),
            status: PlanStepStatus::InProgress,
        },
    ];
    assert!(validate_plan(&valid).is_ok());

    let mut duplicate = valid.clone();
    duplicate[1].id = "read".to_string();
    assert!(validate_plan(&duplicate).is_err());

    let mut multiple_active = valid;
    multiple_active[0].status = PlanStepStatus::InProgress;
    assert!(validate_plan(&multiple_active).is_err());
}

#[test]
fn stops_after_three_identical_tool_failures() {
    let call = ToolCall {
        id: "call-1".to_string(),
        call_type: "function".to_string(),
        function: FunctionCall {
            name: "read_file".to_string(),
            arguments: r#"{"path":"missing.md"}"#.to_string(),
        },
    };
    let mut failures = HashMap::new();

    assert!(record_tool_failure(&mut failures, &call, "not found").is_ok());
    assert!(record_tool_failure(&mut failures, &call, "not found").is_ok());
    assert!(record_tool_failure(&mut failures, &call, "not found").is_err());
    assert!(record_tool_failure(&mut failures, &call, "different error").is_ok());
}

#[test]
fn normalizes_empty_and_duplicate_tool_call_ids() {
    let function = FunctionCall {
        name: "read_document".to_string(),
        arguments: "{}".to_string(),
    };
    let mut calls = vec![
        ToolCall {
            id: String::new(),
            call_type: "function".to_string(),
            function: function.clone(),
        },
        ToolCall {
            id: "duplicate".to_string(),
            call_type: "function".to_string(),
            function: function.clone(),
        },
        ToolCall {
            id: "duplicate".to_string(),
            call_type: "function".to_string(),
            function,
        },
    ];

    normalize_tool_call_ids(&mut calls, "run-1", 2);

    assert_eq!(calls[0].id, "run-1-step-2-call-0");
    assert_eq!(calls[1].id, "duplicate");
    assert_eq!(calls[2].id, "run-1-step-2-call-2");
}

#[test]
fn rejects_writing_non_text_files() {
    let directory = tempfile::tempdir().expect("temporary directory");

    let mut document = String::new();
    let result = execute_tool(
        "write_file",
        r#"{"path":"script.exe","content":"x"}"#,
        &mut document,
        Some(directory.path()),
    );

    assert!(result.is_err());
}

#[test]
fn deserializes_chat_messages_by_role() {
    let value = json!({ "role": "user", "content": "hi" });
    let message: ChatMessage = serde_json::from_value(value).unwrap();
    assert!(matches!(message, ChatMessage::User { content } if content == "hi"));
}

#[test]
fn deserializes_assistant_tool_calls() {
    let value = json!({
        "role": "assistant",
        "content": "",
        "tool_calls": [{ "id": "1", "type": "function", "function": { "name": "read_document", "arguments": "{}" } }]
    });
    let message: ChatMessage = serde_json::from_value(value).unwrap();
    match message {
        ChatMessage::Assistant { tool_calls, .. } => {
            let calls = tool_calls.unwrap();
            assert_eq!(calls.len(), 1);
            assert_eq!(calls[0].id, "1");
            assert_eq!(calls[0].function.name, "read_document");
        }
        _ => panic!("expected assistant message"),
    }
}

#[test]
fn serializes_tool_calls_to_openai_shape() {
    let call = ToolCall {
        id: "1".to_string(),
        call_type: "function".to_string(),
        function: FunctionCall {
            name: "read_document".to_string(),
            arguments: "{}".to_string(),
        },
    };
    let value = serde_json::to_value(&call).unwrap();
    assert_eq!(value["type"], "function");
    assert_eq!(value["function"]["name"], "read_document");
}

#[test]
fn preserves_utf8_characters_split_across_network_chunks() {
    let payload = concat!(
        "data: {\"choices\":[{\"delta\":{\"content\":\"",
        "\u{4f60}\u{597d} \u{1f60a}",
        "\"}}]}\n\n"
    );
    let emoji_start = payload.find('\u{1f60a}').expect("emoji in payload");
    let split_inside_emoji = emoji_start + 1;
    let mut buffer = payload.as_bytes()[..split_inside_emoji].to_vec();

    assert_eq!(take_sse_block(&mut buffer).expect("partial block"), None);

    buffer.extend_from_slice(&payload.as_bytes()[split_inside_emoji..]);
    let block = take_sse_block(&mut buffer)
        .expect("valid UTF-8 block")
        .expect("complete SSE block");

    assert!(block.contains("\u{4f60}\u{597d} \u{1f60a}"));
    assert!(buffer.is_empty());
}

#[test]
fn resolving_an_unknown_permission_request_fails() {
    let error = resolve_agent_permission(999, true).expect_err("unknown request must fail");
    assert_eq!(error, "permission request not found.");
}

#[test]
fn resolves_a_registered_permission_request() {
    let (id, mut receiver) = register_permission_request();
    assert!(receiver.try_recv().is_err());

    resolve_agent_permission(id, true).expect("resolve permission");

    assert!(receiver.try_recv().expect("permission decision").allow);
}
