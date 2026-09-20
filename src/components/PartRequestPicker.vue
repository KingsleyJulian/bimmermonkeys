<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import { partImageUrl } from '@/lib/parts';

export type PartRequestDraft = { part_id: string | null; part_number: string; part_name: string; quantity: number };
type Lookup = { id: string; part_number: string; name: string; alternative_part_number: string; srp: number | null; stock_on_hand: number; status: string; image_path: string | null; fits: string };

/**
 * Multi-add part picker: the catalogue list stays open with a + Add button per row, and every
 * added line sits in the "Selected" table with its own quantity. Unknown parts can be typed by hand.
 */
const props = defineProps<{ modelValue: PartRequestDraft[] }>();
const emit = defineEmits<{ 'update:modelValue': [v: PartRequestDraft[]] }>();

const q = ref('');
const results = ref<Lookup[]>([]);
const loading = ref(false);
const manualNumber = ref('');
const manualName = ref('');
const manualQty = ref(1);

async function search() {
  loading.value = true;
  const term = q.value.toUpperCase().replace(/[\s-]/g, '');
  let query = supabase.from('parts_lookup').select('*').order('name').limit(30);
  if (term) query = query.ilike('search_text', `%${term}%`);
  const { data } = await query;
  results.value = (data as Lookup[]) ?? [];
  loading.value = false;
}
onMounted(search);
let t: ReturnType<typeof setTimeout>;
watch(q, () => {
  clearTimeout(t);
  t = setTimeout(search, 200);
});

const has = (partId: string) => props.modelValue.some((l) => l.part_id === partId);

function add(line: PartRequestDraft) {
  const existing = line.part_id ? props.modelValue.findIndex((l) => l.part_id === line.part_id) : -1;
  if (existing >= 0) {
    // Already selected: bump its quantity instead of adding a duplicate line.
    emit('update:modelValue', props.modelValue.map((l, i) => (i === existing ? { ...l, quantity: l.quantity + line.quantity } : l)));
    return;
  }
  emit('update:modelValue', [...props.modelValue, line]);
}
function addManual() {
  if (!manualNumber.value.trim() || !manualName.value.trim()) return;
  add({ part_id: null, part_number: manualNumber.value.trim().toUpperCase(), part_name: manualName.value.trim().toUpperCase(), quantity: Math.max(1, manualQty.value | 0) });
  manualNumber.value = '';
  manualName.value = '';
  manualQty.value = 1;
}
function setQty(i: number, qty: number) {
  emit('update:modelValue', props.modelValue.map((l, j) => (j === i ? { ...l, quantity: Math.max(1, qty | 0) } : l)));
}
function remove(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, j) => j !== i));
}
</script>

<template>
  <div class="picker">
    <div class="pane">
      <h3>Catalogue</h3>
      <input v-model="q" class="input mono mt" placeholder="SEARCH PART NUMBER, NAME OR REMARKS" autofocus />
      <div class="table-wrap mt" style="max-height: 46vh">
        <table>
          <thead><tr><th></th><th>Part</th><th class="num">Stock</th><th class="num">SRP</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in results" :key="r.id" :class="{ picked: has(r.id) }">
              <td style="width: 44px"><img v-if="partImageUrl(r.image_path)" :src="partImageUrl(r.image_path)!" class="thumb" alt="" /><div v-else class="thumb ph">▣</div></td>
              <td><b>{{ r.name }}</b><div class="dim" style="font-size: 11px">{{ r.part_number }}<span v-if="r.fits"> · {{ r.fits }}</span></div></td>
              <td class="num"><span class="badge" :class="r.status === 'AVAILABLE' ? 'ok' : r.status === 'STOCK_LOW' ? 'warn' : r.status === 'NO_STOCK' ? 'danger' : ''">{{ r.stock_on_hand }}</span></td>
              <td class="num">{{ fmtMoney(r.srp) }}</td>
              <td class="num"><button type="button" class="btn sm" :class="has(r.id) ? '' : 'primary'" @click="add({ part_id: r.id, part_number: r.part_number, part_name: r.name, quantity: 1 })">{{ has(r.id) ? '+1' : '+ Add' }}</button></td>
            </tr>
            <tr v-if="!results.length"><td colspan="5" class="dim">{{ loading ? 'SEARCHING…' : 'NO MATCHES — ADD IT MANUALLY BELOW' }}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="row mt" style="align-items: flex-end">
        <div class="field" style="width: 150px"><label>Part number</label><input v-model="manualNumber" class="input mono" @input="manualNumber = manualNumber.toUpperCase()" @keydown.enter.prevent="addManual" /></div>
        <div class="field" style="flex: 1"><label>Part name (not in catalogue)</label><input v-model="manualName" class="input" @input="manualName = manualName.toUpperCase()" @keydown.enter.prevent="addManual" /></div>
        <div class="field" style="width: 80px"><label>Qty</label><input v-model.number="manualQty" class="input" type="number" min="1" /></div>
        <button type="button" class="btn" :disabled="!manualNumber.trim() || !manualName.trim()" @click="addManual">+ Add</button>
      </div>
    </div>

    <div class="pane">
      <h3>Selected · {{ modelValue.length }}</h3>
      <div class="table-wrap mt" style="max-height: 56vh">
        <table>
          <thead><tr><th>Part</th><th class="num" style="width: 90px">Qty</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(l, i) in modelValue" :key="i">
              <td><b>{{ l.part_name }}</b><div class="dim" style="font-size: 11px">{{ l.part_number }}{{ l.part_id ? '' : ' · NOT IN CATALOGUE' }}</div></td>
              <td class="num"><input class="input" type="number" min="1" :value="l.quantity" style="width: 80px; padding: 6px 8px; text-align: right" @input="setQty(i, Number(($event.target as HTMLInputElement).value))" /></td>
              <td class="num"><button type="button" class="btn sm ghost" @click="remove(i)">✕</button></td>
            </tr>
            <tr v-if="!modelValue.length"><td colspan="3" class="dim">Nothing selected yet — add parts from the catalogue on the left</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; }
@media (max-width: 900px) { .picker { grid-template-columns: 1fr; } }
.pane { min-width: 0; }
.thumb { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; background: var(--surface-alt); display: block; }
.thumb.ph { display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
tr.picked td { background: var(--info-soft); }
</style>
