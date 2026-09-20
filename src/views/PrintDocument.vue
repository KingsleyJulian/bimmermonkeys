<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { signedUrl, supabase } from '@/lib/supabase';
import { fmtDate, fmtMoney, statusLabel } from '@/lib/format';
import { INSPECTION_GROUPS } from '@/lib/inspection';
import { toast } from '@/lib/toast';

/**
 * Printable job-order forms: one bordered sheet, blue section bands, bold label cells,
 * signatory table and liability waiver — plus a Visual Inspection Report page of photos.
 *  intake        — VEHICLE INTAKE CHECKLIST (full inspection; owner + technician sign)
 *  parts-request — PARTS REQUEST FORM (client, mechanic, parts custodian)
 *  sales-invoice — SALES INVOICE for parts (client, mechanic, cashier)
 *  invoice       — SERVICE INVOICE for labor, parts included by default (toggle)
 */
type Kind = 'intake' | 'parts-request' | 'sales-invoice' | 'invoice';
const KIND_TO_DB: Record<Kind, string> = { intake: 'intake', 'parts-request': 'parts_request', 'sales-invoice': 'sales_invoice', invoice: 'invoice' };
/** Section-band colour per document: light blue intake, dark blue parts request, red sales invoice, grey service invoice. */
const BAND: Record<Kind, string> = { intake: '#4f9be3', 'parts-request': '#1f3f93', 'sales-invoice': '#c8102e', invoice: '#4b5563' };
const TITLES: Record<Kind, string> = { intake: 'VEHICLE ENTRY AND INSPECTION FORM', 'parts-request': 'PARTS REQUEST FORM', 'sales-invoice': 'SALES INVOICE — PARTS', invoice: 'SERVICE INVOICE' };

type Jo = {
  id: string; jo_number: string; local_ref: string; status: string; category: string; entry_type: string; odometer_km: number; created_at: string; created_by_name: string | null;
  vehicles: { plate: string; make: string; model: string; year: number; color: string; vin: string; engine_no: string; transmission: string };
  customers: { full_name: string; phone: string; email: string; address: string };
};
type Insp = { item_key: string; state: string; quantity: number | null; remark: string };
type Part = { id: string; part_id: string | null; part_number: string; part_name: string; quantity: number; status: string; parts: { srp: number | null } | null };
type Charge = { id: string; code: string; name: string; unit: string; quantity: number; unit_amount: number; total: number; is_manual: boolean };
type Sig = { label: string; name: string };
type Media = { id: string; kind: string; storage_path: string | null; thumbnail_path: string | null; captured_at: string; captured_by_name: string | null; inspection_item_key: string | null; report_id: string | null };

const route = useRoute();
const kind = route.params.kind as Kind;
const id = route.params.id as string;

const jo = ref<Jo | null>(null);
const inspection = ref<Insp[]>([]);
const complaints = ref<string[]>([]);
const parts = ref<Part[]>([]);
const charges = ref<Charge[]>([]);
const settings = ref<Record<string, string>>({});
const extraSignatories = ref<Sig[]>([]);
const adHoc = ref<Sig[]>([]);
const completedAt = ref<string | null>(null);
const photos = ref<{ url: string; caption: string }[]>([]);
const includePhotos = ref(kind === 'intake');
const includeParts = ref(route.query.parts !== '0');
const docNumber = ref<number | null>(null);
const printedAt = ref(new Date());


const byKey = computed(() => new Map(inspection.value.map((i) => [i.item_key, i])));
const activeParts = computed(() => parts.value.filter((p) => kind === 'parts-request' || p.status !== 'CANCELLED'));
const partsTotal = computed(() => activeParts.value.reduce((n, p) => n + p.quantity * Number(p.parts?.srp ?? 0), 0));
const laborTotal = computed(() => charges.value.reduce((n, c) => n + Number(c.total), 0));
const vatRate = computed(() => Number(settings.value.vat_rate || 0));
const subtotal = computed(() => (kind === 'sales-invoice' ? partsTotal.value : kind === 'invoice' ? laborTotal.value + (includeParts.value ? partsTotal.value : 0) : 0));
const vat = computed(() => (vatRate.value > 0 ? subtotal.value * (vatRate.value / 100) : 0));
const grandTotal = computed(() => subtotal.value + vat.value);
const showParts = computed(() => kind === 'parts-request' || kind === 'sales-invoice' || (kind === 'invoice' && includeParts.value));
const priced = computed(() => kind !== 'parts-request');

const fixedSignatories = computed<Sig[]>(() => {
  const client = { label: 'CLIENT', name: jo.value?.customers.full_name ?? '' };
  const mech = { label: 'MECHANIC ASSIGNED', name: jo.value?.created_by_name ?? '' };
  if (kind === 'intake') return [client, mech];
  if (kind === 'parts-request') return [client, mech, { label: 'PARTS CUSTODIAN', name: settings.value.parts_custodian_name ?? '' }];
  return [client, mech, { label: 'CASHIER', name: settings.value.cashier_name ?? '' }];
});
const allSignatories = computed(() => [...fixedSignatories.value, ...extraSignatories.value, ...adHoc.value]);

const pairs = (items: { key: string; label: string }[]) => {
  const out: { key: string; label: string }[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
};
const stateMark = (s?: string) => (s === 'ok' ? '✓ OK' : s === 'not_ok' ? '✗ NOT OK' : '—');
const ITEM_LABELS = new Map(INSPECTION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)));

onMounted(async () => {
  const [j, i, c, p, ch, s, g, sl, m] = await Promise.all([
    supabase.from('job_orders').select('*, vehicles(*), customers(*)').eq('id', id).maybeSingle(),
    supabase.from('inspection_items').select('item_key, state, quantity, remark').eq('job_order_id', id),
    supabase.from('complaints').select('keyword').eq('job_order_id', id).order('position'),
    supabase.from('part_requests').select('id, part_id, part_number, part_name, quantity, status, parts(srp)').eq('job_order_id', id).order('created_at'),
    supabase.from('job_order_charges').select('*').eq('job_order_id', id).order('created_at'),
    supabase.from('shop_settings').select('key, value'),
    supabase.from('document_signatories').select('label, name').eq('document_kind', KIND_TO_DB[kind]).order('sort_order'),
    supabase.from('job_order_status_log').select('new_status, changed_at').eq('job_order_id', id).in('new_status', ['COMPLETED', 'RELEASED']).order('changed_at', { ascending: false }).limit(1),
    supabase.from('media_attachments').select('id, kind, storage_path, thumbnail_path, captured_at, captured_by_name, inspection_item_key, report_id').eq('job_order_id', id).eq('kind', 'image').order('sort_order'),
  ]);
  jo.value = j.data as unknown as Jo;
  inspection.value = (i.data as Insp[]) ?? [];
  complaints.value = ((c.data as { keyword: string }[]) ?? []).map((x) => x.keyword);
  parts.value = (p.data as unknown as Part[]) ?? [];
  charges.value = (ch.data as Charge[]) ?? [];
  settings.value = Object.fromEntries(((s.data as { key: string; value: string }[]) ?? []).map((r) => [r.key, r.value]));
  extraSignatories.value = (g.data as Sig[]) ?? [];
  completedAt.value = ((sl.data as { changed_at: string }[]) ?? [])[0]?.changed_at ?? null;
  document.title = `${TITLES[kind]} · ${jo.value?.jo_number ?? ''}`;
  // Intake photos (not report media): signed URLs for the Visual Inspection Report page.
  const list = ((m.data as Media[]) ?? []).filter((x) => !x.report_id);
  photos.value = (
    await Promise.all(
      list.map(async (x) => {
        const url = await signedUrl(x.storage_path);
        return url ? { url, caption: `${x.inspection_item_key ? (ITEM_LABELS.get(x.inspection_item_key) ?? x.inspection_item_key) + ' · ' : ''}${fmtDate(x.captured_at)} · ${x.captured_by_name ?? ''}` } : null;
      }),
    )
  ).filter((x): x is { url: string; caption: string } => !!x);
});

async function print() {
  if (kind !== 'intake' && docNumber.value === null) {
    const { data, error } = await supabase.rpc('next_document_number', {
      p_kind: KIND_TO_DB[kind],
      p_job_order_id: id,
      p_include_parts: kind === 'invoice' ? includeParts.value : true,
      p_total: kind === 'parts-request' ? null : grandTotal.value,
    });
    if (error) return toast.error(error.message);
    docNumber.value = data as number;
    printedAt.value = new Date();
  }
  setTimeout(() => window.print(), 80);
}
const closeWindow = () => window.close();
</script>

<template>
  <div class="print-root">
    <div class="print-toolbar no-print">
      <div class="row">
        <button class="btn" @click="closeWindow">✕ Close</button>
        <HelpButton topic="print" />
        <button class="btn primary" @click="print">🖨 Print / Save PDF</button>
        <label v-if="kind === 'invoice'" class="row" style="gap: 6px; font-size: 12px; color: var(--text)"><input v-model="includeParts" type="checkbox" /> INCLUDE PARTS</label>
        <label v-if="photos.length" class="row" style="gap: 6px; font-size: 12px; color: var(--text)"><input v-model="includePhotos" type="checkbox" /> PHOTO PAGE ({{ photos.length }})</label>
      </div>
      <div class="row">
        <button class="btn sm" @click="adHoc.push({ label: '', name: '' })">+ Add signatory</button>
      </div>
    </div>
    <div v-if="adHoc.length" class="no-print card" style="margin: 0 24px 12px">
      <div v-for="(s, i) in adHoc" :key="i" class="row" style="margin-bottom: 6px">
        <input v-model="s.label" class="input" placeholder="ROLE / LABEL" style="flex: 1" @input="s.label = s.label.toUpperCase()" />
        <input v-model="s.name" class="input" placeholder="NAME (OPTIONAL)" style="flex: 1" @input="s.name = s.name.toUpperCase()" />
        <button class="btn sm ghost" @click="adHoc.splice(i, 1)">✕</button>
      </div>
    </div>

    <div v-if="!jo" class="empty">Loading…</div>
    <div v-else class="sheet" :style="{ '--band': BAND[kind] }">
      <div class="brandline">
        <img src="/logo.png" alt="" class="logo" />
        <div class="shopname">{{ settings.shop_name || 'BIMMERMONKEYS' }}</div>
        <div v-if="settings.shop_address" class="shopline">{{ settings.shop_address }}</div>
        <div v-if="settings.shop_phone || settings.shop_email || settings.shop_tin" class="shopline">{{ [settings.shop_phone ? '📞 ' + settings.shop_phone : '', settings.shop_email, settings.shop_tin ? 'TIN ' + settings.shop_tin : ''].filter(Boolean).join(' · ') }}</div>
      </div>
      <h1 class="title">{{ TITLES[kind] }}<span v-if="docNumber !== null" class="docno"> · NO. {{ String(docNumber).padStart(6, '0') }}</span></h1>

      <table class="form hdr">
        <tbody>
          <tr>
            <td class="lbl nw">J.O. #</td><td class="val nw">{{ jo.jo_number }}</td>
            <td class="lbl nw">ENTRY TYPE</td><td class="val nw">{{ jo.entry_type.replace('_', ' ') }}</td>
            <td class="lbl nw">FILING DATE</td><td class="val nw">{{ fmtDate(jo.created_at) }}</td>
            <td class="lbl nw">{{ completedAt ? 'COMPLETION DATE' : 'STATUS' }}</td><td class="val nw">{{ completedAt ? fmtDate(completedAt) : statusLabel(jo.status) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="band">CUSTOMER INFORMATION</div>
      <table class="form">
        <colgroup><col style="width: 15%" /><col style="width: 18%" /><col style="width: 15%" /><col style="width: 18%" /><col style="width: 15%" /><col style="width: 19%" /></colgroup>
        <tbody>
          <tr>
            <td class="lbl">FULL NAME</td><td class="val">{{ jo.customers.full_name }}</td>
            <td class="lbl">PHONE</td><td class="val">{{ jo.customers.phone || '—' }}</td>
            <td class="lbl">EMAIL</td><td class="val">{{ jo.customers.email || '—' }}</td>
          </tr>
          <tr><td class="lbl">ADDRESS</td><td colspan="5" class="val">{{ jo.customers.address || '—' }}</td></tr>
        </tbody>
      </table>

      <div class="band">VEHICLE INFORMATION</div>
      <table class="form">
        <colgroup><col style="width: 15%" /><col style="width: 18%" /><col style="width: 15%" /><col style="width: 18%" /><col style="width: 15%" /><col style="width: 19%" /></colgroup>
        <tbody>
          <tr>
            <td class="lbl">MAKE</td><td class="val">{{ jo.vehicles.make }}</td>
            <td class="lbl">MODEL &amp; COLOR</td><td class="val">{{ jo.vehicles.model }} - {{ jo.vehicles.color }}</td>
            <td class="lbl">YEAR</td><td class="val">{{ jo.vehicles.year }}</td>
          </tr>
          <tr>
            <td class="lbl">SERVICE</td><td class="val">{{ jo.category }}</td>
            <td class="lbl">VIN</td><td class="val">{{ jo.vehicles.vin }}</td>
            <td class="lbl">ENGINE NO.</td><td class="val">{{ jo.vehicles.engine_no }}</td>
          </tr>
          <tr>
            <td class="lbl">ODOMETER</td><td class="val">{{ jo.odometer_km.toLocaleString() }} KM</td>
            <td class="lbl">PLATE NO.</td><td class="val"><b>{{ jo.vehicles.plate }}</b></td>
            <td class="lbl">TRANSMISSION</td><td class="val">{{ jo.vehicles.transmission || '—' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="band">SERVICE NOTES</div>
      <table class="form"><tbody><tr><td class="val notes">{{ complaints.join(', ') || '—' }}</td></tr></tbody></table>

      <template v-if="kind === 'intake'">
        <template v-for="g in INSPECTION_GROUPS" :key="g.key">
          <div class="band">{{ g.title }}</div>
          <table class="form chk">
            <colgroup><col style="width: 27%" /><col style="width: 9%" /><col style="width: 14%" /><col style="width: 27%" /><col style="width: 9%" /><col style="width: 14%" /></colgroup>
            <tbody>
              <tr class="head"><td>ITEM</td><td>STATUS</td><td>REMARKS</td><td>ITEM</td><td>STATUS</td><td>REMARKS</td></tr>
              <tr v-for="(pair, pi) in pairs(g.items)" :key="pi">
                <template v-for="it in pair" :key="it.key">
                  <td class="it">{{ it.label }}<template v-if="byKey.get(it.key)?.quantity != null"> × {{ byKey.get(it.key)?.quantity }}</template></td>
                  <td class="st" :class="byKey.get(it.key)?.state">{{ stateMark(byKey.get(it.key)?.state) }}</td>
                  <td class="rm">{{ byKey.get(it.key)?.remark || '' }}</td>
                </template>
                <template v-if="pair.length === 1"><td /><td /><td /></template>
              </tr>
            </tbody>
          </table>
        </template>
      </template>

      <template v-if="showParts">
        <div class="band">{{ kind === 'parts-request' ? 'PARTS REQUESTED' : 'PARTS INSTALLED / PARTS TO BE INSTALLED' }}</div>
        <table class="form">
          <colgroup v-if="priced"><col style="width: 52%" /><col style="width: 8%" /><col style="width: 18%" /><col style="width: 22%" /></colgroup>
          <colgroup v-else><col style="width: 62%" /><col style="width: 8%" /><col style="width: 6%" /><col style="width: 24%" /></colgroup>
          <tbody>
            <tr class="head"><td>PART NAME</td><td>QTY</td><td>{{ priced ? 'UNIT PRICE' : '' }}</td><td>{{ priced ? 'AMOUNT' : 'STATUS' }}</td></tr>
            <tr v-for="p in activeParts" :key="p.id">
              <td class="val"><span class="pn">{{ p.part_number }}</span> - {{ p.part_name }}</td>
              <td class="val nw">{{ p.quantity }}</td>
              <td class="val nw">{{ priced ? '₱' + fmtMoney(p.parts?.srp) : '' }}</td>
              <td class="val nw">{{ priced ? '₱' + fmtMoney(p.quantity * Number(p.parts?.srp ?? 0)) : p.status }}</td>
            </tr>
            <tr v-if="!activeParts.length"><td colspan="4" class="val muted">NO PARTS</td></tr>
            <tr v-if="priced" class="total"><td colspan="3" class="r">TOTAL PARTS COST</td><td class="val nw">₱{{ fmtMoney(partsTotal) }}</td></tr>
          </tbody>
        </table>
      </template>

      <template v-if="kind === 'invoice'">
        <div class="band">LABOR COSTS / SERVICES RENDERED</div>
        <table class="form">
          <colgroup><col style="width: 52%" /><col style="width: 26%" /><col style="width: 22%" /></colgroup>
          <tbody>
            <tr class="head"><td>LABOR TITLE</td><td>QTY / TIME × RATE</td><td>AMOUNT</td></tr>
            <tr v-for="c in charges" :key="c.id">
              <td class="val">{{ c.name }}<span v-if="c.is_manual" class="muted"> (MANUAL)</span></td>
              <td class="val nw">{{ c.quantity }} {{ c.unit.replace('PER ', '') }} × ₱{{ fmtMoney(c.unit_amount) }}</td>
              <td class="val nw">₱{{ fmtMoney(c.total) }}</td>
            </tr>
            <tr v-if="!charges.length"><td colspan="3" class="val muted">NO LABOR CHARGES</td></tr>
            <tr class="total"><td colspan="2" class="r">TOTAL LABOR COST</td><td class="val nw">₱{{ fmtMoney(laborTotal) }}</td></tr>
            <tr v-if="vatRate > 0" class="total"><td colspan="2" class="r">VAT {{ vatRate }}%</td><td class="val nw">₱{{ fmtMoney(vat) }}</td></tr>
            <tr class="grand"><td colspan="2" class="r">GRAND TOTAL</td><td class="val nw">₱{{ fmtMoney(grandTotal) }}</td></tr>
          </tbody>
        </table>
      </template>
      <template v-else-if="kind === 'sales-invoice'">
        <table class="form">
          <colgroup><col style="width: 78%" /><col style="width: 22%" /></colgroup>
          <tbody>
            <tr v-if="vatRate > 0" class="total"><td class="r">VAT {{ vatRate }}%</td><td class="val nw">₱{{ fmtMoney(vat) }}</td></tr>
            <tr class="grand"><td class="r">GRAND TOTAL</td><td class="val nw">₱{{ fmtMoney(grandTotal) }}</td></tr>
          </tbody>
        </table>
      </template>

      <div class="band">SIGNATORY PERSONNEL</div>
      <table class="form sign">
        <colgroup><col style="width: 25%" /><col style="width: 75%" /></colgroup>
        <tbody>
          <tr v-for="(s, i) in allSignatories" :key="i">
            <td class="lbl">{{ s.label || 'SIGNATORY' }}</td>
            <td class="sigcell"><span class="signame">{{ s.name }}</span></td>
          </tr>
        </tbody>
      </table>

      <table class="form waiver-table"><tbody><tr><td>
        <p class="wt">{{ kind === 'intake' ? 'Vehicle Intake Acknowledgement' : 'Repair Authorization and Liability Waiver' }}</p>
        <p v-if="kind === 'intake'" class="wb">
          I confirm that the condition of the vehicle and the items received are as recorded above. {{ settings.shop_name || 'THE SHOP' }} is not responsible for personal belongings not
          declared on this checklist. I authorize the inspection and diagnosis described herein.
        </p>
        <p v-else class="wb">
          I hereby authorize the repair work described above to be performed, including the use of all necessary parts. I further authorize {{ settings.shop_name || 'THE SHOP' }} to operate
          the vehicle described above for the purpose of testing, inspection or delivery at my own risk. It is understood that {{ settings.shop_name || 'THE SHOP' }} will not be held
          responsible for the loss of, or damage to, the vehicle or any articles left in the vehicle in case of fire, theft, or any other cause beyond the shop's control. We are in
          agreement that the sum due must be collected prior to release of the vehicle to the client. Upon completion of the repair work or warranty claim for the aforementioned unit,
          you will be notified of the final bill. Should we receive no response within two (2) calendar days from the date of notification, a daily storage fee as posted in the shop
          will be imposed. All replaced parts or items paid for by the customer must be collected upon the release of the unit; unclaimed items may be disposed of after three (3)
          calendar days.
        </p>
        <p v-if="settings.invoice_footer && kind !== 'intake'" class="wb" style="text-align: center; font-weight: 700">{{ settings.invoice_footer }}</p>
      </td></tr></tbody></table>
      <div class="foot">{{ TITLES[kind] }} · {{ jo.jo_number }} · REF {{ jo.local_ref }} · PRINTED {{ fmtDate(printedAt.toISOString()) }}</div>

      <template v-if="includePhotos && photos.length">
        <h1 class="title photos-title">VISUAL INSPECTION REPORT</h1>
        <div class="photos">
          <figure v-for="(ph, i) in photos" :key="i">
            <img :src="ph.url" alt="" />
            <figcaption>{{ i + 1 }}. {{ ph.caption }}</figcaption>
          </figure>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.print-root { min-height: 100vh; background: #4a4a50; padding-bottom: 40px; }
.print-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 24px; }

/* Paper reset — nothing from the dark console theme may leak in. */
.sheet, .sheet * { box-sizing: border-box; color: #111; font-family: Arial, Helvetica, sans-serif; }
.sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 9mm 10mm 8mm; font-size: 10.5px; text-transform: uppercase; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.brandline { text-align: center; }
.logo { width: 64px; height: 64px; border-radius: 10px; background: #000; }
.shopname { font-size: 18px; font-weight: 700; letter-spacing: 0.2em; margin-top: 2px; }
.shopline { font-size: 9.5px; color: #222; margin-top: 1px; }
.title { text-align: center; font-size: 16px; font-weight: 700; letter-spacing: 0.04em; margin: 8px 0 6px; color: #111; }
.docno { color: var(--band, #b00); }

.band { display: block; background: var(--band, #5b6ee1); color: #fff; font-weight: 700; text-align: center; letter-spacing: 0.08em; padding: 4px 6px; border: 1px solid #111; border-bottom: 0; font-size: 10.5px; }
.form { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 4px; }
.form td { position: static; background: #fff; border: 1px solid #111; padding: 4px 6px; font-size: 10.5px; line-height: 1.3; vertical-align: middle; text-align: center; letter-spacing: 0; text-transform: uppercase; word-wrap: break-word; }
.form td.lbl { font-weight: 700; white-space: nowrap; }
/* Header strip sizes itself to content: eight nowrap cells, dates included, on one line. */
.form.hdr { table-layout: auto; }
.form.hdr td { font-size: 10px; padding: 4px 5px; }
.form td.nw { white-space: nowrap; word-wrap: normal; overflow-wrap: normal; }
.form td.val { text-align: center; }
.form td.left { text-align: left; }
.form td.r { text-align: right; font-weight: 700; white-space: nowrap; }
.form tr.head td { font-weight: 700; background: #f2f2f2; }
.form td.notes { min-height: 44px; height: 44px; }
.form td.blank { height: 90px; }
.form .who { color: #555; font-size: 9px; }
.form .pn { color: var(--band, #1f3f93); font-weight: 700; }
.form tr.total td { font-weight: 700; }
.form tr.grand td { font-weight: 700; font-size: 12px; }
.form .muted { color: #777; }
.chk { display: table; }
.chk td { padding: 2px 5px; font-size: 9px; line-height: 1.2; }
.chk td.it { text-align: left; }
.chk td.st { font-weight: 700; white-space: nowrap; }
.chk td.st.ok { color: #0a7a3c; }
.chk td.st.not_ok { color: #b00; }
.chk td.rm { text-align: left; color: #b00; font-size: 8.5px; }
.chk tr.head td { font-size: 8.5px; }
.sign td { height: 30px; }
.sign .signame { font-weight: 700; color: #333; font-size: 10px; }
.waiver-table td { text-align: left; text-transform: none; padding: 6px 8px; }
.wt { margin: 0 0 3px; font-size: 8.5px; font-weight: 700; text-align: center; text-transform: uppercase; }
.wb { margin: 0 0 3px; font-size: 8px; line-height: 1.35; text-align: justify; }
.foot { margin-top: 6px; text-align: center; font-size: 8px; color: #666; }

.photos-title { page-break-before: always; break-before: page; margin-top: 0; padding-top: 2mm; }
.photos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.photos figure { margin: 0; page-break-inside: avoid; break-inside: avoid; text-align: center; }
.photos img { width: 100%; max-height: 120mm; object-fit: contain; border: 1px solid #111; background: #000; }
.photos figcaption { font-size: 8.5px; color: #333; margin-top: 3px; }

@media print {
  .no-print { display: none !important; }
  .print-root { background: #fff; padding: 0; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .band, .form tr.head td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 10mm; }
}
</style>

<style>
@media print {
  html, body, #app { height: auto !important; min-height: 0 !important; background: #fff !important; }
  .print-root { min-height: 0 !important; }
  .toasts { display: none !important; }
}
</style>
