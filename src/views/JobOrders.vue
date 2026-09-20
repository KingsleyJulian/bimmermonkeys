<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PartRequestStatus from '@/components/PartRequestStatus.vue';
import type { PartRequestRow } from '@/lib/parts';
import Pager from '@/components/Pager.vue';
import JobOrderStatusControl from '@/components/JobOrderStatusControl.vue';
import ReportModal from '@/components/ReportModal.vue';
import PrintMenu from '@/components/PrintMenu.vue';
import { STATUSES, STATUS_META } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';

type Row = {
  id: string;
  jo_number: string;
  local_ref: string;
  status: string;
  category: string;
  entry_type: string;
  odometer_km: number;
  created_at: string;
  created_by_name: string | null;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  customer_name: string;
  customer_phone: string;
  media_count: number;
  report_count: number;
};

const router = useRouter();
const route = useRoute();
const rows = ref<Row[]>([]);
const parts = ref<Record<string, PartRequestRow[]>>({});
const total = ref(0);
const page = ref(1);
const pageSize = 25;
const q = ref('');
const status = ref<string>((route.query.status as string) || 'all');
const reportFor = ref<Row | null>(null);
const category = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  let query = supabase
    .from('job_order_list')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page.value - 1) * pageSize, page.value * pageSize - 1);
  if (status.value === 'open') query = query.in('status', ['IN_PROGRESS', 'FOR_PARTS_ORDER', 'FOR_PAYMENT']);
  else if (status.value === 'finished') query = query.in('status', ['COMPLETED', 'RELEASED']);
  else if (status.value !== 'all') query = query.eq('status', status.value);
  if (category.value) query = query.eq('category', category.value);
  const term = q.value.toUpperCase().replace(/[\s-]/g, '');
  if (term) query = query.ilike('search_text', `%${term}%`);
  const { data, count } = await query;
  rows.value = (data as Row[]) ?? [];
  total.value = count ?? 0;
  loading.value = false;
  await loadParts();
}

async function loadParts() {
  const ids = rows.value.map((r) => r.id);
  if (!ids.length) {
    parts.value = {};
    return;
  }
  const { data } = await supabase.from('part_requests').select('*').in('job_order_id', ids).order('created_at');
  const map: Record<string, PartRequestRow[]> = {};
  for (const p of (data as PartRequestRow[]) ?? []) (map[p.job_order_id] ??= []).push(p);
  parts.value = map;
}

onMounted(load);
watch([status, category], () => {
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
</script>

<template>
  <div class="page-head">
    <div class="row"><HelpButton topic="job-orders" /><div><h1>Job orders</h1><p>Every entry synced from the shop floor</p></div></div>
  </div>
  <div class="toolbar">
    <input v-model="q" class="input grow mono" placeholder="Search plate, chassis, engine, name or JO #" />
    <select v-model="status" class="input">
      <option value="all">All statuses</option>
      <option value="open">Not finished (any)</option>
      <option value="finished">Finished + released</option>
      <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_META[s].label }}</option>
    </select>
    <select v-model="category" class="input">
      <option value="">All categories</option>
      <option v-for="c in ['PMS', 'ENGINE', 'ELECTRICAL', 'WARRANTY', 'RECALL', 'CRASH']" :key="c" :value="c">{{ c }}</option>
    </select>
  </div>
  <div class="table-wrap">
    <table class="jo-table">
      <thead>
        <tr>
          <th>Status</th><th>Vehicle</th><th>Customer</th><th>Job order</th><th>Service</th><th>Parts requested</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="j in rows" :key="j.id" class="clickable" @click="router.push(`/job-orders/${j.id}`)">
          <td @click.stop><JobOrderStatusControl :job-order-id="j.id" :status="j.status" :plate="j.plate" @changed="(s) => (j.status = s)" @saved="load" /></td>
          <td>
            <div class="stack">
              <span class="plate lg">{{ j.plate }}</span>
              <b>{{ j.make }} {{ j.model }}</b>
              <span class="sub">{{ j.color }} · {{ j.year }}</span>
            </div>
          </td>
          <td>
            <div class="stack">
              <b>{{ j.customer_name }}</b>
              <span class="sub">{{ j.customer_phone || 'NO PHONE' }}</span>
            </div>
          </td>
          <td>
            <div class="stack">
              <span class="mono">{{ j.jo_number }}</span>
              <span class="sub">REF {{ j.local_ref }}</span>
              <span class="sub">{{ fmtDate(j.created_at) }}</span>
              <span class="sub">{{ j.created_by_name ?? 'UNASSIGNED' }}</span>
            </div>
          </td>
          <td>
            <div class="stack">
              <span class="badge">{{ j.category }}</span>
              <span class="sub">{{ j.entry_type.replace('_', ' ') }}</span>
              <span class="sub">{{ j.odometer_km.toLocaleString() }} KM</span>
            </div>
          </td>
          <td class="parts-cell" @click.stop>
            <div v-for="p in parts[j.id] ?? []" :key="p.id" class="part-line">
              <PartRequestStatus :id="p.id" :status="p.status" :label="p.part_name" @changed="(s) => (p.status = s)" />
              <span class="part-name" :title="p.part_number">{{ p.part_name }} <span class="dim">× {{ p.quantity }}</span></span>
            </div>
            <span v-if="!(parts[j.id] ?? []).length" class="dim">—</span>
          </td>
          <td class="actions" @click.stop>
            <div class="stack end">
              <PrintMenu :job-order-id="j.id" :status="j.status" :has-parts="(parts[j.id] ?? []).length > 0" compact />
              <button class="btn sm" @click.stop="reportFor = j">+ Report</button>
            </div>
          </td>
        </tr>
        <tr v-if="!rows.length && !loading"><td colspan="7" class="empty">Nothing matches</td></tr>
      </tbody>
    </table>
  </div>
  <Pager :page="page" :page-size="pageSize" :total="total" @change="(p) => { page = p; load(); }" />
  <ReportModal v-if="reportFor" :job-order-id="reportFor.id" :label="`${reportFor.plate} · ${reportFor.jo_number}`" @close="reportFor = null" @saved="reportFor = null; load()" />
</template>

<style scoped>
/* Roomier grid: related facts stack inside one cell instead of spreading across fourteen columns. */
.jo-table th { padding: 12px 16px; }
.jo-table td { padding: 16px; vertical-align: top; line-height: 1.5; }
.stack { display: flex; flex-direction: column; gap: 4px; min-width: 120px; }
.stack.end { align-items: flex-end; min-width: 0; }
.stack b { font-weight: 700; }
.sub { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.plate.lg { font-size: 15px; padding: 4px 10px; align-self: flex-start; }
.parts-cell { min-width: 280px; }
.part-line { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.part-line + .part-line { margin-top: 6px; }
.part-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.actions { white-space: nowrap; }
</style>
