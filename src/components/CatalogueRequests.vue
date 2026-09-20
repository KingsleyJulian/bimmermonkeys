<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/swal';
import { partImageUrl } from '@/lib/parts';

/**
 * Part requests raised from the app without a catalogue part (mechanics' nicknames, unknown
 * numbers). The parts custodian links each to an existing part or creates the part, which
 * rewrites the request on the job order with the exact number and name.
 */
type Req = {
  id: string; job_order_id: string; part_number: string; part_name: string; quantity: number; status: string; notes: string | null;
  requested_by_name: string | null; created_at: string; job_orders: { jo_number: string; vehicles: { plate: string; make: string; model: string; year: number | null } | null } | null;
};
type Hit = { id: string; part_number: string; name: string; stock_on_hand: number; srp: number | null; image_path: string | null; fits: string };

const emit = defineEmits<{ create: [req: Req]; changed: [] }>();
const rows = ref<Req[]>([]);
const linking = ref<string | null>(null);
const q = ref('');
const hits = ref<Hit[]>([]);
const busy = ref(false);
let t: ReturnType<typeof setTimeout>;

async function load() {
  const { data } = await supabase
    .from('part_requests')
    .select('id, job_order_id, part_number, part_name, quantity, status, notes, requested_by_name, created_at, job_orders(jo_number, vehicles(plate, make, model, year))')
    .is('part_id', null)
    .neq('status', 'CANCELLED')
    .order('created_at', { ascending: false })
    .limit(200);
  rows.value = (data as unknown as Req[]) ?? [];
}
onMounted(load);
defineExpose({ load, count: () => rows.value.length });

function startLink(r: Req) {
  linking.value = linking.value === r.id ? null : r.id;
  q.value = r.part_name;
  hits.value = [];
  search();
}
function search() {
  clearTimeout(t);
  t = setTimeout(async () => {
    const term = q.value.toUpperCase().replace(/[\s-]/g, '');
    if (!term) return (hits.value = []);
    const { data } = await supabase.from('parts_lookup').select('id, part_number, name, stock_on_hand, srp, image_path, fits').ilike('search_text', `%${term}%`).order('name').limit(12);
    hits.value = (data as Hit[]) ?? [];
  }, 200);
}
async function link(r: Req, h: Hit) {
  const ok = await confirmDialog('Link this request?', `<b>${r.part_name}</b> (${r.part_number || 'no number'})<br/>→ <b>${h.part_number} ${h.name}</b><br/><small>The job order's request will show the catalogue part; the mechanic's wording is kept for reference.</small>`, 'Link');
  if (!ok) return;
  busy.value = true;
  const { error } = await supabase.rpc('catalogue_part_request', { p_request_id: r.id, p_part_id: h.id });
  busy.value = false;
  if (error) return toast.error(error.message);
  toast.success('Request linked to the catalogue');
  linking.value = null;
  await load();
  emit('changed');
}
</script>

<template>
  <div class="card">
    <div class="row between">
      <div>
        <h3>Catalogue requests · {{ rows.length }}</h3>
        <p class="help">Parts requested from the app that are not in the inventory yet. Link each to the right part, or create it — the job order request is corrected automatically.</p>
      </div>
      <button class="btn sm" @click="load">↻ Refresh</button>
    </div>
    <div class="table-wrap mt">
      <table>
        <thead><tr><th>Requested</th><th>Job order</th><th>Mechanic wrote</th><th class="num">Qty</th><th>Status</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          <template v-for="r in rows" :key="r.id">
            <tr>
              <td>{{ fmtDate(r.created_at) }}<br /><span class="dim">{{ r.requested_by_name ?? '—' }}</span></td>
              <td>
                <router-link :to="`/job-orders/${r.job_order_id}`" class="mono">{{ r.job_orders?.jo_number ?? '—' }}</router-link><br />
                <span class="dim">{{ r.job_orders?.vehicles?.plate }} · {{ r.job_orders?.vehicles?.make }} {{ r.job_orders?.vehicles?.model }}</span>
              </td>
              <td><b>{{ r.part_name }}</b><br /><span class="dim mono">{{ r.part_number || 'NO NUMBER' }}</span></td>
              <td class="num">{{ r.quantity }}</td>
              <td><span class="badge warn">{{ r.status }}</span></td>
              <td class="dim" style="max-width: 220px">{{ r.notes || '—' }}</td>
              <td class="num">
                <div class="row end" style="flex-wrap: nowrap">
                  <button class="btn sm" :class="{ primary: linking === r.id }" @click="startLink(r)">Link existing</button>
                  <button class="btn sm success" @click="emit('create', r)">+ Create part</button>
                </div>
              </td>
            </tr>
            <tr v-if="linking === r.id" class="link-row">
              <td colspan="7">
                <div class="row" style="align-items: flex-start">
                  <div class="field" style="min-width: 320px"><label>Search the catalogue</label><input v-model="q" class="input" placeholder="PART NUMBER OR NAME" autofocus @input="search" /></div>
                  <div class="hits">
                    <button v-for="h in hits" :key="h.id" type="button" class="hit" :disabled="busy" @click="link(r, h)">
                      <img v-if="partImageUrl(h.image_path)" :src="partImageUrl(h.image_path)!" alt="" />
                      <span v-else class="ph">▣</span>
                      <span class="hit-txt"><b>{{ h.name }}</b><small>{{ h.part_number }} · {{ h.stock_on_hand }} ON HAND<template v-if="h.fits"> · {{ h.fits }}</template></small></span>
                    </button>
                    <span v-if="!hits.length" class="dim">No catalogue part matches — use “+ Create part” instead.</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!rows.length"><td colspan="7" class="empty">Nothing waiting — every requested part is in the catalogue.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.link-row td { background: var(--surface-alt); }
.hits { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 320px; padding-top: 22px; }
.hit { display: flex; align-items: center; gap: 10px; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 10px; cursor: pointer; color: var(--text); font: inherit; }
.hit:hover { border-color: var(--m-light-blue); }
.hit img, .hit .ph { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; background: #000; display: grid; place-items: center; color: var(--text-dim); flex: 0 0 auto; }
.hit-txt { display: flex; flex-direction: column; }
.hit-txt small { color: var(--text-muted); font-size: 11px; }
</style>
