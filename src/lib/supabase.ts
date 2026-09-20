import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
/** True when the build was made without VITE_SUPABASE_URL / VITE_SUPABASE_KEY (e.g. host env vars not set). */
export const isConfigured = !!url && !!key;
// A placeholder client keeps the app mountable so the misconfiguration can be shown instead of a blank page.
export const supabase = createClient(url || 'https://not-configured.supabase.co', key || 'not-configured');

/** Short-lived URL for a private media object; cached per path for the session. */
const urlCache = new Map<string, { url: string; exp: number }>();
export async function signedUrl(path: string | null | undefined, ttl = 3600): Promise<string | null> {
  if (!path) return null;
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from('media').createSignedUrl(path, ttl);
  if (error || !data) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + (ttl - 60) * 1000 });
  return data.signedUrl;
}

/** Call the admin-users edge function with the current session. */
export async function adminUsers<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    // Surface the function's own JSON error when there is one.
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const j = await ctx.json();
        if (j?.error) throw new Error(j.error);
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
