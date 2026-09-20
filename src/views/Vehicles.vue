<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Pager from '@/components/Pager.vue';
import { supabase } from '@/lib/supabase';
import { fmtDate, statusLabel, statusTone } from '@/lib/format';

type Row = {
  id: string; plate: string; make: string; model: string; year: number; color: string; vin: string; engine_no: string; transmission: string;
  visits: number; last_visit_at: string | null; last_status: string | null; last_odometer_km: number | null; owner_name: string | null;
};

const router = useRouter();
const rows = ref<Row[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 30;
const q = ref('');

async function load() {
  let query = supabase
    .from('vehicle_list')
    .select('*', { count: 'exact' })
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .range((page.value - 1) * pageSize, page.value * pageSize - 1);
  const term = q.value.toUpperCase().replace(/[\s-]/g, '');
  if (term) query = query.ilike('search_text', `%${term}%`);
  const { data, count } = await query;
  rows.value = (data as Row[]) ?? [];
  total.value = count ?? 0;
}
onMounted(load);
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
  <div class="page-head"><div class="row"><HelpButton topic="vehicles" /><div><h1>Vehicles</h1><p>Every unit the shop has seen, with its latest status</p></div></div></div>
  <div class="toolbar"><input v-model="q" class="input grow mono" placeholder="Search plate, chassis, engine, make or model" /></div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Plate</th><th>Unit</th><th>Owner</th><th>VIN</th><th>Engine</th><th class="num">Visits</th><th>Last visit</th><th>Last status</th><th class="num">Odometer</th></tr>
      </thead>
      <tbody>
        <tr v-for="v in rows" :key="v.id" class="clickable" @click="router.push(`/vehicles/${v.id}`)">
          <td><span class="plate">{{ v.plate }}</span></td>
          <td>{{ v.make }} {{ v.model }}<br /><span class="muted">{{ v.color }} · {{ v.year }} · {{ v.transmission || '—' }}</span></td>
          <td>{{ v.owner_name ?? '—' }}</td>
          <td class="mono">{{ v.vin }}</td>
          <td>{{ v.engine_no }}</td>
          <td class="num">{{ v.visits }}</td>
          <td>{{ fmtDate(v.last_visit_at) }}</td>
          <td><span v-if="v.last_status" class="badge" :class="statusTone(v.last_status)">{{ statusLabel(v.last_status) }}</span></td>
          <td class="num">{{ v.last_odometer_km?.toLocaleString() ?? '—' }} KM</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="9" class="empty">No vehicles</td></tr>
      </tbody>
    </table>
  </div>
  <Pager :page="page" :page-size="pageSize" :total="total" @change="(p) => { page = p; load(); }" />
</template>
