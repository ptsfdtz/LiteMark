import React, { useEffect, useRef } from "react";
import styles from "./Editor.module.css";
import { EditorProps } from "../../types/editor";

import { EditorView, keymap, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";

const Editor = React.forwardRef<
  HTMLDivElement | HTMLTextAreaElement,
  EditorProps
>(({ value, onChange, onSelectionChange, className }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const startState = EditorState.create({
      doc: value ?? "",
      extensions: [
        keymap.of(defaultKeymap),
        markdown(),
        EditorView.updateListener.of((v: ViewUpdate) => {
          if (v.docChanged) {
            const doc = v.state.doc.toString();
            onChange && onChange(doc);
          }
          if (v.selectionSet && onSelectionChange) {
            const { from, to } = v.state.selection.main;
            onSelectionChange(from, to);
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value != null && value !== current) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node as HTMLDivElement);
        else if (ref)
          (
            ref as React.MutableRefObject<
              HTMLDivElement | HTMLTextAreaElement | null
            >
          ).current = node as HTMLDivElement;
      }}
      className={`${styles.editor} ${className}`}
      data-placeholder={"在这里输入 ..."}
    />
  );
});

Editor.displayName = "Editor";

export default Editor;
