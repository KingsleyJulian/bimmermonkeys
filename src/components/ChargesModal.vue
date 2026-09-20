<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Modal from '@/components/Modal.vue';
import { supabase } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useAuth } from '@/stores/auth';

type Charge = { id: string; category: string; code: string; name: string; description: string; amount: number; unit: string };
type Line = { charge_id: string | null; code: string; name: string; unit: string; quantity: number; unit_amount: number; is_manual: boolean };
const UNITS = ['PER JOB', 'PER HOUR', 'PER DAY', 'PER UNIT', 'PER KM', 'PER LITER'];

/** Bill labor / fees on a job order from the price list, or type a manual line. */
const props = defineProps<{ jobOrderId: string; label?: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const auth = useAuth();

const catalogue = ref<Charge[]>([]);
const q = ref('');
const manual = ref(false);
const lines = ref<Line[]>([]);
const busy = ref(false);
const m = ref({ name: '', amount: '', quantity: '1', unit: 'PER JOB' });

onMounted(async () => {
  const { data } = await supabase.from('charges_lookup').select('id, category, code, name, description, amount, unit').order('sort_order');
  catalogue.value = (data as Charge[]) ?? [];
});
const filtered = computed(() => {
  const term = q.value.toUpperCase().replace(/[\s-]/g, '');
  return (term ? catalogue.value.filter((c) => `${c.code}${c.name}${c.description}${c.category}`.replace(/[\s-]/g, '').includes(term)) : catalogue.value).slice(0, 60);
});
const total = computed(() => lines.value.reduce((n, l) => n + l.quantity * l.unit_amount, 0));

function addCatalogue(c: Charge) {
  lines.value.push({ charge_id: c.id, code: c.code, name: c.name, unit: c.unit, quantity: 1, unit_amount: Number(c.amount), is_manual: false });
}
function addManual() {
  const amount = Number(m.value.amount);
  const quantity = Number(m.value.quantity);
  if (!m.value.name.trim()) return toast.error('Describe the service');
  if (!(amount >= 0)) return toast.error('Enter the amount');
  if (!(quantity > 0)) return toast.error('Quantity must be at least 1');
  lines.value.push({ charge_id: null, code: 'MANUAL', name: m.value.name.trim().toUpperCase(), unit: m.value.unit, quantity, unit_amount: amount, is_manual: true });
  m.value = { name: '', amount: '', quantity: '1', unit: 'PER JOB' };
}
async function save() {
  if (!lines.value.length) return toast.error('Add at least one charge');
  busy.value = true;
  const now = new Date().toISOString();
  const { error } = await supabase.from('job_order_charges').insert(
    lines.value.map((l) => ({
      id: crypto.randomUUID(),
      job_order_id: props.jobOrderId,
      charge_id: l.charge_id,
      code: l.code,
      name: l.name,
      unit: l.unit,
      quantity: l.quantity,
      unit_amount: l.unit_amount,
      is_manual: l.is_manual,
      added_by: auth.profile?.id ?? null,
      added_by_name: auth.profile?.display_name ?? 'ADMIN',
      created_at: now,
    })),
  );
  busy.value = false;
  if (error) return toast.error(error.message);
  toast.success(`${lines.value.length} charge${lines.value.length === 1 ? '' : 's'} added · ${fmtMoney(total.value)}`);
  emit('saved');
}
</script>

<template>
  <Modal :title="`Labor & charges${label ? ' · ' + label : ''}`" help="charges-modal" wide @close="emit('close')">
    <div v-if="lines.length" class="card">
      <div v-for="(l, i) in lines" :key="i" class="row between" style="padding: 6px 0; border-bottom: 1px solid var(--border)">
        <div style="flex: 1"><b class="upper">{{ l.name }}</b><div class="dim" style="font-size: 11px">{{ fmtMoney(l.unit_amount) }} {{ l.unit }}{{ l.is_manual ? ' · MANUAL' : '' }}</div></div>
        <input v-model.number="l.quantity" class="input" type="number" min="1" step="0.5" style="width: 80px; padding: 6px 10px" />
        <b style="min-width: 110px; text-align: right">{{ fmtMoney(l.quantity * l.unit_amount) }}</b>
        <button class="btn sm ghost" @click="lines.splice(i, 1)">✕</button>
      </div>
      <div class="row between mt"><h3>Total</h3><b style="font-size: 18px">₱ {{ fmtMoney(total) }}</b></div>
    </div>

    <div class="tabs mt">
      <button :class="{ active: !manual }" @click="manual = false">From price list</button>
      <button :class="{ active: manual }" @click="manual = true">Manual entry</button>
    </div>

    <template v-if="!manual">
      <input v-model="q" class="input" placeholder="SEARCH LABOR, FEE, PARKING…" />
      <div class="table-wrap mt" style="max-height: 40vh">
        <table>
          <thead><tr><th>Category</th><th>Name</th><th>Description</th><th>Unit</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>
            <tr v-for="c in filtered" :key="c.id" class="clickable" @click="addCatalogue(c)">
              <td><span class="badge">{{ c.category }}</span></td><td><b>{{ c.name }}</b></td><td style="white-space: normal; color: var(--text-muted)">{{ c.description }}</td>
              <td>{{ c.unit }}</td><td class="num">{{ fmtMoney(c.amount) }}</td><td class="num"><button class="btn sm">+ Add</button></td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="6" class="dim">No matches — use manual entry</td></tr>
          </tbody>
        </table>
      </div>
    </template>
    <div v-else class="grid cols-4 mt" style="align-items: end">
      <div class="field" style="grid-column: span 2"><label>Service conducted <span class="req">*</span></label><input v-model="m.name" class="input" placeholder="E.G. REPLACE REAR WIPER ARM" @input="m.name = m.name.toUpperCase()" /></div>
      <div class="field"><label>Amount (₱) <span class="req">*</span></label><input v-model="m.amount" class="input" type="number" min="0" step="0.01" /></div>
      <div class="field"><label>Qty</label><input v-model="m.quantity" class="input" type="number" min="1" step="0.5" /></div>
      <div class="field"><label>Unit</label><select v-model="m.unit" class="input"><option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option></select></div>
      <button class="btn" @click="addManual">+ Add line</button>
    </div>

    <div class="row end mt">
      <button class="btn ghost" :disabled="busy" @click="emit('close')">Skip for now</button>
      <button class="btn success" :disabled="busy || !lines.length" @click="save">Save {{ lines.length }} line{{ lines.length === 1 ? '' : 's' }} · ₱ {{ fmtMoney(total) }}</button>
    </div>
  </Modal>
</template>
