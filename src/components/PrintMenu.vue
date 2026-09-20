<script setup lang="ts">
import { computed } from 'vue';

/**
 * Print dropdown for one job order. Every document is always available; the ones that match
 * the current status are listed first and marked, so the right form is one click away:
 *  IN PROGRESS → intake checklist · FOR PARTS ORDER → parts request + sales invoice · FOR PAYMENT → invoice.
 */
const props = defineProps<{ jobOrderId: string; status?: string; hasParts?: boolean; compact?: boolean }>();
const open = (kind: string, query = '') => window.open(`/print/${kind}/${props.jobOrderId}${query}`, '_blank');

const DOCS = [
  { key: 'intake', label: 'Vehicle intake checklist', kind: 'intake', query: '', for: ['IN_PROGRESS'] },
  { key: 'parts', label: 'Parts request', kind: 'parts-request', query: '', for: ['FOR_PARTS_ORDER'], needsParts: true },
  { key: 'sales', label: 'Sales invoice · parts', kind: 'sales-invoice', query: '', for: ['FOR_PARTS_ORDER'], needsParts: true },
  { key: 'inv', label: 'Invoice · labor + parts', kind: 'invoice', query: '?parts=1', for: ['FOR_PAYMENT', 'COMPLETED', 'RELEASED'] },
  { key: 'inv0', label: 'Invoice · labor only', kind: 'invoice', query: '?parts=0', for: ['FOR_PAYMENT', 'COMPLETED', 'RELEASED'] },
];
const docs = computed(() => {
  const s = props.status ?? '';
  return DOCS.map((d) => ({ ...d, suggested: d.for.includes(s) })).sort((a, b) => Number(b.suggested) - Number(a.suggested));
});
</script>

<template>
  <div class="print-menu" @click.stop>
    <button class="btn sm" :title="compact ? 'Print' : undefined">🖨<span v-if="!compact"> Print ▾</span></button>
    <div class="print-list">
      <a v-for="d in docs" :key="d.key" :class="{ off: d.needsParts && !hasParts, suggested: d.suggested }" @click="open(d.kind, d.query)">
        <span>{{ d.label }}</span>
        <span v-if="d.suggested" class="badge info">For this stage</span>
        <span v-else-if="d.needsParts && !hasParts" class="badge">No parts yet</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.print-menu { position: relative; display: inline-block; }
.print-menu:hover .print-list, .print-menu:focus-within .print-list { display: flex; }
.print-list { display: none; position: absolute; right: 0; top: 100%; z-index: 30; flex-direction: column; min-width: 300px; background: var(--surface-raised); border: 1px solid var(--border-strong); border-radius: var(--radius-md); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.print-list a { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text); white-space: nowrap; }
.print-list a:hover { background: var(--m-dark-blue); }
.print-list a.suggested { border-left: 3px solid var(--m-light-blue); }
.print-list a.off { color: var(--text-dim); }
</style>
