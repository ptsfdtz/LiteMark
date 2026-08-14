import React, { useEffect, useImperativeHandle } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { common, createLowlight } from 'lowlight';
import 'katex/dist/katex.min.css';
import styles from './Editor.module.css';
import 'highlight.js/styles/github.css';
import type { EditorProps, WysiwygEditor } from '@/types/editor';
import { useI18n } from '@/locales/useI18n';
import {
  applyTypedMarkdownPrefix,
  default as MarkdownInputRules,
} from '@/modules/markdownEditing/markdownInputRules';

const lowlight = createLowlight(common);

const EditorImpl = React.forwardRef<WysiwygEditor, EditorProps>(
  ({ value, onChange, className, readOnly = false, onSave, onSaveAs }, ref) => {
    const { t } = useI18n();
    const editor = useEditor({
      extensions: [
        StarterKit.configure({ link: false, codeBlock: false }),
        Markdown.configure({ markedOptions: { gfm: true } }),
        CodeBlockLowlight.configure({ lowlight }),
        Link.configure({ openOnClick: false, autolink: true }),
        Placeholder.configure({ placeholder: t('editor.placeholder') }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Image.configure({ inline: false, allowBase64: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        MarkdownInputRules,
        InlineMath.configure({
          katexOptions: { throwOnError: false, strict: 'ignore' },
        }),
        BlockMath.configure({
          katexOptions: { throwOnError: false, strict: 'ignore', displayMode: true },
        }),
      ],
      content: value,
      contentType: 'markdown',
      editable: !readOnly,
      editorProps: {
        attributes: {
          class: styles.prose,
          spellcheck: 'true',
          'aria-label': t('editor.ariaLabel'),
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        if (applyTypedMarkdownPrefix(currentEditor)) return;
        onChange(currentEditor.getMarkdown());
      },
    });

    useImperativeHandle(ref, () => editor as WysiwygEditor, [editor]);

    useEffect(() => {
      editor?.setEditable(!readOnly, false);
    }, [editor, readOnly]);

    useEffect(() => {
      if (!editor || editor.getMarkdown() === value) return;
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
    }, [editor, value]);

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (event.shiftKey) onSaveAs?.();
      else onSave?.();
    };

    return (
      <div
        className={`${styles.editor} ${className ?? ''}`}
        data-tour="editor"
        onKeyDownCapture={handleKeyDown}
      >
        <div className={styles.paper}>
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  },
);

EditorImpl.displayName = 'EditorImpl';

export default EditorImpl;
