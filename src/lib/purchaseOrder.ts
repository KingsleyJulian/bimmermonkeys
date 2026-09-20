import * as XLSX from 'xlsx';

export type PoLine = { part_id: string; part_number: string; part_name: string; stock_on_hand: number; quantity: number; unit_cost: number | null; remarks: string };

/**
 * Two-sheet workbook:
 *  "Purchase Order" — printable header + editable order lines for the supplier.
 *  "Import"         — the importer's own template; quantities here are ADDED to stock when the
 *                     file comes back (mode = Replenish). Edit Received Qty before importing.
 */
export function purchaseOrderWorkbook(input: {
  number: number;
  shop: Record<string, string>;
  supplier: string;
  note: string;
  preparedBy: string;
  lines: PoLine[];
}) {
  const date = new Date();
  const poNo = `PO-${String(input.number).padStart(6, '0')}`;
  const header: (string | number | null)[][] = [
    [input.shop.shop_name || 'BIMMERMONKEYS'],
    [input.shop.shop_address || ''],
    [[input.shop.shop_phone, input.shop.shop_email].filter(Boolean).join(' · ')],
    [],
    ['PURCHASE ORDER', poNo],
    ['DATE', date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase()],
    ['SUPPLIER', input.supplier.toUpperCase()],
    ['PREPARED BY', input.preparedBy.toUpperCase()],
    ['NOTE', input.note.toUpperCase()],
    [],
    ['#', 'PART NUMBER', 'DESCRIPTION', 'STOCK ON HAND', 'ORDER QTY', 'UNIT COST', 'AMOUNT', 'REMARKS'],
  ];
  const firstRow = header.length + 1; // 1-based row of the first line
  const lines = input.lines.map((l, i) => {
    const r = firstRow + i;
    return [i + 1, l.part_number, l.part_name, l.stock_on_hand, l.quantity, l.unit_cost ?? '', { f: `E${r}*F${r}` }, l.remarks];
  });
  const totalRow = firstRow + lines.length;
  const po = XLSX.utils.aoa_to_sheet([...header, ...lines, [], [null, null, null, null, null, 'TOTAL', { f: `SUM(G${firstRow}:G${totalRow - 1})` }]]);
  po['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 44 }, { wch: 14 }, { wch: 11 }, { wch: 12 }, { wch: 14 }, { wch: 30 }];
  po['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

  // Import sheet: same headers the importer auto-detects; "Stock" = quantity received.
  const imp = XLSX.utils.json_to_sheet(
    input.lines.map((l) => ({ 'Part Number': l.part_number, 'Part Name': l.part_name, Stock: l.quantity, Remarks: `RECEIVED VS ${poNo}` })),
  );
  imp['!cols'] = [{ wch: 22 }, { wch: 44 }, { wch: 10 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, po, 'Purchase Order');
  XLSX.utils.book_append_sheet(wb, imp, 'Import');
  const filename = `${poNo}-${date.toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return { poNo, filename };
}
