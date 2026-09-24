import { sb, must } from '../supabase.js';
import { uid } from '../state.js';
import { html, mount, $, options, modal, toast, errMsg, busy, emptyState, notFound, isUuid, fmtDate } from '../ui.js';
import { artistCard, ARTIST_CARD_FIELDS } from '../shared.js';

export async function list(root) {
  const [{ data, error }, { data: projects }] = await Promise.all([
    sb.from('shortlists').select('id,name,created_at,projects(title),shortlist_items(count)').order('created_at', { ascending: false }),
    sb.from('projects').select('id,title').eq('owner_id', uid()).order('created_at', { ascending: false }),
  ]);
  mount(root, html`
    <div class="page-head"><div><h1>Shortlists</h1><p>Private lists of artists with your notes. Only you can see them.</p></div></div>
    <form class="form form-section form-wide" id="new-list" style="margin-bottom:22px">
      <div class="grid-3" style="align-items:end">
        <div class="field"><label for="sl-name">New shortlist</label><input id="sl-name" name="name" type="text" required maxlength="100" placeholder="e.g. Maya, lead"></div>
        <div class="field"><label for="sl-proj">Project</label><select id="sl-proj" name="project_id">${options((projects || []).map(p => ({ value: p.id, label: p.title })), '', 'No project')}</select></div>
        <div><button class="btn btn-primary" type="submit">Create shortlist</button></div>
      </div>
    </form>
    ${error ? html`<p>${errMsg(error)}</p>` : !data.length
      ? emptyState('No shortlists yet', 'Create one here, or use "Save to shortlist" on any artist profile.')
      : html`<div class="panel"><ul class="list">${data.map(s => html`<li><a class="item-link" href="#/shortlist/${s.id}">${s.name}</a>
          <div class="meta">${s.shortlist_items?.[0]?.count ?? 0} artists${s.projects?.title ? `. ${s.projects.title}` : ''}. Created ${fmtDate(s.created_at)}.</div></li>`)}</ul></div>`}`);

  $('#new-list', root).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const row = await busy(e.submitter, async () => must(await sb.from('shortlists')
        .insert({ owner_id: uid(), name: String(fd.get('name')).trim(), project_id: fd.get('project_id') || null }).select('id').single()));
      location.hash = `#/shortlist/${row.id}`;
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

export async function view(root, { id }) {
  if (!isUuid(id)) { mount(root, notFound('shortlist')); return; }
  const [{ data: s }, { data: items }] = await Promise.all([
    sb.from('shortlists').select('*, projects(id,title)').eq('id', id).maybeSingle(),
    sb.from('shortlist_items').select(`artist_id,note,created_at,artist_profiles(${ARTIST_CARD_FIELDS})`).eq('shortlist_id', id).order('created_at'),
  ]);
  if (!s) { mount(root, notFound('shortlist')); return; }

  mount(root, html`
    <p><a href="#/shortlists">All shortlists</a></p>
    <div class="page-head">
      <div><h1>${s.name}</h1>${s.projects ? html`<p>For <a href="#/project/${s.projects.id}">${s.projects.title}</a></p>` : ''}</div>
      <div class="row"><button class="btn" id="rename" type="button">Rename</button><button class="btn btn-danger" id="del-list" type="button">Delete shortlist</button></div>
    </div>
    ${!items?.length ? emptyState('This shortlist is empty', 'Open an artist profile and choose "Save to shortlist".', html`<a class="btn btn-primary" href="#/artists">Find artists</a>`)
      : html`<div class="headshots" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${items.map(it => html`<div>
          ${it.artist_profiles ? artistCard(it.artist_profiles) : html`<p class="muted">This profile is no longer available.</p>`}
          <div class="field" style="margin-top:10px"><label class="sr-only" for="note-${it.artist_id}">Private note</label>
            <textarea id="note-${it.artist_id}" data-note="${it.artist_id}" maxlength="2000" rows="3" placeholder="Private note">${it.note}</textarea></div>
          <div class="row" style="margin-top:6px"><a class="btn btn-sm" href="#/messages/${it.artist_id}">Message</a>
            <button class="btn btn-sm btn-ghost" type="button" data-remove="${it.artist_id}">Remove</button></div>
        </div>`)}</div>`}`);

  root.querySelectorAll('[data-note]').forEach(t => t.addEventListener('change', async () => {
    const { error } = await sb.from('shortlist_items').update({ note: t.value.trim() }).eq('shortlist_id', id).eq('artist_id', t.dataset.note);
    toast(error ? errMsg(error) : 'Note saved.', error ? 'error' : 'success', 2000);
  }));
  root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
    try {
      await busy(b, async () => must(await sb.from('shortlist_items').delete().eq('shortlist_id', id).eq('artist_id', b.dataset.remove)));
      view(root, { id });
    } catch (err) { toast(errMsg(err), 'error'); }
  }));
  $('#rename', root).addEventListener('click', async () => {
    const name = prompt('Shortlist name', s.name);
    if (!name || !name.trim()) return;
    const { error } = await sb.from('shortlists').update({ name: name.trim().slice(0, 100) }).eq('id', id);
    if (error) toast(errMsg(error), 'error'); else view(root, { id });
  });
  $('#del-list', root).addEventListener('click', async e => {
    if (!confirm('Delete this shortlist and its notes?')) return;
    try {
      await busy(e.target, async () => must(await sb.from('shortlists').delete().eq('id', id)));
      location.hash = '#/shortlists';
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

export async function openShortlistPicker(artistId, artistName = 'this artist') {
  const load = async () => (await sb.from('shortlists').select('id,name,shortlist_items(artist_id)').order('created_at', { ascending: false })).data || [];
  let lists = await load();
  const m = modal(html`<h2>Save ${artistName || 'artist'} to a shortlist</h2><div id="picker"></div>`, { label: 'Save to shortlist' });

  const render = () => {
    mount($('#picker', m.el), html`
      ${lists.length ? html`<ul class="list">${lists.map(l => {
        const inList = (l.shortlist_items || []).some(i => i.artist_id === artistId);
        return html`<li class="panel-head"><span>${l.name}</span>
          ${inList ? html`<span class="pill pill-ok">Saved</span>` : html`<button class="btn btn-sm btn-primary" type="button" data-add="${l.id}">Add</button>`}</li>`;
      })}</ul>` : html`<p class="muted">You don't have any shortlists yet.</p>`}
      <form class="form" id="picker-new" style="margin-top:18px">
        <div class="field"><label for="pk-name">New shortlist</label><input id="pk-name" name="name" type="text" required maxlength="100" placeholder="e.g. Maya, lead"></div>
        <div><button class="btn" type="submit">Create and add</button></div>
      </form>`);
  };
  render();

  const add = async listId => {
    must(await sb.from('shortlist_items').insert({ shortlist_id: listId, artist_id: artistId }));
    lists = await load();
    render();
    toast('Saved to shortlist.', 'success');
  };
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    try { await busy(b, () => add(b.dataset.add)); } catch (err) { toast(errMsg(err), 'error'); }
  });
  m.el.addEventListener('submit', async e => {
    e.preventDefault();
    const name = String(new FormData(e.target).get('name')).trim();
    try {
      await busy(e.submitter, async () => {
        const row = must(await sb.from('shortlists').insert({ owner_id: uid(), name }).select('id').single());
        await add(row.id);
      });
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}
