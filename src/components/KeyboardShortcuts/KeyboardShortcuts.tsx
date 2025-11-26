// src/components/KeyboardShortcuts/KeyboardShortcuts.tsx
import React, { useEffect } from 'react';
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
} from '../Toolbar/toolbarUtils';

import { KeyboardShortcutsProps } from '../../types/keyboardShortcuts';

const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  value,
  setValue,
  selectionStart,
  selectionEnd,
  onSave,
  onSaveAs,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return;

      // Ctrl/Cmd + S 保存
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl/Cmd + Shift + S 另存为
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onSaveAs?.();
        return;
      }

      if (!e.ctrlKey && !e.metaKey) return;

      let newValue: string | null = null;

      switch (e.key) {
        case 'b':
        case 'B':
          e.preventDefault();
          newValue = applyBold(value, selectionStart, selectionEnd);
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          newValue = applyItalic(value, selectionStart, selectionEnd);
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          newValue = applyCode(value, selectionStart, selectionEnd);
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          newValue = applyLink(value, selectionStart, selectionEnd);
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          newValue = applyHeading(value, selectionStart, selectionEnd);
          break;
        case 'q':
        case 'Q':
          e.preventDefault();
          newValue = applyQuote(value, selectionStart, selectionEnd);
          break;
        case 'u':
        case 'U':
          e.preventDefault();
          newValue = applyUnorderedList(value, selectionStart, selectionEnd);
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          newValue = applyOrderedList(value, selectionStart, selectionEnd);
          break;
        case 't':
        case 'T':
          e.preventDefault();
          newValue = applyTable(value, selectionStart);
          break;
        default:
          break;
      }

      if (e.shiftKey) {
        switch (e.key) {
          case 'X':
            e.preventDefault();
            newValue = applyStrikethrough(value, selectionStart, selectionEnd);
            break;
          case 'I':
            e.preventDefault();
            newValue = applyImage(value, selectionStart, selectionEnd);
            break;
          default:
            break;
        }
      }

      if (newValue !== null) {
        setValue(newValue);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [value, setValue, selectionStart, selectionEnd, onSave, onSaveAs]);

  return null;
};

export default KeyboardShortcuts;
