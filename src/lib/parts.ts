import { supabase } from '@/lib/supabase';

export const PART_REQUEST_STATUSES = ['REQUESTED', 'ORDERED', 'RECEIVED', 'INSTALLED', 'CANCELLED'] as const;
export type PartRequestStatus = (typeof PART_REQUEST_STATUSES)[number];

export const partRequestTone = (s: string) =>
  s === 'REQUESTED' ? 'warn' : s === 'ORDERED' ? 'info' : s === 'CANCELLED' ? 'danger' : 'ok';

/** Part photos live in the public `parts` bucket. */
export const partImageUrl = (path: string | null | undefined) =>
  path ? supabase.storage.from('parts').getPublicUrl(path).data.publicUrl : null;

export type PartRequestRow = {
  id: string;
  job_order_id: string;
  report_id: string | null;
  part_id: string | null;
  part_number: string;
  part_name: string;
  quantity: number;
  status: PartRequestStatus;
  notes: string;
  requested_by_name: string | null;
  created_at: string;
  image_path: string | null;
};
