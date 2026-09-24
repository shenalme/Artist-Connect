import { sb, must } from '../supabase.js';
import { state, uid } from '../state.js';
import { html, mount, $, options, fmtDate, today, emptyState, notFound, busy, toast, errMsg, safeUrl, isUuid } from '../ui.js';
import { DISTRICTS, PROJECT_TYPES, AUDITION_TYPES, EXPERIENCE, label } from '../constants.js';
import { statusPill, ageRange, openReport, verifiedMark } from '../shared.js';

export const CALL_FIELDS = 'id,title,location,deadline,audition_type,compensation,created_at,status,project_id,projects(id,title,type),characters(name,role_type)';

export function callList(rows, { empty } = {}) {
  if (!rows?.length) return empty ?? emptyState('No casting calls match', 'Try removing a filter.');
  return html`<ul class="calls">${rows.map(c => html`<li><a class="call" href="#/casting/${c.id}">
    <span class="call-type">${c.projects?.type || 'Project'}</span>
    <strong class="call-title">${c.title}</strong>
    <span class="call-project">${c.projects?.title || ''}${c.characters?.name ? `, role of ${c.characters.name}` : ''}</span>
    <span class="call-meta">${[c.location, c.audition_type, c.deadline ? `Apply by ${fmtDate(c.deadline)}` : 'Open until filled'].filter(Boolean).join('. ')}</span>
  </a></li>`)}</ul>`;
}

export async function list(root, _p, q) {
  mount(root, html`
    <div class="page-head"><div><h1>Casting calls</h1><p>Open roles from verified recruiters across Sri Lanka.</p></div></div>
    <div class="with-filters">
      <details class="filters" open>
        <summary>Filter calls</summary>
        <form class="form" id="call-filters">
          <div class="field"><label for="f-q">Keyword</label><input id="f-q" name="q" type="search" value="${q.q || ''}" placeholder="e.g. lead, dancer, commercial"></div>
          <div class="field"><label for="f-type">Project type</label><select id="f-type" name="type">${options(PROJECT_TYPES, q.type, 'Any type')}</select></div>
          <div class="field"><label for="f-loc">Location</label><select id="f-loc" name="location">${options(DISTRICTS, q.location, 'Anywhere')}</select></div>
          <div class="field"><label for="f-aud">Audition</label><select id="f-aud" name="audition">${options(AUDITION_TYPES, q.audition, 'Any audition type')}</select></div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Show calls</button><a class="btn btn-ghost" href="#/castings">Clear</a></div>
        </form>
      </details>
      <div><div class="calls-panel" id="call-results"><p class="loading">Loading…</p></div></div>
    </div>`);

  $('#call-filters', root).addEventListener('submit', e => {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(e.target)) if (String(v).trim()) params.set(k, String(v).trim());
    location.hash = `#/castings${params.toString() ? `?${params}` : ''}`;
  });

  const fields = q.type ? CALL_FIELDS.replace('projects(', 'projects!inner(') : CALL_FIELDS;
  let query = sb.from('casting_calls').select(fields).eq('status', 'open')
    .or(`deadline.is.null,deadline.gte.${today()}`).order('created_at', { ascending: false }).limit(60);
  if (q.q) query = query.ilike('title', `%${q.q.replace(/[%_\\]/g, '')}%`);
  if (q.location) query = query.eq('location', q.location);
  if (q.audition) query = query.eq('audition_type', q.audition);
  if (q.type) query = query.eq('projects.type', q.type);
  const { data, error } = await query;
  mount($('#call-results', root), error ? html`<p class="muted">${errMsg(error)}</p>` : callList(data));
}

export async function view(root, { id }) {
  if (!isUuid(id)) { mount(root, notFound('casting call')); return; }
  const { data: c } = await sb.from('casting_calls').select('*, projects(*), characters(*)').eq('id', id).maybeSingle();
  if (!c) { mount(root, notFound('casting call')); return; }
  const p = c.projects;
  const ch = c.characters;
  const me = uid();
  const owner = me && p?.owner_id === me;
  const closed = c.status !== 'open' || (c.deadline && c.deadline < today());
  const { data: org } = await sb.from('recruiter_profiles').select('organisation,verified').eq('user_id', p.owner_id).maybeSingle();

  mount(root, html`
    <p><a href="#/castings">All casting calls</a></p>
    <div class="profile profile-call">
      <div>
        <p class="call-type">${p.type}${p.genre ? `, ${p.genre}` : ''}</p>
        <h1 class="profile-name">${c.title}</h1>
        <p class="profile-headline"><a href="#/project/${p.id}">${p.title}</a>${org?.organisation ? `, posted by ${org.organisation}` : ''} ${verifiedMark(org?.verified)}</p>
        <dl class="facts">
          <div><dt>Location</dt><dd>${c.location || p.location || 'Not specified'}</dd></div>
          <div><dt>Shoot dates</dt><dd>${c.shoot_dates || 'To be confirmed'}</dd></div>
          <div><dt>Audition</dt><dd>${c.audition_type}</dd></div>
          <div><dt>Apply by</dt><dd>${c.deadline ? fmtDate(c.deadline) : 'Open until filled'}</dd></div>
          <div><dt>Experience</dt><dd>${c.experience_required === 'any' ? 'Any level' : label(EXPERIENCE, c.experience_required)}</dd></div>
          <div><dt>Compensation</dt><dd>${c.compensation || 'Not stated'}</dd></div>
        </dl>
        ${ch ? html`<section class="section"><h2>The role: ${ch.name}</h2>
          <p class="meta">${[ch.role_type, ch.gender !== 'Any' ? ch.gender : '', ageRange(ch.age_min, ch.age_max) ? `age ${ageRange(ch.age_min, ch.age_max)}` : ''].filter(Boolean).join(', ')}</p>
          ${ch.description ? html`<p style="white-space:pre-wrap">${ch.description}</p>` : ''}
          ${ch.languages?.length ? html`<p><b>Languages:</b> ${ch.languages.join(', ')}</p>` : ''}
          ${ch.skills?.length ? html`<p><b>Skills:</b> ${ch.skills.join(', ')}</p>` : ''}
        </section>` : ''}
        ${c.requirements ? html`<section class="section"><h2>Requirements</h2><p style="white-space:pre-wrap">${c.requirements}</p></section>` : ''}
        ${c.instructions ? html`<section class="section"><h2>How to apply</h2><p style="white-space:pre-wrap">${c.instructions}</p></section>` : ''}
        <section class="section"><h2>About the project</h2><p style="white-space:pre-wrap">${p.description || 'No description yet.'}</p></section>
        ${me && !owner ? html`<p class="section small"><button class="linklike" id="report-call">Report this casting call</button></p>` : ''}
      </div>
      <aside class="profile-side"><div class="panel" id="apply-box"><p class="loading">Loading…</p></div>
        <p class="hint" style="margin-top:12px">Xposure never asks artists to pay to audition. Report any call that asks for money.</p></aside>
    </div>`);

  $('#report-call', root)?.addEventListener('click', () => openReport('casting_call', id, 'this casting call'));

  const box = $('#apply-box', root);
  if (owner) {
    mount(box, html`<h2>Your casting call</h2><p>${statusPill(c.status)}</p><a class="btn btn-primary" href="#/project/${p.id}">Manage applications</a>`);
    return;
  }
  if (!me) {
    mount(box, html`<h2>Interested?</h2><p>Log in with an artist account to apply.</p>
      <a class="btn btn-primary" href="#/login?next=${encodeURIComponent(`/casting/${id}`)}">Log in to apply</a>
      <p class="small" style="margin-top:12px">New here? <a href="#/signup?role=artist">Create a free artist profile</a></p>`);
    return;
  }
  if (state.profile?.role !== 'artist') { mount(box, html`<h2>Applications</h2><p class="muted">Only artist accounts can apply to casting calls.</p>`); return; }

  const { data: existing } = await sb.from('applications').select('status,created_at').eq('casting_call_id', id).eq('artist_id', me).maybeSingle();
  if (existing) {
    mount(box, html`<h2>You've applied</h2><p>Sent ${fmtDate(existing.created_at)}.</p><p>${statusPill(existing.status)}</p><a href="#/applications">View my applications</a>`);
    return;
  }
  if (closed) { mount(box, html`<h2>Applications closed</h2><p class="muted">This call is no longer accepting applications.</p>`); return; }
  const { data: ap } = await sb.from('artist_profiles').select('status').eq('user_id', me).maybeSingle();
  if (ap?.status !== 'approved') {
    mount(box, html`<h2>Almost ready</h2><p>You can apply once your profile has been reviewed and approved. Complete your photos, skills and languages to speed this up.</p>
      <a class="btn btn-primary" href="#/me">Complete my profile</a>`);
    return;
  }
  mount(box, html`<h2>Apply for this role</h2>
    <form class="form" id="apply-form">
      <p class="hint">The recruiter sees your full Xposure profile with your application.</p>
      <div class="field"><label for="a-msg">Message to the recruiter</label>
        <textarea id="a-msg" name="message" maxlength="2000" placeholder="Why you're right for this role, relevant experience, availability"></textarea></div>
      <div class="field"><label for="a-tape">Self-tape link</label>
        <input id="a-tape" name="selftape_url" type="url" placeholder="YouTube, Vimeo or Google Drive link">
        <p class="hint">Optional unless the call asks for one. Unlisted links work.</p></div>
      <button class="btn btn-primary" type="submit">Send application</button>
    </form>`);
  $('#apply-form', root).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const tapeRaw = String(fd.get('selftape_url') || '').trim();
    const tape = safeUrl(tapeRaw);
    if (tapeRaw && !tape) { toast('The self-tape link isn\'t a valid web address.', 'error'); return; }
    try {
      await busy(e.submitter, async () => must(await sb.from('applications').insert({
        casting_call_id: id, artist_id: me, message: String(fd.get('message') || '').trim(), selftape_url: tape })));
      toast('Application sent.', 'success');
      view(root, { id });
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}
