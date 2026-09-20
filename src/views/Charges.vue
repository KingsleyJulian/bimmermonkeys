<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { computed, onMounted, ref } from 'vue';
import Modal from '@/components/Modal.vue';
import { supabase } from '@/lib/supabase';
import { fmtDate, fmtMoney } from '@/lib/format';
import { exportWorkbook } from '@/lib/sheets';
import { toast } from '@/lib/toast';

type Charge = { id?: string; category: string; code: string; name: string; description: string; amount: number; unit: string; is_active: boolean; sort_order: number; updated_at?: string };
type Audit = { id: number; code: string; field: string; old_value: string | null; new_value: string | null; changed_by_name: string | null; changed_at: string };

const CATEGORIES = ['LABOR', 'PARKING', 'FEE', 'SERVICE', 'OTHER'];
const UNITS = ['PER JOB', 'PER HOUR', 'PER DAY', 'PER UNIT', 'PER KM', 'PER LITER'];

const rows = ref<Charge[]>([]);
const q = ref('');
const category = ref('');
const showInactive = ref(false);
const editing = ref<Charge | null>(null);
const audit = ref<Audit[]>([]);
const busy = ref(false);
const draftAmount = ref<Record<string, string>>({});

async function load() {
  const { data } = await supabase.from('charges').select('*').order('category').order('sort_order').order('name');
  rows.value = (data as Charge[]) ?? [];
  const { data: a } = await supabase.from('charge_audit').select('*').order('changed_at', { ascending: false }).limit(30);
  audit.value = (a as Audit[]) ?? [];
}
onMounted(load);

const filtered = computed(() => {
  const term = q.value.toUpperCase().replace(/[\s-]/g, '');
  return rows.value.filter(
    (r) =>
      (showInactive.value || r.is_active) &&
      (!category.value || r.category === category.value) &&
      (!term || `${r.code}${r.name}${r.description}`.replace(/[\s-]/g, '').includes(term)),
  );
});
const grouped = computed(() => {
  const g: Record<string, Charge[]> = {};
  for (const r of filtered.value) (g[r.category] ??= []).push(r);
  return CATEGORIES.filter((c) => g[c]?.length).map((c) => ({ category: c, items: g[c] }));
});

function startNew() {
  editing.value = { category: 'LABOR', code: '', name: '', description: '', amount: 0, unit: 'PER JOB', is_active: true, sort_order: 9000 };
}
async function save() {
  const e = editing.value;
  if (!e) return;
  const payload = {
    category: e.category,
    code: e.code.trim().toUpperCase(),
    name: e.name.trim().toUpperCase(),
    description: e.description.trim().toUpperCase(),
    amount: Number(e.amount) || 0,
    unit: e.unit,
    is_active: e.is_active,
    sort_order: Number(e.sort_order) || 0,
  };
  if (!payload.code || !payload.name) return toast.error('Code and name are required');
  busy.value = true;
  const res = e.id ? await supabase.from('charges').update(payload).eq('id', e.id) : await supabase.from('charges').insert(payload);
  busy.value = false;
  if (res.error) return toast.error(res.error.message.includes('charges_code_key') ? 'That code already exists' : res.error.message);
  toast.success('Saved');
  editing.value = null;
  load();
}
/** Inline amount edit: commit on blur / Enter. */
async function commitAmount(r: Charge) {
  const v = draftAmount.value[r.id!];
  if (v === undefined) return;
  const amount = Number(v);
  delete draftAmount.value[r.id!];
  if (!(amount >= 0) || amount === Number(r.amount)) return;
  const { error } = await supabase.from('charges').update({ amount }).eq('id', r.id!);
  if (error) return toast.error(error.message);
  r.amount = amount;
  toast.success(`${r.name} → ${fmtMoney(amount)}`);
  load();
}
async function toggleActive(r: Charge) {
  const { error } = await supabase.from('charges').update({ is_active: !r.is_active }).eq('id', r.id!);
  if (error) return toast.error(error.message);
  load();
}
async function remove(r: Charge) {
  if (!confirm(`Delete ${r.name}? Lines already billed on job orders keep their text and amount.`)) return;
  const { error } = await supabase.from('charges').delete().eq('id', r.id!);
  if (error) return toast.error(error.message);
  toast.success('Deleted');
  load();
}
function exportAll() {
  exportWorkbook(`charges-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Charges', rows.value.map((r) => ({ Category: r.category, Code: r.code, Name: r.name, Description: r.description, Amount: r.amount, Unit: r.unit, Active: r.is_active ? 'YES' : 'NO' })));
}
</script>

<template>
  <div class="page-head">
    <div class="row"><HelpButton topic="charges" /><div><h1>Charges</h1><p>Price list for labor, parking and fees — what technicians pick from when a job order goes to FOR PAYMENT</p></div></div>
    <div class="row">
      <button class="btn" @click="exportAll">⇩ Export Excel</button>
      <button class="btn primary" @click="startNew">+ New charge</button>
    </div>
  </div>
  <div class="toolbar">
    <input v-model="q" class="input grow" placeholder="Search..." />
    <select v-model="category" class="input"><option value="">All categories</option><option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option></select>
    <label class="row" style="gap: 6px; font-size: 12px"><input v-model="showInactive" type="checkbox" /> SHOW INACTIVE</label>
    <span class="badge info">{{ filtered.length }} items</span>
  </div>

  <div v-for="g in grouped" :key="g.category" class="card" style="margin-bottom: 14px">
    <h3 style="color: var(--m-light-blue)">{{ g.category }} · {{ g.items.length }}</h3>
    <div class="table-wrap mt">
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Unit</th><th class="num" style="width: 160px">Amount (₱)</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in g.items" :key="r.id" :style="{ opacity: r.is_active ? 1 : 0.55 }">
            <td class="mono">{{ r.code }}</td>
            <td><b>{{ r.name }}</b></td>
            <td style="color: var(--text-muted); max-width: 340px; white-space: normal">{{ r.description }}</td>
            <td><span class="badge">{{ r.unit }}</span></td>
            <td class="num">
              <input
                class="input"
                style="text-align: right; padding: 6px 10px; width: 140px"
                type="number" step="0.01" min="0"
                :value="draftAmount[r.id!] ?? r.amount"
                @input="draftAmount[r.id!] = ($event.target as HTMLInputElement).value"
                @blur="commitAmount(r)"
                @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
              />
            </td>
            <td><span class="badge" :class="r.is_active ? 'ok' : 'danger'">{{ r.is_active ? 'Active' : 'Inactive' }}</span></td>
            <td class="num">
              <div class="row end">
                <button class="btn sm" @click="editing = { ...r }">Edit</button>
                <button class="btn sm ghost" @click="toggleActive(r)">{{ r.is_active ? 'Deactivate' : 'Activate' }}</button>
                <button class="btn sm ghost" @click="remove(r)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-if="!grouped.length" class="empty">No charges match</div>

  <div class="card">
    <h3>Recent price changes</h3>
    <div class="table-wrap mt">
      <table>
        <thead><tr><th>When</th><th>Who</th><th>Code</th><th>Field</th><th>From</th><th>To</th></tr></thead>
        <tbody>
          <tr v-for="a in audit" :key="a.id">
            <td>{{ fmtDate(a.changed_at) }}</td><td>{{ a.changed_by_name ?? '—' }}</td><td class="mono">{{ a.code }}</td>
            <td><span class="badge" :class="a.field === 'amount' ? 'info' : ''">{{ a.field.replace('_', ' ') }}</span></td>
            <td>{{ a.field === 'amount' ? fmtMoney(a.old_value) : (a.old_value ?? '—') }}</td>
            <td><b>{{ a.field === 'amount' ? fmtMoney(a.new_value) : (a.new_value ?? '—') }}</b></td>
          </tr>
          <tr v-if="!audit.length"><td colspan="6" class="dim">No changes yet</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal v-if="editing" :title="editing.id ? `Edit · ${editing.code}` : 'New charge'" help="charge-modal" @close="editing = null">
    <form class="grid cols-2" @submit.prevent="save">
      <div class="field"><label>Category</label><select v-model="editing.category" class="input"><option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option></select></div>
      <div class="field"><label>Code <span class="req">*</span></label><input v-model="editing.code" class="input mono" required @input="editing.code = editing.code.toUpperCase()" /></div>
      <div class="field" style="grid-column: 1 / -1"><label>Name <span class="req">*</span></label><input v-model="editing.name" class="input" required @input="editing.name = editing.name.toUpperCase()" /></div>
      <div class="field" style="grid-column: 1 / -1"><label>Description</label><input v-model="editing.description" class="input" @input="editing.description = editing.description.toUpperCase()" /></div>
      <div class="field"><label>Amount (₱)</label><input v-model="editing.amount" class="input" type="number" step="0.01" min="0" /></div>
      <div class="field"><label>Unit</label><select v-model="editing.unit" class="input"><option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option></select></div>
      <div class="field"><label>Sort order</label><input v-model="editing.sort_order" class="input" type="number" /></div>
      <div class="field"><label>Status</label><select v-model="editing.is_active" class="input"><option :value="true">Active</option><option :value="false">Inactive</option></select></div>
      <div class="row end" style="grid-column: 1 / -1">
        <button type="button" class="btn ghost" @click="editing = null">Cancel</button>
        <button class="btn primary" :disabled="busy">Save</button>
      </div>
    </form>
  </Modal>
</template>
