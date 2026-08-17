import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { EditorProps } from '@/types/editor';
import { getEditorLanguage } from '@/types/fileTree';
import { configureMonaco } from '@/modules/markdownEditing/configureMonaco';
import styles from './Editor.module.css';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/php/php.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';

configureMonaco();

const CodeEditor: React.FC<EditorProps> = ({
  value,
  onChange,
  filePath,
  className,
  readOnly,
  theme = 'system',
  onSave,
  onSaveAs,
}) => {
  const activeTheme =
    theme === 'system' ? document.documentElement.getAttribute('data-theme') || 'light' : theme;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    if (event.shiftKey) onSaveAs?.();
    else onSave?.();
  };

  return (
    <div
      className={`${styles.editor} ${styles.codeEditor} ${className ?? ''}`}
      data-tour="editor"
      onKeyDownCapture={handleKeyDown}
    >
      <MonacoEditor
        value={value}
        language={getEditorLanguage(filePath ?? '')}
        theme={activeTheme === 'dark' ? 'vs-dark' : 'light'}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        options={{
          automaticLayout: true,
          fontFamily: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
          fontLigatures: true,
          fontSize: 13,
          lineHeight: 21,
          minimap: { enabled: false },
          padding: { top: 24, bottom: 40 },
          readOnly,
          renderLineHighlight: 'line',
          scrollbar: {
            horizontalScrollbarSize: 7,
            verticalScrollbarSize: 7,
          },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          wordWrap: 'on',
        }}
      />
    </div>
  );
};

export default CodeEditor;
