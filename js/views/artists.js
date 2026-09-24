import { sb, publicUrl } from '../supabase.js';
import { state, uid } from '../state.js';
import { html, mount, $, $$, options, emptyState, notFound, modal, safeUrl, isUuid, initials, errMsg } from '../ui.js';
import { ARTIST_TYPES, LANGUAGES, DISTRICTS, GENDERS, EXPERIENCE, AVAILABILITY, SOCIALS, label } from '../constants.js';
import { artistCard, ARTIST_CARD_FIELDS, ageRange, openReport } from '../shared.js';

const PAGE = 24;

export async function search(root, _p, q) {
  const page = Math.max(0, parseInt(q.page || '0', 10) || 0);
  mount(root, html`
    <div class="page-head"><div><h1>Find artists</h1><p>Reviewed profiles of performers across Sri Lanka.</p></div></div>
    <div class="with-filters">
      <details class="filters" open>
        <summary>Filter artists</summary>
        <form class="form" id="artist-filters">
          <div class="field"><label for="f-q">Name or keyword</label><input id="f-q" name="q" type="search" value="${q.q || ''}"></div>
          <div class="field"><label for="f-type">Artist type</label><select id="f-type" name="type">${options(ARTIST_TYPES, q.type, 'Any type')}</select></div>
          <div class="field"><label for="f-gender">Gender</label><select id="f-gender" name="gender">${options(GENDERS.slice(0, 3), q.gender, 'Any gender')}</select></div>
          <div class="field"><span class="label">Playing age</span>
            <div class="grid-2" style="gap:8px;grid-template-columns:1fr 1fr">
              <input aria-label="Playing age from" name="age_from" type="number" min="10" max="100" value="${q.age_from || ''}" placeholder="From">
              <input aria-label="Playing age to" name="age_to" type="number" min="10" max="100" value="${q.age_to || ''}" placeholder="To">
            </div></div>
          <div class="field"><label for="f-loc">District</label><select id="f-loc" name="location">${options(DISTRICTS, q.location, 'Anywhere')}</select></div>
          <div class="field"><label for="f-lang">Language</label><select id="f-lang" name="lang">${options(LANGUAGES, q.lang, 'Any language')}</select></div>
          <div class="field"><label for="f-skill">Skill</label><input id="f-skill" name="skill" type="text" value="${q.skill || ''}" placeholder="e.g. kandyan dance"></div>
          <div class="field"><label for="f-exp">Experience</label><select id="f-exp" name="exp">${options(EXPERIENCE, q.exp, 'Any level')}</select></div>
          <label class="toggle"><input type="checkbox" name="available" value="1"${q.available ? ' checked' : ''}><span>Available now only</span></label>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Show artists</button><a class="btn btn-ghost" href="#/artists">Clear</a></div>
        </form>
      </details>
      <div id="artist-results"><p class="loading">Loading…</p></div>
    </div>`);

  $('#artist-filters', root).addEventListener('submit', e => {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(e.target)) if (String(v).trim()) params.set(k, String(v).trim());
    location.hash = `#/artists${params.toString() ? `?${params}` : ''}`;
  });

  let query = sb.from('artist_profiles').select(ARTIST_CARD_FIELDS, { count: 'exact' })
    .eq('status', 'approved').eq('is_public', true);
  if (q.type) query = query.contains('artist_types', [q.type]);
  if (q.lang) query = query.contains('languages', [q.lang]);
  if (q.skill) query = query.contains('skills', [q.skill.trim().toLowerCase()]);
  if (q.gender) query = query.eq('gender', q.gender);
  if (q.location) query = query.eq('location', q.location);
  if (q.exp) query = query.eq('experience_level', q.exp);
  if (q.available) query = query.eq('availability', 'available');
  if (q.age_from) query = query.gte('playing_age_max', Number(q.age_from));
  if (q.age_to) query = query.lte('playing_age_min', Number(q.age_to));
  if (q.q) {
    const kw = q.q.replace(/[%_,()\\*.:"]/g, ' ').trim();
    if (kw) query = query.or(`stage_name.ilike.%${kw}%,headline.ilike.%${kw}%,bio.ilike.%${kw}%`);
  }
  const { data, count, error } = await query.order('updated_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);

  const out = $('#artist-results', root);
  if (error) { mount(out, html`<p class="muted">${errMsg(error)}</p>`); return; }
  if (!data.length) {
    mount(out, emptyState('No artists match these filters', 'Widen the playing age range or remove a filter to see more people.'));
    return;
  }
  const pageLink = n => { const p = new URLSearchParams(q); p.set('page', String(n)); return `#/artists?${p}`; };
  const pages = Math.ceil((count || 0) / PAGE);
  mount(out, html`
    <div class="result-bar"><span>${count} ${count === 1 ? 'artist' : 'artists'}</span>${pages > 1 ? html`<span>Page ${page + 1} of ${pages}</span>` : ''}</div>
    <div class="headshots">${data.map(artistCard)}</div>
    ${pages > 1 ? html`<nav class="pager" aria-label="Pages">
      ${page > 0 ? html`<a class="btn" href="${pageLink(page - 1)}">Previous page</a>` : ''}
      ${page + 1 < pages ? html`<a class="btn" href="${pageLink(page + 1)}">Next page</a>` : ''}</nav>` : ''}`);
}

function embedFor(url) {
  const u = safeUrl(url);
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export async function view(root, { id }) {
  if (!isUuid(id)) { mount(root, notFound('artist')); return; }
  const [{ data: a }, { data: photos }] = await Promise.all([
    sb.from('artist_profiles').select('*').eq('user_id', id).maybeSingle(),
    sb.from('artist_photos').select('id,path,caption').eq('user_id', id).order('created_at'),
  ]);
  if (!a) { mount(root, notFound('artist')); return; }

  const own = uid() === id;
  const isRecruiter = state.profile?.role === 'recruiter';
  const img = publicUrl(a.avatar_path);
  const age = ageRange(a.playing_age_min, a.playing_age_max);
  const embed = embedFor(a.showreel_url);
  const reel = safeUrl(a.showreel_url);
  const socials = SOCIALS.map(s => ({ ...s, url: safeUrl(a.social_links?.[s.key]) })).filter(s => s.url);
  const credits = Array.isArray(a.credits) ? a.credits : [];

  mount(root, html`
    ${own && a.status === 'pending' ? html`<div class="notice notice-warn"><p><b>Your profile is waiting for review.</b> Recruiters can see it once it's approved. This is a preview.</p></div>` : ''}
    ${own && a.status === 'rejected' ? html`<div class="notice notice-bad"><p><b>Your profile needs changes before it can be published.</b> Edit it and it goes back into review.</p></div>` : ''}
    <div class="profile">
      <aside class="profile-side">
        <div class="profile-photo">${img ? html`<img src="${img}" alt="${a.stage_name}">` : html`<span class="initials" aria-hidden="true">${initials(a.stage_name)}</span>`}</div>
      </aside>
      <div>
        <h1 class="profile-name">${a.stage_name || 'Unnamed artist'}</h1>
        ${a.headline ? html`<p class="profile-headline">${a.headline}</p>` : ''}
        <div class="row">
          <span class="pill ${a.availability === 'available' ? 'pill-spot' : ''}">${label(AVAILABILITY, a.availability)}</span>
          ${a.founding ? html`<span class="pill pill-brand">Founding Artist</span>` : ''}
          ${a.status === 'approved' ? html`<span class="pill pill-ok">Profile reviewed</span>` : ''}
        </div>
        <div class="profile-actions">
          ${own ? html`<a class="btn btn-primary" href="#/me">Edit profile</a>` : ''}
          ${isRecruiter && !own ? html`<button class="btn btn-primary" id="shortlist-btn" type="button">Save to shortlist</button>
            <a class="btn" href="#/messages/${id}">Send message</a>` : ''}
          ${!state.session ? html`<a class="btn" href="#/login?next=${encodeURIComponent(`/artist/${id}`)}">Log in to contact</a>` : ''}
        </div>
        <dl class="facts">
          <div><dt>Artist type</dt><dd>${(a.artist_types || []).join(', ') || 'Not set'}</dd></div>
          <div><dt>Playing age</dt><dd>${age || 'Not set'}</dd></div>
          <div><dt>Gender</dt><dd>${a.gender || 'Not set'}</dd></div>
          <div><dt>Based in</dt><dd>${a.location || 'Not set'}</dd></div>
          <div><dt>Languages</dt><dd>${(a.languages || []).join(', ') || 'Not set'}</dd></div>
          <div><dt>Experience</dt><dd>${label(EXPERIENCE, a.experience_level)}</dd></div>
          ${a.height_cm ? html`<div><dt>Height</dt><dd>${a.height_cm} cm</dd></div>` : ''}
        </dl>
        ${a.bio ? html`<section class="section"><h2>About</h2><p style="white-space:pre-wrap">${a.bio}</p></section>` : ''}
        ${a.skills?.length ? html`<section class="section"><h2>Skills</h2><ul class="tags">${a.skills.map(s => html`<li>${s}</li>`)}</ul></section>` : ''}
        ${embed ? html`<section class="section"><h2>Showreel</h2><div class="video"><iframe src="${embed}" title="Showreel of ${a.stage_name}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div></section>`
          : reel ? html`<section class="section"><h2>Showreel</h2><a class="btn" href="${reel}" target="_blank" rel="noopener noreferrer">Watch showreel</a></section>` : ''}
        ${photos?.length ? html`<section class="section"><h2>Portfolio</h2><div class="gallery">
          ${photos.map((p, i) => html`<button type="button" data-photo="${i}" aria-label="Open photo ${i + 1}"><img src="${publicUrl(p.path)}" alt="${p.caption || ''}" loading="lazy"></button>`)}</div></section>` : ''}
        ${credits.length ? html`<section class="section"><h2>Credits</h2><div class="table-scroll"><table class="credits">
          <thead><tr><th scope="col">Production</th><th scope="col">Role</th><th scope="col">Type</th><th scope="col">Year</th></tr></thead>
          <tbody>${credits.map(c => html`<tr><td>${c.title}</td><td>${c.role}</td><td>${c.type}</td><td>${c.year}</td></tr>`)}</tbody></table></div></section>` : ''}
        ${socials.length ? html`<section class="section"><h2>Links</h2><div class="row">${socials.map(s => html`<a class="btn btn-sm" href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label}</a>`)}</div></section>` : ''}
        ${state.session && !own ? html`<p class="section small"><button class="linklike" id="report-artist" type="button">Report this profile</button></p>` : ''}
      </div>
    </div>`);

  $$('[data-photo]', root).forEach(btn => btn.addEventListener('click', () => {
    const p = photos[Number(btn.dataset.photo)];
    modal(html`<img src="${publicUrl(p.path)}" alt="${p.caption || `Photo of ${a.stage_name}`}">`, { label: 'Photo', wide: true });
  }));
  $('#report-artist', root)?.addEventListener('click', () => openReport('artist', id, 'this profile'));
  $('#shortlist-btn', root)?.addEventListener('click', async () => {
    const { openShortlistPicker } = await import('./shortlists.js');
    openShortlistPicker(id, a.stage_name);
  });
}
