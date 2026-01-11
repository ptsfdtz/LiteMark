// src/components/Editor/Editor.tsx
import React, { useEffect, useState, useRef } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import styles from './Editor.module.css';
import { EditorProps } from '@/types/editor';
import { useI18n } from '@/locales/useI18n';
import {
  applyBold,
  applyItalic,
  applyStrikethrough,
  applyCode,
  applyLink,
  applyHeading,
  applyQuote,
  applyUnorderedList,
  applyOrderedList,
  applyTable,
  applyImage,
} from '@/components/Toolbar/toolbarUtils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Editor = React.forwardRef<any, EditorProps>(
  (
    { value, onChange, onSelectionChange, className, theme, onSave, onSaveAs, minimapEnabled },
    ref,
  ) => {
    const { t } = useI18n();
    const [resolvedTheme, setResolvedTheme] = useState('light');
    const onSaveRef = useRef(onSave);
    const onSaveAsRef = useRef(onSaveAs);
    const tableTemplateRef = useRef(t('toolbar.tableTemplate'));

    useEffect(() => {
      onSaveRef.current = onSave;
    }, [onSave]);

    useEffect(() => {
      onSaveAsRef.current = onSaveAs;
    }, [onSaveAs]);

    useEffect(() => {
      tableTemplateRef.current = t('toolbar.tableTemplate');
    }, [t]);

    useEffect(() => {
      const updateTheme = () => {
        if (theme === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setResolvedTheme(isDark ? 'vs-dark' : 'light');
        } else {
          setResolvedTheme(theme === 'dark' ? 'vs-dark' : 'light');
        }
      };

      updateTheme();

      if (theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
          setResolvedTheme(e.matches ? 'vs-dark' : 'light');
        };
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
      }
    }, [theme]);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
      if (typeof ref === 'function') {
        ref(editor);
      } else if (ref) {
        ref.current = editor;
      }

      editor.onDidChangeCursorSelection((e) => {
        if (onSelectionChange) {
          const model = editor.getModel();
          if (model) {
            const selection = e.selection;
            const start = model.getOffsetAt(selection.getStartPosition());
            const end = model.getOffsetAt(selection.getEndPosition());
            onSelectionChange(start, end);
          }
        }
      });

      type TableTransform = (text: string, pos: number, template?: string) => string;
      type Transform = ((text: string, start: number, end: number) => string) | TableTransform;

      const applyEdit = (transform: Transform, isTable = false) => {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (model && selection) {
          const startOffset = model.getOffsetAt(selection.getStartPosition());
          const endOffset = model.getOffsetAt(selection.getEndPosition());
          const text = model.getValue();
          let newText: string;
          if (isTable) {
            const fn = transform as TableTransform;
            newText = fn(text, startOffset, tableTemplateRef.current);
          } else {
            const fn = transform as (text: string, start: number, end: number) => string;
            newText = fn(text, startOffset, endOffset);
          }
          editor.executeEdits('keyboard', [
            {
              range: model.getFullModelRange(),
              text: newText,
              forceMoveMarkers: true,
            },
          ]);
        }
      };

      // Shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => applyEdit(applyBold));
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => applyEdit(applyItalic));
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyX, () =>
        applyEdit(applyStrikethrough),
      );
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => applyEdit(applyCode));
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => applyEdit(applyLink));
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => applyEdit(applyHeading));
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyQ, () => applyEdit(applyQuote));
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU, () =>
        applyEdit(applyUnorderedList),
      );
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, () =>
        applyEdit(applyOrderedList),
      );
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT, () =>
        applyEdit(applyTable, true),
      );
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI, () =>
        applyEdit(applyImage),
      );

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (onSaveRef.current) {
          onSaveRef.current();
        }
      });
      editor.addCommand(monaco.KeyCode.Enter, () => {
        const model = editor.getModel();
        const pos = editor.getPosition();
        if (!model || !pos) return;

        const lineNumber = pos.lineNumber;
        const lineText = model.getLineContent(lineNumber);

        const unordered = lineText.match(/^(\s*)-\s+/);
        const ordered = lineText.match(/^(\s*)(\d+)\.\s+/);

        if (unordered) {
          const indent = unordered[1] || '';
          const insert = '\n' + indent + '- ';
          editor.executeEdits('list-enter', [
            {
              range: new monaco.Range(lineNumber, pos.column, lineNumber, pos.column),
              text: insert,
              forceMoveMarkers: true,
            },
          ]);
          // place cursor after the new list marker
          const nextPos = new monaco.Position(lineNumber + 1, indent.length + 3);
          editor.setPosition(nextPos);
          editor.revealPositionInCenterIfOutsideViewport(nextPos);
          return;
        }

        if (ordered) {
          const indent = ordered[1] || '';
          const current = parseInt(ordered[2], 10);
          const next = current + 1;
          const insert = '\n' + indent + next + '. ';
          editor.executeEdits('list-enter', [
            {
              range: new monaco.Range(lineNumber, pos.column, lineNumber, pos.column),
              text: insert,
              forceMoveMarkers: true,
            },
          ]);
          const nextPos = new monaco.Position(
            lineNumber + 1,
            indent.length + String(next).length + 3,
          );
          editor.setPosition(nextPos);
          editor.revealPositionInCenterIfOutsideViewport(nextPos);
          return;
        }

        // Fallback: insert a normal newline
        editor.trigger('keyboard', 'type', { text: '\n' });
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
        if (onSaveAsRef.current) {
          onSaveAsRef.current();
        }
      });
    };

    return (
      <div className={`${styles.editor} ${className}`}>
        <MonacoEditor
          height="100%"
          language="markdown"
          theme={resolvedTheme}
          value={value}
          onChange={(value) => onChange(value || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: !!minimapEnabled },
            wordWrap: 'on',
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontFamily:
              "'Consolas', 'Menlo', 'Monaco', 'Courier New', monospace, 'Microsoft YaHei'",
          }}
        />
      </div>
    );
  },
);

Editor.displayName = 'Editor';

export default Editor;
