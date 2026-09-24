import { sb, must, publicUrl } from '../supabase.js';
import { state, uid } from '../state.js';
import { html, mount, $, options, checks, toast, errMsg, busy, modal, fmtDate, today, emptyState, notFound, isUuid, avatar, safeUrl, raw } from '../ui.js';
import { PROJECT_TYPES, PROJECT_STATUS, DISTRICTS, ROLE_TYPES, CHARACTER_GENDERS, LANGUAGES, AUDITION_TYPES, EXPERIENCE, CALL_STATUS, APP_STATUS, label } from '../constants.js';
import { statusPill, ageRange, openReport } from '../shared.js';

async function recruiterVerified() {
  const { data } = await sb.from('recruiter_profiles').select('verified').eq('user_id', uid()).maybeSingle();
  return !!data?.verified;
}

const unverifiedNotice = html`<div class="notice notice-warn"><p><b>Your account isn't verified yet.</b> You can build projects and casting calls now; they become visible to artists once we verify you. <a href="#/me">Complete your recruiter profile</a> to speed this up.</p></div>`;

export async function list(root) {
  const [{ data, error }, verified] = await Promise.all([
    sb.from('projects').select('id,title,type,status,is_public,created_at,casting_calls(count)').eq('owner_id', uid()).order('created_at', { ascending: false }),
    recruiterVerified(),
  ]);
  mount(root, html`
    <div class="page-head"><div><h1>My projects</h1><p>Productions you're casting, with their characters and calls.</p></div>
      <a class="btn btn-primary" href="#/project/new">Create a project</a></div>
    ${verified ? '' : unverifiedNotice}
    ${error ? html`<p>${errMsg(error)}</p>` : !data.length
      ? emptyState('No projects yet', 'Create a project, add the characters you need, then publish a casting call for each role.',
        html`<a class="btn btn-primary" href="#/project/new">Create your first project</a>`)
      : html`<div class="panel"><ul class="list">${data.map(p => html`<li class="panel-head">
          <div><a class="item-link" href="#/project/${p.id}">${p.title}</a>
            <div class="meta">${p.type}. ${p.casting_calls?.[0]?.count ?? 0} casting calls. Created ${fmtDate(p.created_at)}.</div></div>
          <div class="row"><span class="pill">${label(PROJECT_STATUS, p.status)}</span>${p.is_public ? '' : html`<span class="pill">Private</span>`}</div>
        </li>`)}</ul></div>`}`);
}

export async function edit(root, { id }) {
  let p = { title: '', description: '', type: 'Film', genre: '', location: '', start_date: '', end_date: '', status: 'casting', is_public: true, contact_info: '' };
  if (id) {
    if (!isUuid(id)) { mount(root, notFound('project')); return; }
    const { data } = await sb.from('projects').select('*').eq('id', id).eq('owner_id', uid()).maybeSingle();
    if (!data) { mount(root, notFound('project')); return; }
    p = data;
  }
  mount(root, html`
    <p><a href="${id ? `#/project/${id}` : '#/projects'}">${id ? 'Back to project' : 'My projects'}</a></p>
    <h1>${id ? 'Edit project' : 'Create a project'}</h1>
    <form class="form form-section" id="project-form">
      <div class="field"><label for="title">Project title</label><input id="title" name="title" type="text" required minlength="2" maxlength="140" value="${p.title}"></div>
      <div class="grid-3">
        <div class="field"><label for="type">Type</label><select id="type" name="type">${options(PROJECT_TYPES, p.type)}</select></div>
        <div class="field"><label for="genre">Genre</label><input id="genre" name="genre" type="text" maxlength="60" value="${p.genre}" placeholder="e.g. Family drama"></div>
        <div class="field"><label for="status">Stage</label><select id="status" name="status">${options(PROJECT_STATUS, p.status)}</select></div>
      </div>
      <div class="field"><label for="description">Description</label><textarea id="description" name="description" maxlength="5000" rows="6" placeholder="Story, tone, production company, anything artists should know">${p.description}</textarea></div>
      <div class="grid-3">
        <div class="field"><label for="location">Main location</label><select id="location" name="location">${options(DISTRICTS, p.location, 'Not decided')}</select></div>
        <div class="field"><label for="start_date">Production starts</label><input id="start_date" name="start_date" type="date" value="${p.start_date || ''}"></div>
        <div class="field"><label for="end_date">Production ends</label><input id="end_date" name="end_date" type="date" value="${p.end_date || ''}"></div>
      </div>
      <div class="field"><label for="contact_info">Public contact details</label><input id="contact_info" name="contact_info" type="text" maxlength="200" value="${p.contact_info}" placeholder="Optional. Artists can always message you on Xposure."></div>
      <label class="toggle"><input type="checkbox" name="is_public"${p.is_public ? raw(' checked') : ''}>
        <span><b>Public project.</b> Its page and open casting calls are visible to artists. Turn off for confidential productions.</span></label>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${id ? 'Save project' : 'Create project'}</button></div>
    </form>`);

  $('#project-form', root).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const row = {
      title: String(fd.get('title')).trim(), type: fd.get('type'), genre: String(fd.get('genre') || '').trim(),
      status: fd.get('status'), description: String(fd.get('description') || '').trim(), location: fd.get('location') || '',
      start_date: fd.get('start_date') || null, end_date: fd.get('end_date') || null,
      contact_info: String(fd.get('contact_info') || '').trim(), is_public: fd.get('is_public') === 'on',
    };
    if (row.start_date && row.end_date && row.start_date > row.end_date) { toast('The end date must be after the start date.', 'error'); return; }
    try {
      const saved = await busy(e.submitter, async () => (id
        ? must(await sb.from('projects').update(row).eq('id', id).select('id').single())
        : must(await sb.from('projects').insert({ ...row, owner_id: uid() }).select('id').single())));
      toast(id ? 'Project saved.' : 'Project created. Now add your characters.', 'success');
      location.hash = `#/project/${saved.id}`;
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

export async function view(root, { id }) {
  if (!isUuid(id)) { mount(root, notFound('project')); return; }
  const { data: p } = await sb.from('projects').select('*').eq('id', id).maybeSingle();
  if (!p) { mount(root, notFound('project')); return; }
  if (p.owner_id === uid()) return manage(root, p);

  const [{ data: chars }, { data: calls }, { data: org }] = await Promise.all([
    sb.from('characters').select('*').eq('project_id', id).order('created_at'),
    sb.from('casting_calls').select('id,title,deadline,audition_type,status').eq('project_id', id).eq('status', 'open').order('created_at', { ascending: false }),
    sb.from('recruiter_profiles').select('organisation,verified').eq('user_id', p.owner_id).maybeSingle(),
  ]);
  mount(root, html`
    <p class="call-type">${p.type}${p.genre ? `, ${p.genre}` : ''}</p>
    <h1 class="profile-name">${p.title}</h1>
    <p class="profile-headline">${org?.organisation || 'Independent production'} ${org?.verified ? html`<span class="pill pill-ok">Verified recruiter</span>` : ''}</p>
    <dl class="facts">
      <div><dt>Stage</dt><dd>${label(PROJECT_STATUS, p.status)}</dd></div>
      <div><dt>Location</dt><dd>${p.location || 'Not decided'}</dd></div>
      <div><dt>Production dates</dt><dd>${p.start_date ? `${fmtDate(p.start_date)}${p.end_date ? ` to ${fmtDate(p.end_date)}` : ''}` : 'To be confirmed'}</dd></div>
      ${p.contact_info ? html`<div><dt>Contact</dt><dd>${p.contact_info}</dd></div>` : ''}
    </dl>
    ${p.description ? html`<section class="section"><h2>About</h2><p style="white-space:pre-wrap">${p.description}</p></section>` : ''}
    <section class="section"><h2>Open casting calls</h2>
      ${calls?.length ? html`<div class="panel"><ul class="list">${calls.map(c => html`<li><a class="item-link" href="#/casting/${c.id}">${c.title}</a>
        <div class="meta">${c.audition_type}. ${c.deadline ? `Apply by ${fmtDate(c.deadline)}` : 'Open until filled'}</div></li>`)}</ul></div>`
        : html`<p class="muted">No open calls right now.</p>`}</section>
    ${chars?.length ? html`<section class="section"><h2>Characters</h2><div class="panel"><ul class="list">${chars.map(c => html`<li>
      <b>${c.name}</b> <span class="meta">${[c.role_type, ageRange(c.age_min, c.age_max) ? `age ${ageRange(c.age_min, c.age_max)}` : ''].filter(Boolean).join(', ')}</span>
      ${c.description ? html`<p style="margin:4px 0 0">${c.description}</p>` : ''}</li>`)}</ul></div></section>` : ''}
    ${state.session ? html`<p class="section small"><button class="linklike" id="report-project" type="button">Report this project</button></p>` : ''}`);
  $('#report-project', root)?.addEventListener('click', () => openReport('project', id, 'this project'));
}

// ---------------------------------------------------------------------
// Owner view: characters, casting calls and applications in one place
// ---------------------------------------------------------------------
async function manage(root, p) {
  const [{ data: chars }, { data: calls }, verified] = await Promise.all([
    sb.from('characters').select('*').eq('project_id', p.id).order('created_at'),
    sb.from('casting_calls').select('*, characters(name)').eq('project_id', p.id).order('created_at', { ascending: false }),
    recruiterVerified(),
  ]);
  const callIds = (calls || []).map(c => c.id);
  const { data: apps } = callIds.length
    ? await sb.from('applications').select('*, artist_profiles(user_id,stage_name,avatar_path,location,artist_types)').in('casting_call_id', callIds).order('created_at')
    : { data: [] };
  const appsByCall = {};
  for (const a of apps || []) (appsByCall[a.casting_call_id] ||= []).push(a);

  const refresh = () => manage(root, p);

  mount(root, html`
    <p><a href="#/projects">My projects</a></p>
    <div class="page-head">
      <div><p class="call-type" style="margin:0">${p.type}${p.genre ? `, ${p.genre}` : ''}</p><h1>${p.title}</h1>
        <p>${label(PROJECT_STATUS, p.status)}. ${p.is_public ? 'Public project.' : 'Private project.'}</p></div>
      <div class="row"><a class="btn" href="#/project/${p.id}/edit">Edit project</a><button class="btn btn-danger" id="del-project" type="button">Delete project</button></div>
    </div>
    ${verified ? '' : unverifiedNotice}
    ${!p.is_public ? html`<div class="notice"><p>This project is private, so its casting calls aren't listed publicly. Message artists directly from search to invite them.</p></div>` : ''}

    <section class="section">
      <div class="panel-head"><h2>Characters</h2><button class="btn btn-primary btn-sm" id="add-char" type="button">Add a character</button></div>
      ${chars?.length ? html`<div class="panel"><ul class="list">${chars.map(c => html`<li class="panel-head">
        <div><b>${c.name}</b> <span class="meta">${[c.role_type, c.gender !== 'Any' ? c.gender : '', ageRange(c.age_min, c.age_max) ? `age ${ageRange(c.age_min, c.age_max)}` : '', (c.languages || []).join(' / ')].filter(Boolean).join(', ')}</span>
          ${c.description ? html`<p class="meta" style="margin:4px 0 0">${c.description}</p>` : ''}</div>
        <div class="row">
          <button class="btn btn-sm btn-primary" data-call-for="${c.id}" type="button">Create casting call</button>
          <a class="btn btn-sm" href="${findArtistsLink(c)}">Find matching artists</a>
          <button class="btn btn-sm" data-edit-char="${c.id}" type="button">Edit</button>
          <button class="btn btn-sm btn-danger" data-del-char="${c.id}" type="button">Delete</button>
        </div></li>`)}</ul></div>`
        : html`<p class="muted">Describe each role you need to cast. Example: Maya, lead, 25 to 30, Sinhala and English.</p>`}
    </section>

    <section class="section">
      <div class="panel-head"><h2>Casting calls</h2><button class="btn btn-sm" id="add-call" type="button">Create casting call</button></div>
      ${calls?.length ? calls.map(c => {
        const list = appsByCall[c.id] || [];
        return html`<div class="panel">
          <div class="panel-head">
            <div><h3><a href="#/casting/${c.id}">${c.title}</a></h3>
              <p class="meta" style="margin:4px 0 0">${c.characters?.name ? `Role: ${c.characters.name}. ` : ''}${c.deadline ? `Apply by ${fmtDate(c.deadline)}.` : 'No deadline.'} ${list.length} ${list.length === 1 ? 'application' : 'applications'}.</p></div>
            <div class="row">${statusPill(c.status)}
              ${c.status === 'open' ? html`<button class="btn btn-sm" data-close-call="${c.id}" type="button">Close</button>`
                : html`<button class="btn btn-sm" data-open-call="${c.id}" type="button">Open</button>`}
              <button class="btn btn-sm" data-edit-call="${c.id}" type="button">Edit</button>
              <button class="btn btn-sm btn-danger" data-del-call="${c.id}" type="button">Delete</button></div>
          </div>
          ${list.length ? html`<details open style="margin-top:12px"><summary><b>Applications</b></summary>
            <ul class="list" style="margin-top:8px">${list.map(appRow)}</ul></details>` : ''}
        </div>`;
      }) : html`<p class="muted">No casting calls yet. Add a character first, then create a call for it.</p>`}
    </section>`);

  // --- actions ---
  $('#del-project', root).addEventListener('click', async e => {
    if (!confirm(`Delete "${p.title}" with all its characters, casting calls and applications? This can't be undone.`)) return;
    try {
      await busy(e.target, async () => must(await sb.from('projects').delete().eq('id', p.id)));
      toast('Project deleted.', 'success');
      location.hash = '#/projects';
    } catch (err) { toast(errMsg(err), 'error'); }
  });
  $('#add-char', root).addEventListener('click', () => characterForm(p, null, refresh));
  $('#add-call', root).addEventListener('click', () => callForm(p, chars || [], null, null, refresh));

  root._ctx = { chars: chars || [], calls: calls || [], refresh };
  if (root.dataset.bound) return;
  root.dataset.bound = '1';

  root.addEventListener('click', async e => {
    const t = e.target.closest('button');
    const { chars, calls, refresh } = root._ctx;
    if (!t || !root.contains(t)) return;
    const d = t.dataset;
    try {
      if (d.editChar) characterForm(p, chars.find(c => c.id === d.editChar), refresh);
      else if (d.delChar) {
        if (!confirm('Delete this character? Casting calls for it stay, without a linked role.')) return;
        await busy(t, async () => must(await sb.from('characters').delete().eq('id', d.delChar)));
        refresh();
      } else if (d.callFor) callForm(p, chars, null, chars.find(c => c.id === d.callFor), refresh);
      else if (d.editCall) callForm(p, chars, calls.find(c => c.id === d.editCall), null, refresh);
      else if (d.closeCall || d.openCall) {
        await busy(t, async () => must(await sb.from('casting_calls').update({ status: d.closeCall ? 'closed' : 'open' }).eq('id', d.closeCall || d.openCall)));
        toast(d.closeCall ? 'Casting call closed.' : 'Casting call opened.', 'success');
        refresh();
      } else if (d.delCall) {
        if (!confirm('Delete this casting call and all its applications?')) return;
        await busy(t, async () => must(await sb.from('casting_calls').delete().eq('id', d.delCall)));
        refresh();
      } else if (d.shortlist) {
        const { openShortlistPicker } = await import('./shortlists.js');
        openShortlistPicker(d.shortlist, d.name);
      }
    } catch (err) { toast(errMsg(err), 'error'); }
  });

  root.addEventListener('change', async e => {
    const sel = e.target.closest('select[data-app-status]');
    if (!sel) return;
    const { refresh } = root._ctx;
    try {
      sel.disabled = true;
      must(await sb.from('applications').update({ status: sel.value }).eq('id', sel.dataset.appStatus));
      toast(`Status set to ${label(APP_STATUS, sel.value)}. The artist has been notified.`, 'success');
    } catch (err) { toast(errMsg(err), 'error'); refresh(); } finally { sel.disabled = false; }
  });
}

function findArtistsLink(c) {
  const q = new URLSearchParams();
  if (c.gender && c.gender !== 'Any') q.set('gender', c.gender);
  if (c.age_min) q.set('age_from', c.age_min);
  if (c.age_max) q.set('age_to', c.age_max);
  if (c.languages?.length === 1) q.set('lang', c.languages[0]);
  return `#/artists?${q}`;
}

function appRow(a) {
  const ar = a.artist_profiles || {};
  const tape = safeUrl(a.selftape_url);
  return html`<li class="app-row">
    <a class="app-artist" href="#/artist/${a.artist_id}">${avatar(publicUrl(ar.avatar_path), ar.stage_name)}
      <span><b>${ar.stage_name || 'Artist'}</b><small>${[(ar.artist_types || []).slice(0, 2).join(', '), ar.location].filter(Boolean).join(', ')}</small></span></a>
    <div>
      ${a.message ? html`<p class="app-msg">${a.message}</p>` : html`<p class="meta">No message.</p>`}
      <p class="meta" style="margin:0">Applied ${fmtDate(a.created_at)}${tape ? html`. <a href="${tape}" target="_blank" rel="noopener noreferrer">Watch self-tape</a>` : ''}</p>
    </div>
    <div class="app-actions">
      ${a.status === 'withdrawn' ? statusPill('withdrawn') : html`<label class="sr-only" for="st-${a.id}">Status for ${ar.stage_name}</label>
        <select id="st-${a.id}" data-app-status="${a.id}">${options(APP_STATUS.filter(s => s.value !== 'withdrawn'), a.status)}</select>`}
      <div class="row">
        <button class="btn btn-sm" type="button" data-shortlist="${a.artist_id}" data-name="${ar.stage_name || ''}">Shortlist</button>
        <a class="btn btn-sm" href="#/messages/${a.artist_id}">Message</a>
      </div>
    </div>
  </li>`;
}

function characterForm(p, c, done) {
  const v = c || { name: '', role_type: 'Supporting', age_min: '', age_max: '', gender: 'Any', languages: [], skills: [], description: '' };
  const m = modal(html`
    <h2>${c ? 'Edit character' : 'Add a character'}</h2>
    <form class="form" id="char-form">
      <div class="grid-2">
        <div class="field"><label for="c-name">Character name</label><input id="c-name" name="name" type="text" required maxlength="100" value="${v.name}"></div>
        <div class="field"><label for="c-role">Role size</label><select id="c-role" name="role_type">${options(ROLE_TYPES, v.role_type)}</select></div>
      </div>
      <div class="grid-3">
        <div class="field"><label for="c-min">Age from</label><input id="c-min" name="age_min" type="number" min="0" max="100" value="${v.age_min ?? ''}"></div>
        <div class="field"><label for="c-max">Age to</label><input id="c-max" name="age_max" type="number" min="0" max="100" value="${v.age_max ?? ''}"></div>
        <div class="field"><label for="c-gender">Gender</label><select id="c-gender" name="gender">${options(CHARACTER_GENDERS, v.gender)}</select></div>
      </div>
      <div class="field"><span class="label">Languages</span>${checks('languages', LANGUAGES, v.languages || [])}</div>
      <div class="field"><label for="c-skills">Skills</label><input id="c-skills" name="skills" type="text" value="${(v.skills || []).join(', ')}" placeholder="e.g. acting, emotional performance"></div>
      <div class="field"><label for="c-desc">Description</label><textarea id="c-desc" name="description" maxlength="3000" placeholder="Who they are, what they want, key scenes">${v.description}</textarea></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${c ? 'Save character' : 'Add character'}</button>
        <button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
    </form>`, { label: 'Character' });
  m.el.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const n = k => (String(fd.get(k)).trim() === '' ? null : Number(fd.get(k)));
    const row = {
      name: String(fd.get('name')).trim(), role_type: fd.get('role_type'), age_min: n('age_min'), age_max: n('age_max'),
      gender: fd.get('gender'), languages: fd.getAll('languages'),
      skills: [...new Set(String(fd.get('skills') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean))].slice(0, 25),
      description: String(fd.get('description') || '').trim(),
    };
    if (row.age_min != null && row.age_max != null && row.age_min > row.age_max) { toast('"Age from" must be lower than "Age to".', 'error'); return; }
    try {
      await busy(e.submitter, async () => must(c
        ? await sb.from('characters').update(row).eq('id', c.id)
        : await sb.from('characters').insert({ ...row, project_id: p.id })));
      m.close();
      toast(c ? 'Character saved.' : 'Character added.', 'success');
      done();
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

function callForm(p, chars, call, forChar, done) {
  const v = call || {
    title: forChar ? `${forChar.name}, ${forChar.role_type.toLowerCase()} role in ${p.title}` : '',
    character_id: forChar?.id || '', requirements: '', location: p.location || '', shoot_dates: '',
    experience_required: 'any', deadline: '', audition_type: 'Self-tape', compensation: '', instructions: '', status: 'open',
  };
  const m = modal(html`
    <h2>${call ? 'Edit casting call' : 'Create a casting call'}</h2>
    <form class="form" id="call-form">
      <div class="field"><label for="k-title">Title</label><input id="k-title" name="title" type="text" required minlength="2" maxlength="140" value="${v.title}"></div>
      <div class="grid-2">
        <div class="field"><label for="k-char">Character</label><select id="k-char" name="character_id">${options(chars.map(c => ({ value: c.id, label: c.name })), v.character_id, 'No specific character')}</select></div>
        <div class="field"><label for="k-status">Status</label><select id="k-status" name="status">${options(CALL_STATUS, v.status)}</select></div>
      </div>
      <div class="field"><label for="k-req">Requirements</label><textarea id="k-req" name="requirements" placeholder="Look, skills, availability, anything essential">${v.requirements}</textarea></div>
      <div class="grid-2">
        <div class="field"><label for="k-loc">Location</label><select id="k-loc" name="location">${options(DISTRICTS, v.location, 'Not decided')}</select></div>
        <div class="field"><label for="k-dates">Shoot dates</label><input id="k-dates" name="shoot_dates" type="text" maxlength="120" value="${v.shoot_dates}" placeholder="e.g. 3 days in mid-March"></div>
      </div>
      <div class="grid-3">
        <div class="field"><label for="k-exp">Experience</label><select id="k-exp" name="experience_required">${options([{ value: 'any', label: 'Any level' }, ...EXPERIENCE], v.experience_required)}</select></div>
        <div class="field"><label for="k-aud">Audition</label><select id="k-aud" name="audition_type">${options(AUDITION_TYPES, v.audition_type)}</select></div>
        <div class="field"><label for="k-dead">Apply by</label><input id="k-dead" name="deadline" type="date" min="${today()}" value="${v.deadline || ''}"></div>
      </div>
      <div class="field"><label for="k-pay">Compensation</label><input id="k-pay" name="compensation" type="text" maxlength="160" value="${v.compensation}" placeholder="e.g. Rs. 25,000 per shoot day, meals and transport"></div>
      <div class="field"><label for="k-ins">How to apply</label><textarea id="k-ins" name="instructions" placeholder="What to include in the self-tape, script pages, audition venue">${v.instructions}</textarea></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${call ? 'Save casting call' : 'Create casting call'}</button>
        <button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
    </form>`, { label: 'Casting call' });
  m.el.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const row = Object.fromEntries(['title', 'requirements', 'location', 'shoot_dates', 'experience_required', 'audition_type', 'compensation', 'instructions', 'status']
      .map(k => [k, String(fd.get(k) ?? '').trim()]));
    row.character_id = fd.get('character_id') || null;
    row.deadline = fd.get('deadline') || null;
    try {
      await busy(e.submitter, async () => must(call
        ? await sb.from('casting_calls').update(row).eq('id', call.id)
        : await sb.from('casting_calls').insert({ ...row, project_id: p.id })));
      m.close();
      toast(call ? 'Casting call saved.' : 'Casting call created.', 'success');
      done();
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}
