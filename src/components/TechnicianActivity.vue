<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Modal from '@/components/Modal.vue';
import PartRequestStatus from '@/components/PartRequestStatus.vue';
import { supabase } from '@/lib/supabase';
import { fmtDate, statusLabel, statusTone } from '@/lib/format';
import type { PartRequestRow } from '@/lib/parts';

type Serviced = {
  id: string; jo_number: string; status: string; category: string; odometer_km: number; created_at: string;
  vehicles: { id: string; plate: string; make: string; model: string; year: number; color: string } | null;
  customers: { full_name: string } | null;
};
type ReportRow = { id: string; job_order_id: string; body: string; created_at: string; job_orders: { jo_number: string; vehicles: { plate: string } | null } | null };
type PartRow = PartRequestRow & { job_orders: { jo_number: string; vehicles: { plate: string; make: string; model: string } | null } | null };

const props = defineProps<{ userId: string; name: string }>();
const emit = defineEmits<{ close: [] }>();
const router = useRouter();

const serviced = ref<Serviced[]>([]);
const reports = ref<ReportRow[]>([]);
const parts = ref<PartRow[]>([]);
const tab = ref<'vehicles' | 'parts' | 'reports'>('vehicles');

onMounted(async () => {
  const [s, r, p] = await Promise.all([
    supabase.from('job_orders').select('id, jo_number, status, category, odometer_km, created_at, vehicles(id, plate, make, model, year, color), customers(full_name)').eq('created_by_user_id', props.userId).order('created_at', { ascending: false }).limit(300),
    supabase.from('reports').select('id, job_order_id, body, created_at, job_orders(jo_number, vehicles(plate))').eq('author_user_id', props.userId).order('created_at', { ascending: false }).limit(300),
    supabase.from('part_requests').select('*, job_orders(jo_number, vehicles(plate, make, model))').eq('requested_by', props.userId).order('created_at', { ascending: false }).limit(300),
  ]);
  serviced.value = (s.data as unknown as Serviced[]) ?? [];
  reports.value = (r.data as unknown as ReportRow[]) ?? [];
  parts.value = (p.data as unknown as PartRow[]) ?? [];
});
</script>

<template>
  <Modal :title="`${name} · activity`" help="technician-activity" wide @close="emit('close')">
    <div class="tabs">
      <button :class="{ active: tab === 'vehicles' }" @click="tab = 'vehicles'">Vehicles serviced · {{ serviced.length }}</button>
      <button :class="{ active: tab === 'parts' }" @click="tab = 'parts'">Parts requested · {{ parts.length }}</button>
      <button :class="{ active: tab === 'reports' }" @click="tab = 'reports'">Reports · {{ reports.length }}</button>
    </div>

    <div v-if="tab === 'vehicles'" class="table-wrap">
      <table>
        <thead><tr><th>Plate</th><th>Unit</th><th>Customer</th><th>JO #</th><th>Category</th><th>Status</th><th>Entered</th></tr></thead>
        <tbody>
          <tr v-for="j in serviced" :key="j.id" class="clickable" @click="router.push(`/job-orders/${j.id}`); emit('close')">
            <td><span class="plate">{{ j.vehicles?.plate }}</span></td>
            <td>{{ j.vehicles?.make }} {{ j.vehicles?.model }} <span class="muted">· {{ j.vehicles?.color }} · {{ j.vehicles?.year }}</span></td>
            <td>{{ j.customers?.full_name }}</td>
            <td class="mono">{{ j.jo_number }}</td>
            <td>{{ j.category }}</td>
            <td><span class="badge" :class="statusTone(j.status)">{{ statusLabel(j.status) }}</span></td>
            <td>{{ fmtDate(j.created_at) }}</td>
          </tr>
          <tr v-if="!serviced.length"><td colspan="7" class="empty">No job orders entered by this technician</td></tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'parts'" class="table-wrap">
      <table>
        <thead><tr><th>Status</th><th>Part</th><th>Part number</th><th class="num">Qty</th><th>For vehicle</th><th>JO #</th><th>Requested</th></tr></thead>
        <tbody>
          <tr v-for="p in parts" :key="p.id" class="clickable" @click="router.push(`/job-orders/${p.job_order_id}`); emit('close')">
            <td @click.stop><PartRequestStatus :id="p.id" :status="p.status" :label="p.part_name" @changed="(s) => (p.status = s)" /></td>
            <td><b>{{ p.part_name }}</b></td>
            <td class="mono">{{ p.part_number }}</td>
            <td class="num">{{ p.quantity }}</td>
            <td><span class="plate">{{ p.job_orders?.vehicles?.plate }}</span> {{ p.job_orders?.vehicles?.make }} {{ p.job_orders?.vehicles?.model }}</td>
            <td class="mono">{{ p.job_orders?.jo_number }}</td>
            <td>{{ fmtDate(p.created_at) }}</td>
          </tr>
          <tr v-if="!parts.length"><td colspan="7" class="empty">No parts requested by this technician</td></tr>
        </tbody>
      </table>
    </div>

    <div v-else class="timeline">
      <div v-for="r in reports" :key="r.id" class="tl-item clickable" @click="router.push(`/job-orders/${r.job_order_id}`); emit('close')">
        <div class="tl-head">
          <b><span class="plate">{{ r.job_orders?.vehicles?.plate }}</span> <span class="dim">{{ r.job_orders?.jo_number }}</span></b>
          <span class="dim">{{ fmtDate(r.created_at) }}</span>
        </div>
        <div>{{ r.body }}</div>
      </div>
      <div v-if="!reports.length" class="empty">No reports written by this technician</div>
    </div>
  </Modal>
</template>
