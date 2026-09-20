<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { STATUSES, STATUS_META, normalizeStatus, type Status } from '@/lib/status';
import { toast } from '@/lib/toast';

/** Inline status dropdown; writes straight to job_orders and reports back. */
const props = defineProps<{ jobOrderId: string; status: string; plate?: string }>();
const emit = defineEmits<{ changed: [status: Status] }>();
const busy = ref(false);

async function change(e: Event) {
  const next = (e.target as HTMLSelectElement).value as Status;
  if (next === normalizeStatus(props.status)) return;
  busy.value = true;
  const { error } = await supabase.from('job_orders').update({ status: next }).eq('id', props.jobOrderId);
  busy.value = false;
  if (error) {
    toast.error(error.message);
    (e.target as HTMLSelectElement).value = normalizeStatus(props.status);
    return;
  }
  toast.success(`${props.plate ? props.plate + ' · ' : ''}${STATUS_META[next].label}`);
  emit('changed', next);
}
</script>

<template>
  <select class="input status-select" :class="STATUS_META[normalizeStatus(status)].tone" :value="normalizeStatus(status)" :disabled="busy" @click.stop @change="change">
    <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_META[s].label }}</option>
  </select>
</template>

<style scoped>
.status-select { width: auto; padding: 6px 30px 6px 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; border-radius: var(--radius-pill); cursor: pointer; }
.status-select.warn { border-color: var(--warning); color: var(--warning); }
.status-select.info { border-color: var(--m-light-blue); color: var(--m-light-blue); }
.status-select.ok { border-color: var(--success); color: var(--success); }
.status-select.danger { border-color: var(--m-red); color: var(--m-red); }
.status-select option { color: var(--text); }
</style>
