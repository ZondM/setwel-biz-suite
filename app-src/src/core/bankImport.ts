// Reads bank statement CSV files from South African banks (FNB, ABSA, Standard Bank,
// Nedbank, Capitec, TymeBank, Discovery and others). Banks lay their files out
// differently, so this finds the header row and the date / description / amount
// columns itself, and the owner can correct the columns if it guesses wrong.

export interface ColumnMap {
  date: number;
  description: number[];
  amount?: number; // one signed amount column
  moneyIn?: number; // or separate in / out columns
  moneyOut?: number;
}

export interface ParsedLine {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // + money in, - money out
  fingerprint: string;
}

export interface ParseResult {
  rows: string[][];
  headerRow: number; // -1 when the file has no header row
  columns: ColumnMap | null;
  lines: ParsedLine[];
}

// ---------- CSV ----------

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 20).join('\n');
  const counts = [',', ';', '\t', '|'].map((d) => ({ d, n: sample.split(d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].d;
}

export function parseCsv(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

// ---------- Values ----------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** South African statements write dates day-first (01/10/2026 is 1 October). */
export function parseDate(raw: string, fallbackYear = new Date().getFullYear()): string | null {
  const s = raw.trim().replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) return iso(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})[ -,]*(\d{2,4})?/))) {
    const mon = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mon ? iso(m[3] ? +m[3] : fallbackYear, mon, +m[1]) : null;
  }
  return null;
}

/** "R 1 234,56", "-1,234.56", "(150.00)", "150.00 DR", "1234.56CR" → number. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/ /g, ' ');
  if (!s) return null;
  let sign = 1;
  if (/\bDR\b|DR$|Dt$/i.test(s)) sign = -1;
  s = s.replace(/\b(CR|DR)\b|CR$|DR$|Dt$|Kt$/gi, '');
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  s = s.replace(/R|ZAR|\s/gi, '');
  if (s.startsWith('-')) {
    sign *= -1;
    s = s.slice(1);
  } else if (s.endsWith('-')) {
    sign *= -1;
    s = s.slice(0, -1);
  }
  s = s.replace(/^\+/, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot && s.length - lastComma - 1 <= 2) {
    s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 or 1234,56
  } else {
    s = s.replace(/,/g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(sign * parseFloat(s) * 100) / 100;
}

// ---------- Columns ----------

const isDateHeader = (h: string) => /date|datum/i.test(h) && !/value date/i.test(h);
const isInHeader = (h: string) => /credit|money in|deposit|inbetaling|kredi/i.test(h);
const isOutHeader = (h: string) => /debit|money out|withdraw|payment out|uitbetaling|debi/i.test(h);
const isAmountHeader = (h: string) => /amount|bedrag|value|transaction amount/i.test(h) && !isInHeader(h) && !isOutHeader(h);
const isDescHeader = (h: string) => /desc|narrat|details|reference|particular|transaction|beskrywing|merchant|payee/i.test(h) && !/date|amount|balance/i.test(h);

function mapFromHeader(header: string[]): ColumnMap | null {
  const date = header.findIndex(isDateHeader);
  const amount = header.findIndex(isAmountHeader);
  const moneyIn = header.findIndex(isInHeader);
  const moneyOut = header.findIndex(isOutHeader);
  const description = header.map((h, i) => (isDescHeader(h) ? i : -1)).filter((i) => i >= 0);
  if (date < 0 || (amount < 0 && (moneyIn < 0 || moneyOut < 0))) return null;
  if (description.length === 0) {
    // take the text-looking column that isn't date/amount/balance
    const other = header.findIndex((h, i) => i !== date && i !== amount && i !== moneyIn && i !== moneyOut && !/balance|saldo/i.test(h));
    if (other >= 0) description.push(other);
  }
  return amount >= 0 ? { date, description, amount } : { date, description, moneyIn, moneyOut };
}

/** For files with no header row (some FNB exports): guess columns from what the cells look like. */
function mapFromContent(rows: string[][]): ColumnMap | null {
  const sample = rows.filter((r) => r.length >= 3).slice(0, 40);
  if (sample.length < 2) return null;
  const width = Math.max(...sample.map((r) => r.length));
  const stats = Array.from({ length: width }, (_, c) => {
    const cells = sample.map((r) => r[c] ?? '');
    return {
      c,
      dates: cells.filter((v) => parseDate(v)).length,
      numbers: cells.filter((v) => v !== '' && parseAmount(v) !== null).length,
      negatives: cells.filter((v) => (parseAmount(v) ?? 0) < 0).length,
      textLen: cells.reduce((s, v) => s + (/[A-Za-z]{3}/.test(v) ? v.length : 0), 0)
    };
  });
  const date = stats.filter((s) => s.dates >= sample.length * 0.8).sort((a, b) => b.dates - a.dates)[0];
  if (!date) return null;
  const numeric = stats.filter((s) => s.c !== date.c && s.numbers >= sample.length * 0.8);
  // the signed amount column has negatives; the balance column usually doesn't
  const amount = numeric.sort((a, b) => b.negatives - a.negatives || a.c - b.c)[0];
  const desc = stats.filter((s) => s.c !== date.c && !numeric.some((n) => n.c === s.c)).sort((a, b) => b.textLen - a.textLen)[0];
  if (!amount || !desc) return null;
  return { date: date.c, description: [desc.c], amount: amount.c };
}

export function detect(rows: string[][]): { headerRow: number; columns: ColumnMap | null } {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cols = mapFromHeader(rows[i]);
    if (cols) return { headerRow: i, columns: cols };
  }
  return { headerRow: -1, columns: mapFromContent(rows) };
}

// ---------- Lines ----------

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function extractLines(rows: string[][], headerRow: number, cols: ColumnMap): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const seen = new Map<string, number>();
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const date = parseDate(r[cols.date] ?? '');
    if (!date) continue;
    let amount: number | null;
    if (cols.amount !== undefined) {
      amount = parseAmount(r[cols.amount] ?? '');
    } else {
      const inn = parseAmount(r[cols.moneyIn!] ?? '') ?? 0;
      const out = parseAmount(r[cols.moneyOut!] ?? '') ?? 0;
      amount = Math.round((Math.abs(inn) - Math.abs(out)) * 100) / 100;
    }
    if (amount === null || amount === 0) continue;
    const description = cols.description.map((c) => r[c] ?? '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'Bank transaction';
    // Same date + amount + description can legitimately appear twice; number them so both are kept.
    const base = `${date}|${amount.toFixed(2)}|${normalise(description)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    lines.push({ date, description, amount, fingerprint: `${base}|${n}` });
  }
  return lines;
}

export function parseStatement(text: string): ParseResult {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const { headerRow, columns } = detect(rows);
  return { rows, headerRow, columns, lines: columns ? extractLines(rows, headerRow, columns) : [] };
}
