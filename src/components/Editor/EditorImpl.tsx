import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
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
  LuBold,
  LuAlignCenter,
  LuAlignLeft,
  LuAlignRight,
  LuCode,
  LuColumns3,
  LuCopy,
  LuItalic,
  LuLink,
  LuRows3,
  LuScissors,
  LuStrikethrough,
  LuTable2,
  LuTrash2,
} from 'react-icons/lu';
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import {
  applyTypedMarkdownPrefix,
  default as MarkdownInputRules,
} from '@/modules/markdownEditing/markdownInputRules';

const lowlight = createLowlight(common);
const alignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.style.textAlign || null,
  renderHTML: (attributes: { textAlign?: string }) =>
    attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {},
};
const AlignableTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), textAlign: alignAttribute };
  },
});
const AlignableTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), textAlign: alignAttribute };
  },
});
const DEFER_SERIALIZATION_CHARS = 256 * 1024;
const SERIALIZATION_DELAY_MS = 120;

const EditorImpl = React.forwardRef<WysiwygEditor, EditorProps>(
  ({ value, onChange, className, readOnly = false, onSave, onSaveAs }, ref) => {
    const { t } = useI18n();
    const serializationTimerRef = useRef<number | null>(null);
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      hasSelection: boolean;
      inTable: boolean;
    } | null>(null);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);
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
        AlignableTableHeader,
        AlignableTableCell,
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
        if (currentEditor.state.doc.content.size < DEFER_SERIALIZATION_CHARS) {
          onChangeRef.current(currentEditor.getMarkdown());
          return;
        }
        if (serializationTimerRef.current !== null) {
          window.clearTimeout(serializationTimerRef.current);
        }
        serializationTimerRef.current = window.setTimeout(() => {
          serializationTimerRef.current = null;
          onChangeRef.current(currentEditor.getMarkdown());
        }, SERIALIZATION_DELAY_MS);
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

    useEffect(
      () => () => {
        if (serializationTimerRef.current !== null) {
          window.clearTimeout(serializationTimerRef.current);
        }
      },
      [],
    );

    const flushContent = () => {
      if (!editor || serializationTimerRef.current === null) return;
      window.clearTimeout(serializationTimerRef.current);
      serializationTimerRef.current = null;
      onChangeRef.current(editor.getMarkdown());
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      flushContent();
      if (event.shiftKey) onSaveAs?.();
      else onSave?.();
    };

    return (
      <div
        className={`${styles.editor} ${className ?? ''}`}
        data-tour="editor"
        onKeyDownCapture={handleKeyDown}
        onContextMenu={(event) => {
          if (!editor || readOnly) return;
          event.preventDefault();
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            hasSelection: !editor.state.selection.empty,
            inTable: editor.isActive('table'),
          });
        }}
      >
        <div className={styles.paper}>
          <EditorContent editor={editor} />
        </div>
        {contextMenu && editor && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            label={t('editor.contextActions')}
            onClose={() => setContextMenu(null)}
            items={[
              {
                id: 'cut',
                label: t('editor.cut'),
                icon: <LuScissors />,
                shortcut: 'Ctrl+X',
                disabled: !contextMenu.hasSelection,
                onSelect: () => {
                  const { from, to } = editor.state.selection;
                  void navigator.clipboard.writeText(editor.state.doc.textBetween(from, to, '\n'));
                  editor.chain().focus().deleteSelection().run();
                },
              },
              {
                id: 'copy',
                label: t('editor.copy'),
                icon: <LuCopy />,
                shortcut: 'Ctrl+C',
                disabled: !contextMenu.hasSelection,
                onSelect: () => {
                  const { from, to } = editor.state.selection;
                  void navigator.clipboard.writeText(editor.state.doc.textBetween(from, to, '\n'));
                },
              },
              {
                id: 'paste',
                label: t('editor.paste'),
                icon: <LuCopy />,
                shortcut: 'Ctrl+V',
                onSelect: () =>
                  void navigator.clipboard
                    .readText()
                    .then((text) => editor.chain().focus().insertContent(text).run()),
              },
              {
                id: 'select-all',
                label: t('editor.selectAll'),
                icon: <LuCopy />,
                shortcut: 'Ctrl+A',
                onSelect: () => editor.chain().focus().selectAll().run(),
              },
              { id: 'format-separator', separator: true },
              {
                id: 'bold',
                label: t('toolbar.bold'),
                icon: <LuBold />,
                disabled: !contextMenu.hasSelection,
                onSelect: () => editor.chain().focus().toggleBold().run(),
              },
              {
                id: 'italic',
                label: t('toolbar.italic'),
                icon: <LuItalic />,
                disabled: !contextMenu.hasSelection,
                onSelect: () => editor.chain().focus().toggleItalic().run(),
              },
              {
                id: 'strike',
                label: t('toolbar.strikethrough'),
                icon: <LuStrikethrough />,
                disabled: !contextMenu.hasSelection,
                onSelect: () => editor.chain().focus().toggleStrike().run(),
              },
              {
                id: 'code',
                label: t('toolbar.code'),
                icon: <LuCode />,
                disabled: !contextMenu.hasSelection,
                onSelect: () => editor.chain().focus().toggleCode().run(),
              },
              {
                id: 'link',
                label: t('toolbar.link'),
                icon: <LuLink />,
                disabled: !contextMenu.hasSelection,
                onSelect: () => {
                  const href = window.prompt(t('toolbar.linkPrompt'));
                  if (href) editor.chain().focus().setLink({ href }).run();
                },
              },
              ...(contextMenu.inTable
                ? [
                    { id: 'table-separator', separator: true } as const,
                    {
                      id: 'row',
                      label: t('editor.insertRow'),
                      icon: <LuRows3 />,
                      onSelect: () => editor.chain().focus().addRowAfter().run(),
                    },
                    {
                      id: 'column',
                      label: t('editor.insertColumn'),
                      icon: <LuColumns3 />,
                      onSelect: () => editor.chain().focus().addColumnAfter().run(),
                    },
                    {
                      id: 'delete-row',
                      label: t('editor.deleteRow'),
                      icon: <LuTrash2 />,
                      danger: true,
                      onSelect: () => editor.chain().focus().deleteRow().run(),
                    },
                    {
                      id: 'delete-column',
                      label: t('editor.deleteColumn'),
                      icon: <LuTrash2 />,
                      danger: true,
                      onSelect: () => editor.chain().focus().deleteColumn().run(),
                    },
                    {
                      id: 'delete-table',
                      label: t('editor.deleteTable'),
                      icon: <LuTable2 />,
                      danger: true,
                      onSelect: () => editor.chain().focus().deleteTable().run(),
                    },
                    {
                      id: 'align-left',
                      label: t('editor.alignLeft'),
                      icon: <LuAlignLeft />,
                      onSelect: () =>
                        editor.chain().focus().setCellAttribute('textAlign', 'left').run(),
                    },
                    {
                      id: 'align-center',
                      label: t('editor.alignCenter'),
                      icon: <LuAlignCenter />,
                      onSelect: () =>
                        editor.chain().focus().setCellAttribute('textAlign', 'center').run(),
                    },
                    {
                      id: 'align-right',
                      label: t('editor.alignRight'),
                      icon: <LuAlignRight />,
                      onSelect: () =>
                        editor.chain().focus().setCellAttribute('textAlign', 'right').run(),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>
    );
  },
);

EditorImpl.displayName = 'EditorImpl';

export default EditorImpl;
