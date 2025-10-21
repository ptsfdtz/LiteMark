import React from "react";
import styles from "./Editor.module.css";
import { EditorProps } from "../../types/editor";

const Editor = React.forwardRef<HTMLTextAreaElement, EditorProps>(
  ({ value, onChange, onSelectionChange, className }, ref) => {
    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      if (onSelectionChange) onSelectionChange(start, end);
    };

    return (
      <textarea
        ref={ref}
        className={`${styles.editor} ${className}`}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onSelect={handleSelect}
        placeholder="在这里输入 ..."
      />
    );
  }
);

Editor.displayName = "Editor";

export default Editor;
