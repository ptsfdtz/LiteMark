// src/components/Toolbar/Toolbar.tsx
import React from 'react';
import styles from './Toolbar.module.css';
import { ToolbarProps } from '@/types/toolbar';
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
import { useI18n } from '@/locales/useI18n';

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
  const { t } = useI18n();
  const tableTemplate = t('toolbar.tableTemplate');
  const noDrag = { 'data-tauri-drag-region': 'false' } as const;

  const applyWithUndo = (transform: (text: string, start: number, end: number) => string) => {
    const editor = editorRef?.current;

    // Handle Monaco Editor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (editor && (editor as any).getModel) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (editor as any).getModel();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selection = (editor as any).getSelection();
      if (model && selection) {
        const startOffset = model.getOffsetAt(selection.getStartPosition());
        const endOffset = model.getOffsetAt(selection.getEndPosition());
        const text = model.getValue();

        const newText = transform(text, startOffset, endOffset);

        // Use executeEdits to preserve undo stack
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).executeEdits('toolbar', [
          {
            range: model.getFullModelRange(),
            text: newText,
            forceMoveMarkers: true,
          },
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).focus();
        return;
      }
    }

    // Handle HTMLTextAreaElement (fallback)
    const el = editorRef && (editorRef.current as HTMLTextAreaElement | HTMLInputElement);
    if (el && el.setSelectionRange) {
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
    <div className={`${styles.toolbar} ${className}`} data-tauri-drag-region="true">
      {onOpenFolder && (
        <button
          onClick={onOpenFolder}
          title={t('toolbar.recentFiles')}
          aria-label={t('toolbar.recentFiles')}
          className="folderButton"
          {...noDrag}
        >
          <FaFolderOpen />
        </button>
      )}
      {onSave && (
        <button
          onClick={onSave}
          title={t('toolbar.save')}
          aria-label={t('toolbar.save')}
          {...noDrag}
        >
          <FaSave />
        </button>
      )}
      {onSaveAs && (
        <button
          onClick={onSaveAs}
          title={t('toolbar.saveAs')}
          aria-label={t('toolbar.saveAs')}
          {...noDrag}
        >
          <FaCopy />
        </button>
      )}
      <button
        onClick={() => applyWithUndo((t, s, e) => applyBold(t, s, e))}
        title={t('toolbar.bold')}
        aria-label={t('toolbar.bold')}
        {...noDrag}
      >
        <FaBold />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyItalic(t, s, e))}
        title={t('toolbar.italic')}
        aria-label={t('toolbar.italic')}
        {...noDrag}
      >
        <FaItalic />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyStrikethrough(t, s, e))}
        title={t('toolbar.strikethrough')}
        aria-label={t('toolbar.strikethrough')}
        {...noDrag}
      >
        <FaStrikethrough />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyCode(t, s, e))}
        title={t('toolbar.code')}
        aria-label={t('toolbar.code')}
        {...noDrag}
      >
        <FaCode />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyLink(t, s, e))}
        title={t('toolbar.link')}
        aria-label={t('toolbar.link')}
        {...noDrag}
      >
        <FaLink />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyHeading(t, s, e))}
        title={t('toolbar.heading')}
        aria-label={t('toolbar.heading')}
        {...noDrag}
      >
        <FaHeading />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyQuote(t, s, e))}
        title={t('toolbar.quote')}
        aria-label={t('toolbar.quote')}
        {...noDrag}
      >
        <FaQuoteRight />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyUnorderedList(t, s, e))}
        title={t('toolbar.unorderedList')}
        aria-label={t('toolbar.unorderedList')}
        {...noDrag}
      >
        <FaListUl />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyOrderedList(t, s, e))}
        title={t('toolbar.orderedList')}
        aria-label={t('toolbar.orderedList')}
        {...noDrag}
      >
        <FaListOl />
      </button>
      <button
        onClick={() => applyWithUndo((t, s) => applyTable(t, s, tableTemplate))}
        title={t('toolbar.table')}
        aria-label={t('toolbar.table')}
        {...noDrag}
      >
        <FaTable />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyImage(t, s, e))}
        title={t('toolbar.image')}
        aria-label={t('toolbar.image')}
        {...noDrag}
      >
        <FaImage />
      </button>
    </div>
  );
};

export default Toolbar;
