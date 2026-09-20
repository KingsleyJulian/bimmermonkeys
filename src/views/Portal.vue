<script setup lang="ts">
import { computed, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { fmtDate, fmtMoney, statusLabel, statusTone } from '@/lib/format';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { INSPECTION_GROUPS } from '@/lib/inspection';
import { PORTAL_STATEMENT_KEY, type PortalJo, type PortalMedia, type PortalResult } from '@/lib/portal';

/**
 * Customer self-service portal (public homepage). The customer proves ownership with the full plate
 * number + first four VIN characters; the customer-portal edge function returns the vehicle's whole
 * service history read-only. No shop documents can be printed from here — only the summary export.
 */
type Media = PortalMedia;
type Jo = PortalJo;
type Result = PortalResult;

const plate = ref('');
const vin = ref('');
const busy = ref(false);
const error = ref('');
const result = ref<Result | null>(null);
const selectedId = ref<string | null>(null);
const lightbox = ref<Media | null>(null);
const ITEM_LABELS = new Map(INSPECTION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)));

const canSearch = computed(() => plate.value.replace(/[^A-Z0-9]/g, '').length >= 2 && vin.value.replace(/[^A-Z0-9]/g, '').length === 4);
const partsTotal = (j: Jo) => j.parts.filter((p) => p.status !== 'CANCELLED').reduce((n, p) => n + p.amount, 0);
const laborTotal = (j: Jo) => j.charges.reduce((n, c) => n + Number(c.total), 0);
const totals = computed(() => {
  const jos = result.value?.jobOrders ?? [];
  const parts = jos.reduce((n, j) => n + partsTotal(j), 0);
  const labor = jos.reduce((n, j) => n + laborTotal(j), 0);
  return { visits: jos.length, parts, labor, grand: parts + labor, installed: jos.reduce((n, j) => n + j.parts.filter((p) => p.status === 'INSTALLED').length, 0) };
});
const partTone = (s: string) => (s === 'INSTALLED' ? 'ok' : s === 'CANCELLED' ? 'danger' : s === 'RECEIVED' ? 'info' : 'warn');
const itemLabel = (k: string | null) => (k ? ITEM_LABELS.get(k) ?? k : '');

async function search() {
  if (!canSearch.value || busy.value) return;
  busy.value = true;
  error.value = '';
  result.value = null;
  try {
    const { data, error: fe } = await supabase.functions.invoke('customer-portal', { body: { plate: plate.value, vin: vin.value } });
    if (fe) {
      // FunctionsHttpError carries the JSON body with the real message.
      const ctx = (fe as { context?: Response }).context;
      let msg = 'Lookup failed. Please try again.';
      try {
        msg = ((await ctx?.json()) as { error?: string })?.error ?? msg;
      } catch {
        /* keep default */
      }
      throw new Error(msg);
    }
    result.value = data as Result;
    selectedId.value = result.value.jobOrders?.[0]?.id ?? null;
    setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 50);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lookup failed';
  } finally {
    busy.value = false;
  }
}
function reset() {
  result.value = null;
  error.value = '';
  plate.value = '';
  vin.value = '';
}

function printSummary() {
  if (!result.value) return;
  try {
    sessionStorage.setItem(PORTAL_STATEMENT_KEY, JSON.stringify(result.value));
  } catch {
    return (error.value = 'Could not prepare the statement in this browser.');
  }
  window.open('/statement', '_blank');
}
</script>

<template>
  <div class="portal">
    <main class="portal-main">
      <div class="masthead no-print">
        <img src="/logo.png" alt="Bimmermonkeys" class="logo" />
        <b class="wordmark">BIMMERMONKEYS</b>
        <div class="row" style="gap: 6px">
          <router-link class="btn sm ghost" to="/login">Staff sign in ›</router-link>
          <ThemeToggle />
        </div>
      </div>

      <section v-if="!result" class="hero no-print">
        <h1>Check your vehicle's service history</h1>
        <p class="lead">See every visit, what was found, the parts and labor you were charged for, and the photos and videos our technicians took — anytime.</p>

        <form class="card lookup" @submit.prevent="search">
          <div class="lookup-grid">
            <div class="field">
              <label>Plate number <span class="req">*</span></label>
              <input v-model="plate" class="input mono" placeholder="E.G. ABC1234" maxlength="15" autocomplete="off" @input="plate = plate.toUpperCase()" />
              <span class="help">Your full plate number, no spaces or dashes needed.</span>
            </div>
            <div class="field">
              <label>First 4 characters of VIN <span class="req">*</span></label>
              <input v-model="vin" class="input mono" placeholder="E.G. WBA3" maxlength="4" autocomplete="off" @input="vin = vin.toUpperCase().replace(/[^A-Z0-9]/g, '')" />
              <span class="help">The chassis / VIN number on your OR/CR or the plate under the windshield.</span>
            </div>
            <button class="btn primary lookup-btn" :disabled="!canSearch || busy">{{ busy ? 'Searching…' : 'View my history' }}</button>
          </div>
          <p v-if="error" class="err mt">{{ error }}</p>
        </form>

        <div class="guide">
          <h2>How it works</h2>
          <ol class="steps">
            <li><b>Type your full plate number</b><span>Exactly as it appears on the plate, e.g. <code>ABC1234</code> or <code>NCK123</code>. Letters and numbers only.</span></li>
            <li><b>Add the first 4 characters of your VIN</b><span>Your VIN (chassis number) is on the OR/CR, on the metal plate at the base of the windshield, or on the door-jamb sticker. Only the first four are needed — e.g. <code>WBA3</code>.</span></li>
            <li><b>Press “View my history”</b><span>You'll see every job order for the vehicle: the complaint, our findings, photos and videos, each part and labor charge, who did the work and when.</span></li>
            <li><b>Download your statement</b><span>Save a PDF service statement — every visit in full, in the shop's document format — for your records.</span></li>
          </ol>
          <p class="help">Can't find your vehicle? Make sure both fields match the documents. After several failed attempts the search pauses for an hour — call the shop and we'll help.</p>
        </div>
      </section>

      <section v-else id="results" class="results">
        <!-- Statement header: vehicle identity + document meta (also the first block of the PDF). -->
        <div class="statement-head">
          <div class="row" style="gap: 14px">
            <span class="plate xl">{{ result.vehicle.plate }}</span>
            <div>
              <h1>{{ result.vehicle.make }} {{ result.vehicle.model }} <span class="dim">{{ result.vehicle.year }}</span></h1>
              <p class="dim">{{ result.vehicle.color }} · {{ result.vehicle.transmission || '—' }} · VIN {{ result.vehicle.vin }} · ENGINE {{ result.vehicle.engine_no }}</p>
            </div>
          </div>
          <div class="row no-print">
            <button class="btn" @click="printSummary">🖨 PDF · full statement</button>
            <button class="btn ghost" @click="reset">New search</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><b>{{ totals.visits }}</b><span>Visits</span></div>
          <div class="stat"><b>{{ totals.installed }}</b><span>Parts installed</span></div>
          <div class="stat"><b>₱{{ fmtMoney(totals.parts) }}</b><span>Parts</span></div>
          <div class="stat"><b>₱{{ fmtMoney(totals.labor) }}</b><span>Labor</span></div>
          <div class="stat accent"><b>₱{{ fmtMoney(totals.grand) }}</b><span>Total</span></div>
        </div>

        <p v-if="!result.jobOrders.length" class="card dim">No job orders have been filed for this vehicle yet.</p>

        <div v-else class="layout">
          <!-- Visit list (screen only) -->
          <aside class="visits no-print">
            <h3>Visits</h3>
            <button v-for="j in result.jobOrders" :key="j.id" type="button" class="visit" :class="{ active: j.id === selectedId }" @click="selectedId = j.id">
              <span class="row between" style="flex-wrap: nowrap"><span class="mono jo-no">{{ j.jo_number }}</span><span class="badge" :class="statusTone(j.status)">{{ statusLabel(j.status) }}</span></span>
              <span class="dim small">{{ fmtDate(j.created_at, false) }} · {{ j.category }} · {{ j.odometer_km.toLocaleString() }} KM</span>
              <span class="visit-total">₱{{ fmtMoney(partsTotal(j) + laborTotal(j)) }}</span>
            </button>
          </aside>

          <!-- One full statement per job order. On screen only the selected one shows; the PDF prints them all. -->
          <div class="detail">
            <article v-for="j in result.jobOrders" :key="j.id" class="jo" :class="{ hidden: j.id !== selectedId }">
              <header class="jo-top">
                <div>
                  <div class="row" style="gap: 10px">
                    <span class="mono jo-no big">{{ j.jo_number }}</span>
                    <span class="badge" :class="statusTone(j.status)">{{ statusLabel(j.status) }}</span>
                  </div>
                </div>
                <div class="jo-sum"><span class="dim small">Total for this visit</span><b>₱{{ fmtMoney(partsTotal(j) + laborTotal(j)) }}</b></div>
              </header>

              <dl class="facts">
                <div><dt>Received</dt><dd>{{ fmtDate(j.created_at) }}</dd></div>
                <div><dt>Category</dt><dd>{{ j.category }}</dd></div>
                <div><dt>Entry type</dt><dd>{{ j.entry_type.replace('_', ' ') }}</dd></div>
                <div><dt>Odometer</dt><dd>{{ j.odometer_km.toLocaleString() }} KM</dd></div>
                <div><dt>Technician</dt><dd>{{ j.technician ?? '—' }}</dd></div>
                <div><dt>Customer</dt><dd>{{ j.customer_name ?? '—' }}</dd></div>
                <div><dt>Finished</dt><dd>{{ j.finished_at ? fmtDate(j.finished_at) : '—' }}</dd></div>
                <div><dt>Released</dt><dd>{{ j.released_at ? fmtDate(j.released_at) : '—' }}</dd></div>
              </dl>

              <section class="block">
                <h3>Customer complaint</h3>
                <p>{{ j.complaints.join(', ') || '—' }}</p>
              </section>

              <section class="block">
                <h3>Reports & findings · {{ j.reports.length }}</h3>
                <p v-if="!j.reports.length" class="dim">No reports were written for this visit.</p>
                <div v-for="r in j.reports" :key="r.id" class="report">
                  <p class="report-body">{{ r.body }}</p>
                  <p class="dim small">{{ r.author_name ?? '—' }} · {{ fmtDate(r.created_at) }}</p>
                  <div v-if="r.media.length" class="gallery">
                    <button v-for="m in r.media" :key="m.id" type="button" class="thumb" @click="lightbox = m">
                      <img v-if="m.thumbnail_url || (m.kind === 'image' && m.url)" :src="m.thumbnail_url ?? m.url ?? ''" alt="" />
                      <span v-else class="thumb-ph">▶</span>
                      <span v-if="m.kind === 'video'" class="play">▶</span>
                    </button>
                  </div>
                </div>
              </section>

              <section v-if="j.intake_media.length" class="block">
                <h3>Intake photos & videos · {{ j.intake_media.length }}</h3>
                <div class="gallery">
                  <button v-for="m in j.intake_media" :key="m.id" type="button" class="thumb" :title="itemLabel(m.inspection_item_key)" @click="lightbox = m">
                    <img v-if="m.thumbnail_url || (m.kind === 'image' && m.url)" :src="m.thumbnail_url ?? m.url ?? ''" alt="" />
                    <span v-else class="thumb-ph">▶</span>
                    <span v-if="m.kind === 'video'" class="play">▶</span>
                    <span v-if="m.inspection_item_key" class="cap">{{ itemLabel(m.inspection_item_key) }}</span>
                  </button>
                </div>
              </section>

              <section class="block">
                <h3>Parts · ₱{{ fmtMoney(partsTotal(j)) }}</h3>
                <div class="table-wrap">
                  <table class="stmt">
                    <thead><tr><th class="no-print"></th><th>Part</th><th class="num">Qty</th><th>Status</th><th class="num">Unit price</th><th class="num">Amount</th><th>Requested</th><th>Installed</th></tr></thead>
                    <tbody>
                      <tr v-for="p in j.parts" :key="p.id">
                        <td class="no-print" style="width: 48px"><img v-if="p.image_url" :src="p.image_url" alt="" class="part-img" /></td>
                        <td><b>{{ p.part_name }}</b><br /><span class="dim small">{{ p.part_number }}</span></td>
                        <td class="num">{{ p.quantity }}</td>
                        <td><span class="badge" :class="partTone(p.status)">{{ p.status }}</span></td>
                        <td class="num nw">{{ p.unit_price != null ? '₱' + fmtMoney(p.unit_price) : '—' }}</td>
                        <td class="num nw"><b>₱{{ fmtMoney(p.amount) }}</b></td>
                        <td class="small nw">{{ fmtDate(p.requested_at) }}<br /><span class="dim">{{ p.requested_by_name ?? '' }}</span></td>
                        <td class="small nw">{{ p.installed_at ? fmtDate(p.installed_at) : '—' }}</td>
                      </tr>
                      <tr v-if="!j.parts.length"><td colspan="8" class="dim">No parts on this visit</td></tr>
                      <tr v-else class="tfoot"><td class="no-print"></td><td colspan="4" class="num">Parts subtotal</td><td class="num nw"><b>₱{{ fmtMoney(partsTotal(j)) }}</b></td><td colspan="2"></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="block">
                <h3>Labor & services · ₱{{ fmtMoney(laborTotal(j)) }}</h3>
                <div class="table-wrap">
                  <table class="stmt">
                    <thead><tr><th>Service</th><th class="num">Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Total</th><th>Charged by</th><th>Date</th></tr></thead>
                    <tbody>
                      <tr v-for="c in j.charges" :key="c.id">
                        <td><b>{{ c.name }}</b></td>
                        <td class="num">{{ c.quantity }}</td>
                        <td class="nw">{{ c.unit }}</td>
                        <td class="num nw">₱{{ fmtMoney(c.unit_amount) }}</td>
                        <td class="num nw"><b>₱{{ fmtMoney(c.total) }}</b></td>
                        <td>{{ c.added_by_name ?? '—' }}</td>
                        <td class="small nw">{{ fmtDate(c.created_at) }}</td>
                      </tr>
                      <tr v-if="!j.charges.length"><td colspan="7" class="dim">No labor charges on this visit</td></tr>
                      <tr v-else class="tfoot"><td colspan="4" class="num">Labor subtotal</td><td class="num nw"><b>₱{{ fmtMoney(laborTotal(j)) }}</b></td><td colspan="2"></td></tr>
                      <tr class="grand"><td colspan="4" class="num">TOTAL FOR THIS VISIT</td><td class="num nw">₱{{ fmtMoney(partsTotal(j) + laborTotal(j)) }}</td><td colspan="2"></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="block">
                <h3>Timeline</h3>
                <ul class="timeline">
                  <li><span>{{ fmtDate(j.created_at) }}</span> Vehicle received · {{ j.entry_type.replace('_', ' ') }} · by {{ j.technician ?? '—' }}</li>
                  <li v-for="(l, i) in j.status_log" :key="'s' + i"><span>{{ fmtDate(l.changed_at) }}</span> Status → {{ statusLabel(l.new_status) }} · by {{ l.changed_by_name ?? '—' }}</li>
                  <li v-for="(a, i) in j.audit" :key="'a' + i"><span>{{ fmtDate(a.at) }}</span> {{ a.action.replace(/_/g, ' ') }} · {{ a.value }} · by {{ a.by ?? '—' }}</li>
                </ul>
              </section>
            </article>
          </div>
        </div>

      </section>
    </main>

    <footer class="portal-foot no-print">© {{ new Date().getFullYear() }} Bimmermonkeys · Your data is shown only after you enter your plate number and VIN. Media links expire after an hour.</footer>

    <div v-if="lightbox" class="lightbox" @click.self="lightbox = null">
      <div class="lb-inner">
        <video v-if="lightbox.kind === 'video' && lightbox.url" :src="lightbox.url" controls autoplay playsinline />
        <img v-else-if="lightbox.url" :src="lightbox.url" alt="" />
        <p class="lb-cap">{{ itemLabel(lightbox.inspection_item_key) }}{{ lightbox.inspection_item_key ? ' · ' : '' }}{{ fmtDate(lightbox.captured_at) }} · {{ lightbox.captured_by_name ?? '' }}</p>
        <button class="btn sm" @click="lightbox = null">Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portal { min-height: 100vh; display: flex; flex-direction: column; }
.masthead { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 10px; }
.masthead .logo { width: 96px; height: 96px; border-radius: 22px; background: #000; }
.wordmark { font-size: 18px; letter-spacing: 0.22em; }
.portal-main { flex: 1; width: min(1100px, 100%); margin: 0 auto; padding: 28px 20px 60px; }
.portal-foot { text-align: center; font-size: 11px; color: var(--text-dim); padding: 18px; border-top: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.06em; }

.hero h1 { font-size: 30px; text-align: center; margin-top: 22px; }
.lead { text-align: center; color: var(--text-muted); max-width: 640px; margin: 10px auto 26px; font-size: 15px; }
.lookup { max-width: 860px; margin: 0 auto; }
/* Labels, inputs and help text sit on three shared baselines regardless of how long each help text runs. */
.lookup-grid { display: grid; grid-template-columns: 1.2fr 1fr auto; gap: 14px; align-items: start; }
.lookup .field label { min-height: 14px; line-height: 14px; }
.lookup .input { font-size: 20px; padding: 14px 16px; height: 54px; }
.lookup .help { min-height: 30px; line-height: 1.4; }
.lookup-btn { height: 54px; padding: 0 22px; margin-top: 20px; }
.guide { max-width: 860px; margin: 30px auto 0; }
.guide h2 { font-size: 14px; color: var(--text-muted); letter-spacing: 0.1em; margin-bottom: 12px; }
.steps { list-style: none; counter-reset: step; padding: 0; margin: 0 0 12px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.steps li { counter-increment: step; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px 16px 16px 56px; position: relative; }
.steps li::before { content: counter(step); position: absolute; left: 16px; top: 16px; width: 28px; height: 28px; border-radius: 999px; background: var(--m-light-blue); color: #fff; font-weight: 700; display: grid; place-items: center; }
.steps b { display: block; margin-bottom: 4px; }
.steps span { color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.steps code { background: var(--surface-raised); padding: 1px 6px; border-radius: 6px; font-family: inherit; letter-spacing: 0.08em; }

.statement-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.statement-head h1 { font-size: 22px; }
.plate.xl { font-size: 22px; padding: 6px 14px; }
.stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 18px; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px 16px; }
.stat b { display: block; font-size: 20px; }
.stat span { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.stat.accent { border-color: var(--m-light-blue); }
.stat.accent b { color: var(--m-light-blue); }

.layout { display: grid; grid-template-columns: 260px 1fr; gap: 16px; align-items: start; }
.visits { display: flex; flex-direction: column; gap: 8px; position: sticky; top: 16px; }
.visits h3 { margin-bottom: 2px; }
.visit { display: flex; flex-direction: column; gap: 4px; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; cursor: pointer; color: var(--text); font: inherit; }
.visit:hover { border-color: var(--border-strong); }
.visit.active { border-color: var(--m-light-blue); background: var(--info-soft); }
.visit-total { font-weight: 700; }
.jo-no { font-weight: 700; letter-spacing: 0.08em; color: var(--m-light-blue); }
.jo-no.big { font-size: 18px; }
.jo { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 22px; }
.jo.hidden { display: none; }
.jo-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.jo-sum { text-align: right; display: flex; flex-direction: column; }
.jo-sum b { font-size: 20px; }
.facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 16px; margin: 14px 0 4px; }
.facts div { background: var(--surface-alt); border-radius: var(--radius-sm); padding: 8px 10px; }
.facts dt { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.facts dd { margin: 2px 0 0; font-weight: 700; font-size: 13px; }
.block { margin-top: 18px; }
.block h3 { margin-bottom: 8px; }
table.stmt th { white-space: nowrap; }
table.stmt .nw { white-space: nowrap; }
table.stmt tr.tfoot td { font-weight: 700; border-top: 1px solid var(--border-strong); }
table.stmt tr.grand td { font-weight: 700; font-size: 14px; color: var(--m-light-blue); }
.timeline { list-style: none; padding: 0; margin: 0; font-size: 13px; }
.timeline li { padding: 4px 0; border-bottom: 1px dashed var(--border); }
.timeline span { display: inline-block; min-width: 190px; color: var(--text-dim); font-size: 12px; }
.repairs { margin: 0; padding-left: 20px; }
.report { border-left: 3px solid var(--m-light-blue); padding: 6px 0 6px 14px; margin-bottom: 12px; }
.report-body { margin: 0 0 4px; white-space: pre-wrap; }
.small { font-size: 12px; }
.dim { color: var(--text-muted); }
.gallery { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.thumb { position: relative; width: 120px; height: 90px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); background: #000; padding: 0; cursor: pointer; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-ph { color: #fff; font-size: 26px; display: grid; place-items: center; height: 100%; }
.play { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 24px; text-shadow: 0 0 8px #000; }
.cap { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.65); color: #fff; font-size: 9px; padding: 2px 4px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.part-img { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; background: #000; }
.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px; }
.lb-inner { max-width: 92vw; max-height: 92vh; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.lb-inner img, .lb-inner video { max-width: 92vw; max-height: 78vh; border-radius: var(--radius-md); }
.lb-cap { color: #ddd; font-size: 12px; margin: 0; }

@media (max-width: 860px) {
  .layout { grid-template-columns: 1fr; }
  .visits { position: static; }
  .facts { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 760px) {
  .lookup-grid, .steps, .stats { grid-template-columns: 1fr; }
  .lookup-btn { margin-top: 0; width: 100%; }
  .lookup .help { min-height: 0; }
  .hero h1 { font-size: 24px; }
}
@media print {
  .no-print { display: none !important; }
}
</style>
