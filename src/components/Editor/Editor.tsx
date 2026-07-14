import React, { Suspense } from 'react';
import styles from './Editor.module.css';
import type { EditorProps, MarkdownEditor } from '@/types/editor';

const LazyEditor = React.lazy(async () => {
  const [{ configureMonaco }, editorModule] = await Promise.all([
    import('@/modules/markdownEditing/configureMonaco'),
    import('./EditorImpl'),
  ]);
  configureMonaco();
  return { default: editorModule.default };
});

const Editor = React.forwardRef<MarkdownEditor, EditorProps>((props, ref) => (
  <Suspense fallback={<div className={`${styles.editor} ${props.className}`} data-tour="editor" />}>
    <LazyEditor {...props} ref={ref} />
  </Suspense>
));

Editor.displayName = 'Editor';

export default Editor;
