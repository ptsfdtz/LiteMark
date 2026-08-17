import { invoke, isTauri } from '@tauri-apps/api/core';
import { getDocument, GlobalWorkerOptions, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPageSize {
  width: number;
  height: number;
}

export interface PdfDocumentHandle {
  pageCount: number;
  getPageSize(pageNumber: number): Promise<PdfPageSize>;
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, scale: number): Promise<void>;
  cancelRender(): void;
  destroy(): Promise<void>;
}

async function readPdfBytes(path: string): Promise<Uint8Array> {
  const data = await invoke<ArrayBuffer | number[]>('read_pdf_file', { path });
  return data instanceof ArrayBuffer ? new Uint8Array(data) : Uint8Array.from(data);
}

export async function loadPdfDocument(path: string): Promise<PdfDocumentHandle> {
  if (!isTauri()) throw new Error('PDF preview requires the desktop application.');
  const data = await readPdfBytes(path);
  const loadingTask = getDocument({ data });
  const document = await loadingTask.promise;

  let activeTask: RenderTask | null = null;

  return {
    pageCount: document.numPages,

    async getPageSize(pageNumber) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      return { width: viewport.width, height: viewport.height };
    },

    async renderPage(pageNumber, canvas, scale) {
      activeTask?.cancel();
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const canvasContext = canvas.getContext('2d');
      if (!canvasContext) throw new Error('Canvas 2D context is unavailable.');
      const task = page.render({
        canvas,
        canvasContext,
        viewport,
        ...(outputScale !== 1 ? { transform: [outputScale, 0, 0, outputScale, 0, 0] } : {}),
      });
      activeTask = task;
      try {
        await task.promise;
      } finally {
        if (activeTask === task) activeTask = null;
      }
    },

    cancelRender() {
      activeTask?.cancel();
      activeTask = null;
    },

    async destroy() {
      activeTask?.cancel();
      activeTask = null;
      await loadingTask.destroy();
    },
  };
}
