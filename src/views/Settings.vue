<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { onMounted, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useAuth } from '@/stores/auth';

type Signatory = { id?: string; document_kind: string; label: string; name: string; sort_order: number };

const auth = useAuth();
const settings = ref<Record<string, string>>({});
const signatories = ref<Signatory[]>([]);
const busy = ref(false);

const FIELDS: { key: string; label: string; help?: string; upper?: boolean }[] = [
  { key: 'shop_name', label: 'Shop name' },
  { key: 'shop_tagline', label: 'Tagline' },
  { key: 'shop_address', label: 'Address' },
  { key: 'shop_phone', label: 'Phone' },
  { key: 'shop_email', label: 'Email' },
  { key: 'shop_tin', label: 'TIN' },
  { key: 'vat_rate', label: 'VAT rate (%)', help: '0 = prices already inclusive / not applied' },
  { key: 'invoice_footer', label: 'Invoice footer line' },
];
const DOCS = [
  { kind: 'intake', title: 'Vehicle intake checklist', fixed: ['CUSTOMER / OWNER', 'TECHNICIAN'] },
  { kind: 'parts_request', title: 'Parts request', fixed: ['CUSTOMER', 'TECHNICIAN', 'PARTS CUSTODIAN'] },
  { kind: 'sales_invoice', title: 'Sales invoice (parts)', fixed: ['CUSTOMER', 'TECHNICIAN', 'CASHIER'] },
  { kind: 'invoice', title: 'Invoice (labor + parts)', fixed: ['CUSTOMER', 'TECHNICIAN', 'CASHIER'] },
];

async function load() {
  const [{ data: s }, { data: g }] = await Promise.all([
    supabase.from('shop_settings').select('key, value'),
    supabase.from('document_signatories').select('*').order('document_kind').order('sort_order'),
  ]);
  settings.value = Object.fromEntries(((s as { key: string; value: string }[]) ?? []).map((r) => [r.key, r.value]));
  signatories.value = (g as Signatory[]) ?? [];
}
onMounted(load);

async function saveSettings() {
  busy.value = true;
  const rows = Object.entries(settings.value).map(([key, value]) => ({
    key,
    value: key === 'shop_email' ? value.trim().toLowerCase() : value.trim().toUpperCase(),
    updated_by: auth.profile?.id ?? null,
  }));
  const { error } = await supabase.from('shop_settings').upsert(rows, { onConflict: 'key' });
  busy.value = false;
  if (error) return toast.error(error.message);
  toast.success('Settings saved');
  load();
}

function addSignatory(kind: string) {
  signatories.value.push({ document_kind: kind, label: '', name: '', sort_order: signatories.value.filter((s) => s.document_kind === kind).length + 1 });
}
async function saveSignatory(s: Signatory) {
  if (!s.label.trim()) return toast.error('Label is required');
  const payload = { document_kind: s.document_kind, label: s.label.trim().toUpperCase(), name: s.name.trim().toUpperCase(), sort_order: s.sort_order };
  const res = s.id ? await supabase.from('document_signatories').update(payload).eq('id', s.id) : await supabase.from('document_signatories').insert(payload);
  if (res.error) return toast.error(res.error.message);
  toast.success('Signatory saved');
  load();
}
async function removeSignatory(s: Signatory) {
  if (!s.id) {
    signatories.value = signatories.value.filter((x) => x !== s);
    return;
  }
  const { error } = await supabase.from('document_signatories').delete().eq('id', s.id);
  if (error) return toast.error(error.message);
  load();
}
</script>

<template>
  <div class="page-head">
    <div class="row"><HelpButton topic="settings" /><div><h1>Settings</h1><p>What goes on the printed documents and who signs them</p></div></div>
    <button class="btn primary" :disabled="busy" @click="saveSettings">Save settings</button>
  </div>

  <div class="grid cols-2" style="align-items: start">
    <div class="card">
      <h3>Shop details</h3>
      <div class="grid cols-2 mt">
        <div v-for="f in FIELDS" :key="f.key" class="field" :style="f.key === 'shop_address' || f.key === 'invoice_footer' ? 'grid-column: 1 / -1' : ''">
          <label>{{ f.label }}</label>
          <input v-model="settings[f.key]" class="input" :class="{ lower: f.key === 'shop_email' }" />
          <span v-if="f.help" class="help">{{ f.help }}</span>
        </div>
      </div>
    </div>
    <div class="card">
      <h3>Named signatories</h3>
      <p class="help">These names are printed under the signature lines. Leave blank to print a line only.</p>
      <div class="grid cols-1 mt" style="gap: 12px">
        <div class="field"><label>Parts custodian</label><input v-model="settings.parts_custodian_name" class="input" placeholder="NAME PRINTED ON PARTS REQUESTS" /></div>
        <div class="field"><label>Cashier</label><input v-model="settings.cashier_name" class="input" placeholder="NAME PRINTED ON INVOICES" /></div>
      </div>
    </div>
  </div>

  <div class="card mt">
    <h3>Additional signatories per document</h3>
    <p class="help">Every document already carries the fixed lines listed below. Add more here (e.g. SERVICE ADVISOR, BRANCH MANAGER); you can also add one-off lines on the print page itself.</p>
    <div v-for="d in DOCS" :key="d.kind" class="mt" style="border-top: 1px solid var(--border); padding-top: 12px">
      <div class="row between">
        <div><b class="upper">{{ d.title }}</b><div class="dim" style="font-size: 11px">FIXED: {{ d.fixed.join(' · ') }}</div></div>
        <button class="btn sm" @click="addSignatory(d.kind)">+ Add signatory</button>
      </div>
      <div v-for="s in signatories.filter((x) => x.document_kind === d.kind)" :key="s.id ?? s.label + s.sort_order" class="row mt" style="align-items: flex-end">
        <div class="field" style="width: 90px"><label>Order</label><input v-model.number="s.sort_order" class="input" type="number" /></div>
        <div class="field" style="flex: 1"><label>Label (role)</label><input v-model="s.label" class="input" placeholder="SERVICE ADVISOR" @input="s.label = s.label.toUpperCase()" /></div>
        <div class="field" style="flex: 1"><label>Name (optional)</label><input v-model="s.name" class="input" @input="s.name = s.name.toUpperCase()" /></div>
        <button class="btn sm primary" @click="saveSignatory(s)">Save</button>
        <button class="btn sm ghost" @click="removeSignatory(s)">Remove</button>
      </div>
    </div>
  </div>
</template>
