import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configured = /^https:\/\/.+/.test(SUPABASE_URL)
  && !SUPABASE_URL.includes('YOUR-PROJECT-REF')
  && SUPABASE_ANON_KEY.length > 30;

export const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } })
  : null;

export const BUCKET = 'media';

export function publicUrl(path) {
  if (!path || !sb) return '';
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Throw Supabase errors so callers can use try/catch.
export function must(res) {
  if (res.error) throw res.error;
  return res.data;
}
