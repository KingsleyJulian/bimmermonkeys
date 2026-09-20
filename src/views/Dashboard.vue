<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import JobOrderStatusControl from '@/components/JobOrderStatusControl.vue';
import { supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';
import { STATUS_META, type Status } from '@/lib/status';

type Stats = Record<string, number>;
type Recent = {
  id: string; jo_number: string; status: string; category: string; created_at: string; created_by_name: string | null;
  plate: string; make: string; model: string; color: string; customer_name: string; media_count: number; report_count: number;
};
type OpenPart = { id: string; part_name: string; part_number: string; quantity: number; status: string; job_order_id: string; job_orders: { jo_number: string; vehicles: { plate: string } | null } | null };

const router = useRouter();
const stats = ref<Stats>({});
const recent = ref<Recent[]>([]);
const openParts = ref<OpenPart[]>([]);

const pipeline = computed(() => [
  { key: 'in_progress', status: 'IN_PROGRESS' as Status, color: 'var(--warning)' },
  { key: 'for_parts', status: 'FOR_PARTS_ORDER' as Status, color: 'var(--m-light-blue)' },
  { key: 'for_payment', status: 'FOR_PAYMENT' as Status, color: 'var(--m-dark-blue)' },
  { key: 'finished', status: 'COMPLETED' as Status, color: 'var(--success)' },
]);
const pipelineTotal = computed(() => pipeline.value.reduce((n, p) => n + (stats.value[p.key] ?? 0), 0) || 1);

async function load() {
  const [{ data: s }, { data: r }, { data: p }] = await Promise.all([
    supabase.rpc('admin_dashboard'),
    supabase.from('job_order_list').select('*').order('created_at', { ascending: false }).limit(8),
    supabase.from('part_requests').select('id, part_name, part_number, quantity, status, job_order_id, job_orders(jo_number, vehicles(plate))').in('status', ['REQUESTED', 'ORDERED']).order('created_at', { ascending: false }).limit(8),
  ]);
  stats.value = (s as Stats) ?? {};
  recent.value = (r as Recent[]) ?? [];
  openParts.value = (p as unknown as OpenParts) ?? [];
}
onMounted(load);
type OpenParts = OpenPart[];
</script>

<template>
  <div class="page-head">
    <div class="row"><HelpButton topic="dashboard" /><div><h1>Dashboard</h1><p>{{ new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase() }}</p></div></div>
    <router-link class="btn primary" to="/job-orders">Open job orders</router-link>
  </div>

  <!-- Pipeline: where every unfinished job order sits right now -->
  <div class="card">
    <div class="row between">
      <h3>Work in the shop</h3>
      <span class="badge info">{{ stats.today ?? 0 }} entered today</span>
    </div>
    <div class="pipe mt">
      <div v-for="p in pipeline" :key="p.key" class="pipe-seg" :style="{ flex: Math.max(stats[p.key] ?? 0, 0.15), background: p.color }" :title="STATUS_META[p.status].label" />
    </div>
    <div class="grid cols-4 mt">
      <router-link v-for="p in pipeline" :key="p.key" class="stat" :style="{ borderColor: p.color }" :to="`/job-orders?status=${p.status}`">
        <b>{{ stats[p.key] ?? '—' }}</b>
        <span>{{ STATUS_META[p.status].label }}</span>
        <small class="dim">{{ Math.round(((stats[p.key] ?? 0) / pipelineTotal) * 100) }}%</small>
      </router-link>
    </div>
  </div>

  <div class="grid cols-3 mt">
    <router-link class="stat" to="/vehicles"><b>{{ stats.vehicles ?? '—' }}</b><span>Vehicles on file</span></router-link>
    <router-link class="stat" to="/inventory?status=STOCK_LOW"><b :style="{ color: (stats.low_stock ?? 0) > 0 ? 'var(--m-red)' : undefined }">{{ stats.low_stock ?? '—' }}</b><span>Parts low / out of stock</span></router-link>
    <router-link class="stat" to="/technicians"><b>{{ stats.technicians ?? '—' }}</b><span>Active technicians</span></router-link>
  </div>

  <div class="grid cols-2 mt" style="align-items: start">
    <div class="card">
      <h3>Latest job orders</h3>
      <div class="list mt">
        <div v-for="j in recent" :key="j.id" class="list-row clickable" @click="router.push(`/job-orders/${j.id}`)">
          <span class="plate">{{ j.plate }}</span>
          <div style="flex: 1; min-width: 0">
            <div class="upper" style="font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ j.make }} {{ j.model }} · {{ j.customer_name }}</div>
            <div class="dim" style="font-size: 11px">{{ j.jo_number }} · {{ j.category }} · {{ fmtDate(j.created_at) }} · {{ j.created_by_name ?? '—' }}</div>
          </div>
          <JobOrderStatusControl :job-order-id="j.id" :status="j.status" :plate="j.plate" @changed="(s) => (j.status = s)" @saved="load" />
        </div>
        <div v-if="!recent.length" class="empty">No job orders synced yet</div>
      </div>
    </div>

    <div class="card">
      <h3>Parts waiting</h3>
      <div class="list mt">
        <div v-for="p in openParts" :key="p.id" class="list-row clickable" @click="router.push(`/job-orders/${p.job_order_id}`)">
          <div style="flex: 1; min-width: 0">
            <div class="upper" style="font-weight: 700">{{ p.part_name }} <span class="dim">× {{ p.quantity }}</span></div>
            <div class="dim" style="font-size: 11px">{{ p.part_number }} · {{ p.job_orders?.vehicles?.plate }} · {{ p.job_orders?.jo_number }}</div>
          </div>
          <span class="badge" :class="p.status === 'ORDERED' ? 'info' : 'warn'">{{ p.status }}</span>
        </div>
        <div v-if="!openParts.length" class="empty">Nothing requested or on order</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pipe { display: flex; gap: 4px; height: 14px; border-radius: var(--radius-pill); overflow: hidden; }
.pipe-seg { min-width: 6px; transition: flex 0.4s ease; }
.stat { text-decoration: none; color: inherit; display: block; }
.stat small { display: block; margin-top: 4px; font-size: 11px; }
.list { display: flex; flex-direction: column; gap: 8px; }
.list-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-alt); border: 1px solid var(--border); }
.list-row:hover { border-color: var(--m-light-blue); }
</style>
