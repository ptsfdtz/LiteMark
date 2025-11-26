// src/components/Editor/Editor.tsx
import React from 'react';
import styles from './Editor.module.css';
import { EditorProps } from '../../types/editor';

const Editor = React.forwardRef<HTMLTextAreaElement, EditorProps>(
  ({ value, onChange, onSelectionChange, className }, ref) => {
    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      if (onSelectionChange) onSelectionChange(start, end);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const element = e.currentTarget;
        const start = element.selectionStart;
        const value = element.value;

        const beforeCursor = value.substring(0, start);
        const lastNewLine = beforeCursor.lastIndexOf('\n');
        const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
        const currentLine = beforeCursor.substring(lineStart);

        // Ordered List
        const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s/);
        if (orderedMatch) {
          e.preventDefault();
          const indent = orderedMatch[1];
          const currentNum = parseInt(orderedMatch[2], 10);
          const nextNum = currentNum + 1;
          const textToInsert = `\n${indent}${nextNum}. `;

          let success = false;
          try {
            success = document.execCommand('insertText', false, textToInsert);
          } catch (err) {
            console.error(err);
          }

          if (!success) {
            if (element.setRangeText) {
              element.setRangeText(textToInsert, start, element.selectionEnd, 'end');
              element.dispatchEvent(new Event('input', { bubbles: true }));
              onChange(element.value);
            } else {
              const newValue =
                value.substring(0, start) + textToInsert + value.substring(element.selectionEnd);
              onChange(newValue);
            }
          }
          return;
        }

        // Unordered List
        const unorderedMatch = currentLine.match(/^(\s*)([-*+])\s/);
        if (unorderedMatch) {
          e.preventDefault();
          const indent = unorderedMatch[1];
          const marker = unorderedMatch[2];
          const textToInsert = `\n${indent}${marker} `;

          let success = false;
          try {
            success = document.execCommand('insertText', false, textToInsert);
          } catch (err) {
            console.error(err);
          }

          if (!success) {
            if (element.setRangeText) {
              element.setRangeText(textToInsert, start, element.selectionEnd, 'end');
              element.dispatchEvent(new Event('input', { bubbles: true }));
              onChange(element.value);
            } else {
              const newValue =
                value.substring(0, start) + textToInsert + value.substring(element.selectionEnd);
              onChange(newValue);
            }
          }
          return;
        }
      }
    };

    return (
      <textarea
        ref={ref}
        className={`${styles.editor} ${className}`}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder="在这里输入 ..."
      />
    );
  },
);

Editor.displayName = 'Editor';

export default Editor;
