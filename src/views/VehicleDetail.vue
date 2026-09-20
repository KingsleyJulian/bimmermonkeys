<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MediaGallery, { type MediaRow } from '@/components/MediaGallery.vue';
import { supabase } from '@/lib/supabase';
import { fmtDate, statusLabel, statusTone } from '@/lib/format';
import { ITEM_LABELS } from '@/lib/inspection';

type Vehicle = { id: string; plate: string; make: string; model: string; year: number; color: string; vin: string; engine_no: string; transmission: string };
type Visit = { id: string; jo_number: string; status: string; category: string; odometer_km: number; created_at: string; created_by_name: string | null; customers: { full_name: string } | null };
type NotOk = { job_order_id: string; item_key: string; remark: string };
type Complaint = { job_order_id: string; keyword: string };
type Report = { id: string; job_order_id: string; body: string; author_name: string | null; created_at: string };
type Media = MediaRow & { job_order_id: string };

const route = useRoute();
const router = useRouter();
const vehicle = ref<Vehicle | null>(null);
const visits = ref<Visit[]>([]);
const notOk = ref<NotOk[]>([]);
const complaints = ref<Complaint[]>([]);
const reports = ref<Report[]>([]);
const media = ref<Media[]>([]);

onMounted(async () => {
  const id = route.params.id as string;
  const { data: v } = await supabase.from('vehicles').select('*').eq('id', id).maybeSingle();
  vehicle.value = v as Vehicle;
  const { data: vs } = await supabase
    .from('job_orders')
    .select('id, jo_number, status, category, odometer_km, created_at, created_by_name, customers(full_name)')
    .eq('vehicle_id', id)
    .order('created_at', { ascending: false });
  visits.value = (vs as unknown as Visit[]) ?? [];
  const ids = visits.value.map((x) => x.id);
  if (!ids.length) return;
  const [n, c, r, m] = await Promise.all([
    supabase.from('inspection_items').select('job_order_id, item_key, remark').in('job_order_id', ids).eq('state', 'not_ok'),
    supabase.from('complaints').select('job_order_id, keyword').in('job_order_id', ids).order('position'),
    supabase.from('reports').select('id, job_order_id, body, author_name, created_at').in('job_order_id', ids).order('created_at'),
    supabase.from('media_attachments').select('*').in('job_order_id', ids).order('sort_order'),
  ]);
  notOk.value = (n.data as NotOk[]) ?? [];
  complaints.value = (c.data as Complaint[]) ?? [];
  reports.value = (r.data as Report[]) ?? [];
  media.value = (m.data as Media[]) ?? [];
});

const forJob = <T extends { job_order_id: string }>(arr: T[], id: string) => arr.filter((x) => x.job_order_id === id);
const intakeFor = (id: string) => media.value.filter((x) => x.job_order_id === id && !x.report_id);
const reportMedia = (id: string) => media.value.filter((x) => x.report_id === id);
</script>

<template>
  <div v-if="!vehicle" class="empty">Loading…</div>
  <template v-else>
    <div class="page-head">
      <div class="row">
        <button class="btn icon ghost" @click="router.back()">‹</button>
        <HelpButton topic="vehicle-detail" />
        <span class="plate" style="font-size: 18px">{{ vehicle.plate }}</span>
        <div>
          <h1>{{ vehicle.make }} {{ vehicle.model }}</h1>
          <p>{{ vehicle.color }} · {{ vehicle.year }} · {{ vehicle.transmission || '—' }} · VIN {{ vehicle.vin }} · ENGINE {{ vehicle.engine_no }}</p>
        </div>
      </div>
      <span class="badge info">{{ visits.length }} visit{{ visits.length === 1 ? '' : 's' }}</span>
    </div>

    <div class="timeline">
      <div v-for="v in visits" :key="v.id" class="tl-item">
        <div class="tl-head">
          <div>
            <b>{{ fmtDate(v.created_at) }}</b>
            <div class="dim" style="font-size: 11px">
              {{ v.jo_number }} · {{ v.category }} · {{ v.odometer_km.toLocaleString() }} KM · {{ v.customers?.full_name }} · {{ v.created_by_name ?? '—' }}
            </div>
          </div>
          <div class="row">
            <span class="badge" :class="statusTone(v.status)">{{ statusLabel(v.status) }}</span>
            <router-link class="btn sm" :to="`/job-orders/${v.id}`">Open</router-link>
          </div>
        </div>
        <div class="chips"><span v-for="c in forJob(complaints, v.id)" :key="c.keyword" class="badge">{{ c.keyword }}</span></div>
        <div class="mt">
          <div v-for="n in forJob(notOk, v.id)" :key="n.item_key" style="color: var(--m-red); font-size: 12px; text-transform: uppercase">
            ✕ {{ ITEM_LABELS.get(n.item_key) ?? n.item_key }}<span v-if="n.remark"> — {{ n.remark }}</span>
          </div>
          <div v-if="!forJob(notOk, v.id).length" style="color: var(--success); font-size: 11px">NO ITEMS MARKED NOT OK</div>
        </div>
        <div v-if="intakeFor(v.id).length" class="mt"><MediaGallery :items="intakeFor(v.id)" /></div>
        <template v-if="forJob(reports, v.id).length">
          <h3 class="mt">Reports · {{ forJob(reports, v.id).length }}</h3>
          <div v-for="r in forJob(reports, v.id)" :key="r.id" class="card mt" style="border-left: 3px solid var(--m-light-blue)">
            <div class="row between"><b class="upper">{{ r.author_name ?? 'UNASSIGNED' }}</b><span class="dim">{{ fmtDate(r.created_at) }}</span></div>
            <div class="mt">{{ r.body }}</div>
            <div v-if="reportMedia(r.id).length" class="mt"><MediaGallery :items="reportMedia(r.id)" /></div>
          </div>
        </template>
      </div>
      <div v-if="!visits.length" class="empty">No visits yet</div>
    </div>
  </template>
</template>
