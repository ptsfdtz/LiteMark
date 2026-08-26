mod document;
pub(crate) mod filesystem;
pub(crate) mod patch;
mod search;
mod verification;

use serde_json::{json, Value};
use std::path::Path;

pub(crate) const MAX_READ_CHARS: usize = 50_000;
pub(crate) const MAX_BATCH_READ_FILES: usize = 20;
pub(crate) const MAX_BATCH_WRITE_FILES: usize = 20;

pub(crate) fn tool_definitions() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "search_files",
                "description": "Search workspace text files by file name or relative path. Use this before broad directory listing and reading.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Case-insensitive name/path query. Supports * and ? wildcards." },
                        "limit": { "type": "integer", "minimum": 1, "maximum": 200 }
                    },
                    "required": ["query"], "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "grep_text",
                "description": "Search Markdown/text content across the workspace and return paths, line numbers, and compact context. Prefer this over reading many files to find relevant content.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" },
                        "path": { "type": "string", "description": "Optional workspace-relative directory or file scope." },
                        "case_sensitive": { "type": "boolean" },
                        "context_lines": { "type": "integer", "minimum": 0, "maximum": 5 },
                        "limit": { "type": "integer", "minimum": 1, "maximum": 200 }
                    },
                    "required": ["query"], "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "update_plan",
                "description": "Publish or update the plan for a multi-step task. Keep stable step ids and exactly one in_progress step while working.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "steps": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": { "type": "string" },
                                    "description": { "type": "string" },
                                    "status": { "type": "string", "enum": ["pending", "in_progress", "completed", "failed"] }
                                },
                                "required": ["id", "description", "status"],
                                "additionalProperties": false
                            }
                        }
                    },
                    "required": ["steps"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "apply_patch",
                "description": "Apply a validated unified diff to one or more Markdown/text files in the workspace. Include file headers (--- a/path and +++ b/path), standard line-numbered hunk headers, and exact context. A bare @@ header is accepted only when its context uniquely identifies one location. After applying, the tool re-reads changed regions and reports them.",
                "parameters": {
                    "type": "object",
                    "properties": { "patch": { "type": "string", "description": "Unified diff text." } },
                    "required": ["patch"], "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "check_markdown",
                "description": "Run workspace Markdown verification: malformed links, heading hierarchy, duplicate top-level titles, and broken local references. Returns structured findings; fix errors and verify again before finishing.",
                "parameters": {
                    "type": "object",
                    "properties": { "paths": { "type": "array", "items": { "type": "string" }, "maxItems": 50 } },
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "check_links",
                "description": "Check Markdown links and local reference targets in workspace files.",
                "parameters": { "type": "object", "properties": { "paths": { "type": "array", "items": { "type": "string" }, "maxItems": 50 } }, "additionalProperties": false }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "check_headings",
                "description": "Check heading hierarchy and duplicate headings in workspace Markdown files.",
                "parameters": { "type": "object", "properties": { "paths": { "type": "array", "items": { "type": "string" }, "maxItems": 50 } }, "additionalProperties": false }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "check_duplicate_titles",
                "description": "Find duplicate top-level Markdown titles across workspace files.",
                "parameters": { "type": "object", "properties": { "paths": { "type": "array", "items": { "type": "string" }, "maxItems": 50 } }, "additionalProperties": false }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "check_broken_references",
                "description": "Find local Markdown links whose files or heading anchors do not exist.",
                "parameters": { "type": "object", "properties": { "paths": { "type": "array", "items": { "type": "string" }, "maxItems": 50 } }, "additionalProperties": false }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_document",
                "description": "Return the current full text of the document.",
                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "rewrite_document",
                "description": "Replace the entire document with new content.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "The current document path shown in the project context. This tool cannot edit another file." },
                        "content": { "type": "string", "description": "The complete new document text." }
                    },
                    "required": ["path", "content"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "replace_in_document",
                "description": "Replace one exact substring of the document with another.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "The current document path shown in the project context. This tool cannot edit another file." },
                        "old_string": { "type": "string", "description": "The exact text to replace." },
                        "new_string": { "type": "string", "description": "The replacement text." }
                    },
                    "required": ["path", "old_string", "new_string"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_documents",
                "description": "List the Markdown/text documents in the project directory.",
                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read one Markdown/text file from the project directory. Use read_files instead when two or more files are needed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "The file name or relative path within the project directory." }
                    },
                    "required": ["path"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_files",
                "description": "Read multiple Markdown/text files from the project directory in one call. Prefer this over repeated read_file calls whenever two or more files are needed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "paths": {
                            "type": "array",
                            "description": "File names or relative paths within the project directory.",
                            "minItems": 1,
                            "maxItems": 20,
                            "uniqueItems": true,
                            "items": { "type": "string" }
                        }
                    },
                    "required": ["paths"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "write_file",
                "description": "Create or overwrite one Markdown/text file in the project directory. Not for the current document. Use write_files when two or more files are needed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "The file name or relative path within the project directory." },
                        "content": { "type": "string", "description": "The complete file content to write." }
                    },
                    "required": ["path", "content"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "write_files",
                "description": "Create or overwrite multiple Markdown/text files in one approved operation. Prefer this whenever two or more files need to be written. Not for the current document.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "files": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": 20,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "path": { "type": "string", "description": "The file name or relative path within the project directory." },
                                    "content": { "type": "string", "description": "The complete file content to write." }
                                },
                                "required": ["path", "content"],
                                "additionalProperties": false
                            }
                        }
                    },
                    "required": ["files"],
                    "additionalProperties": false
                }
            }
        }
    ])
}

pub(crate) fn execute_tool(
    name: &str,
    arguments: &str,
    document: &mut String,
    work_dir: Option<&Path>,
) -> Result<String, String> {
    match name {
        "read_document" => Ok(document::read(document)),
        "rewrite_document" => document::rewrite(arguments, document),
        "replace_in_document" => document::replace(arguments, document),
        "list_documents" => filesystem::list(work_dir),
        "read_file" => filesystem::read(arguments, work_dir),
        "read_files" => filesystem::read_many(arguments, work_dir),
        "search_files" => search::search_files(arguments, work_dir),
        "grep_text" => search::grep_text(arguments, work_dir),
        "apply_patch" => patch::apply(arguments, work_dir),
        "check_markdown" => verification::check(arguments, work_dir, verification::CheckKind::All),
        "check_links" => verification::check(arguments, work_dir, verification::CheckKind::Links),
        "check_headings" => {
            verification::check(arguments, work_dir, verification::CheckKind::Headings)
        }
        "check_duplicate_titles" => verification::check(
            arguments,
            work_dir,
            verification::CheckKind::DuplicateTitles,
        ),
        "check_broken_references" => verification::check(
            arguments,
            work_dir,
            verification::CheckKind::BrokenReferences,
        ),
        "write_file" => filesystem::write(arguments, work_dir),
        "write_files" => filesystem::write_many(arguments, work_dir),
        _ => Err(format!("unknown tool: {name}")),
    }
}
