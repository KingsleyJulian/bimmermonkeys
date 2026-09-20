<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { VEHICLE_MAKES } from '@/lib/makes';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';

import { modelLabel, type VehicleModel } from '@/lib/models';

/**
 * Brand (shared make list) + model typed by hand. While typing, existing models for that brand
 * are suggested so a duplicate can be picked instead of created. Emits the chosen/created model.
 */
const props = defineProps<{ models: VehicleModel[]; allowCreate?: boolean }>();
const emit = defineEmits<{ select: [model: VehicleModel]; created: [model: VehicleModel] }>();

const make = ref('');
const text = ref('');
const year = ref('');
const open = ref(false);
const busy = ref(false);

const suggestions = computed(() => {
  const q = text.value.trim().toUpperCase();
  return props.models
    .filter((m) => (!make.value || m.make === make.value) && (!q || m.model.includes(q) || m.make.includes(q)))
    .slice(0, 12);
});
const yearNum = computed(() => (year.value ? Number(year.value) : null));
const exact = computed(
  () => props.models.find((m) => m.make === make.value && m.model === text.value.trim().toUpperCase() && (m.year ?? null) === yearNum.value) ?? null,
);
/** Same brand + model with a different year — shown so the user sees the family already exists. */
const siblings = computed(() =>
  props.models.filter((m) => m.make === make.value && m.model === text.value.trim().toUpperCase() && (m.year ?? null) !== yearNum.value),
);

watch(make, () => (open.value = true));

function closeSoon() {
  window.setTimeout(() => (open.value = false), 150);
}

function pick(m: VehicleModel) {
  make.value = m.make;
  text.value = m.model;
  year.value = m.year ? String(m.year) : '';
  open.value = false;
  emit('select', m);
}

async function create() {
  const model = text.value.trim().toUpperCase();
  if (!make.value || !model) return toast.error('Pick a brand and type the model');
  if (exact.value) return pick(exact.value);
  busy.value = true;
  if (yearNum.value !== null && (yearNum.value < 1950 || yearNum.value > 2100)) return toast.error('Year must be between 1950 and 2100');
  const { data, error } = await supabase
    .from('vehicle_models')
    .insert({ make: make.value, model, year: yearNum.value })
    .select('id, make, model, year')
    .single();
  busy.value = false;
  if (error) return toast.error(error.message);
  toast.success(`${make.value} ${model}${yearNum.value ? ` ${yearNum.value}` : ''} added`);
  open.value = false;
  emit('created', data as VehicleModel);
  emit('select', data as VehicleModel);
}

defineExpose({ reset: () => { make.value = ''; text.value = ''; year.value = ''; } });
</script>

<template>
  <div class="row" style="align-items: flex-end">
    <div class="field" style="min-width: 200px">
      <label>Brand</label>
      <select v-model="make" class="input">
        <option value="">Select brand</option>
        <option v-for="m in VEHICLE_MAKES" :key="m" :value="m">{{ m }}</option>
      </select>
    </div>
    <div class="field typeahead" style="flex: 1; min-width: 220px">
      <label>Model</label>
      <input
        v-model="text"
        class="input"
        placeholder="TYPE THE MODEL"
        @input="text = text.toUpperCase(); open = true"
        @focus="open = true"
        @blur="closeSoon"
        @keydown.enter.prevent="allowCreate ? create() : suggestions[0] && pick(suggestions[0])"
      />
      <div v-if="open && suggestions.length" class="suggest">
        <div v-for="m in suggestions" :key="m.id" @mousedown.prevent="pick(m)">
          <span>{{ modelLabel(m) }}</span>
          <span v-if="exact && exact.id === m.id" class="exact">ALREADY EXISTS</span>
          <span v-else-if="siblings.some((s) => s.id === m.id)" class="dim">SAME MODEL · {{ m.year ?? 'NO YEAR' }}</span>
        </div>
      </div>
    </div>
    <div class="field" style="width: 120px">
      <label>Year</label>
      <input v-model="year" class="input" type="number" min="1950" max="2100" placeholder="ANY" @focus="open = true" />
    </div>
    <button v-if="allowCreate" type="button" class="btn" :class="exact ? '' : 'primary'" :disabled="busy || !make || !text.trim()" @click="create">
      {{ exact ? 'Use existing' : '+ Add model' }}
    </button>
  </div>
</template>
