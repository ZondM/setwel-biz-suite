import { saveOrDownloadFile } from '../db/storageAdapter';

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.map(escapeCsvCell).join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))];
  const csv = lines.join('\n');
  await saveOrDownloadFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, csv, 'text/csv');
}
