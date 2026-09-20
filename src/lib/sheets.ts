import * as XLSX from 'xlsx';

export type ImportRow = {
  part_number: string;
  name?: string;
  alternative_part_number?: string;
  srp?: string;
  stock_on_hand?: string;
  make?: string;
  model?: string;
  year?: string;
  catalogue_block?: string;
  remarks?: string;
};

/** Header aliases → canonical import field. Matching is case/space-insensitive. */
const ALIASES: Record<keyof ImportRow, string[]> = {
  part_number: ['part_number', 'partnumber', 'partno', 'part', 'partsnumber', 'sku', 'pn', 'itemcode', 'code'],
  name: ['name', 'partname', 'partsname', 'description', 'desc', 'item', 'itemname'],
  alternative_part_number: ['alternative_part_number', 'alternative', 'alternativeparts', 'altpart', 'alt', 'alternate', 'supersedes', 'replacement'],
  srp: ['srp', 'qbsrp', 'price', 'sellingprice', 'unitprice', 'retail', 'amount'],
  stock_on_hand: ['stock_on_hand', 'stockonhand', 'stock', 'qty', 'quantity', 'onhand', 'soh', 'inventory', 'balance'],
  make: ['make', 'brand', 'manufacturer'],
  model: ['model', 'unitmodel', 'unit', 'vehiclemodel'],
  year: ['year', 'modelyear', 'yr'],
  catalogue_block: ['catalogue_block', 'catalogueblock', 'catalogblock', 'block', 'section', 'group', 'fig', 'figure'],
  remarks: ['remarks', 'remark', 'notes', 'note', 'comment', 'comments'],
};

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function detectMapping(headers: string[]): Record<string, keyof ImportRow | ''> {
  const map: Record<string, keyof ImportRow | ''> = {};
  const used = new Set<string>();
  for (const h of headers) {
    const n = norm(h);
    let hit: keyof ImportRow | '' = '';
    for (const [field, aliases] of Object.entries(ALIASES) as [keyof ImportRow, string[]][]) {
      if (!used.has(field) && aliases.includes(n)) {
        hit = field;
        break;
      }
    }
    if (hit) used.add(hit);
    map[h] = hit;
  }
  return map;
}

export function parseWorkbook(buffer: ArrayBuffer): { sheets: string[]; read: (sheet: string) => { headers: string[]; rows: Record<string, unknown>[] } } {
  const wb = XLSX.read(buffer, { type: 'array' });
  return {
    sheets: wb.SheetNames,
    read: (sheet) => {
      const ws = wb.Sheets[sheet];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const headers = rows.length ? Object.keys(rows[0]) : (XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] ?? []).map(String);
      return { headers, rows };
    },
  };
}

export function applyMapping(rows: Record<string, unknown>[], mapping: Record<string, keyof ImportRow | ''>): ImportRow[] {
  const out: ImportRow[] = [];
  for (const r of rows) {
    const item: Partial<ImportRow> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const raw = r[header];
      const val = String(raw ?? '').trim();
      if (field === 'srp' || field === 'stock_on_hand') {
        const num = val.replace(/[^0-9.-]/g, '');
        item[field] = num;
      } else if (field === 'year') {
        item.year = val.replace(/\D/g, '').slice(0, 4);
      } else {
        item[field] = val.toUpperCase();
      }
    }
    if (item.part_number) out.push(item as ImportRow);
  }
  return out;
}

/** Turn a Google Sheets share/edit link into its CSV export URL (sheet must be shared "anyone with the link"). */
export function googleSheetCsvUrl(link: string): string | null {
  const m = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(link);
  if (!m) return null;
  const gid = /[#&?]gid=(\d+)/.exec(link)?.[1] ?? '0';
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

/** Several sheets in one workbook (sheet names are trimmed to Excel's 31 characters). */
export function exportWorkbookSheets(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '': 'NONE' }]), s.name.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export function exportWorkbook(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

/** Blank template with two example rows; the same headers are what the importer auto-detects. */
export function templateWorkbook(format: 'xlsx' | 'csv' = 'xlsx') {
  const rows = [
    { 'Part Number': '11427566327', 'Part Name': 'OIL FILTER KIT', 'Alternative Part': '11428507683', SRP: 1250, Stock: 24, Brand: 'BMW', Model: 'X5 XDRIVE40I', Year: 2025, 'Catalogue Block': '11-42', Remarks: 'FITS B58 ENGINES' },
    { 'Part Number': '34116860907', 'Part Name': 'BRAKE PAD SET FRONT', 'Alternative Part': '', SRP: 6890, Stock: 0, Brand: 'BMW', Model: '320I', Year: 2022, 'Catalogue Block': '34-11', Remarks: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  XLSX.writeFile(wb, `inventory-template.${format}`, { bookType: format });
}
