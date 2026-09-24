import { sb, must } from '../supabase.js';
import { html, mount, $, timeAgo, emptyState, toast, errMsg, busy } from '../ui.js';

export default async function notifications(root) {
  const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
  const unread = (data || []).filter(n => !n.read_at).length;
  mount(root, html`
    <div class="page-head"><div><h1>Notifications</h1></div>
      ${unread ? html`<button class="btn" id="read-all" type="button">Mark all as read</button>` : ''}</div>
    ${error ? html`<p>${errMsg(error)}</p>` : !data.length
      ? emptyState('Nothing new', 'Application updates, messages and profile reviews appear here.')
      : html`<div class="panel"><ul class="list">${data.map(n => html`<li>
          <a class="notif ${n.read_at ? '' : 'unread'}" href="${n.link && n.link.startsWith('#/') ? n.link : '#/notifications'}" data-id="${n.id}">
            <strong>${n.title}</strong>${n.body ? html`<div class="meta">${n.body}</div>` : ''}<div class="meta small">${timeAgo(n.created_at)}</div></a></li>`)}</ul></div>`}`);

  const done = () => window.dispatchEvent(new Event('xposure:badge'));
  $('#read-all', root)?.addEventListener('click', async e => {
    try {
      await busy(e.target, async () => must(await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)));
      done();
      notifications(root);
    } catch (err) { toast(errMsg(err), 'error'); }
  });
  root.querySelectorAll('.notif.unread').forEach(a => a.addEventListener('click', () => {
    sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', a.dataset.id).then(done);
  }));
}
