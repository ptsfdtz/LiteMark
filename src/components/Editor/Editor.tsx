import React from 'react';
import EditorImpl from './EditorImpl';
import type { EditorProps, WysiwygEditor } from '@/types/editor';
import { getFileViewKind } from '@/types/fileTree';
import ImagePreview from './ImagePreview';

const LazyCodeEditor = React.lazy(() => import('./CodeEditor'));
const LazyPdfPreview = React.lazy(() => import('./PdfPreview'));

const Editor = React.forwardRef<WysiwygEditor, EditorProps>((props, ref) => {
  const viewKind = props.filePath ? getFileViewKind(props.filePath) : 'markdown';

  if (viewKind === 'code') {
    return (
      <React.Suspense fallback={<div className={props.className} data-tour="editor" />}>
        <LazyCodeEditor {...props} />
      </React.Suspense>
    );
  }

  if (viewKind === 'image' && props.filePath) {
    return <ImagePreview filePath={props.filePath} className={props.className} />;
  }

  if (viewKind === 'pdf' && props.filePath) {
    return (
      <React.Suspense fallback={<div className={props.className} data-tour="editor" />}>
        <LazyPdfPreview filePath={props.filePath} className={props.className} />
      </React.Suspense>
    );
  }

  return <EditorImpl {...props} ref={ref} />;
});

Editor.displayName = 'Editor';

export default Editor;
