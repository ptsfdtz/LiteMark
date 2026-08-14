import React from 'react';
import EditorImpl from './EditorImpl';
import type { EditorProps, WysiwygEditor } from '@/types/editor';
import { getFileViewKind } from '@/types/fileTree';

const LazyCodeEditor = React.lazy(() => import('./CodeEditor'));

const Editor = React.forwardRef<WysiwygEditor, EditorProps>((props, ref) => {
  const viewKind = props.filePath ? getFileViewKind(props.filePath) : 'markdown';

  if (viewKind === 'code') {
    return (
      <React.Suspense fallback={<div className={props.className} data-tour="editor" />}>
        <LazyCodeEditor {...props} />
      </React.Suspense>
    );
  }

  return <EditorImpl {...props} ref={ref} />;
});

Editor.displayName = 'Editor';

export default Editor;
