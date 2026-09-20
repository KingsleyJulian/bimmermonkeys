import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Customer self-service lookup. Anonymous callers prove they own the vehicle with the full plate
// number plus the first four characters of the VIN; on a match they get the vehicle's complete
// service history (job orders, reports with media, parts and labor, audit trail) — read only.
// Nothing here prints or numbers documents. Every attempt is logged and throttled.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_PER_CLIENT_10MIN = 20;
const MAX_FAILED_PER_PLATE_HOUR = 10;
const SIGNED_URL_TTL = 60 * 60;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const mask = (s: string | null, keep = 4) => (!s ? "" : s.length <= keep * 2 ? s : `${s.slice(0, keep)}${"•".repeat(Math.max(3, s.length - keep * 2))}${s.slice(-keep)}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { plate?: string; vin?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const plate = String(body.plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const vin4 = String(body.vin ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (plate.length < 2 || plate.length > 15) return json({ error: "Enter your full plate number" }, 400);
  if (vin4.length !== 4) return json({ error: "Enter the first 4 characters of your VIN / chassis number" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const clientHash = await sha256(`${ip}|${req.headers.get("user-agent") ?? ""}`);

  // Throttle: per client and per plate (failed attempts), so the portal cannot be used to guess VINs.
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: perClient }, { count: failedPlate }] = await Promise.all([
    admin.from("portal_lookups").select("id", { count: "exact", head: true }).eq("client_hash", clientHash).gte("looked_up_at", tenMinAgo),
    admin.from("portal_lookups").select("id", { count: "exact", head: true }).eq("plate", plate).eq("found", false).gte("looked_up_at", hourAgo),
  ]);
  if ((perClient ?? 0) >= MAX_PER_CLIENT_10MIN || (failedPlate ?? 0) >= MAX_FAILED_PER_PLATE_HOUR) {
    return json({ error: "Too many attempts. Please try again later or call the shop." }, 429);
  }

  const { data: vehicle } = await admin
    .from("vehicles")
    .select("id, plate, vin, engine_no, make, model, year, color, transmission")
    .eq("plate", plate)
    .ilike("vin", `${vin4}%`)
    .maybeSingle();

  await admin.from("portal_lookups").insert({ plate, vin_prefix: vin4, client_hash: clientHash, found: !!vehicle, vehicle_id: vehicle?.id ?? null });
  if (!vehicle) return json({ error: "No vehicle matches that plate number and VIN. Check both and try again." }, 404);

  const { data: jos } = await admin
    .from("job_orders")
    .select("id, jo_number, local_ref, status, category, entry_type, odometer_km, created_by_name, created_at, customers(full_name)")
    .eq("vehicle_id", vehicle.id)
    .order("created_at", { ascending: false });
  const ids = (jos ?? []).map((j) => j.id);
  if (!ids.length) return json({ vehicle: { ...vehicle, vin: mask(vehicle.vin), engine_no: mask(vehicle.engine_no) }, jobOrders: [] });

  const [complaints, reports, media, parts, charges, statusLog, repairs, audit, shopRows] = await Promise.all([
    admin.from("complaints").select("job_order_id, keyword, position").in("job_order_id", ids).order("position"),
    admin.from("reports").select("id, job_order_id, body, author_name, created_at").in("job_order_id", ids).order("created_at"),
    admin.from("media_attachments").select("id, job_order_id, report_id, inspection_item_key, kind, storage_path, thumbnail_path, mime_type, captured_at, captured_by_name, sort_order").in("job_order_id", ids).order("sort_order"),
    admin.from("part_requests").select("id, job_order_id, part_number, part_name, quantity, status, requested_by_name, created_at, stock_deducted_at, image_path, parts(srp)").in("job_order_id", ids).order("created_at"),
    admin.from("job_order_charges").select("id, job_order_id, name, unit, quantity, unit_amount, total, added_by_name, created_at").in("job_order_id", ids).order("created_at"),
    admin.from("job_order_status_log").select("job_order_id, old_status, new_status, changed_by_name, changed_at").in("job_order_id", ids).order("changed_at"),
    admin.from("job_order_repairs").select("job_order_id, line_no, description, created_by_name, created_at").in("job_order_id", ids).order("line_no"),
    admin.from("job_order_audit").select("job_order_id, action, new_value, changed_by_name, changed_at").in("job_order_id", ids).order("changed_at"),
    admin.from("shop_settings").select("key, value").in("key", ["shop_name", "shop_address", "shop_phone", "shop_email"]),
  ]);
  const shop = Object.fromEntries((shopRows.data ?? []).map((r) => [r.key, r.value]));

  // Signed URLs for the private media bucket (thumbnails too), one batch call.
  const paths = Array.from(new Set((media.data ?? []).flatMap((m) => [m.storage_path, m.thumbnail_path]).filter((p): p is string => !!p)));
  const urlByPath = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await admin.storage.from("media").createSignedUrls(paths.slice(i, i + 100), SIGNED_URL_TTL);
    for (const s of data ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }
  const partImage = (p: string | null) => (p ? admin.storage.from("parts").getPublicUrl(p).data.publicUrl : null);

  const by = <T extends { job_order_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.job_order_id, [...(m.get(r.job_order_id) ?? []), r]);
    return m;
  };
  const C = by(complaints.data), R = by(reports.data), M = by(media.data), P = by(parts.data), H = by(charges.data), S = by(statusLog.data), X = by(repairs.data), A = by(audit.data);

  const jobOrders = (jos ?? []).map((j) => {
    const ms = (M.get(j.id) ?? []).map((m) => ({
      id: m.id,
      report_id: m.report_id,
      inspection_item_key: m.inspection_item_key,
      kind: m.kind,
      mime_type: m.mime_type,
      captured_at: m.captured_at,
      captured_by_name: m.captured_by_name,
      url: urlByPath.get(m.storage_path) ?? null,
      thumbnail_url: m.thumbnail_path ? urlByPath.get(m.thumbnail_path) ?? null : null,
    }));
    const log = S.get(j.id) ?? [];
    const finished = [...log].reverse().find((l) => l.new_status === "COMPLETED" || l.new_status === "RELEASED");
    const released = [...log].reverse().find((l) => l.new_status === "RELEASED");
    return {
      id: j.id,
      jo_number: j.jo_number,
      status: j.status,
      category: j.category,
      entry_type: j.entry_type,
      odometer_km: j.odometer_km,
      technician: j.created_by_name,
      customer_name: (j as unknown as { customers: { full_name: string } | null }).customers?.full_name ?? null,
      created_at: j.created_at,
      finished_at: finished?.changed_at ?? null,
      released_at: released?.changed_at ?? null,
      complaints: (C.get(j.id) ?? []).map((c) => c.keyword),
      reports: (R.get(j.id) ?? []).map((r) => ({ id: r.id, body: r.body, author_name: r.author_name, created_at: r.created_at, media: ms.filter((m) => m.report_id === r.id) })),
      intake_media: ms.filter((m) => !m.report_id),
      parts: (P.get(j.id) ?? []).map((p) => ({
        id: p.id,
        part_number: p.part_number,
        part_name: p.part_name,
        quantity: p.quantity,
        status: p.status,
        unit_price: (p as unknown as { parts: { srp: number | null } | null }).parts?.srp ?? null,
        amount: p.quantity * Number((p as unknown as { parts: { srp: number | null } | null }).parts?.srp ?? 0),
        requested_by_name: p.requested_by_name,
        requested_at: p.created_at,
        installed_at: p.stock_deducted_at,
        image_url: partImage(p.image_path),
      })),
      charges: (H.get(j.id) ?? []).map((c) => ({ id: c.id, name: c.name, unit: c.unit, quantity: c.quantity, unit_amount: c.unit_amount, total: c.total, added_by_name: c.added_by_name, created_at: c.created_at })),
      repairs: (X.get(j.id) ?? []).map((r) => r.description),
      status_log: log,
      audit: (A.get(j.id) ?? []).map((a) => ({ action: a.action, value: a.new_value, by: a.changed_by_name, at: a.changed_at })),
    };
  });

  return json({
    vehicle: { ...vehicle, vin: mask(vehicle.vin), engine_no: mask(vehicle.engine_no) },
    jobOrders,
    shop,
    generated_at: new Date().toISOString(),
    media_expires_in: SIGNED_URL_TTL,
  });
});
