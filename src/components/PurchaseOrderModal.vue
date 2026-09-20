<script setup lang="ts">
import { computed, ref } from 'vue';
import Modal from '@/components/Modal.vue';
import { supabase } from '@/lib/supabase';
import { purchaseOrderWorkbook, type PoLine } from '@/lib/purchaseOrder';
import { confirmDialog } from '@/lib/swal';
import { toast } from '@/lib/toast';
import { useAuth } from '@/stores/auth';

/** Turn the selected parts into a numbered purchase order and download it as a two-sheet workbook. */
const props = defineProps<{ parts: { part_id: string; part_number: string; name: string; stock_on_hand: number; low_stock_threshold: number; srp: number | null; remarks: string }[] }>();
const emit = defineEmits<{ close: []; done: [] }>();
const auth = useAuth();

const supplier = ref('');
const note = ref('');
const busy = ref(false);
const lines = ref<PoLine[]>(
  props.parts.map((p) => ({
    part_id: p.part_id,
    part_number: p.part_number,
    part_name: p.name,
    stock_on_hand: p.stock_on_hand,
    // Default order quantity: bring the part back above its low-stock threshold, at least 1.
    quantity: Math.max(1, p.low_stock_threshold * 2 - p.stock_on_hand),
    unit_cost: null,
    remarks: '',
  })),
);
const total = computed(() => lines.value.reduce((n, l) => n + l.quantity * (l.unit_cost ?? 0), 0));

async function generate() {
  if (!lines.value.length) return;
  const ok = await confirmDialog(
    'Create purchase order?',
    `<b>${lines.value.length}</b> part${lines.value.length === 1 ? '' : 's'} for <b>${supplier.value.toUpperCase() || 'UNSPECIFIED SUPPLIER'}</b>.<br/>A PO number is assigned and the Excel file downloads with an Import sheet for when the stock arrives.`,
    'Create & download',
  );
  if (!ok) return;
  busy.value = true;
  try {
    const { data, error } = await supabase.rpc('create_purchase_order', {
      p_supplier: supplier.value,
      p_note: note.value,
      p_items: lines.value.map((l) => ({ part_id: l.part_id, part_number: l.part_number, part_name: l.part_name, stock_at_order: l.stock_on_hand, quantity: l.quantity, unit_cost: l.unit_cost })),
    });
    if (error) throw new Error(error.message);
    const { data: s } = await supabase.from('shop_settings').select('key, value');
    const shop = Object.fromEntries(((s as { key: string; value: string }[]) ?? []).map((r) => [r.key, r.value]));
    const { poNo, filename } = purchaseOrderWorkbook({
      number: (data as { number: number }).number,
      shop,
      supplier: supplier.value,
      note: note.value,
      preparedBy: auth.profile?.display_name ?? '',
      lines: lines.value,
    });
    toast.success(`${poNo} created · ${filename}`);
    emit('done');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not create the purchase order');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal title="Purchase order" help="purchase-order" wide @close="emit('close')">
    <div class="grid cols-2">
      <div class="field"><label>Supplier</label><input v-model="supplier" class="input" placeholder="SUPPLIER NAME" @input="supplier = supplier.toUpperCase()" /></div>
      <div class="field"><label>Note</label><input v-model="note" class="input" placeholder="DELIVERY TERMS, REFERENCE…" @input="note = note.toUpperCase()" /></div>
    </div>
    <div class="table-wrap mt" style="max-height: 50vh">
      <table>
        <thead><tr><th>Part number</th><th>Description</th><th class="num">On hand</th><th class="num" style="width: 110px">Order qty</th><th class="num" style="width: 130px">Unit cost</th><th class="num">Amount</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(l, i) in lines" :key="l.part_id">
            <td class="mono">{{ l.part_number }}</td>
            <td>{{ l.part_name }}</td>
            <td class="num">{{ l.stock_on_hand }}</td>
            <td class="num"><input v-model.number="l.quantity" class="input" type="number" min="1" style="width: 90px; padding: 6px 8px; text-align: right" /></td>
            <td class="num"><input v-model.number="l.unit_cost" class="input" type="number" min="0" step="0.01" placeholder="—" style="width: 110px; padding: 6px 8px; text-align: right" /></td>
            <td class="num">{{ l.unit_cost != null ? (l.quantity * l.unit_cost).toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '—' }}</td>
            <td class="num"><button class="btn sm ghost" @click="lines.splice(i, 1)">✕</button></td>
          </tr>
        </tbody>
        <tfoot v-if="total"><tr><td colspan="5" class="num"><b>TOTAL</b></td><td class="num"><b>{{ total.toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</b></td><td /></tr></tfoot>
      </table>
    </div>
    <p class="help mt">The workbook has two sheets: <b>Purchase Order</b> (editable quantities and costs for the supplier) and <b>Import</b> — when the delivery arrives, import that sheet with mode <b>Replenish</b> and the received quantities are added to stock.</p>
    <div class="row end mt">
      <button class="btn ghost" :disabled="busy" @click="emit('close')">Cancel</button>
      <button class="btn success" :disabled="busy || !lines.length" @click="generate">Create PO & download Excel</button>
    </div>
  </Modal>
</template>
