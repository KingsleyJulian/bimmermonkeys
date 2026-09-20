<script setup lang="ts">
import { ref } from 'vue';
import Modal from '@/components/Modal.vue';
import PartRequestPicker, { type PartRequestDraft } from '@/components/PartRequestPicker.vue';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useAuth } from '@/stores/auth';

/**
 * Append a report from the console: findings text + photos/videos chosen from disk.
 * Files go to the same `media` bucket path the app uses, so the app's galleries show them too.
 */
const props = defineProps<{ jobOrderId: string; label?: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const auth = useAuth();
const body = ref('');
const files = ref<File[]>([]);
const parts = ref<PartRequestDraft[]>([]);
const over = ref(false);
const busy = ref(false);
const progress = ref('');

function addFiles(list: FileList | null | undefined) {
  if (!list) return;
  for (const f of Array.from(list)) {
    if (!/^(image|video)\//.test(f.type)) {
      toast.error(`${f.name}: only images and videos`);
      continue;
    }
    if (f.size > 100 * 1024 * 1024) {
      toast.error(`${f.name}: over 100 MB`);
      continue;
    }
    files.value.push(f);
  }
}

const extOf = (f: File) => {
  const fromName = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (fromName) return fromName === 'jpeg' ? 'jpg' : fromName;
  return f.type.split('/')[1] ?? 'bin';
};

async function save() {
  if (!body.value.trim()) return toast.error('Write the findings first');
  busy.value = true;
  try {
    const reportId = crypto.randomUUID();
    const now = new Date().toISOString();
    const author = auth.profile?.display_name ?? 'ADMIN';
    const { error } = await supabase.from('reports').insert({
      id: reportId,
      job_order_id: props.jobOrderId,
      body: body.value.trim().toUpperCase(),
      author_user_id: auth.profile?.id ?? null,
      author_name: author,
      created_at: now,
    });
    if (error) throw new Error(error.message);

    for (let i = 0; i < files.value.length; i++) {
      const f = files.value[i];
      progress.value = `Uploading ${i + 1} / ${files.value.length}`;
      const id = crypto.randomUUID();
      const ext = extOf(f);
      const path = `job-orders/${props.jobOrderId}/${id}.${ext}`;
      const up = await supabase.storage.from('media').upload(path, f, { contentType: f.type, upsert: true });
      if (up.error) throw new Error(`${f.name}: ${up.error.message}`);
      const isVideo = f.type.startsWith('video/');
      const row = await supabase.from('media_attachments').insert({
        id,
        job_order_id: props.jobOrderId,
        report_id: reportId,
        kind: isVideo ? 'video' : 'image',
        storage_path: path,
        thumbnail_path: isVideo ? null : path,
        mime_type: f.type,
        container: ext,
        encoding_status: 'encoded',
        size_bytes: f.size,
        overlay_burned: false,
        captured_at: new Date(f.lastModified || Date.now()).toISOString(),
        captured_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        device_name: 'ADMIN CONSOLE',
        device_model: 'WEB',
        device_os: navigator.platform,
        captured_by_user_id: auth.profile?.id ?? null,
        captured_by_name: author,
        sort_order: i,
        created_at: now,
      });
      if (row.error) throw new Error(row.error.message);
    }
    if (parts.value.length) {
      const { error: pe } = await supabase.from('part_requests').insert(
        parts.value.map((p) => ({
          id: crypto.randomUUID(),
          job_order_id: props.jobOrderId,
          report_id: reportId,
          part_id: p.part_id,
          part_number: p.part_number,
          part_name: p.part_name,
          quantity: p.quantity,
          requested_by: auth.profile?.id ?? null,
          requested_by_name: author,
          created_at: now,
        })),
      );
      if (pe) throw new Error(pe.message);
    }
    toast.success('Report added');
    emit('saved');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not save report');
  } finally {
    busy.value = false;
    progress.value = '';
  }
}
</script>

<template>
  <Modal :title="`New report${label ? ' · ' + label : ''}`" help="report-modal" @close="emit('close')">
    <p class="help">{{ new Date().toLocaleString('en-PH').toUpperCase() }} · {{ auth.profile?.display_name }}</p>
    <div class="field mt">
      <label>Findings / work done <span class="req">*</span></label>
      <textarea v-model="body" class="input" rows="5" placeholder="DIAGNOSTIC FINDINGS, PARTS REPLACED, TESTS PERFORMED" @input="body = body.toUpperCase()" />
    </div>
    <h3 class="mt">Parts needed · {{ parts.length }}</h3>
    <div class="card mt"><PartRequestPicker v-model="parts" /></div>
    <label class="drop mt" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; addFiles($event.dataTransfer?.files)">
      Drop photos / videos here or click to choose
      <input type="file" accept="image/*,video/*" multiple hidden @change="addFiles(($event.target as HTMLInputElement).files)" />
    </label>
    <div v-if="files.length" class="chips mt">
      <span v-for="(f, i) in files" :key="i" class="badge info" style="cursor: pointer" title="Remove" @click="files.splice(i, 1)">{{ f.name.toUpperCase() }} · {{ (f.size / 1024 / 1024).toFixed(1) }} MB ✕</span>
    </div>
    <p v-if="progress" class="help mt">{{ progress }}</p>
    <div class="row end mt">
      <button class="btn ghost" :disabled="busy" @click="emit('close')">Cancel</button>
      <button class="btn success" :disabled="busy" @click="save">Save report</button>
    </div>
  </Modal>
</template>
