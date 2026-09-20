<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { PART_REQUEST_STATUSES, partRequestTone, type PartRequestStatus } from '@/lib/parts';
import { toast } from '@/lib/toast';

/** Inline dropdown for one requested part line. */
const props = defineProps<{ id: string; status: string; label?: string }>();
const emit = defineEmits<{ changed: [status: PartRequestStatus] }>();
const busy = ref(false);

async function change(e: Event) {
  const next = (e.target as HTMLSelectElement).value as PartRequestStatus;
  if (next === props.status) return;
  busy.value = true;
  const { error } = await supabase.from('part_requests').update({ status: next }).eq('id', props.id);
  busy.value = false;
  if (error) {
    toast.error(error.message);
    (e.target as HTMLSelectElement).value = props.status;
    return;
  }
  toast.success(`${props.label ?? 'Part'} · ${next}`);
  emit('changed', next);
}
</script>

<template>
  <select class="input pr-select" :class="partRequestTone(status)" :value="status" :disabled="busy" @click.stop @change="change">
    <option v-for="s in PART_REQUEST_STATUSES" :key="s" :value="s">{{ s }}</option>
  </select>
</template>

<style scoped>
.pr-select { width: auto; padding: 3px 24px 3px 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; border-radius: var(--radius-pill); cursor: pointer; background: var(--surface-raised); }
.pr-select.warn { border-color: var(--warning); color: var(--warning); }
.pr-select.info { border-color: var(--m-light-blue); color: var(--m-light-blue); }
.pr-select.ok { border-color: var(--success); color: var(--success); }
.pr-select.danger { border-color: var(--m-red); color: var(--m-red); }
.pr-select option { color: var(--text); }
</style>
