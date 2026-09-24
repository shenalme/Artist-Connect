import { sb, must, BUCKET } from '../supabase.js';
import { state, uid } from '../state.js';
import { html, mount, $, toast, errMsg, busy, download } from '../ui.js';
import { displayNames } from '../shared.js';

export default async function account(root) {
  const me = uid();
  const { data: blocks } = await sb.from('blocks').select('blocked_id').eq('blocker_id', me);
  const names = await displayNames((blocks || []).map(b => b.blocked_id));

  mount(root, html`
    <div class="page-head"><div><h1>Account</h1><p>Signed in as ${state.session.user.email}. ${state.profile?.role === 'recruiter' ? 'Recruiter account.' : 'Artist account.'}</p></div>
      <button class="btn" id="signout" type="button">Log out</button></div>
    <div class="stack">
      <section class="form-section"><h2>Password</h2><p class="muted">Choose a new password for your account.</p>
        <a class="btn" href="#/update-password">Change password</a></section>
      <section class="form-section"><h2>Blocked members</h2>
        ${blocks?.length ? html`<ul class="list">${blocks.map(b => html`<li class="panel-head"><span>${names[b.blocked_id]?.name || 'Member'}</span>
          <button class="btn btn-sm" type="button" data-unblock="${b.blocked_id}">Unblock</button></li>`)}</ul>`
          : html`<p class="muted">You haven't blocked anyone.</p>`}</section>
      <section class="form-section"><h2>Your data</h2>
        <p class="muted">Download a copy of your profile, projects, applications, shortlists and messages as a JSON file.</p>
        <button class="btn" id="export" type="button">Download my data</button></section>
      <section class="form-section"><h2>Delete account</h2>
        <p class="muted">Permanently deletes your profile, photos, projects, applications and messages. This can't be undone.</p>
        <button class="btn btn-danger" id="delete" type="button">Delete my account</button></section>
    </div>`);

  $('#signout', root).addEventListener('click', async () => { await sb.auth.signOut(); location.hash = '#/'; });

  root.querySelectorAll('[data-unblock]').forEach(b => b.addEventListener('click', async () => {
    try {
      await busy(b, async () => must(await sb.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', b.dataset.unblock)));
      account(root);
    } catch (err) { toast(errMsg(err), 'error'); }
  }));

  $('#export', root).addEventListener('click', async e => {
    try {
      const out = await busy(e.target, async () => {
        const q = (t, f) => f(sb.from(t).select('*')).then(r => r.data || []);
        const [profile, artist, recruiter, photos, projects, applications, shortlists, messages, notifications] = await Promise.all([
          q('profiles', x => x.eq('id', me)), q('artist_profiles', x => x.eq('user_id', me)), q('recruiter_profiles', x => x.eq('user_id', me)),
          q('artist_photos', x => x.eq('user_id', me)), sb.from('projects').select('*, characters(*), casting_calls(*)').eq('owner_id', me).then(r => r.data || []),
          q('applications', x => x.eq('artist_id', me)), sb.from('shortlists').select('*, shortlist_items(*)').eq('owner_id', me).then(r => r.data || []),
          q('messages', x => x.or(`sender_id.eq.${me},recipient_id.eq.${me}`)), q('notifications', x => x.eq('user_id', me)),
        ]);
        return { exported_at: new Date().toISOString(), email: state.session.user.email, profile, artist, recruiter, photos, projects, applications, shortlists, messages, notifications };
      });
      download(`xposure-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2));
    } catch (err) { toast(errMsg(err), 'error'); }
  });

  $('#delete', root).addEventListener('click', async e => {
    const typed = prompt('Type DELETE to permanently delete your account.');
    if (typed !== 'DELETE') return;
    try {
      await busy(e.target, async () => {
        const store = sb.storage.from(BUCKET);
        for (const folder of [me, `${me}/photos`]) {
          const { data } = await store.list(folder, { limit: 1000 });
          const files = (data || []).filter(f => f.id).map(f => `${folder}/${f.name}`);
          if (files.length) await store.remove(files);
        }
        must(await sb.rpc('delete_my_account'));
        await sb.auth.signOut();
      });
      toast('Your account has been deleted.', 'success');
      location.hash = '#/';
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}
