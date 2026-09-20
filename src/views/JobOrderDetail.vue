<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MediaGallery, { type MediaRow } from '@/components/MediaGallery.vue';
import JobOrderStatusControl from '@/components/JobOrderStatusControl.vue';
import PartsOrderModal from '@/components/PartsOrderModal.vue';
import PrintMenu from '@/components/PrintMenu.vue';
import ChargesModal from '@/components/ChargesModal.vue';
import { partImageUrl } from '@/lib/parts';
import { fmtMoney } from '@/lib/format';
import ReportModal from '@/components/ReportModal.vue';
import PartRequestStatus from '@/components/PartRequestStatus.vue';
import type { PartRequestRow } from '@/lib/parts';
import { supabase } from '@/lib/supabase';
import { fmtDate, statusLabel, statusTone } from '@/lib/format';
import { INSPECTION_GROUPS, ITEM_LABELS } from '@/lib/inspection';
import { reasonDialog } from '@/lib/swal';
import { toast } from '@/lib/toast';
import { useAuth } from '@/stores/auth';

type Jo = {
  id: string; jo_number: string; local_ref: string; status: string; category: string; entry_type: string; odometer_km: number;
  created_at: string; created_by_name: string | null; vehicle_id: string;
  vehicles: { id: string; plate: string; make: string; model: string; year: number; color: string; vin: string; engine_no: string; transmission: string };
  customers: { full_name: string; phone: string; email: string; address: string };
};
type Insp = { item_key: string; state: string; quantity: number | null; remark: string };
type Report = { id: string; body: string; author_name: string | null; created_at: string };

const route = useRoute();
const router = useRouter();
const jo = ref<Jo | null>(null);
const inspection = ref<Insp[]>([]);
const complaints = ref<string[]>([]);
const remarks = ref<{ body: string; author_name: string | null; created_at: string }[]>([]);
const reports = ref<Report[]>([]);
const media = ref<MediaRow[]>([]);
const history = ref<{ id: string; jo_number: string; status: string; category: string; odometer_km: number; created_at: string }[]>([]);
const tab = ref<'info' | 'history'>('info');
const reportFor = ref<string | null>(null);
const partRequests = ref<PartRequestRow[]>([]);
type ChargeRow = { id: string; code: string; name: string; unit: string; quantity: number; unit_amount: number; total: number; is_manual: boolean; added_by_name: string | null; created_at: string };
const charges = ref<ChargeRow[]>([]);
const addParts = ref(false);
const addCharges = ref(false);
const chargesTotal = () => charges.value.reduce((n, c) => n + Number(c.total), 0);
const auth = useAuth();

/** Reduce or remove lines. Removal is a soft delete; both are written to the job order audit trail by the database. */
async function setPartQty(p: PartRequestRow, qty: number) {
  qty = Math.max(1, Math.floor(qty));
  if (qty === p.quantity) return;
  const { error } = await supabase.from('part_requests').update({ quantity: qty }).eq('id', p.id);
  if (error) return toast.error(error.message);
  p.quantity = qty;
}
async function removePart(p: PartRequestRow) {
  const reason = await reasonDialog('Remove this part?', `<b>${p.part_name}</b> × ${p.quantity}<br/><small>The request is marked CANCELLED; if it was already installed the stock goes back. Logged in the audit trail.</small>`);
  if (reason === null) return;
  const { error } = await supabase.from('part_requests').update({ status: 'CANCELLED', cancel_reason: reason || null }).eq('id', p.id);
  if (error) return toast.error(error.message);
  toast.success('Part removed');
  load();
}
async function setChargeQty(c: ChargeRow, qty: number) {
  qty = Math.max(0.25, Math.round(qty * 100) / 100);
  if (qty === Number(c.quantity)) return;
  const { error } = await supabase.from('job_order_charges').update({ quantity: qty }).eq('id', c.id);
  if (error) return toast.error(error.message);
  c.quantity = qty;
  c.total = Math.round(qty * Number(c.unit_amount) * 100) / 100;
}
async function removeCharge(c: ChargeRow) {
  const reason = await reasonDialog('Remove this charge?', `<b>${c.name}</b> · ${c.quantity} ${c.unit} × ₱${fmtMoney(c.unit_amount)}<br/><small>It disappears from the invoice; the removal is logged in the audit trail.</small>`);
  if (reason === null) return;
  const { error } = await supabase
    .from('job_order_charges')
    .update({ removed_at: new Date().toISOString(), removed_by: auth.profile?.id ?? null, removed_by_name: auth.profile?.display_name ?? null, removed_reason: reason || null })
    .eq('id', c.id);
  if (error) return toast.error(error.message);
  toast.success('Charge removed');
  load();
}
const statusLog = ref<{ id: number; old_status: string | null; new_status: string; changed_by_name: string | null; changed_at: string }[]>([]);

const byKey = computed(() => new Map(inspection.value.map((i) => [i.item_key, i])));
const intakeMedia = computed(() => media.value.filter((m) => !m.report_id && !m.inspection_item_key));
const itemMedia = (key: string) => media.value.filter((m) => m.inspection_item_key === key);
const reportMedia = (id: string) => media.value.filter((m) => m.report_id === id);

async function load() {
  const id = route.params.id as string;
  const { data } = await supabase.from('job_orders').select('*, vehicles(*), customers(*)').eq('id', id).maybeSingle();
  jo.value = data as unknown as Jo;
  if (!jo.value) return;
  const [i, c, r, rp, m, h, sl, pr, ch] = await Promise.all([
    supabase.from('inspection_items').select('item_key, state, quantity, remark').eq('job_order_id', id),
    supabase.from('complaints').select('keyword').eq('job_order_id', id).order('position'),
    supabase.from('remarks').select('body, author_name, created_at').eq('job_order_id', id).order('created_at'),
    supabase.from('reports').select('id, body, author_name, created_at').eq('job_order_id', id).order('created_at'),
    supabase.from('media_attachments').select('*').eq('job_order_id', id).order('sort_order'),
    supabase.from('job_orders').select('id, jo_number, status, category, odometer_km, created_at').eq('vehicle_id', jo.value.vehicle_id).order('created_at', { ascending: false }),
    supabase.from('job_order_status_log').select('id, old_status, new_status, changed_by_name, changed_at').eq('job_order_id', id).order('changed_at', { ascending: false }),
    supabase.from('part_requests').select('*').eq('job_order_id', id).order('created_at'),
    supabase.from('job_order_charges').select('*').eq('job_order_id', id).is('removed_at', null).order('created_at'),
  ]);
  inspection.value = (i.data as Insp[]) ?? [];
  complaints.value = ((c.data as { keyword: string }[]) ?? []).map((x) => x.keyword);
  remarks.value = (r.data as typeof remarks.value) ?? [];
  reports.value = (rp.data as Report[]) ?? [];
  media.value = (m.data as MediaRow[]) ?? [];
  history.value = (h.data as typeof history.value) ?? [];
  statusLog.value = (sl.data as typeof statusLog.value) ?? [];
  partRequests.value = (pr.data as PartRequestRow[]) ?? [];
  charges.value = (ch.data as ChargeRow[]) ?? [];
}
const reportParts = (id: string) => partRequests.value.filter((p) => p.report_id === id);

onMounted(load);
watch(() => route.params.id, () => { tab.value = 'info'; load(); });
</script>

<template>
  <div v-if="!jo" class="empty">Loading…</div>
  <template v-else>
    <div class="page-head">
      <div class="row">
        <button class="btn icon ghost" @click="router.back()">‹</button>
        <HelpButton topic="job-order-detail" />
        <span class="plate" style="font-size: 18px">{{ jo.vehicles.plate }}</span>
        <div>
          <h1>{{ jo.vehicles.make }} {{ jo.vehicles.model }}</h1>
          <p>{{ jo.vehicles.color }} · {{ jo.vehicles.year }} · {{ jo.vehicles.transmission || '—' }} · {{ jo.odometer_km.toLocaleString() }} KM · <router-link :to="`/vehicles/${jo.vehicle_id}`">Vehicle profile</router-link></p>
        </div>
      </div>
      <div class="row">
        <JobOrderStatusControl :job-order-id="jo.id" :status="jo.status" :plate="jo.vehicles.plate" @changed="load" @saved="load" />
        <button class="btn primary sm" @click="reportFor = jo.id">+ Add report</button>
        <PrintMenu :job-order-id="jo.id" :status="jo.status" :has-parts="partRequests.length > 0" />
      </div>
    </div>

    <div class="tabs">
      <button :class="{ active: tab === 'info' }" @click="tab = 'info'">Vehicle info</button>
      <button :class="{ active: tab === 'history' }" @click="tab = 'history'">History · {{ history.length }}</button>
    </div>

    <template v-if="tab === 'info'">
      <div class="grid cols-2">
        <div class="card">
          <h3>Job order</h3>
          <dl class="kv mt">
            <dt>JO #</dt><dd>{{ jo.jo_number }} <span class="dim">· {{ jo.local_ref }}</span></dd>
            <dt>Category</dt><dd>{{ jo.category }}</dd>
            <dt>Entry type</dt><dd>{{ jo.entry_type.replace('_', ' ') }}</dd>
            <dt>Created</dt><dd>{{ fmtDate(jo.created_at) }}</dd>
            <dt>Technician</dt><dd>{{ jo.created_by_name ?? '—' }}</dd>
            <dt>Complaint</dt><dd>{{ complaints.join(' · ') || '—' }}</dd>
          </dl>
          <h3 class="mt">Status history</h3>
          <div v-for="s in statusLog" :key="s.id" class="mt" style="font-size: 12px">
            <span class="badge" :class="statusTone(s.new_status)">{{ statusLabel(s.new_status) }}</span>
            <span class="dim"> · {{ s.changed_by_name ?? '—' }} · {{ fmtDate(s.changed_at) }}</span>
          </div>
        </div>
        <div class="card">
          <h3>Customer</h3>
          <dl class="kv mt">
            <dt>Name</dt><dd>{{ jo.customers.full_name }}</dd>
            <dt>Mobile</dt><dd>{{ jo.customers.phone || '—' }}</dd>
            <dt>Email</dt><dd>{{ jo.customers.email || '—' }}</dd>
            <dt>Address</dt><dd>{{ jo.customers.address || '—' }}</dd>
          </dl>
          <h3 class="mt">Vehicle</h3>
          <dl class="kv mt">
            <dt>VIN</dt><dd>{{ jo.vehicles.vin }}</dd>
            <dt>Engine</dt><dd>{{ jo.vehicles.engine_no }}</dd>
          </dl>
        </div>
      </div>

      <div class="card mt">
        <div class="row between"><h3>Parts requested · {{ partRequests.length }}</h3><button class="btn sm" @click="addParts = true">+ Add parts</button></div>
        <div class="table-wrap mt">
          <table>
            <thead><tr><th></th><th>Status</th><th>Part</th><th>Part number</th><th class="num">Qty</th><th>Requested by</th><th>When</th><th></th></tr></thead>
            <tbody>
              <tr v-for="p in partRequests" :key="p.id">
                <td style="width: 48px"><img v-if="partImageUrl(p.image_path)" :src="partImageUrl(p.image_path)!" alt="" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; display: block" /></td>
                <td><PartRequestStatus :id="p.id" :status="p.status" :label="p.part_name" @changed="(s) => (p.status = s)" /></td>
                <td><b>{{ p.part_name }}</b><span v-if="!p.part_id" class="badge warn" style="margin-left: 6px">Not in catalogue</span></td>
                <td class="mono">{{ p.part_number }}</td>
                <td class="num">
                  <div v-if="p.status !== 'CANCELLED'" class="qty"><button class="btn sm ghost" title="Decrease" @click="setPartQty(p, p.quantity - 1)">−</button><b>{{ p.quantity }}</b><button class="btn sm ghost" title="Increase" @click="setPartQty(p, p.quantity + 1)">+</button></div>
                  <span v-else>{{ p.quantity }}</span>
                </td>
                <td>{{ p.requested_by_name ?? '—' }}</td><td>{{ fmtDate(p.created_at) }}</td>
                <td class="num"><button v-if="p.status !== 'CANCELLED'" class="btn sm ghost danger-text" title="Remove" @click="removePart(p)">✕ Remove</button></td>
              </tr>
              <tr v-if="!partRequests.length"><td colspan="8" class="dim">No parts requested</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mt">
        <div class="row between"><h3>Labor & charges · ₱ {{ fmtMoney(chargesTotal()) }}</h3><button class="btn sm" @click="addCharges = true">+ Add charges</button></div>
        <div class="table-wrap mt">
          <table>
            <thead><tr><th>Code</th><th>Service</th><th>Unit</th><th class="num">Qty</th><th class="num">Unit amount</th><th class="num">Total</th><th>Added by</th><th>When</th><th></th></tr></thead>
            <tbody>
              <tr v-for="c in charges" :key="c.id">
                <td class="mono">{{ c.code }}</td><td><b>{{ c.name }}</b><span v-if="c.is_manual" class="badge" style="margin-left: 6px">Manual</span></td><td>{{ c.unit }}</td>
                <td class="num"><div class="qty"><button class="btn sm ghost" title="Decrease" @click="setChargeQty(c, Number(c.quantity) - 1)">−</button><b>{{ c.quantity }}</b><button class="btn sm ghost" title="Increase" @click="setChargeQty(c, Number(c.quantity) + 1)">+</button></div></td>
                <td class="num">{{ fmtMoney(c.unit_amount) }}</td><td class="num"><b>{{ fmtMoney(c.total) }}</b></td><td>{{ c.added_by_name ?? '—' }}</td><td>{{ fmtDate(c.created_at) }}</td>
                <td class="num"><button class="btn sm ghost danger-text" title="Remove" @click="removeCharge(c)">✕ Remove</button></td>
              </tr>
              <tr v-if="!charges.length"><td colspan="9" class="dim">No charges yet</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mt">
        <h3>Intake photos & video · {{ intakeMedia.length }}</h3>
        <div class="mt"><MediaGallery :items="intakeMedia" /></div>
      </div>

      <div class="card mt">
        <h3>Inspection</h3>
        <div v-for="g in INSPECTION_GROUPS" :key="g.key" class="mt">
          <h3 style="color: var(--m-light-blue)">{{ g.title }}</h3>
          <div class="insp mt">
            <div v-for="it in g.items" :key="it.key" class="i">
              <span class="dot" :class="{ ok: byKey.get(it.key)?.state === 'ok', bad: byKey.get(it.key)?.state === 'not_ok' }" />
              <div style="flex: 1">
                <span :style="{ color: byKey.get(it.key)?.state === 'unchecked' || !byKey.get(it.key) ? 'var(--text-dim)' : 'var(--text)' }">
                  {{ it.label }}<template v-if="byKey.get(it.key)?.quantity != null"> × {{ byKey.get(it.key)?.quantity }}</template>

                </span>
                <div v-if="byKey.get(it.key)?.state === 'not_ok' && byKey.get(it.key)?.remark" class="rm">{{ byKey.get(it.key)?.remark }}</div>
                <div v-if="itemMedia(it.key).length" class="mt"><MediaGallery :items="itemMedia(it.key)" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt">
        <h3>Remarks</h3>
        <div v-for="(r, i) in remarks" :key="i" class="mt">
          <div>{{ r.body }}</div>
          <div class="dim" style="font-size: 11px">{{ r.author_name ?? 'UNASSIGNED' }} · {{ fmtDate(r.created_at) }}</div>
        </div>
        <div v-if="!remarks.length" class="dim mt">—</div>
      </div>
    </template>


    <template v-else>
      <div class="timeline">
        <div v-for="h in history" :key="h.id" class="tl-item" :class="{ current: h.id === jo.id }">
          <div class="tl-head">
            <div>
              <b>{{ fmtDate(h.created_at) }}</b>
              <div class="dim" style="font-size: 11px">{{ h.jo_number }} · {{ h.category }} · {{ h.odometer_km.toLocaleString() }} KM{{ h.id === jo.id ? ' · VIEWING' : '' }}</div>
            </div>
            <div class="row">
              <span class="badge" :class="statusTone(h.status)">{{ statusLabel(h.status) }}</span>
              <button v-if="h.id !== jo.id" class="btn sm" @click="reportFor = h.id">+ Report</button>
              <router-link v-if="h.id !== jo.id" class="btn sm" :to="`/job-orders/${h.id}`">Open</router-link>
            </div>
          </div>
          <template v-if="h.id === jo.id">
            <div class="chips"><span v-for="c in complaints" :key="c" class="badge">{{ c }}</span></div>
            <div class="mt">
              <div v-for="i in inspection.filter((x) => x.state === 'not_ok')" :key="i.item_key" class="rm" style="color: var(--m-red); font-size: 12px">✕ {{ ITEM_LABELS.get(i.item_key) ?? i.item_key }}<span v-if="i.remark"> — {{ i.remark }}</span></div>
            </div>
            <div class="row between mt"><h3>Reports · {{ reports.length }}</h3><button class="btn sm" @click="reportFor = h.id">+ Add report</button></div>
            <div v-for="r in reports" :key="r.id" class="card mt" style="border-left: 3px solid var(--m-light-blue)">
              <div class="row between"><b class="upper">{{ r.author_name ?? 'UNASSIGNED' }}</b><span class="dim">{{ fmtDate(r.created_at) }}</span></div>
              <div class="mt">{{ r.body }}</div>
              <div v-if="reportParts(r.id).length" class="chips mt">
                <span v-for="p in reportParts(r.id)" :key="p.id" class="badge" :class="p.status === 'REQUESTED' ? 'warn' : p.status === 'ORDERED' ? 'info' : p.status === 'CANCELLED' ? 'danger' : 'ok'">{{ p.part_name }} × {{ p.quantity }} · {{ p.status }}</span>
              </div>
              <div v-if="reportMedia(r.id).length" class="mt"><MediaGallery :items="reportMedia(r.id)" /></div>
            </div>
            <div v-if="!reports.length" class="dim mt">No reports filed under this visit.</div>
          </template>

        </div>
      </div>
    </template>

    <PartsOrderModal v-if="addParts" :job-order-id="jo.id" :label="jo.vehicles.plate" @close="addParts = false" @saved="addParts = false; load()" />
    <ChargesModal v-if="addCharges" :job-order-id="jo.id" :label="jo.vehicles.plate" @close="addCharges = false" @saved="addCharges = false; load()" />
    <ReportModal v-if="reportFor" :job-order-id="reportFor" :label="jo.vehicles.plate" @close="reportFor = null" @saved="reportFor = null; load()" />
  </template>

</template>

