import React, { useEffect } from "react";
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
} from "../Toolbar/toolbarUtils";

interface KeyboardShortcutsProps {
  value: string;
  setValue: (newValue: string) => void;
  selectionStart: number;
  selectionEnd: number;
}

const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  value,
  setValue,
  selectionStart,
  selectionEnd,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return;

      if (!e.ctrlKey && !e.metaKey) return;

      let newValue: string | null = null;

      switch (e.key) {
        case "b":
        case "B":
          e.preventDefault();
          newValue = applyBold(value, selectionStart, selectionEnd);
          break;
        case "i":
        case "I":
          e.preventDefault();
          newValue = applyItalic(value, selectionStart, selectionEnd);
          break;
        case "k":
        case "K":
          e.preventDefault();
          newValue = applyCode(value, selectionStart, selectionEnd);
          break;
        case "l":
        case "L":
          e.preventDefault();
          newValue = applyLink(value, selectionStart, selectionEnd);
          break;
        case "h":
        case "H":
          e.preventDefault();
          newValue = applyHeading(value, selectionStart, selectionEnd);
          break;
        case "q":
        case "Q":
          e.preventDefault();
          newValue = applyQuote(value, selectionStart, selectionEnd);
          break;
        case "u":
        case "U":
          e.preventDefault();
          newValue = applyUnorderedList(value, selectionStart, selectionEnd);
          break;
        case "o":
        case "O":
          e.preventDefault();
          newValue = applyOrderedList(value, selectionStart, selectionEnd);
          break;
        case "t":
        case "T":
          e.preventDefault();
          newValue = applyTable(value, selectionStart);
          break;
        default:
          break;
      }

      if (e.shiftKey) {
        switch (e.key) {
          case "X":
            e.preventDefault();
            newValue = applyStrikethrough(value, selectionStart, selectionEnd);
            break;
          case "I":
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [value, setValue, selectionStart, selectionEnd]);

  return null;
};

export default KeyboardShortcuts;
