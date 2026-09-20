<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { signedUrl } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';

export type MediaRow = {
  id: string;
  kind: 'image' | 'video';
  storage_path: string | null;
  thumbnail_path: string | null;
  container: string;
  captured_at: string;
  captured_by_name: string | null;
  device_model: string | null;
  latitude: number | null;
  longitude: number | null;
  inspection_item_key: string | null;
  report_id: string | null;
};

const props = defineProps<{ items: MediaRow[] }>();
const thumbs = ref<Record<string, string | null>>({});
const open = ref<{ item: MediaRow; url: string } | null>(null);

async function load() {
  const out: Record<string, string | null> = {};
  await Promise.all(props.items.map(async (m) => (out[m.id] = await signedUrl(m.thumbnail_path ?? m.storage_path))));
  thumbs.value = out;
}
onMounted(load);
watch(() => props.items, load);

async function show(item: MediaRow) {
  const url = await signedUrl(item.storage_path);
  if (url) open.value = { item, url };
}
</script>

<template>
  <div v-if="!items.length" class="empty">No media</div>
  <div v-else class="media-grid">
    <div v-for="m in items" :key="m.id" class="media-tile" @click="show(m)">
      <img v-if="thumbs[m.id]" :src="thumbs[m.id]!" alt="" loading="lazy" />
      <span class="badge tag" :class="m.kind === 'video' ? 'info' : ''">{{ m.kind === 'video' ? '▶ ' : '' }}{{ m.container }}</span>
    </div>
  </div>
  <div v-if="open" class="lightbox" @click.self="open = null">
    <button class="btn icon close" @click="open = null">✕</button>
    <video v-if="open.item.kind === 'video'" :src="open.url" controls autoplay />
    <img v-else :src="open.url" alt="" />
    <div class="meta">
      <span class="badge info">{{ fmtDate(open.item.captured_at) }}</span>
      <span class="badge">{{ open.item.captured_by_name ?? 'UNASSIGNED' }}</span>
      <span class="badge">{{ open.item.device_model ?? 'UNKNOWN DEVICE' }}</span>
      <span v-if="open.item.latitude != null" class="badge">{{ open.item.latitude?.toFixed(5) }}, {{ open.item.longitude?.toFixed(5) }}</span>
    </div>
  </div>
</template>
