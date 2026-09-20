<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fmtDate, fmtMoney, statusLabel } from '@/lib/format';
import { INSPECTION_GROUPS } from '@/lib/inspection';
import { PORTAL_STATEMENT_KEY, type PortalResult } from '@/lib/portal';

/**
 * Printable "Vehicle Service Statement" for customers, in the same form layout as the shop's
 * invoices (logo, title, bordered form tables, section bands). Reads the lookup result the portal
 * stored in sessionStorage; it is not a numbered shop document.
 */
const data = ref<PortalResult | null>(null);
const missing = ref(false);
const ITEM_LABELS = new Map(INSPECTION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)));
const itemLabel = (k: string | null) => (k ? ITEM_LABELS.get(k) ?? k : '');

const partsTotal = (j: PortalResult['jobOrders'][number]) => j.parts.filter((p) => p.status !== 'CANCELLED').reduce((n, p) => n + p.amount, 0);
const laborTotal = (j: PortalResult['jobOrders'][number]) => j.charges.reduce((n, c) => n + Number(c.total), 0);
const totals = computed(() => {
  const jos = data.value?.jobOrders ?? [];
  const parts = jos.reduce((n, j) => n + partsTotal(j), 0);
  const labor = jos.reduce((n, j) => n + laborTotal(j), 0);
  return { parts, labor, grand: parts + labor, installed: jos.reduce((n, j) => n + j.parts.filter((p) => p.status === 'INSTALLED').length, 0) };
});
const photosOf = (j: PortalResult['jobOrders'][number]) => [...j.intake_media, ...j.reports.flatMap((r) => r.media)].filter((m) => m.kind === 'image' && m.url);

onMounted(() => {
  try {
    const raw = sessionStorage.getItem(PORTAL_STATEMENT_KEY);
    data.value = raw ? (JSON.parse(raw) as PortalResult) : null;
  } catch {
    data.value = null;
  }
  missing.value = !data.value;
  if (data.value) document.title = `VEHICLE SERVICE STATEMENT · ${data.value.vehicle.plate}`;
});
const print = () => setTimeout(() => window.print(), 80);
const closeWindow = () => window.close();
</script>

<template>
  <div class="print-root">
    <div class="print-toolbar no-print">
      <div class="row">
        <button class="btn" @click="closeWindow">✕ Close</button>
        <button class="btn primary" :disabled="!data" @click="print">🖨 Print / Save PDF</button>
      </div>
      <span class="help">Use “Save as PDF” in the print dialog to keep a copy.</span>
    </div>

    <div v-if="missing" class="empty">This statement has expired. Go back to the portal and look your vehicle up again.</div>

    <div v-else-if="data" class="sheet">
      <div class="brandline">
        <img src="/logo.png" alt="" class="logo" />
        <div class="shopname">{{ data.shop?.shop_name || 'BIMMERMONKEYS' }}</div>
        <div v-if="data.shop?.shop_address" class="shopline">{{ data.shop.shop_address }}</div>
        <div v-if="data.shop?.shop_phone || data.shop?.shop_email" class="shopline">{{ [data.shop.shop_phone ? '📞 ' + data.shop.shop_phone : '', data.shop.shop_email].filter(Boolean).join(' · ') }}</div>
      </div>
      <h1 class="title">VEHICLE SERVICE STATEMENT <span class="docno">· {{ data.vehicle.plate }}</span></h1>

      <table class="form hdr">
        <tbody>
          <tr>
            <td class="lbl nw">PLATE NO.</td><td class="val nw"><b>{{ data.vehicle.plate }}</b></td>
            <td class="lbl nw">VEHICLE</td><td class="val nw">{{ data.vehicle.make }} {{ data.vehicle.model }} {{ data.vehicle.year ?? '' }}</td>
            <td class="lbl nw">COLOR</td><td class="val nw">{{ data.vehicle.color }}</td>
            <td class="lbl nw">GENERATED</td><td class="val nw">{{ fmtDate(data.generated_at) }}</td>
          </tr>
          <tr>
            <td class="lbl nw">VIN</td><td class="val nw">{{ data.vehicle.vin }}</td>
            <td class="lbl nw">ENGINE NO.</td><td class="val nw">{{ data.vehicle.engine_no }}</td>
            <td class="lbl nw">TRANSMISSION</td><td class="val nw">{{ data.vehicle.transmission || '—' }}</td>
            <td class="lbl nw">JOB ORDERS</td><td class="val nw">{{ data.jobOrders.length }}</td>
          </tr>
        </tbody>
      </table>

      <div class="band">SUMMARY OF ALL VISITS</div>
      <table class="form">
        <colgroup><col style="width: 25%" /><col style="width: 25%" /><col style="width: 25%" /><col style="width: 25%" /></colgroup>
        <tbody>
          <tr class="head"><td>PARTS INSTALLED</td><td>PARTS TOTAL</td><td>LABOR TOTAL</td><td>GRAND TOTAL</td></tr>
          <tr>
            <td class="val nw">{{ totals.installed }}</td>
            <td class="val nw">₱{{ fmtMoney(totals.parts) }}</td>
            <td class="val nw">₱{{ fmtMoney(totals.labor) }}</td>
            <td class="val nw"><b>₱{{ fmtMoney(totals.grand) }}</b></td>
          </tr>
        </tbody>
      </table>
      <table class="form">
        <colgroup><col style="width: 16%" /><col style="width: 20%" /><col style="width: 14%" /><col style="width: 12%" /><col style="width: 22%" /><col style="width: 16%" /></colgroup>
        <tbody>
          <tr class="head"><td>J.O. #</td><td>DATE</td><td>STATUS</td><td>CATEGORY</td><td>TECHNICIAN</td><td>AMOUNT</td></tr>
          <tr v-for="j in data.jobOrders" :key="j.id">
            <td class="val nw pn">{{ j.jo_number }}</td>
            <td class="val nw">{{ fmtDate(j.created_at) }}</td>
            <td class="val nw">{{ statusLabel(j.status) }}</td>
            <td class="val nw">{{ j.category }}</td>
            <td class="val">{{ j.technician ?? '—' }}</td>
            <td class="val nw">₱{{ fmtMoney(partsTotal(j) + laborTotal(j)) }}</td>
          </tr>
          <tr v-if="!data.jobOrders.length"><td colspan="6" class="val muted">NO JOB ORDERS ON RECORD</td></tr>
        </tbody>
      </table>

      <!-- One job order per page, in full. -->
      <template v-for="(j, idx) in data.jobOrders" :key="j.id">
        <div class="pagebreak" />
        <h2 class="subtitle"><span>JOB ORDER {{ j.jo_number }} <span class="docno">· {{ statusLabel(j.status).toUpperCase() }}</span></span><span class="pageof">{{ idx + 1 }} OF {{ data.jobOrders.length }} · {{ data.vehicle.plate }}</span></h2>

        <table class="form hdr">
          <tbody>
            <tr>
              <td class="lbl nw">RECEIVED</td><td class="val nw">{{ fmtDate(j.created_at) }}</td>
              <td class="lbl nw">ENTRY TYPE</td><td class="val nw">{{ j.entry_type.replace('_', ' ') }}</td>
              <td class="lbl nw">CATEGORY</td><td class="val nw">{{ j.category }}</td>
              <td class="lbl nw">ODOMETER</td><td class="val nw">{{ j.odometer_km.toLocaleString() }} KM</td>
            </tr>
            <tr>
              <td class="lbl nw">CUSTOMER</td><td class="val">{{ j.customer_name ?? '—' }}</td>
              <td class="lbl nw">TECHNICIAN</td><td class="val">{{ j.technician ?? '—' }}</td>
              <td class="lbl nw">FINISHED</td><td class="val nw">{{ j.finished_at ? fmtDate(j.finished_at) : '—' }}</td>
              <td class="lbl nw">RELEASED</td><td class="val nw">{{ j.released_at ? fmtDate(j.released_at) : '—' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="band">CUSTOMER COMPLAINT</div>
        <table class="form"><tbody><tr><td class="val notes">{{ j.complaints.join(', ') || '—' }}</td></tr></tbody></table>

        <div class="band">REPORTS &amp; FINDINGS</div>
        <table class="form">
          <colgroup><col style="width: 70%" /><col style="width: 30%" /></colgroup>
          <tbody>
            <tr class="head"><td>FINDINGS</td><td>BY / WHEN</td></tr>
            <tr v-for="r in j.reports" :key="r.id">
              <td class="val left pre">{{ r.body }}</td>
              <td class="val nw">{{ r.author_name ?? '—' }}<br />{{ fmtDate(r.created_at) }}</td>
            </tr>
            <tr v-if="!j.reports.length"><td colspan="2" class="val muted">NO REPORTS FOR THIS VISIT</td></tr>
          </tbody>
        </table>

        <div class="band">PARTS</div>
        <table class="form">
          <colgroup><col style="width: 38%" /><col style="width: 6%" /><col style="width: 12%" /><col style="width: 14%" /><col style="width: 14%" /><col style="width: 16%" /></colgroup>
          <tbody>
            <tr class="head"><td>PART</td><td>QTY</td><td>STATUS</td><td>UNIT PRICE</td><td>AMOUNT</td><td>INSTALLED</td></tr>
            <tr v-for="p in j.parts" :key="p.id">
              <td class="val left"><span class="pn">{{ p.part_number }}</span> - {{ p.part_name }}</td>
              <td class="val nw">{{ p.quantity }}</td>
              <td class="val nw">{{ p.status }}</td>
              <td class="val nw">{{ p.unit_price != null ? '₱' + fmtMoney(p.unit_price) : '—' }}</td>
              <td class="val nw">₱{{ fmtMoney(p.amount) }}</td>
              <td class="val nw">{{ p.installed_at ? fmtDate(p.installed_at, false) : '—' }}</td>
            </tr>
            <tr v-if="!j.parts.length"><td colspan="6" class="val muted">NO PARTS</td></tr>
            <tr class="total"><td colspan="4" class="r">TOTAL PARTS COST</td><td class="val nw">₱{{ fmtMoney(partsTotal(j)) }}</td><td /></tr>
          </tbody>
        </table>

        <div class="band">LABOR COSTS / SERVICES RENDERED</div>
        <table class="form">
          <colgroup><col style="width: 46%" /><col style="width: 20%" /><col style="width: 16%" /><col style="width: 18%" /></colgroup>
          <tbody>
            <tr class="head"><td>LABOR TITLE</td><td>QTY / TIME × RATE</td><td>AMOUNT</td><td>DATE</td></tr>
            <tr v-for="c in j.charges" :key="c.id">
              <td class="val left">{{ c.name }}</td>
              <td class="val nw">{{ c.quantity }} {{ c.unit.replace('PER ', '') }} × ₱{{ fmtMoney(c.unit_amount) }}</td>
              <td class="val nw">₱{{ fmtMoney(c.total) }}</td>
              <td class="val nw">{{ fmtDate(c.created_at, false) }}</td>
            </tr>
            <tr v-if="!j.charges.length"><td colspan="4" class="val muted">NO LABOR CHARGES</td></tr>
            <tr class="total"><td colspan="2" class="r">TOTAL LABOR COST</td><td class="val nw">₱{{ fmtMoney(laborTotal(j)) }}</td><td /></tr>
            <tr class="grand"><td colspan="2" class="r">TOTAL FOR THIS JOB ORDER</td><td class="val nw">₱{{ fmtMoney(partsTotal(j) + laborTotal(j)) }}</td><td /></tr>
          </tbody>
        </table>

        <div class="band">TIMELINE</div>
        <table class="form">
          <colgroup><col style="width: 26%" /><col style="width: 44%" /><col style="width: 30%" /></colgroup>
          <tbody>
            <tr class="head"><td>WHEN</td><td>EVENT</td><td>BY</td></tr>
            <tr><td class="val nw">{{ fmtDate(j.created_at) }}</td><td class="val left">VEHICLE RECEIVED · {{ j.entry_type.replace('_', ' ') }}</td><td class="val">{{ j.technician ?? '—' }}</td></tr>
            <tr v-for="(l, i) in j.status_log" :key="'s' + i"><td class="val nw">{{ fmtDate(l.changed_at) }}</td><td class="val left">STATUS → {{ statusLabel(l.new_status) }}</td><td class="val">{{ l.changed_by_name ?? '—' }}</td></tr>
            <tr v-for="(a, i) in j.audit" :key="'a' + i"><td class="val nw">{{ fmtDate(a.at) }}</td><td class="val left">{{ a.action.replace(/_/g, ' ') }} · {{ a.value }}</td><td class="val">{{ a.by ?? '—' }}</td></tr>
          </tbody>
        </table>

        <template v-if="photosOf(j).length">
          <div class="band">PHOTOS · {{ photosOf(j).length }}</div>
          <div class="photos">
            <figure v-for="(m, i) in photosOf(j)" :key="m.id">
              <img :src="m.url!" alt="" />
              <figcaption>{{ i + 1 }}. {{ itemLabel(m.inspection_item_key) }}{{ m.inspection_item_key ? ' · ' : '' }}{{ fmtDate(m.captured_at) }} · {{ m.captured_by_name ?? '' }}</figcaption>
            </figure>
          </div>
        </template>
      </template>

      <div class="foot">VEHICLE SERVICE STATEMENT · {{ data.vehicle.plate }} · GENERATED {{ fmtDate(data.generated_at) }} · FOR THE CUSTOMER'S RECORDS — NOT AN OFFICIAL INVOICE OR RECEIPT</div>
    </div>
  </div>
</template>

<style scoped>
.print-root { min-height: 100vh; background: #4a4a50; padding-bottom: 40px; }
.print-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 24px; }
.empty { color: #fff; text-align: center; padding: 60px 20px; }

/* Paper reset — same sheet as the shop's invoices. */
.sheet, .sheet * { box-sizing: border-box; color: #111; font-family: Arial, Helvetica, sans-serif; }
.sheet { --band: #1f3f93; width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 9mm 10mm 8mm; font-size: 10.5px; text-transform: uppercase; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.brandline { text-align: center; }
.logo { width: 64px; height: 64px; border-radius: 10px; background: #000; }
.shopname { font-size: 18px; font-weight: 700; letter-spacing: 0.2em; margin-top: 2px; }
.shopline { font-size: 9.5px; color: #222; margin-top: 1px; }
.title { text-align: center; font-size: 16px; font-weight: 700; letter-spacing: 0.04em; margin: 8px 0 6px; color: #111; }
.subtitle { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; margin: 4px 0 6px; color: #111; }
.pageof { font-size: 9px; color: #555; font-weight: 400; }
.docno { color: var(--band); }

.band { display: block; background: var(--band); color: #fff; font-weight: 700; text-align: center; letter-spacing: 0.08em; padding: 4px 6px; border: 1px solid #111; border-bottom: 0; font-size: 10.5px; }
.form { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 4px; }
.form td { position: static; background: #fff; border: 1px solid #111; padding: 4px 6px; font-size: 10.5px; line-height: 1.3; vertical-align: middle; text-align: center; letter-spacing: 0; text-transform: uppercase; word-wrap: break-word; }
.form td.lbl { font-weight: 700; white-space: nowrap; }
.form.hdr { table-layout: auto; }
.form.hdr td { font-size: 10px; padding: 4px 5px; }
.form td.nw { white-space: nowrap; word-wrap: normal; overflow-wrap: normal; }
.form td.val { text-align: center; }
.form td.left { text-align: left; }
.form td.pre { white-space: pre-wrap; }
.form td.r { text-align: right; font-weight: 700; white-space: nowrap; }
.form tr.head td { font-weight: 700; background: #f2f2f2; }
.form td.notes { min-height: 34px; height: 34px; }
.form .pn { color: var(--band); font-weight: 700; }
.form tr.total td { font-weight: 700; }
.form tr.grand td { font-weight: 700; font-size: 12px; }
.form .muted { color: #777; }
.foot { margin-top: 6px; text-align: center; font-size: 8px; color: #666; }

.pagebreak { page-break-before: always; break-before: page; height: 0; margin-top: 16px; }
.photos { border: 1px solid #111; padding: 6px; margin-bottom: 4px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.photos figure { margin: 0; page-break-inside: avoid; break-inside: avoid; text-align: center; }
.photos img { width: 100%; height: 42mm; object-fit: cover; border: 1px solid #111; background: #000; }
.photos figcaption { font-size: 8px; color: #333; margin-top: 2px; }

@media print {
  .no-print { display: none !important; }
  .print-root { background: #fff; padding: 0; min-height: 0 !important; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .band, .form tr.head td, .photos img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .form tr, .photos figure { break-inside: avoid; page-break-inside: avoid; }
  @page { size: A4; margin: 10mm; }
}
</style>

<style>
@media print {
  html, body, #app { height: auto !important; min-height: 0 !important; background: #fff !important; }
  .toasts { display: none !important; }
}
</style>
