// AI receipt reading: shrink the photo on the device, send it to the Setwel server
// (api/scan.php), and get back the details to fill in an expense.

import { apiPost } from './api';
import { LicenceInfo } from './licence';

export interface ScannedReceipt {
  supplier_name: string;
  supplier_vat_number: string;
  document_number: string;
  date: string;
  total: number;
  vat_amount: number;
  description: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PreparedFile {
  mediaType: string;
  base64: string;
  previewDataUrl?: string; // stored with the expense (images only)
}

const MAX_SIDE = 1600;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That photo could not be opened. Please try another one.'));
    img.src = src;
  });
}

/** Phone photos are often 4-10 MB; a 1600px JPEG is plenty to read a slip and uploads fast on mobile data. */
export async function prepareFile(file: File): Promise<PreparedFile> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error('That PDF is too big. Please use one under 5 MB.');
    const url = await readAsDataUrl(file);
    return { mediaType: 'application/pdf', base64: url.split(',')[1] };
  }
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo or a PDF.');
  const img = await loadImage(await readAsDataUrl(file));
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { mediaType: 'image/jpeg', base64: dataUrl.split(',')[1], previewDataUrl: dataUrl };
}

export async function scanReceipt(licence: LicenceInfo, file: PreparedFile, categories: string[]): Promise<{ fields: ScannedReceipt; remaining: number | null }> {
  return apiPost('scan.php', { mediaType: file.mediaType, data: file.base64, categories }, licence);
}
