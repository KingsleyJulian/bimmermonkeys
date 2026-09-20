/** Shape of the customer-portal edge function response, shared by the portal page and the statement print. */
export type PortalMedia = { id: string; report_id: string | null; inspection_item_key: string | null; kind: 'image' | 'video'; mime_type: string | null; captured_at: string; captured_by_name: string | null; url: string | null; thumbnail_url: string | null };
export type PortalPart = { id: string; part_number: string; part_name: string; quantity: number; status: string; unit_price: number | null; amount: number; requested_by_name: string | null; requested_at: string; installed_at: string | null; image_url: string | null };
export type PortalCharge = { id: string; name: string; unit: string; quantity: number; unit_amount: number; total: number; added_by_name: string | null; created_at: string };
export type PortalReport = { id: string; body: string; author_name: string | null; created_at: string; media: PortalMedia[] };
export type PortalLog = { old_status: string | null; new_status: string; changed_by_name: string | null; changed_at: string };
export type PortalJo = {
  id: string; jo_number: string; status: string; category: string; entry_type: string; odometer_km: number; technician: string | null; customer_name: string | null;
  created_at: string; finished_at: string | null; released_at: string | null; complaints: string[]; reports: PortalReport[]; intake_media: PortalMedia[]; parts: PortalPart[]; charges: PortalCharge[];
  repairs: string[]; status_log: PortalLog[]; audit: { action: string; value: string | null; by: string | null; at: string }[];
};
export type PortalVehicle = { plate: string; vin: string; engine_no: string; make: string; model: string; year: number | null; color: string; transmission: string | null };
export type PortalResult = { vehicle: PortalVehicle; jobOrders: PortalJo[]; shop?: Record<string, string>; generated_at: string };

/** sessionStorage key the portal uses to hand a lookup result to the /statement print page. */
export const PORTAL_STATEMENT_KEY = 'bm-portal-statement';
