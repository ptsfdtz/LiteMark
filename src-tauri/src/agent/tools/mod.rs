mod document;
pub(crate) mod filesystem;

use serde_json::{json, Value};
use std::path::Path;

pub(crate) const MAX_READ_CHARS: usize = 50_000;

pub(crate) fn tool_definitions() -> Value {
    json!([
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
                        "content": { "type": "string", "description": "The complete new document text." }
                    },
                    "required": ["content"],
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
                        "old_string": { "type": "string", "description": "The exact text to replace." },
                        "new_string": { "type": "string", "description": "The replacement text." }
                    },
                    "required": ["old_string", "new_string"],
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
                "description": "Read a Markdown/text file from the project directory.",
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
                "name": "write_file",
                "description": "Create or overwrite a Markdown/text file in the project directory. Not for the current document.",
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
        "write_file" => filesystem::write(arguments, work_dir),
        _ => Err(format!("unknown tool: {name}")),
    }
}
