import { useCallback, useEffect, useRef, useState } from 'react';

export interface DocumentReference {
  name: string;
  path: string;
  modified: Date;
}

export type RecentDocument = DocumentReference;

export interface DocumentStorage {
  getStartupDocument(): Promise<string | null>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  createUntitled(workDirectory: string, content: string): Promise<string>;
  rename(path: string, newName: string): Promise<string>;
  list(directory: string): Promise<DocumentReference[]>;
}

export interface RecentDocumentsStore {
  load(): Promise<RecentDocument[]>;
  save(documents: RecentDocument[]): Promise<void>;
}

export interface DocumentSessionDependencies {
  storage: DocumentStorage;
  recentDocuments: RecentDocumentsStore;
  confirmDiscard(): Promise<boolean>;
  onRecentDocumentsError?(error: unknown): void;
  onInitializationError?(error: unknown): void;
}

export interface DocumentSession {
  ready: boolean;
  content: string;
  currentDocumentPath: string | null;
  isDirty: boolean;
  recentDocuments: RecentDocument[];
  directoryDocuments: DocumentReference[] | null;
  setContent(content: string): void;
  openDocument(path: string): Promise<boolean>;
  createDocument(workDirectory: string, initialContent: string): Promise<boolean>;
  saveDocument(): Promise<boolean>;
  saveDocumentAs(path: string): Promise<boolean>;
  renameDocument(newName: string): Promise<boolean>;
  removeRecentDocument(path: string): Promise<void>;
  loadDirectory(directory: string): Promise<void>;
  clearDirectoryDocuments(): void;
  canClose(): Promise<boolean>;
}

interface InitialDocumentSession {
  recentDocuments: RecentDocument[];
  currentDocumentPath: string | null;
  content: string;
  recordAsRecent: boolean;
}

function mergeRecentDocuments(
  primary: RecentDocument[],
  secondary: RecentDocument[],
): RecentDocument[] {
  const seen = new Set<string>();
  return [...primary, ...secondary]
    .filter((document) => {
      if (seen.has(document.path)) return false;
      seen.add(document.path);
      return true;
    })
    .slice(0, 50);
}

export default function useDocumentSession(
  dependencies: DocumentSessionDependencies,
): DocumentSession {
  const {
    storage,
    recentDocuments: recentDocumentsStore,
    confirmDiscard,
    onRecentDocumentsError,
    onInitializationError,
  } = dependencies;
  const [ready, setReady] = useState(false);
  const [content, setContent] = useState('');
  const contentRef = useRef('');
  const [persistedContent, setPersistedContent] = useState('');
  const persistedContentRef = useRef('');
  const [currentDocumentPath, setCurrentDocumentPath] = useState<string | null>(null);
  const currentDocumentPathRef = useRef<string | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [directoryDocuments, setDirectoryDocuments] = useState<DocumentReference[] | null>(null);
  const recentDocumentsRef = useRef<RecentDocument[]>([]);
  const recentDocumentsQueueRef = useRef<Promise<void> | null>(null);
  const recentDocumentsRevisionRef = useRef(0);
  const initializationRef = useRef<Promise<InitialDocumentSession> | null>(null);
  const initializationCommittedRef = useRef(false);
  const onRecentDocumentsErrorRef = useRef(onRecentDocumentsError);
  const onInitializationErrorRef = useRef(onInitializationError);
  onRecentDocumentsErrorRef.current = onRecentDocumentsError;
  onInitializationErrorRef.current = onInitializationError;
  const documentIntentRef = useRef(0);
  const editRevisionRef = useRef(0);
  const sessionEpochRef = useRef(0);
  const directoryIntentRef = useRef(0);
  const documentWriteQueueRef = useRef<Promise<void> | null>(null);

  const enqueueDocumentWrite = useCallback(<T>(operation: () => Promise<T>): Promise<T> => {
    const previous = documentWriteQueueRef.current;
    const result = previous ? previous.then(operation, operation) : operation();
    documentWriteQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const enqueueRecentDocumentsMutation = useCallback(
    (update: (documents: RecentDocument[]) => RecentDocument[]): Promise<void> => {
      recentDocumentsRevisionRef.current += 1;
      const operation = async () => {
        const nextRecentDocuments = update(recentDocumentsRef.current);
        await recentDocumentsStore.save(nextRecentDocuments);
        recentDocumentsRef.current = nextRecentDocuments;
        setRecentDocuments(nextRecentDocuments);
      };
      const previous = recentDocumentsQueueRef.current;
      const result = previous ? previous.then(operation, operation) : operation();
      recentDocumentsQueueRef.current = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    [recentDocumentsStore],
  );

  const recordRecentDocument = useCallback(
    async (path: string, replacesPath?: string) => {
      const document: RecentDocument = {
        name: path.split(/[/\\]/).pop() || path,
        path,
        modified: new Date(),
      };
      try {
        await enqueueRecentDocumentsMutation((documents) =>
          [
            document,
            ...documents.filter((recent) => recent.path !== path && recent.path !== replacesPath),
          ].slice(0, 50),
        );
      } catch (error) {
        onRecentDocumentsErrorRef.current?.(error);
      }
    },
    [enqueueRecentDocumentsMutation],
  );

  useEffect(() => {
    let active = true;
    const initializationIntent = documentIntentRef.current;
    const initializationEditRevision = editRevisionRef.current;
    const initializationRecentRevision = recentDocumentsRevisionRef.current;
    initializationRef.current ??= (async () => {
      let documents: RecentDocument[] = [];
      try {
        documents = await recentDocumentsStore.load();
      } catch (error) {
        onInitializationErrorRef.current?.(error);
      }

      let startupDocument: string | null = null;
      try {
        startupDocument = await storage.getStartupDocument();
      } catch (error) {
        onInitializationErrorRef.current?.(error);
      }

      const path = startupDocument ?? documents[0]?.path ?? null;
      if (!path) {
        return {
          recentDocuments: documents,
          currentDocumentPath: null,
          content: '',
          recordAsRecent: false,
        };
      }

      try {
        const initialContent = await storage.read(path);
        return {
          recentDocuments: documents,
          currentDocumentPath: path,
          content: initialContent,
          recordAsRecent: startupDocument !== null,
        };
      } catch (error) {
        onInitializationErrorRef.current?.(error);
        return {
          recentDocuments: documents,
          currentDocumentPath: null,
          content: '',
          recordAsRecent: false,
        };
      }
    })();

    void initializationRef.current.then(async (initial) => {
      if (!active || initializationCommittedRef.current) return;
      initializationCommittedRef.current = true;
      if (recentDocumentsRevisionRef.current === initializationRecentRevision) {
        recentDocumentsRef.current = initial.recentDocuments;
        setRecentDocuments(initial.recentDocuments);
      } else {
        try {
          await enqueueRecentDocumentsMutation((documents) =>
            mergeRecentDocuments(documents, initial.recentDocuments),
          );
        } catch (error) {
          onRecentDocumentsErrorRef.current?.(error);
        }
        if (!active) return;
      }
      if (
        documentIntentRef.current === initializationIntent &&
        editRevisionRef.current === initializationEditRevision
      ) {
        sessionEpochRef.current += 1;
        currentDocumentPathRef.current = initial.currentDocumentPath;
        contentRef.current = initial.content;
        persistedContentRef.current = initial.content;
        setCurrentDocumentPath(initial.currentDocumentPath);
        setContent(initial.content);
        setPersistedContent(initial.content);
        if (initial.currentDocumentPath && initial.recordAsRecent) {
          void recordRecentDocument(initial.currentDocumentPath);
        }
      }
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [enqueueRecentDocumentsMutation, recentDocumentsStore, recordRecentDocument, storage]);

  const isDirty = content !== persistedContent;
  const updateContent = (nextContent: string) => {
    editRevisionRef.current += 1;
    contentRef.current = nextContent;
    setContent(nextContent);
  };
  const canReplaceDocument = async () =>
    contentRef.current === persistedContentRef.current || confirmDiscard();

  const createDocument = async (workDirectory: string, initialContent: string) => {
    const intent = ++documentIntentRef.current;
    const editRevision = editRevisionRef.current;
    if (!(await canReplaceDocument())) return false;

    const path = await storage.createUntitled(workDirectory, initialContent);
    if (documentIntentRef.current !== intent || editRevisionRef.current !== editRevision)
      return false;
    sessionEpochRef.current += 1;
    currentDocumentPathRef.current = path;
    contentRef.current = initialContent;
    persistedContentRef.current = initialContent;
    setCurrentDocumentPath(path);
    setContent(initialContent);
    setPersistedContent(initialContent);
    await recordRecentDocument(path);
    return true;
  };

  const openDocument = async (path: string) => {
    const intent = ++documentIntentRef.current;
    const editRevision = editRevisionRef.current;
    if (!(await canReplaceDocument())) return false;

    const nextContent = await storage.read(path);
    if (documentIntentRef.current !== intent || editRevisionRef.current !== editRevision)
      return false;
    sessionEpochRef.current += 1;
    currentDocumentPathRef.current = path;
    contentRef.current = nextContent;
    persistedContentRef.current = nextContent;
    setCurrentDocumentPath(path);
    setContent(nextContent);
    setPersistedContent(nextContent);
    await recordRecentDocument(path);
    return true;
  };

  const saveDocument = async () => {
    if (!currentDocumentPathRef.current) return false;
    const sessionEpoch = sessionEpochRef.current;
    const contentSnapshot = contentRef.current;
    const saved = await enqueueDocumentWrite(async () => {
      const path = currentDocumentPathRef.current;
      if (sessionEpochRef.current !== sessionEpoch || !path) return false;
      await storage.write(path, contentSnapshot);
      if (sessionEpochRef.current === sessionEpoch) {
        persistedContentRef.current = contentSnapshot;
        setPersistedContent(contentSnapshot);
      }
      return true;
    });
    if (!saved) return false;
    return true;
  };

  const saveDocumentAs = async (path: string) => {
    const intent = ++documentIntentRef.current;
    const sessionEpoch = sessionEpochRef.current;
    const contentSnapshot = contentRef.current;
    const saved = await enqueueDocumentWrite(async () => {
      if (documentIntentRef.current !== intent || sessionEpochRef.current !== sessionEpoch) {
        return false;
      }
      await storage.write(path, contentSnapshot);
      if (documentIntentRef.current !== intent || sessionEpochRef.current !== sessionEpoch) {
        return false;
      }
      currentDocumentPathRef.current = path;
      persistedContentRef.current = contentSnapshot;
      setPersistedContent(contentSnapshot);
      return true;
    });
    if (!saved) return false;
    setCurrentDocumentPath(path);
    await recordRecentDocument(path);
    return true;
  };

  const renameDocument = async (newName: string) => {
    if (!currentDocumentPathRef.current) return false;
    const sessionEpoch = sessionEpochRef.current;
    const renamedDocument = await enqueueDocumentWrite(async () => {
      if (sessionEpochRef.current !== sessionEpoch) return null;
      const previousPath = currentDocumentPathRef.current;
      if (!previousPath) return null;
      const nextPath = await storage.rename(previousPath, newName);
      if (sessionEpochRef.current === sessionEpoch) currentDocumentPathRef.current = nextPath;
      return { previousPath, nextPath };
    });
    if (!renamedDocument) return false;
    if (sessionEpochRef.current !== sessionEpoch) return false;
    setCurrentDocumentPath(renamedDocument.nextPath);
    await recordRecentDocument(renamedDocument.nextPath, renamedDocument.previousPath);
    return true;
  };

  const removeRecentDocument = async (path: string) => {
    await enqueueRecentDocumentsMutation((documents) =>
      documents.filter((document) => document.path !== path),
    );
  };

  const loadDirectory = async (directory: string) => {
    const intent = ++directoryIntentRef.current;
    const scannedDocuments = await storage.list(directory);
    if (directoryIntentRef.current === intent) setDirectoryDocuments(scannedDocuments);
  };

  const clearDirectoryDocuments = () => {
    directoryIntentRef.current += 1;
    setDirectoryDocuments(null);
  };

  const canClose = async () => {
    await documentWriteQueueRef.current;
    return canReplaceDocument();
  };

  return {
    ready,
    content,
    currentDocumentPath,
    isDirty,
    recentDocuments,
    directoryDocuments,
    setContent: updateContent,
    openDocument,
    createDocument,
    saveDocument,
    saveDocumentAs,
    renameDocument,
    removeRecentDocument,
    loadDirectory,
    clearDirectoryDocuments,
    canClose,
  };
}
