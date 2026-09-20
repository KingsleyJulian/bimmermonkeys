<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Modal from '@/components/Modal.vue';
import ModelPicker from '@/components/ModelPicker.vue';
import { modelLabel, type VehicleModel } from '@/lib/models';
import { supabase } from '@/lib/supabase';
import { fmtDate, fmtMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import { partImageUrl } from '@/lib/parts';

type Part = { id?: string; part_number: string; name: string; alternative_part_number: string; srp: number | null; stock_on_hand: number; low_stock_threshold: number; notes: string; image_path: string | null };
type Fitment = { id: string; catalogue_block: string; vehicle_models: { id: string; make: string; model: string; year: number | null } };
type Audit = { id: number; field: string; old_value: string | null; new_value: string | null; changed_by_name: string | null; source: string; changed_at: string };

const props = defineProps<{ partId: string | null; models: VehicleModel[]; initial?: { part_number?: string; name?: string; notes?: string } }>();
const emit = defineEmits<{ close: []; saved: []; created: [id: string]; modelCreated: [m: VehicleModel] }>();

const part = ref<Part>({ part_number: '', name: '', alternative_part_number: '', srp: null, stock_on_hand: 0, low_stock_threshold: 5, notes: '', image_path: null });
const uploading = ref(false);
const fitments = ref<Fitment[]>([]);
const audit = ref<Audit[]>([]);
const busy = ref(false);
const newFit = ref<{ model: VehicleModel | null; block: string }>({ model: null, block: '' });
/** Fitments chosen on a NEW part before it is saved; inserted right after the part row. */
const pendingFits = ref<{ model: VehicleModel; block: string }[]>([]);
function queueFitment() {
  if (!newFit.value.model) return toast.error('Pick a model');
  const m = newFit.value.model;
  if (pendingFits.value.some((f) => f.model.id === m.id && f.block === newFit.value.block.trim().toUpperCase())) return toast.error('Already added');
  pendingFits.value.push({ model: m, block: newFit.value.block.trim().toUpperCase() });
  newFit.value = { model: null, block: '' };
}

async function load() {
  if (!props.partId) {
    if (props.initial) part.value = { ...part.value, part_number: props.initial.part_number ?? '', name: props.initial.name ?? '', notes: props.initial.notes ?? '' };
    return;
  }
  const [{ data: p }, { data: f }, { data: a }] = await Promise.all([
    supabase.from('parts').select('*').eq('id', props.partId).single(),
    supabase.from('part_fitments').select('id, catalogue_block, vehicle_models(id, make, model, year)').eq('part_id', props.partId),
    supabase.from('part_audit').select('*').eq('part_id', props.partId).order('changed_at', { ascending: false }).limit(50),
  ]);
  part.value = p as Part;
  fitments.value = (f as unknown as Fitment[]) ?? [];
  audit.value = (a as Audit[]) ?? [];
}
onMounted(load);

async function save() {
  const p = part.value;
  const payload = {
    part_number: p.part_number.trim().toUpperCase(),
    name: p.name.trim().toUpperCase(),
    alternative_part_number: p.alternative_part_number.trim().toUpperCase(),
    srp: p.srp === null || (p.srp as unknown) === '' ? null : Number(p.srp),
    stock_on_hand: Number(p.stock_on_hand) || 0,
    low_stock_threshold: Number(p.low_stock_threshold) || 0,
    notes: p.notes.toUpperCase(),
  };
  if (!payload.part_number || !payload.name) return toast.error('Part number and name are required');
  busy.value = true;
  const q = p.id ? supabase.from('parts').update(payload).eq('id', p.id).select('id').single() : supabase.from('parts').insert(payload).select('id').single();
  const { data, error } = await q;
  busy.value = false;
  if (error) return toast.error(error.message.includes('parts_part_number_key') ? 'That part number already exists' : error.message);
  const created = !p.id;
  part.value.id = (data as { id: string }).id;
  if (pendingFits.value.length) {
    const { error: fe } = await supabase.from('part_fitments').insert(pendingFits.value.map((f) => ({ part_id: part.value.id, model_id: f.model.id, catalogue_block: f.block })));
    if (fe) toast.error(`Part saved but fitments failed: ${fe.message}`);
    pendingFits.value = [];
  }
  toast.success('Saved');
  emit('saved');
  if (created) emit('created', part.value.id!);
  load();
}

async function addFitment() {
  if (!part.value.id) return toast.error('Save the part first');
  if (!newFit.value.model) return toast.error('Pick a model');
  const { error } = await supabase.from('part_fitments').insert({
    part_id: part.value.id,
    model_id: newFit.value.model.id,
    catalogue_block: newFit.value.block.trim().toUpperCase(),
  });
  if (error) return toast.error(error.message.includes('part_fitments_unique') ? 'That fitment already exists' : error.message);
  newFit.value = { model: null, block: '' };
  toast.success('Fitment added');
  emit('saved');
  load();
}
async function uploadImage(file: File | undefined) {
  if (!file || !part.value.id) return;
  if (!/^image\//.test(file.type)) return toast.error('Images only');
  uploading.value = true;
  const ext = file.name.split('.').pop()?.toLowerCase() === 'png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${part.value.id}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from('parts').upload(path, file, { contentType: file.type, upsert: true });
  if (up.error) {
    uploading.value = false;
    return toast.error(up.error.message);
  }
  const { error } = await supabase.from('parts').update({ image_path: path }).eq('id', part.value.id);
  uploading.value = false;
  if (error) return toast.error(error.message);
  part.value.image_path = path;
  toast.success('Photo updated');
  emit('saved');
}
async function removeImage() {
  if (!part.value.id || !part.value.image_path) return;
  await supabase.storage.from('parts').remove([part.value.image_path]);
  const { error } = await supabase.from('parts').update({ image_path: null }).eq('id', part.value.id);
  if (error) return toast.error(error.message);
  part.value.image_path = null;
  emit('saved');
}

async function removeFitment(id: string) {
  const { error } = await supabase.from('part_fitments').delete().eq('id', id);
  if (error) return toast.error(error.message);
  emit('saved');
  load();
}
async function removePart() {
  if (!part.value.id || !confirm(`Delete ${part.value.part_number}? Its fitments go with it; the audit trail keeps the record.`)) return;
  const { error } = await supabase.from('parts').delete().eq('id', part.value.id);
  if (error) return toast.error(error.message);
  toast.success('Part deleted');
  emit('saved');
  emit('close');
}
</script>

<template>
  <Modal :title="part.id ? `Part · ${part.part_number}` : 'New part'" help="part-modal" wide @close="emit('close')">
    <form class="grid cols-3" @submit.prevent="save">
      <div class="field"><label>Part number <span class="req">*</span></label><input v-model="part.part_number" class="input mono" required @input="part.part_number = part.part_number.toUpperCase()" /></div>
      <div class="field" style="grid-column: span 2"><label>Part name <span class="req">*</span></label><input v-model="part.name" class="input" required @input="part.name = part.name.toUpperCase()" /></div>
      <div class="field"><label>Alternative part</label><input v-model="part.alternative_part_number" class="input mono" @input="part.alternative_part_number = part.alternative_part_number.toUpperCase()" /></div>
      <div class="field"><label>SRP (₱)</label><input v-model="part.srp" class="input" type="number" step="0.01" min="0" /></div>
      <div class="row" style="gap: 10px">
        <div class="field" style="flex: 1"><label>Stock on hand</label><input v-model="part.stock_on_hand" class="input" type="number" min="0" step="1" /></div>
        <div class="field" style="flex: 1"><label>Low-stock below</label><input v-model="part.low_stock_threshold" class="input" type="number" min="0" step="1" /></div>
      </div>
      <div class="field" style="grid-column: 1 / -1"><label>Remarks</label><textarea v-model="part.notes" class="input" rows="2" placeholder="ANYTHING WORTH KNOWING ABOUT THIS PART — SEARCHABLE" @input="part.notes = part.notes.toUpperCase()" /></div>
      <div v-if="!part.id" style="grid-column: 1 / -1">
        <h3>Fits (optional) · {{ pendingFits.length }}</h3>
        <p class="help">Tag every brand / model / year this part fits — a part can fit several. You can add more after saving.</p>
        <div v-for="(f, i) in pendingFits" :key="i" class="row" style="padding: 4px 0"><span class="badge info">{{ modelLabel(f.model) }}</span><span v-if="f.block" class="badge">{{ f.block }}</span><button type="button" class="btn sm ghost" @click="pendingFits.splice(i, 1)">✕</button></div>
        <div class="card mt">
          <ModelPicker :models="models" allow-create @select="(m) => (newFit.model = m)" @created="(m) => emit('modelCreated', m)" />
          <div class="row mt" style="align-items: flex-end">
            <div class="field" style="width: 180px"><label>Catalogue block</label><input v-model="newFit.block" class="input" @input="newFit.block = newFit.block.toUpperCase()" /></div>
            <button type="button" class="btn" :disabled="!newFit.model" @click="queueFitment">+ Add fitment{{ newFit.model ? ` · ${modelLabel(newFit.model)}` : '' }}</button>
          </div>
        </div>
      </div>
      <div class="row between" style="grid-column: 1 / -1">
        <button v-if="part.id" type="button" class="btn danger sm" @click="removePart">Delete part</button>
        <span v-else />
        <div class="row">
          <button type="button" class="btn ghost" @click="emit('close')">Close</button>
          <button class="btn primary" :disabled="busy">{{ part.id ? 'Save changes' : 'Create part' }}</button>
        </div>
      </div>
    </form>

    <template v-if="part.id">
      <h3 class="mt">Photo</h3>
      <div class="row mt" style="align-items: center">
        <img v-if="partImageUrl(part.image_path)" :src="partImageUrl(part.image_path)!" alt="" style="width: 120px; height: 120px; object-fit: cover; border-radius: var(--radius-md); background: #000" />
        <div v-else class="drop" style="width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; padding: 0">NO PHOTO</div>
        <div class="row">
          <label class="btn">{{ uploading ? 'Uploading…' : part.image_path ? 'Replace photo' : 'Upload photo' }}<input type="file" accept="image/*" hidden :disabled="uploading" @change="uploadImage(($event.target as HTMLInputElement).files?.[0])" /></label>
          <button v-if="part.image_path" type="button" class="btn ghost sm" @click="removeImage">Remove</button>
        </div>
      </div>

      <h3 class="mt">Fits · {{ fitments.length }}</h3>
      <div class="table-wrap mt">
        <table>
          <thead><tr><th>Brand</th><th>Model</th><th>Year</th><th>Catalogue block</th><th></th></tr></thead>
          <tbody>
            <tr v-for="f in fitments" :key="f.id">
              <td>{{ f.vehicle_models.make }}</td><td>{{ f.vehicle_models.model }}</td><td>{{ f.vehicle_models.year ?? '—' }}</td><td>{{ f.catalogue_block || '—' }}</td>
              <td class="num"><button class="btn sm ghost" @click="removeFitment(f.id)">Remove</button></td>
            </tr>
            <tr v-if="!fitments.length"><td colspan="5" class="dim">Not linked to any model yet</td></tr>
          </tbody>
        </table>
      </div>
      <div class="card mt">
        <ModelPicker :models="models" allow-create @select="(m) => (newFit.model = m)" @created="(m) => emit('modelCreated', m)" />
        <div class="row mt" style="align-items: flex-end">
          <div class="field" style="width: 180px"><label>Catalogue block</label><input v-model="newFit.block" class="input" @input="newFit.block = newFit.block.toUpperCase()" /></div>
          <button class="btn" :disabled="!newFit.model" @click="addFitment">+ Add fitment{{ newFit.model ? ` · ${modelLabel(newFit.model)}` : '' }}</button>
        </div>
      </div>

      <h3 class="mt">Audit trail · last {{ audit.length }}</h3>
      <div class="table-wrap mt">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Field</th><th>From</th><th>To</th><th>Source</th></tr></thead>
          <tbody>
            <tr v-for="a in audit" :key="a.id">
              <td>{{ fmtDate(a.changed_at) }}</td><td>{{ a.changed_by_name ?? '—' }}</td>
              <td><span class="badge" :class="a.field === 'srp' ? 'info' : a.field === 'stock_on_hand' ? 'warn' : ''">{{ a.field === 'notes' ? 'remarks' : a.field.replace(/_/g, ' ') }}</span></td>
              <td>{{ a.field === 'srp' ? fmtMoney(a.old_value) : (a.old_value ?? '—') }}</td>
              <td>{{ a.field === 'srp' ? fmtMoney(a.new_value) : (a.new_value ?? '—') }}</td>
              <td><span class="badge" :class="a.source === 'import' ? 'info' : ''">{{ a.source }}</span></td>
            </tr>
            <tr v-if="!audit.length"><td colspan="6" class="dim">No changes recorded</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </Modal>
</template>
