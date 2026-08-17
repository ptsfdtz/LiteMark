import {
  Extension,
  InputRule,
  type Editor,
  textblockTypeInputRule,
  wrappingInputRule,
} from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

const MarkdownInputRules = Extension.create({
  name: 'markdownInputRules',

  addInputRules() {
    const { blockquote, bulletList, heading, orderedList, paragraph, taskItem, taskList } =
      this.editor.schema.nodes;

    if (
      !blockquote ||
      !bulletList ||
      !heading ||
      !orderedList ||
      !paragraph ||
      !taskItem ||
      !taskList
    ) {
      return [];
    }

    return [
      textblockTypeInputRule({
        find: /^(#{1,6})\s$/,
        type: heading,
        getAttributes: (match) => ({ level: match[1]?.length }),
      }),
      wrappingInputRule({ find: /^[-+*]\s$/, type: bulletList }),
      wrappingInputRule({
        find: /^(\d+)\.\s$/,
        type: orderedList,
        getAttributes: (match) => ({ start: Number(match[1]) }),
      }),
      wrappingInputRule({ find: /^>\s$/, type: blockquote }),
      new InputRule({
        find: /^-\s\[([ xX])\]\s$/,
        handler: ({ chain, match, range }) => {
          const checked = match[1]?.toLowerCase() === 'x';
          chain()
            .deleteRange({ from: range.from, to: range.to })
            .toggleTaskList()
            .updateAttributes('taskItem', { checked })
            .run();
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Space: () => {
        const { $from } = this.editor.state.selection;
        if ($from.parent.type.name !== 'paragraph') return false;

        const marker = $from.parent.textBetween(0, $from.parentOffset, '', '');
        const removeMarker = () =>
          this.editor.chain().focus().deleteRange({ from: $from.start(), to: $from.pos });

        const headingMatch = marker.match(/^(#{1,6})$/);
        if (headingMatch) {
          return removeMarker()
            .setHeading({ level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6 })
            .run();
        }

        if (/^[-+*]$/.test(marker)) return removeMarker().toggleBulletList().run();
        if (/^\d+\.$/.test(marker)) return removeMarker().toggleOrderedList().run();
        if (marker === '>') return removeMarker().toggleBlockquote().run();

        const taskMatch = marker.match(/^-\s\[([ xX])\]$/);
        if (taskMatch) {
          return removeMarker()
            .toggleTaskList()
            .updateAttributes('taskItem', { checked: taskMatch[1].toLowerCase() === 'x' })
            .run();
        }

        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput: (_view, _from, _to, text) => {
            if (text !== ' ') return false;

            const { $from } = this.editor.state.selection;
            if ($from.parent.type.name !== 'paragraph') return false;

            const marker = $from.parent.textBetween(0, $from.parentOffset, '', '');
            const removeMarker = () =>
              this.editor.chain().focus().deleteRange({ from: $from.start(), to: $from.pos });

            const headingMatch = marker.match(/^(#{1,6})$/);
            if (headingMatch) {
              removeMarker()
                .setHeading({ level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6 })
                .run();
              return true;
            }

            if (/^[-+*]$/.test(marker)) {
              removeMarker().toggleBulletList().run();
              return true;
            }
            if (/^\d+\.$/.test(marker)) {
              removeMarker().toggleOrderedList().run();
              return true;
            }
            if (marker === '>') {
              removeMarker().toggleBlockquote().run();
              return true;
            }

            const taskMatch = marker.match(/^-\s\[([ xX])\]$/);
            if (taskMatch) {
              removeMarker()
                .toggleTaskList()
                .updateAttributes('taskItem', { checked: taskMatch[1].toLowerCase() === 'x' })
                .run();
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

export default MarkdownInputRules;

export function applyTypedMarkdownPrefix(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== 'paragraph') return false;

  const marker = $from.parent.textBetween(0, $from.parentOffset, '', '');
  const removeMarker = () =>
    editor.chain().focus().deleteRange({ from: $from.start(), to: $from.pos });

  const headingMatch = marker.match(/^(#{1,6}) $/);
  if (headingMatch) {
    return removeMarker()
      .setHeading({ level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6 })
      .run();
  }
  if (/^[-+*] $/.test(marker)) return removeMarker().toggleBulletList().run();
  if (/^\d+\. $/.test(marker)) return removeMarker().toggleOrderedList().run();
  if (marker === '> ') return removeMarker().toggleBlockquote().run();

  const taskMatch = marker.match(/^-\s\[([ xX])\]\s$/);
  if (!taskMatch) return false;

  return removeMarker()
    .toggleTaskList()
    .updateAttributes('taskItem', { checked: taskMatch[1].toLowerCase() === 'x' })
    .run();
}
