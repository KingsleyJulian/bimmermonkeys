<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { partImageUrl } from '@/lib/parts';
import Pager from '@/components/Pager.vue';
import Modal from '@/components/Modal.vue';
import ImportModal from '@/components/ImportModal.vue';
import PurchaseOrderModal from '@/components/PurchaseOrderModal.vue';
import { fmtDate } from '@/lib/format';
import PartModal from '@/components/PartModal.vue';
import CatalogueRequests from '@/components/CatalogueRequests.vue';
import ModelPicker from '@/components/ModelPicker.vue';
import { modelLabel, type VehicleModel } from '@/lib/models';
import { supabase } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import { exportWorkbook, templateWorkbook } from '@/lib/sheets';
import { toast } from '@/lib/toast';

type Row = {
  part_id: string; fitment_id: string | null; part_number: string; name: string; alternative_part_number: string; srp: number | null;
  stock_on_hand: number; low_stock_threshold: number; status: string; image_path: string | null; model_id: string | null; make: string | null; model: string | null;
  year: number | null; catalogue_block: string | null; remarks: string;
};

const rows = ref<Row[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 50;
const q = ref('');
const route = useRoute();
const status = ref((route.query.status as string) || '');
const make = ref('');
const modelId = ref('');
const year = ref('');
const models = ref<VehicleModel[]>([]);
const years = ref<number[]>([]);
const loading = ref(false);
const editing = ref<string | null | undefined>(undefined); // undefined = closed, null = new
const importing = ref(false);
/** Uncatalogued app requests: the panel, and the request a new part is being created for. */
const showRequests = ref(route.query.requests === '1');
const requestsPanel = ref<InstanceType<typeof CatalogueRequests> | null>(null);
const pendingRequests = ref(0);
const creatingFor = ref<{ id: string; part_number: string; part_name: string; notes: string | null } | null>(null);
async function countRequests() {
  const { count } = await supabase.from('part_requests').select('id', { count: 'exact', head: true }).is('part_id', null).neq('status', 'CANCELLED');
  pendingRequests.value = count ?? 0;
}
function createFromRequest(r: { id: string; part_number: string; part_name: string; notes: string | null }) {
  creatingFor.value = r;
  editing.value = null;
}
async function onPartCreated(id: string) {
  if (!creatingFor.value) return;
  const { error } = await supabase.rpc('catalogue_part_request', { p_request_id: creatingFor.value.id, p_part_id: id });
  if (error) toast.error(`Part created but the request was not linked: ${error.message}`);
  else toast.success('Part created and the job order request updated');
  creatingFor.value = null;
  requestsPanel.value?.load();
  countRequests();
}
const managingModels = ref(false);
/** Selection is per part (the grid shows one row per fitment). */
const selected = ref<Map<string, Row>>(new Map());
const ordering = ref(false);
type ImportLog = { id: string; file_name: string; mode: string; note: string; row_count: number; created: number; updated: number; skipped: number; status: string; imported_by_name: string | null; imported_at: string };
const importLogs = ref<ImportLog[]>([]);
const showLogs = ref(false);
const pageAllSelected = computed(() => rows.value.length > 0 && rows.value.every((r) => selected.value.has(r.part_id)));
function toggle(r: Row) {
  const next = new Map(selected.value);
  if (next.has(r.part_id)) next.delete(r.part_id);
  else next.set(r.part_id, r);
  selected.value = next;
}
function togglePage() {
  const next = new Map(selected.value);
  if (pageAllSelected.value) rows.value.forEach((r) => next.delete(r.part_id));
  else rows.value.forEach((r) => next.set(r.part_id, r));
  selected.value = next;
}
async function loadLogs() {
  const { data } = await supabase.from('import_logs').select('*').order('imported_at', { ascending: false }).limit(15);
  importLogs.value = (data as ImportLog[]) ?? [];
}

const makes = computed(() => Array.from(new Set(models.value.map((m) => m.make))).sort());
const modelsForMake = computed(() => models.value.filter((m) => !make.value || m.make === make.value));

async function loadModels() {
  const { data } = await supabase.from('vehicle_models').select('id, make, model, year').order('make').order('model').order('year');
  models.value = (data as VehicleModel[]) ?? [];
  years.value = Array.from(new Set(models.value.map((m) => m.year).filter((y): y is number => y !== null))).sort((a, b) => b - a);
}

function buildQuery(count: boolean) {
  let query = supabase.from('inventory_rows').select('*', count ? { count: 'exact' } : undefined).order('part_number').order('make').order('model').order('year', { ascending: false });
  const term = q.value.trim().toUpperCase();
  if (term) query = query.or(`part_number.ilike.%${term}%,name.ilike.%${term}%,alternative_part_number.ilike.%${term}%,remarks.ilike.%${term}%`);
  if (status.value) query = query.eq('status', status.value);
  if (make.value) query = query.eq('make', make.value);
  if (modelId.value) query = query.eq('model_id', modelId.value);
  if (year.value) query = query.eq('year', Number(year.value));
  return query;
}

async function load() {
  loading.value = true;
  const { data, count, error } = await buildQuery(true).range((page.value - 1) * pageSize, page.value * pageSize - 1);
  if (error) toast.error(error.message);
  rows.value = (data as Row[]) ?? [];
  total.value = count ?? 0;
  loading.value = false;
}

async function exportAll() {
  toast.info('Preparing export…');
  const out: Record<string, unknown>[] = [];
  const CH = 1000;
  for (let from = 0; ; from += CH) {
    const { data, error } = await buildQuery(false).range(from, from + CH - 1);
    if (error) return toast.error(error.message);
    const chunk = (data as Row[]) ?? [];
    for (const r of chunk) {
      out.push({
        Status: r.status, 'Stock On Hand': r.stock_on_hand, Brand: r.make ?? '', 'Unit Model': r.model ?? '', Year: r.year ?? '',
        'Catalogue Block': r.catalogue_block ?? '', 'Part Number': r.part_number, 'Part Name': r.name, 'Alternative Part': r.alternative_part_number, SRP: r.srp ?? '', Remarks: r.remarks ?? '',
      });
    }
    if (chunk.length < CH) break;
  }
  exportWorkbook(`inventory-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Inventory', out);
  toast.success(`Exported ${out.length.toLocaleString()} rows`);
}

onMounted(async () => {
  await loadModels();
  load();
  loadLogs();
  countRequests();
});
watch([status, make, modelId, year], () => {
  if (make.value && modelId.value && !models.value.find((m) => m.id === modelId.value && m.make === make.value)) modelId.value = '';
  page.value = 1;
  load();
});
let t: ReturnType<typeof setTimeout>;
watch(q, () => {
  clearTimeout(t);
  t = setTimeout(() => {
    page.value = 1;
    load();
  }, 250);
});

const tone = (s: string) => (s === 'AVAILABLE' ? 'ok' : s === 'STOCK_LOW' ? 'warn' : s === 'NO_STOCK' ? 'danger' : '');
async function deleteModel(m: VehicleModel) {
  if (!confirm(`Delete ${m.make} ${m.model}? Only possible when no part is linked to it.`)) return;
  const { error } = await supabase.from('vehicle_models').delete().eq('id', m.id);
  if (error) return toast.error(error.message.includes('violates foreign key') ? 'Parts are still linked to this model' : error.message);
  toast.success('Model removed');
  loadModels();
}
</script>

<template>
  <div class="page-head">
    <div class="row"><HelpButton topic="inventory" /><div><h1>Parts inventory</h1><p>{{ total.toLocaleString() }} fitment rows · statuses: available, low (below threshold), no stock, no data (no SRP)</p></div></div>
    <div class="row">
      <button class="btn" :class="{ primary: showRequests }" @click="showRequests = !showRequests">Catalogue requests<span v-if="pendingRequests" class="badge warn" style="margin-left: 6px">{{ pendingRequests }}</span></button>
      <button class="btn" @click="managingModels = true">Models</button>
      <button class="btn" @click="templateWorkbook('xlsx')">⇩ Template</button>
      <button class="btn" @click="importing = true">⇪ Import</button>
      <button class="btn" @click="showLogs = !showLogs">Import history</button>
      <button class="btn primary" :disabled="!selected.size" @click="ordering = true">Purchase order ({{ selected.size }})</button>
      <button class="btn success" @click="exportAll">⇩ Export Excel</button>
      <button class="btn primary" @click="editing = null">+ New part</button>
    </div>
  </div>

  <CatalogueRequests v-if="showRequests" ref="requestsPanel" class="mb" @create="createFromRequest" @changed="countRequests(); load()" />

  <div class="toolbar">
    <input v-model="q" class="input grow mono" placeholder="Search part number, name, alternative or remarks" />
    <select v-model="status" class="input">
      <option value="">All statuses</option>
      <option value="AVAILABLE">Available</option>
      <option value="STOCK_LOW">Stock low</option>
      <option value="NO_STOCK">No stock</option>
      <option value="NO_DATA">No data</option>
    </select>
    <select v-model="make" class="input">
      <option value="">All brands</option>
      <option v-for="m in makes" :key="m" :value="m">{{ m }}</option>
    </select>
    <select v-model="modelId" class="input">
      <option value="">All models</option>
      <option v-for="m in modelsForMake" :key="m.id" :value="m.id">{{ make ? `${m.model}${m.year ? ` · ${m.year}` : ''}` : modelLabel(m) }}</option>
    </select>
    <select v-model="year" class="input">
      <option value="">All years</option>
      <option v-for="y in years" :key="y" :value="String(y)">{{ y }}</option>
    </select>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width: 36px"><input type="checkbox" :checked="pageAllSelected" title="Select all on this page" @change="togglePage" /></th><th></th><th>Status</th><th class="num">Stock</th><th>Brand</th><th>Unit model</th><th>Year</th><th>Block</th>
          <th>Part number</th><th>Part name</th><th>Alternative</th><th class="num">SRP</th><th>Remarks</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.fitment_id ?? r.part_id" class="clickable" :class="{ picked: selected.has(r.part_id) }" @click="editing = r.part_id">
          <td @click.stop><input type="checkbox" :checked="selected.has(r.part_id)" @change="toggle(r)" /></td>
          <td style="width: 52px"><img v-if="partImageUrl(r.image_path)" :src="partImageUrl(r.image_path)!" class="part-thumb" alt="" loading="lazy" /><div v-else class="part-thumb ph">▣</div></td>
          <td><span class="badge" :class="tone(r.status)">{{ r.status.replace('_', ' ') }}</span></td>
          <td class="num"><b>{{ r.stock_on_hand }}</b></td>
          <td>{{ r.make ?? '—' }}</td>
          <td>{{ r.model ?? '—' }}</td>
          <td>{{ r.year ?? '—' }}</td>
          <td>{{ r.catalogue_block || '—' }}</td>
          <td class="mono">{{ r.part_number }}</td>
          <td>{{ r.name }}</td>
          <td style="color: var(--success)">{{ r.alternative_part_number || '' }}</td>
          <td class="num">{{ fmtMoney(r.srp) }}</td>
          <td style="max-width: 220px; white-space: normal; color: var(--text-muted)">{{ r.remarks || '' }}</td>
          <td class="num"><button class="btn sm" @click.stop="editing = r.part_id">View</button></td>
        </tr>
        <tr v-if="!rows.length && !loading"><td colspan="14" class="empty">No parts match — import a sheet or add a part</td></tr>
      </tbody>
    </table>
  </div>
  <Pager :page="page" :page-size="pageSize" :total="total" @change="(p) => { page = p; load(); }" />
  <div v-if="selected.size" class="card mt row between">
    <div class="chips"><span v-for="[id, r] in selected" :key="id" class="badge info" style="cursor: pointer" title="Remove" @click="toggle(r)">{{ r.part_number }} ✕</span></div>
    <div class="row"><button class="btn sm ghost" @click="selected = new Map()">Clear</button><button class="btn sm primary" @click="ordering = true">Purchase order ({{ selected.size }})</button></div>
  </div>

  <div v-if="showLogs" class="card mt">
    <h3>Import history</h3>
    <div class="table-wrap mt">
      <table>
        <thead><tr><th>When</th><th>Who</th><th>File</th><th>Mode</th><th>Note</th><th class="num">Rows</th><th class="num">Created</th><th class="num">Updated</th><th class="num">Skipped</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="l in importLogs" :key="l.id">
            <td>{{ fmtDate(l.imported_at) }}</td><td>{{ l.imported_by_name ?? '—' }}</td><td style="text-transform: none">{{ l.file_name }}</td><td>{{ l.mode.replace('_', ' ') }}</td><td>{{ l.note }}</td>
            <td class="num">{{ l.row_count }}</td><td class="num">{{ l.created }}</td><td class="num">{{ l.updated }}</td><td class="num">{{ l.skipped }}</td>
            <td><span class="badge" :class="l.status === 'done' ? 'ok' : l.status === 'failed' ? 'danger' : 'warn'">{{ l.status }}</span></td>
          </tr>
          <tr v-if="!importLogs.length"><td colspan="10" class="dim">No imports yet</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <PurchaseOrderModal v-if="ordering" :parts="Array.from(selected.values())" @close="ordering = false" @done="ordering = false; selected = new Map(); loadLogs()" />

  <PartModal
    v-if="editing !== undefined"
    :part-id="editing"
    :models="models"
    :initial="creatingFor ? { part_number: creatingFor.part_number, name: creatingFor.part_name, notes: creatingFor.notes ? `REQUESTED AS: ${creatingFor.notes}` : '' } : undefined"
    @close="editing = undefined; creatingFor = null"
    @saved="load"
    @created="onPartCreated"
    @model-created="loadModels"
  />
  <ImportModal v-if="importing" @close="importing = false" @done="() => { loadModels(); load(); loadLogs(); }" />

  <Modal v-if="managingModels" title="Vehicle models" help="models-modal" wide @close="managingModels = false">
    <p class="help">Pick a brand from the same list the app uses, type the model and year. Matches appear as you type — pick one instead of creating a duplicate.</p>
    <div class="card mt"><ModelPicker :models="models" allow-create @created="loadModels" /></div>
    <div class="table-wrap mt" style="max-height: 50vh">
      <table>
        <thead><tr><th>Brand</th><th>Model</th><th>Year</th><th></th></tr></thead>
        <tbody>
          <tr v-for="m in models" :key="m.id">
            <td>{{ m.make }}</td><td>{{ m.model }}</td><td>{{ m.year ?? '—' }}</td>
            <td class="num"><button class="btn sm ghost" @click="deleteModel(m)">Delete</button></td>
          </tr>
          <tr v-if="!models.length"><td colspan="4" class="dim">No models yet</td></tr>
        </tbody>
      </table>
    </div>
  </Modal>
</template>

<style scoped>
.part-thumb { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; background: var(--surface-alt); display: block; }
.part-thumb.ph { display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
tr.picked td { background: var(--info-soft); }
input[type='checkbox'] { width: 16px; height: 16px; accent-color: var(--m-light-blue); cursor: pointer; }
</style>
