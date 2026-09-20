<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { onMounted, ref, watch } from 'vue';
import Pager from '@/components/Pager.vue';
import { supabase } from '@/lib/supabase';
import { fmtDate, fmtMoney } from '@/lib/format';
import { exportWorkbook } from '@/lib/sheets';

type Row = { id: number; part_id: string | null; part_number: string; field: string; old_value: string | null; new_value: string | null; changed_by_name: string | null; source: string; changed_at: string };

const rows = ref<Row[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 50;
const q = ref('');
const field = ref('');
const source = ref('');
const who = ref('');
const people = ref<string[]>([]);

/** Second log: console actions on job orders (repairs typed on invoices, …). */
type JoRow = { id: number; job_order_id: string; jo_number: string | null; action: string; old_value: string | null; new_value: string | null; changed_by_name: string | null; changed_at: string };
const tab = ref<'parts' | 'job-orders'>('parts');
const joRows = ref<JoRow[]>([]);
async function loadJo() {
  let query = supabase.from('job_order_audit').select('*').order('changed_at', { ascending: false }).limit(200);
  if (q.value.trim()) query = query.ilike('jo_number', `%${q.value.trim().toUpperCase()}%`);
  if (who.value) query = query.eq('changed_by_name', who.value);
  const { data } = await query;
  joRows.value = (data as JoRow[]) ?? [];
}

function build(count: boolean) {
  let query = supabase.from('part_audit').select('*', count ? { count: 'exact' } : undefined).order('changed_at', { ascending: false });
  if (q.value.trim()) query = query.ilike('part_number', `%${q.value.trim().toUpperCase()}%`);
  if (field.value) query = query.eq('field', field.value);
  if (source.value) query = query.eq('source', source.value);
  if (who.value) query = query.eq('changed_by_name', who.value);
  return query;
}
async function load() {
  const { data, count } = await build(true).range((page.value - 1) * pageSize, page.value * pageSize - 1);
  rows.value = (data as Row[]) ?? [];
  total.value = count ?? 0;
}
async function exportAll() {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(false).range(from, from + 999);
    const chunk = (data as Row[]) ?? [];
    for (const r of chunk) out.push({ When: fmtDate(r.changed_at), Who: r.changed_by_name ?? '', 'Part Number': r.part_number, Field: r.field, From: r.old_value ?? '', To: r.new_value ?? '', Source: r.source });
    if (chunk.length < 1000) break;
  }
  exportWorkbook(`audit-trail-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Audit', out);
}
onMounted(async () => {
  const { data } = await supabase.from('profiles').select('display_name').order('display_name');
  people.value = ((data as { display_name: string }[]) ?? []).map((p) => p.display_name);
  load();
});
watch([field, source, who], () => { page.value = 1; load(); loadJo(); });
watch(tab, () => { if (tab.value === 'job-orders') loadJo(); });
let t: ReturnType<typeof setTimeout>;
watch(q, () => { clearTimeout(t); t = setTimeout(() => { page.value = 1; load(); loadJo(); }, 250); });
</script>

<template>
  <div class="page-head">
    <div class="row"><HelpButton topic="audit" /><div><h1>Audit trail</h1><p>Who changed which price or quantity, when, and from where</p></div></div>
    <div class="row">
      <button class="btn" :class="{ primary: tab === 'parts' }" @click="tab = 'parts'">Inventory</button>
      <button class="btn" :class="{ primary: tab === 'job-orders' }" @click="tab = 'job-orders'">Job orders</button>
      <button v-if="tab === 'parts'" class="btn success" @click="exportAll">⇩ Export Excel</button>
    </div>
  </div>
  <div class="toolbar">
    <input v-model="q" class="input grow mono" :placeholder="tab === 'parts' ? 'Part number' : 'JO number'" />
    <select v-if="tab === 'parts'" v-model="field" class="input">
      <option value="">All fields</option>
      <option value="srp">SRP</option>
      <option value="stock_on_hand">Stock on hand</option>
      <option value="name">Name</option>
      <option value="alternative_part_number">Alternative part</option>
      <option value="low_stock_threshold">Low-stock threshold</option>
      <option value="notes">Remarks</option>
      <option value="created">Created</option>
      <option value="deleted">Deleted</option>
    </select>
    <select v-if="tab === 'parts'" v-model="source" class="input"><option value="">All sources</option><option value="manual">Manual</option><option value="import">Import</option><option value="install">Install (part used on a job order)</option></select>
    <select v-model="who" class="input"><option value="">Everyone</option><option v-for="p in people" :key="p" :value="p">{{ p }}</option></select>
  </div>
  <div v-if="tab === 'job-orders'" class="table-wrap">
    <table>
      <thead><tr><th>When</th><th>Who</th><th>JO #</th><th>Action</th><th>From</th><th>To</th></tr></thead>
      <tbody>
        <tr v-for="r in joRows" :key="r.id">
          <td>{{ fmtDate(r.changed_at) }}</td>
          <td>{{ r.changed_by_name ?? '—' }}</td>
          <td class="mono"><router-link :to="`/job-orders/${r.job_order_id}`">{{ r.jo_number ?? '—' }}</router-link></td>
          <td><span class="badge info">{{ r.action.replace(/_/g, ' ') }}</span></td>
          <td style="max-width: 320px; white-space: pre-wrap">{{ r.old_value ?? '—' }}</td>
          <td style="max-width: 320px; white-space: pre-wrap"><b>{{ r.new_value ?? '—' }}</b></td>
        </tr>
        <tr v-if="!joRows.length"><td colspan="6" class="empty">No job order actions recorded yet</td></tr>
      </tbody>
    </table>
  </div>
  <div v-else class="table-wrap">
    <table>
      <thead><tr><th>When</th><th>Who</th><th>Part number</th><th>Field</th><th>From</th><th>To</th><th>Source</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td>{{ fmtDate(r.changed_at) }}</td>
          <td>{{ r.changed_by_name ?? '—' }}</td>
          <td class="mono">{{ r.part_number }}</td>
          <td><span class="badge" :class="r.field === 'srp' ? 'info' : r.field === 'stock_on_hand' ? 'warn' : r.field === 'deleted' ? 'danger' : ''">{{ r.field === 'notes' ? 'remarks' : r.field.replace(/_/g, ' ') }}</span></td>
          <td>{{ r.field === 'srp' ? fmtMoney(r.old_value) : (r.old_value ?? '—') }}</td>
          <td><b>{{ r.field === 'srp' ? fmtMoney(r.new_value) : (r.new_value ?? '—') }}</b></td>
          <td><span class="badge" :class="r.source === 'import' ? 'info' : r.source === 'install' ? 'warn' : ''">{{ r.source }}</span></td>
        </tr>
        <tr v-if="!rows.length"><td colspan="7" class="empty">No changes recorded yet</td></tr>
      </tbody>
    </table>
  </div>
  <Pager v-if="tab === 'parts'" :page="page" :page-size="pageSize" :total="total" @change="(p) => { page = p; load(); }" />
</template>
