import { sb, publicUrl, must } from './supabase.js';
import { state } from './state.js';
import { html, raw, initials, modal, options, toast, errMsg, busy } from './ui.js';
import { APP_STATUS, AVAILABILITY, REPORT_REASONS, label } from './constants.js';

export const ARTIST_CARD_FIELDS =
  'user_id,stage_name,headline,artist_types,location,playing_age_min,playing_age_max,avatar_path,availability,experience_level';

export function ageRange(min, max) {
  if (min && max) return min === max ? `${min}` : `${min}–${max}`;
  if (min) return `${min}+`;
  if (max) return `up to ${max}`;
  return '';
}

export function artistCard(a) {
  const img = publicUrl(a.avatar_path);
  const age = ageRange(a.playing_age_min, a.playing_age_max);
  return html`<a class="headshot" href="#/artist/${a.user_id}">
    <div class="headshot-img">
      ${img ? html`<img src="${img}" alt="" loading="lazy">` : html`<span class="initials" aria-hidden="true">${initials(a.stage_name)}</span>`}
      <span class="avail avail-${a.availability}">${label(AVAILABILITY, a.availability)}</span>
    </div>
    <div class="headshot-meta">
      <strong>${a.stage_name || 'Unnamed artist'}</strong>
      <span>${(a.artist_types || []).slice(0, 3).join(', ') || 'Artist'}</span>
      <span>${[a.location, age ? `plays ${age}` : ''].filter(Boolean).join(', ')}</span>
    </div>
  </a>`;
}

export function statusPill(status) {
  const cls = { confirmed: 'pill-ok', selected: 'pill-ok', shortlisted: 'pill-brand', audition: 'pill-spot',
    callback: 'pill-spot', rejected: 'pill-bad', withdrawn: '', open: 'pill-ok', closed: '', draft: 'pill-spot',
    approved: 'pill-ok', pending: 'pill-spot' }[status] ?? 'pill-brand';
  const text = label(APP_STATUS, status) || status;
  return html`<span class="pill ${cls}">${text.charAt(0).toUpperCase() + text.slice(1)}</span>`;
}

// Friendly names for a set of member ids (stage name or organisation).
export async function displayNames(ids) {
  const list = [...new Set(ids)].filter(Boolean);
  const map = {};
  if (!list.length) return map;
  const [p, a, r] = await Promise.all([
    sb.from('profiles').select('id,full_name,role').in('id', list),
    sb.from('artist_profiles').select('user_id,stage_name,avatar_path').in('user_id', list),
    sb.from('recruiter_profiles').select('user_id,organisation,verified').in('user_id', list),
  ]);
  for (const x of p.data || []) {
    map[x.id] = { name: x.full_name || 'Member', role: x.role, sub: x.role === 'recruiter' ? 'Recruiter' : 'Artist', avatar: '' };
  }
  for (const x of a.data || []) {
    if (!map[x.user_id]) continue;
    if (x.stage_name) map[x.user_id].name = x.stage_name;
    map[x.user_id].avatar = publicUrl(x.avatar_path);
  }
  for (const x of r.data || []) {
    if (!map[x.user_id]) continue;
    map[x.user_id].sub = x.organisation ? `${x.organisation}${x.verified ? ', verified recruiter' : ''}` : (x.verified ? 'Verified recruiter' : 'Recruiter');
    map[x.user_id].verified = x.verified;
  }
  return map;
}

export function openReport(targetType, targetId, what = 'this') {
  if (!state.session) { location.hash = '#/login'; return; }
  const m = modal(html`
    <h2>Report ${what}</h2>
    <p class="muted">Reports go to the Xposure team, not to the person you're reporting.</p>
    <form class="form" id="report-form">
      <div class="field"><label for="r-reason">What's wrong?</label>
        <select id="r-reason" name="reason" required>${options(REPORT_REASONS, '', 'Choose a reason')}</select></div>
      <div class="field"><label for="r-details">Details</label>
        <textarea id="r-details" name="details" maxlength="2000" placeholder="What happened? Include anything that helps us check."></textarea></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Send report</button>
        <button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
    </form>`, { label: 'Report' });
  m.el.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await busy(e.submitter, async () => must(await sb.from('reports').insert({
        reporter_id: state.session.user.id, target_type: targetType, target_id: targetId,
        reason: fd.get('reason'), details: String(fd.get('details') || '').trim(),
      })));
      m.close();
      toast('Report sent. Thank you.', 'success');
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

export const verifiedMark = v => (v ? html`<span class="pill pill-ok">Verified</span>` : raw(''));
