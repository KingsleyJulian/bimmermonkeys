<script setup lang="ts">
import { ref } from 'vue';
import StatusSelect from '@/components/StatusSelect.vue';
import PartsOrderModal from '@/components/PartsOrderModal.vue';
import ChargesModal from '@/components/ChargesModal.vue';
import type { Status } from '@/lib/status';

/**
 * Status dropdown plus the follow-up the new status calls for:
 * FOR PARTS ORDER → pick parts from inventory; FOR PAYMENT → bill labor & charges.
 */
const props = defineProps<{ jobOrderId: string; status: string; plate?: string }>();
const emit = defineEmits<{ changed: [status: Status]; saved: [] }>();
const partsOpen = ref(false);
const chargesOpen = ref(false);

function onChanged(s: Status) {
  emit('changed', s);
  if (s === 'FOR_PARTS_ORDER') partsOpen.value = true;
  else if (s === 'FOR_PAYMENT') chargesOpen.value = true;
}
</script>

<template>
  <StatusSelect :job-order-id="jobOrderId" :status="status" :plate="plate" @changed="onChanged" />
  <PartsOrderModal v-if="partsOpen" :job-order-id="jobOrderId" :label="plate" @close="partsOpen = false" @saved="partsOpen = false; emit('saved')" />
  <ChargesModal v-if="chargesOpen" :job-order-id="jobOrderId" :label="plate" @close="chargesOpen = false" @saved="chargesOpen = false; emit('saved')" />
</template>
