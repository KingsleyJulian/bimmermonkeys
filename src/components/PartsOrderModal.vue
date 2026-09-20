<script setup lang="ts">
import { ref } from 'vue';
import Modal from '@/components/Modal.vue';
import PartRequestPicker, { type PartRequestDraft } from '@/components/PartRequestPicker.vue';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useAuth } from '@/stores/auth';

/** Opened when a job order goes to FOR PARTS ORDER: pick the parts from inventory. */
const props = defineProps<{ jobOrderId: string; label?: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const auth = useAuth();
const parts = ref<PartRequestDraft[]>([]);
const busy = ref(false);

async function save() {
  if (!parts.value.length) return toast.error('Add at least one part');
  busy.value = true;
  const now = new Date().toISOString();
  const { error } = await supabase.from('part_requests').insert(
    parts.value.map((p) => ({
      id: crypto.randomUUID(),
      job_order_id: props.jobOrderId,
      part_id: p.part_id,
      part_number: p.part_number,
      part_name: p.part_name,
      quantity: p.quantity,
      requested_by: auth.profile?.id ?? null,
      requested_by_name: auth.profile?.display_name ?? 'ADMIN',
      created_at: now,
    })),
  );
  busy.value = false;
  if (error) return toast.error(error.message);
  toast.success(`${parts.value.length} part${parts.value.length === 1 ? '' : 's'} requested`);
  emit('saved');
}
</script>

<template>
  <Modal :title="`Parts to order${label ? ' · ' + label : ''}`" help="parts-order" wide @close="emit('close')">
    <p class="help">Pick from the inventory (photo and stock shown as you type) or add a part that is not listed yet.</p>
    <div class="card mt"><PartRequestPicker v-model="parts" /></div>
    <div class="row end mt">
      <button class="btn ghost" :disabled="busy" @click="emit('close')">Skip for now</button>
      <button class="btn success" :disabled="busy || !parts.length" @click="save">Save {{ parts.length }} part{{ parts.length === 1 ? '' : 's' }}</button>
    </div>
  </Modal>
</template>
