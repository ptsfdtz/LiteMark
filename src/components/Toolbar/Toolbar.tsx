// src/components/Toolbar/Toolbar.tsx
import React from "react";
import styles from "./Toolbar.module.css";
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
} from "./toolbarUtils";

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
} from "react-icons/fa";

interface ToolbarProps {
  value: string;
  setValue: (newValue: string) => void;
  selectionStart: number;
  selectionEnd: number;
  onOpenFolder?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  value,
  setValue,
  selectionStart,
  selectionEnd,
  onOpenFolder,
  onSave,
  onSaveAs,
}) => {
  return (
    <div className={styles.toolbar}>
      {onOpenFolder && (
        <button
          onClick={onOpenFolder}
          title="最近的文件"
          className={styles.folderButton}
        >
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
      <button
        onClick={() => setValue(applyBold(value, selectionStart, selectionEnd))}
        title="粗体 (Ctrl+B)"
      >
        <FaBold />
      </button>
      <button
        onClick={() =>
          setValue(applyItalic(value, selectionStart, selectionEnd))
        }
        title="斜体 (Ctrl+I)"
      >
        <FaItalic />
      </button>
      <button
        onClick={() =>
          setValue(applyStrikethrough(value, selectionStart, selectionEnd))
        }
        title="删除线 (Ctrl+Shift+X)"
      >
        <FaStrikethrough />
      </button>
      <button
        onClick={() => setValue(applyCode(value, selectionStart, selectionEnd))}
        title="代码 (Ctrl+K)"
      >
        <FaCode />
      </button>
      <button
        onClick={() => setValue(applyLink(value, selectionStart, selectionEnd))}
        title="链接 (Ctrl+L)"
      >
        <FaLink />
      </button>
      <button
        onClick={() =>
          setValue(applyHeading(value, selectionStart, selectionEnd))
        }
        title="标题 (Ctrl+H)"
      >
        <FaHeading />
      </button>
      <button
        onClick={() =>
          setValue(applyQuote(value, selectionStart, selectionEnd))
        }
        title="引用 (Ctrl+Q)"
      >
        <FaQuoteRight />
      </button>
      <button
        onClick={() =>
          setValue(applyUnorderedList(value, selectionStart, selectionEnd))
        }
        title="无序列表 (Ctrl+U)"
      >
        <FaListUl />
      </button>
      <button
        onClick={() =>
          setValue(applyOrderedList(value, selectionStart, selectionEnd))
        }
        title="有序列表 (Ctrl+O)"
      >
        <FaListOl />
      </button>
      <button
        onClick={() => setValue(applyTable(value, selectionStart))}
        title="表格 (Ctrl+T)"
      >
        <FaTable />
      </button>
      <button
        onClick={() =>
          setValue(applyImage(value, selectionStart, selectionEnd))
        }
        title="图片 (Ctrl+Shift+I)"
      >
        <FaImage />
      </button>
    </div>
  );
};

export default Toolbar;
