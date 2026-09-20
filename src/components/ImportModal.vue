<script setup lang="ts">
import { computed, ref } from 'vue';
import Modal from '@/components/Modal.vue';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { confirmDialog, warnDialog } from '@/lib/swal';
import { fmtDate } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { applyMapping, detectMapping, googleSheetCsvUrl, parseWorkbook, templateWorkbook, type ImportRow } from '@/lib/sheets';

const emit = defineEmits<{ close: []; done: [] }>();
const auth = useAuth();

const FIELDS: { key: keyof ImportRow | ''; label: string }[] = [
  { key: '', label: '— ignore —' },
  { key: 'part_number', label: 'Part number *' },
  { key: 'name', label: 'Part name' },
  { key: 'alternative_part_number', label: 'Alternative part' },
  { key: 'srp', label: 'SRP / price' },
  { key: 'stock_on_hand', label: 'Stock / quantity' },
  { key: 'make', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'year', label: 'Year' },
  { key: 'catalogue_block', label: 'Catalogue block' },
  { key: 'remarks', label: 'Remarks' },
];
const MODES = [
  { value: 'upsert', label: 'Create + update everything', help: 'New parts are created; existing parts take every mapped column. Stock is SET to the sheet value.' },
  { value: 'add_stock', label: 'Replenish — add received quantities to stock', help: 'For deliveries / purchase-order returns. Stock = current + sheet quantity. Nothing else changes.' },
  { value: 'stock_only', label: 'Set stock only (existing parts)', help: 'Stock is SET to the sheet value; prices and names untouched.' },
  { value: 'price_only', label: 'Update SRP only (existing parts)', help: 'Only the price column is applied.' },
];

const step = ref<'source' | 'map' | 'running' | 'done'>('source');
const over = ref(false);
const sheetUrl = ref('');
const fileName = ref('');
const source = ref<'file' | 'google_sheet'>('file');
const workbook = ref<ReturnType<typeof parseWorkbook> | null>(null);
const sheet = ref('');
const headers = ref<string[]>([]);
const rows = ref<Record<string, unknown>[]>([]);
const mapping = ref<Record<string, keyof ImportRow | ''>>({});
const mode = ref<'upsert' | 'stock_only' | 'price_only' | 'add_stock'>('upsert');
const note = ref('');
const progress = ref({ done: 0, total: 0 });
const result = ref({ created: 0, updated: 0, fitments: 0, models: 0, skipped: 0 });
const busy = ref(false);

const mapped = computed(() => applyMapping(rows.value, mapping.value));
const hasPartNumber = computed(() => Object.values(mapping.value).includes('part_number'));
const modeHelp = computed(() => MODES.find((m) => m.value === mode.value)?.help ?? '');

function loadBuffer(buf: ArrayBuffer) {
  workbook.value = parseWorkbook(buf);
  // A purchase-order workbook carries an "Import" sheet; prefer it and switch to replenish mode.
  const importSheet = workbook.value.sheets.find((s) => s.toLowerCase() === 'import');
  sheet.value = importSheet ?? workbook.value.sheets[0];
  if (importSheet) mode.value = 'add_stock';
  selectSheet();
  step.value = 'map';
}
function selectSheet() {
  if (!workbook.value) return;
  const r = workbook.value.read(sheet.value);
  headers.value = r.headers;
  rows.value = r.rows;
  mapping.value = detectMapping(r.headers);
}
async function onFile(file: File | undefined) {
  if (!file) return;
  fileName.value = file.name;
  source.value = 'file';
  loadBuffer(await file.arrayBuffer());
}
async function fetchSheet() {
  const url = googleSheetCsvUrl(sheetUrl.value);
  if (!url) return toast.error('Paste a Google Sheets link');
  busy.value = true;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google returned HTTP ${res.status} — is the sheet shared to anyone with the link?`);
    fileName.value = `GOOGLE SHEET ${/\/d\/([a-zA-Z0-9-_]+)/.exec(sheetUrl.value)?.[1] ?? ''}`;
    source.value = 'google_sheet';
    loadBuffer(await res.arrayBuffer());
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not fetch the sheet');
  } finally {
    busy.value = false;
  }
}

async function run() {
  if (!hasPartNumber.value) return toast.error('Map a Part number column');
  if (!note.value.trim()) return toast.error('Describe this import (e.g. delivery reference) before running it');
  const all = mapped.value;
  const modeLabel = MODES.find((m) => m.value === mode.value)?.label ?? mode.value;

  // Same file name already imported? Say so, and let the admin decide.
  const { data: prior } = await supabase
    .from('import_logs')
    .select('imported_at, imported_by_name, mode, status')
    .ilike('file_name', fileName.value)
    .order('imported_at', { ascending: false })
    .limit(1);
  if (prior && prior.length) {
    const p = prior[0] as { imported_at: string; imported_by_name: string | null; mode: string; status: string };
    const again = await warnDialog(
      'This file was already imported',
      `<b>${fileName.value}</b> was imported on <b>${fmtDate(p.imported_at)}</b> by <b>${p.imported_by_name ?? '—'}</b> (${p.mode.replace('_', ' ')}, ${p.status}).<br/><br/>Importing it again will apply the quantities a second time. Continue anyway?`,
      'Yes, import again',
    );
    if (!again) return;
  }

  const ok = await confirmDialog(
    'Run this import?',
    `<b>${all.length.toLocaleString()}</b> rows from <b>${fileName.value}</b><br/>Mode: <b>${modeLabel}</b><br/>Note: ${note.value.toUpperCase()}<br/>By: <b>${auth.profile?.display_name}</b> · ${new Date().toLocaleString('en-PH').toUpperCase()}`,
    'Import now',
  );
  if (!ok) return;

  step.value = 'running';
  progress.value = { done: 0, total: all.length };
  result.value = { created: 0, updated: 0, fitments: 0, models: 0, skipped: 0 };
  const { data: log, error: logErr } = await supabase
    .from('import_logs')
    .insert({ file_name: fileName.value, source: source.value, mode: mode.value, note: note.value.trim().toUpperCase(), row_count: all.length, imported_by: auth.profile?.id ?? null, imported_by_name: auth.profile?.display_name ?? null })
    .select('id')
    .single();
  if (logErr) {
    toast.error(logErr.message);
    step.value = 'map';
    return;
  }
  const logId = (log as { id: string }).id;
  const CHUNK = 400;
  try {
    for (let i = 0; i < all.length; i += CHUNK) {
      const { data, error } = await supabase.rpc('import_inventory', { p_rows: all.slice(i, i + CHUNK), p_mode: mode.value, p_log_id: logId });
      if (error) throw new Error(error.message);
      const r = data as typeof result.value;
      for (const k of Object.keys(result.value) as (keyof typeof result.value)[]) result.value[k] += r[k] ?? 0;
      progress.value.done = Math.min(all.length, i + CHUNK);
    }
    await supabase.from('import_logs').update({ status: 'done', finished_at: new Date().toISOString() }).eq('id', logId);
    step.value = 'done';
    toast.success(`Imported ${result.value.created + result.value.updated} parts`);
    emit('done');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    await supabase.from('import_logs').update({ status: 'failed', error: msg, finished_at: new Date().toISOString() }).eq('id', logId);
    toast.error(msg);
    step.value = 'map';
  }
}
</script>

<template>
  <Modal title="Import inventory" help="import-modal" wide @close="emit('close')">
    <template v-if="step === 'source'">
      <div class="grid cols-2">
        <div>
          <h3>Excel / CSV file</h3>
          <label class="drop mt" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; onFile($event.dataTransfer?.files[0])">
            Drop .xlsx / .xls / .csv here or click to choose
            <input type="file" accept=".xlsx,.xls,.csv,.tsv" hidden @change="onFile(($event.target as HTMLInputElement).files?.[0])" />
          </label>
          <div class="row mt">
            <button class="btn sm" @click="templateWorkbook('xlsx')">⇩ Excel template</button>
            <button class="btn sm" @click="templateWorkbook('csv')">⇩ CSV template</button>
          </div>
          <p class="help mt">A purchase-order workbook is recognised automatically: its <b>Import</b> sheet is selected and the mode switches to Replenish.</p>
        </div>
        <div>
          <h3>Google Sheets</h3>
          <div class="field mt">
            <label>Share link (anyone with the link · viewer)</label>
            <input v-model="sheetUrl" class="input lower" placeholder="https://docs.google.com/spreadsheets/d/…" />
          </div>
          <button class="btn primary mt" :disabled="busy" @click="fetchSheet">Fetch sheet</button>
        </div>
      </div>
    </template>

    <template v-else-if="step === 'map' || step === 'running'">
      <div class="card">
        <div class="grid cols-3">
          <div v-if="workbook && workbook.sheets.length > 1" class="field">
            <label>Sheet</label>
            <select v-model="sheet" class="input" @change="selectSheet"><option v-for="s in workbook.sheets" :key="s">{{ s }}</option></select>
          </div>
          <div class="field" style="grid-column: span 2">
            <label>Mode</label>
            <select v-model="mode" class="input"><option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option></select>
            <span class="help">{{ modeHelp }}</span>
          </div>
          <div class="field" style="grid-column: 1 / -1">
            <label>Import note <span class="req">*</span></label>
            <input v-model="note" class="input" placeholder="E.G. DELIVERY DR#12345 FROM SUPPLIER X · PO-000003" @input="note = note.toUpperCase()" />
            <span class="help">Logged with your name and the exact time. File: <b>{{ fileName }}</b> · {{ mapped.length.toLocaleString() }} rows with a part number.</span>
          </div>
        </div>
      </div>

      <h3 class="mt">Column mapping</h3>
      <div class="grid cols-3 mt">
        <div v-for="h in headers" :key="h" class="field">
          <label style="text-transform: none">{{ h }}</label>
          <select v-model="mapping[h]" class="input"><option v-for="f in FIELDS" :key="f.key" :value="f.key">{{ f.label }}</option></select>
        </div>
      </div>
      <p v-if="!hasPartNumber" class="err mt">Map one column to Part number to continue.</p>

      <h3 class="mt">Preview (first 8)</h3>
      <div class="table-wrap mt">
        <table>
          <thead><tr><th>Part #</th><th>Name</th><th>Alt</th><th class="num">SRP</th><th class="num">{{ mode === 'add_stock' ? 'Qty to add' : 'Stock' }}</th><th>Brand</th><th>Model</th><th>Year</th><th>Block</th><th>Remarks</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in mapped.slice(0, 8)" :key="i">
              <td class="mono">{{ r.part_number }}</td><td>{{ r.name }}</td><td>{{ r.alternative_part_number }}</td>
              <td class="num">{{ r.srp }}</td><td class="num">{{ r.stock_on_hand }}</td><td>{{ r.make }}</td><td>{{ r.model }}</td><td>{{ r.year }}</td><td>{{ r.catalogue_block }}</td><td>{{ r.remarks }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="step === 'running'" class="mt"><div class="badge info">Importing {{ progress.done }} / {{ progress.total }}…</div></div>
      <div class="row end mt">
        <button class="btn ghost" :disabled="step === 'running'" @click="step = 'source'">Back</button>
        <button class="btn success" :disabled="step === 'running' || !hasPartNumber || !mapped.length" @click="run">Import {{ mapped.length.toLocaleString() }} rows</button>
      </div>
    </template>

    <template v-else>
      <div class="grid cols-5">
        <div class="stat accent-green"><b>{{ result.created }}</b><span>Parts created</span></div>
        <div class="stat accent-blue"><b>{{ result.updated }}</b><span>Parts updated</span></div>
        <div class="stat"><b>{{ result.fitments }}</b><span>Fitments added</span></div>
        <div class="stat"><b>{{ result.models }}</b><span>Models created</span></div>
        <div class="stat accent-amber"><b>{{ result.skipped }}</b><span>Rows skipped</span></div>
      </div>
      <p class="help mt">Logged under Import history with your name and time. Every price and quantity change is in the Audit Trail with source = IMPORT.</p>
      <div class="row end mt"><button class="btn primary" @click="emit('close')">Close</button></div>
    </template>
  </Modal>
</template>
