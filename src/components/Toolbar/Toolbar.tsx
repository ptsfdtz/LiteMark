// src/components/Toolbar/Toolbar.tsx
import React from 'react';
import styles from './Toolbar.module.css';
import { ToolbarProps } from '../../types/toolbar';
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
} from './toolbarUtils';

import {
  FaBold,
  FaItalic,
  FaStrikethrough,
  FaCode,
  FaLink,
  FaHeading,
  FaQuoteRight,
  FaListUl,
  FaListOl,
  FaTable,
  FaImage,
  FaFolderOpen,
  FaSave,
  FaCopy,
} from 'react-icons/fa';

const Toolbar: React.FC<ToolbarProps> = ({
  value,
  setValue,
  selectionStart,
  selectionEnd,
  onOpenFolder,
  onSave,
  onSaveAs,
  className,
  editorRef,
}) => {
  const applyWithUndo = (transform: (text: string, start: number, end: number) => string) => {
    const el = editorRef && (editorRef.current as HTMLTextAreaElement | HTMLInputElement);
    if (el) {
      el.focus();
      const s = el.selectionStart ?? 0;
      const e = el.selectionEnd ?? 0;
      const originalValue = el.value;
      const newValue = transform(originalValue, s, e);
      const replacement = newValue.slice(s, newValue.length - (originalValue.length - e));
      let success = false;
      try {
        el.setSelectionRange(s, e);
        success = document.execCommand('insertText', false, replacement);
      } catch (err) {
        console.error('execCommand failed', err);
      }

      if (!success) {
        if (typeof el.setRangeText === 'function') {
          el.setRangeText(replacement, s, e, 'end');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          setValue(el.value);
        } else {
          setValue(newValue);
        }
      }
      return;
    }
    setValue(transform(value, selectionStart, selectionEnd));
  };
  return (
    <div className={`${styles.toolbar} ${className}`}>
      {onOpenFolder && (
        <button onClick={onOpenFolder} title="最近的文件" className="folderButton">
          <FaFolderOpen />
        </button>
      )}
      {onSave && (
        <button onClick={onSave} title="保存 (Ctrl+S)">
          <FaSave />
        </button>
      )}
      {onSaveAs && (
        <button onClick={onSaveAs} title="另存为 (Ctrl+Shift+S)">
          <FaCopy />
        </button>
      )}
      <button onClick={() => applyWithUndo((t, s, e) => applyBold(t, s, e))} title="粗体 (Ctrl+B)">
        <FaBold />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyItalic(t, s, e))}
        title="斜体 (Ctrl+I)"
      >
        <FaItalic />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyStrikethrough(t, s, e))}
        title="删除线 (Ctrl+Shift+X)"
      >
        <FaStrikethrough />
      </button>
      <button onClick={() => applyWithUndo((t, s, e) => applyCode(t, s, e))} title="代码 (Ctrl+K)">
        <FaCode />
      </button>
      <button onClick={() => applyWithUndo((t, s, e) => applyLink(t, s, e))} title="链接 (Ctrl+L)">
        <FaLink />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyHeading(t, s, e))}
        title="标题 (Ctrl+H)"
      >
        <FaHeading />
      </button>
      <button onClick={() => applyWithUndo((t, s, e) => applyQuote(t, s, e))} title="引用 (Ctrl+Q)">
        <FaQuoteRight />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyUnorderedList(t, s, e))}
        title="无序列表 (Ctrl+U)"
      >
        <FaListUl />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyOrderedList(t, s, e))}
        title="有序列表 (Ctrl+O)"
      >
        <FaListOl />
      </button>
      <button onClick={() => applyWithUndo((t, s) => applyTable(t, s))} title="表格 (Ctrl+T)">
        <FaTable />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyImage(t, s, e))}
        title="图片 (Ctrl+Shift+I)"
      >
        <FaImage />
      </button>
    </div>
  );
};

export default Toolbar;
