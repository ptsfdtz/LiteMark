import { invoke, isTauri } from '@tauri-apps/api/core';
import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

async function renderElementToPngDataUrl(element: HTMLElement): Promise<string> {
  return toPng(element, {
    backgroundColor: '#ffffff',
    pixelRatio: 1,
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function renderElementToPngBytes(element: HTMLElement): Promise<Uint8Array> {
  return dataUrlToBytes(await renderElementToPngDataUrl(element));
}

export async function renderElementToPdfBytes(element: HTMLElement): Promise<Uint8Array> {
  const dataUrl = await toJpeg(element, {
    backgroundColor: '#ffffff',
    pixelRatio: 1,
    quality: 0.92,
  });
  const width = Math.max(1, element.scrollWidth);
  const height = Math.max(1, element.scrollHeight);
  const pdf = new jsPDF({ unit: 'px', format: [width, height], hotfixes: ['px_scaling'] });
  pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height, undefined, 'FAST');
  return new Uint8Array(pdf.output('arraybuffer'));
}

export async function writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
  if (!isTauri()) throw new Error('Export requires the desktop application.');
  await invoke('write_binary_file', { path, data });
}

export function exportBaseName(filePath: string | null): string {
  const name = filePath?.split(/[/\\]/).pop() || 'document';
  return name.replace(/\.[^.]+$/, '') || 'document';
}
