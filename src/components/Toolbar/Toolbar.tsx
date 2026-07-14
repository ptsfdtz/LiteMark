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
} from '@/modules/markdownEditing/markdownTransforms';

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
import { applyMarkdownTransform } from '@/modules/markdownEditing/applyMarkdownTransform';

const Toolbar: React.FC<ToolbarProps> = ({
  onOpenFolder,
  onSave,
  onSaveAs,
  className,
  editorRef,
  disabled,
}) => {
  const { t } = useI18n();
  const tableTemplate = t('toolbar.tableTemplate');
  const noDrag = { 'data-tauri-drag-region': 'false' } as const;

  const applyWithUndo = (transform: (text: string, start: number, end: number) => string) => {
    const editor = editorRef.current;
    if (!disabled && editor && applyMarkdownTransform(editor, transform, 'toolbar')) {
      editor.focus();
    }
  };
  return (
    <div className={`${styles.toolbar} ${className}`} data-tauri-drag-region="true">
      {onOpenFolder && (
        <button
          onClick={onOpenFolder}
          title={t('toolbar.recentFiles')}
          aria-label={t('toolbar.recentFiles')}
          className="folderButton"
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
          {...noDrag}
        >
          <FaCopy />
        </button>
      )}
      <button
        onClick={() => applyWithUndo((t, s, e) => applyBold(t, s, e))}
        title={t('toolbar.bold')}
        aria-label={t('toolbar.bold')}
        disabled={disabled}
        {...noDrag}
      >
        <FaBold />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyItalic(t, s, e))}
        title={t('toolbar.italic')}
        aria-label={t('toolbar.italic')}
        disabled={disabled}
        {...noDrag}
      >
        <FaItalic />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyStrikethrough(t, s, e))}
        title={t('toolbar.strikethrough')}
        aria-label={t('toolbar.strikethrough')}
        disabled={disabled}
        {...noDrag}
      >
        <FaStrikethrough />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyCode(t, s, e))}
        title={t('toolbar.code')}
        aria-label={t('toolbar.code')}
        disabled={disabled}
        {...noDrag}
      >
        <FaCode />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyLink(t, s, e))}
        title={t('toolbar.link')}
        aria-label={t('toolbar.link')}
        disabled={disabled}
        {...noDrag}
      >
        <FaLink />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyHeading(t, s, e))}
        title={t('toolbar.heading')}
        aria-label={t('toolbar.heading')}
        disabled={disabled}
        {...noDrag}
      >
        <FaHeading />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyQuote(t, s, e))}
        title={t('toolbar.quote')}
        aria-label={t('toolbar.quote')}
        disabled={disabled}
        {...noDrag}
      >
        <FaQuoteRight />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyUnorderedList(t, s, e))}
        title={t('toolbar.unorderedList')}
        aria-label={t('toolbar.unorderedList')}
        disabled={disabled}
        {...noDrag}
      >
        <FaListUl />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyOrderedList(t, s, e))}
        title={t('toolbar.orderedList')}
        aria-label={t('toolbar.orderedList')}
        disabled={disabled}
        {...noDrag}
      >
        <FaListOl />
      </button>
      <button
        onClick={() => applyWithUndo((t, s) => applyTable(t, s, tableTemplate))}
        title={t('toolbar.table')}
        aria-label={t('toolbar.table')}
        disabled={disabled}
        {...noDrag}
      >
        <FaTable />
      </button>
      <button
        onClick={() => applyWithUndo((t, s, e) => applyImage(t, s, e))}
        title={t('toolbar.image')}
        aria-label={t('toolbar.image')}
        disabled={disabled}
        {...noDrag}
      >
        <FaImage />
      </button>
    </div>
  );
};

export default Toolbar;
