import { sb } from './supabase.js';

export const state = { session: null, profile: null };

export const uid = () => state.session?.user?.id ?? null;

export async function loadProfile() {
  if (!state.session) { state.profile = null; return; }
  const { data } = await sb.from('profiles').select('*').eq('id', state.session.user.id).maybeSingle();
  state.profile = data;
}
