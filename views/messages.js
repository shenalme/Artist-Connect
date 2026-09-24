import { sb, must } from '../supabase.js';
import { uid } from '../state.js';
import { html, mount, $, avatar, timeAgo, emptyState, notFound, isUuid, toast, errMsg, busy } from '../ui.js';
import { displayNames, openReport } from '../shared.js';

export async function inbox(root) {
  const me = uid();
  const { data, error } = await sb.from('messages').select('*')
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`).order('created_at', { ascending: false }).limit(400);
  if (error) { mount(root, html`<p>${errMsg(error)}</p>`); return; }

  const threads = new Map();
  for (const m of data) {
    const other = m.sender_id === me ? m.recipient_id : m.sender_id;
    if (!threads.has(other)) threads.set(other, { last: m, unread: 0 });
    if (m.recipient_id === me && !m.read_at) threads.get(other).unread++;
  }
  const names = await displayNames([...threads.keys()]);

  mount(root, html`
    <div class="page-head"><div><h1>Messages</h1><p>Conversations between artists and recruiters.</p></div></div>
    ${!threads.size ? emptyState('No messages yet', 'Recruiters can message any artist from their profile. Artists can message recruiters and reply to anyone who writes to them.')
      : html`<div class="panel"><ul class="list inbox">${[...threads].map(([id, t]) => {
        const n = names[id] || { name: 'Member', sub: '' };
        return html`<li class="${t.unread ? 'unread' : ''}"><a href="#/messages/${id}">
          ${avatar(n.avatar, n.name)}
          <span style="flex:1;min-width:0"><strong>${n.name}</strong> <span class="meta">${n.sub}</span>
            <span class="preview">${t.last.sender_id === me ? 'You: ' : ''}${t.last.body}</span></span>
          <span class="meta small">${timeAgo(t.last.created_at)}</span></a></li>`;
      })}</ul></div>`}`);
}

export async function thread(root, { id }) {
  const me = uid();
  if (!isUuid(id) || id === me) { mount(root, notFound('conversation')); return; }
  const names = await displayNames([id]);
  const other = names[id];
  if (!other) { mount(root, notFound('member')); return; }
  const profileLink = other.role === 'artist' ? `#/artist/${id}` : null;

  mount(root, html`
    <div class="thread">
      <header class="thread-head">
        <a href="#/messages" class="btn btn-sm btn-ghost">All messages</a>
        <div class="who">${avatar(other.avatar, other.name)}
          <div><b>${profileLink ? html`<a href="${profileLink}">${other.name}</a>` : other.name}</b><div class="meta small">${other.sub}</div></div></div>
        <div class="row"><button class="btn btn-sm btn-ghost" id="block" type="button">Block</button>
          <button class="btn btn-sm btn-ghost" id="report" type="button">Report</button></div>
      </header>
      <ol class="bubbles" id="bubbles" aria-live="polite"><li class="muted">Loading…</li></ol>
      <form class="composer" id="send">
        <label class="sr-only" for="body">Message</label>
        <textarea id="body" name="body" rows="2" maxlength="4000" required placeholder="Write a message"></textarea>
        <button class="btn btn-primary" type="submit">Send</button>
      </form>
    </div>
    <p class="hint" style="margin-top:10px">Keep conversations on Xposure until you trust the other person. Never send money or ID documents to get an audition.</p>`);

  const list = $('#bubbles', root);
  let lastKey = '';
  let lastFromThem = null;
  const load = async () => {
    const { data } = await sb.from('messages').select('*')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${me})`)
      .order('created_at', { ascending: true }).limit(500);
    if (!data) return;
    const key = `${data.length}:${data.at(-1)?.id || ''}`;
    if (key !== lastKey) {
      lastKey = key;
      lastFromThem = [...data].reverse().find(m => m.sender_id === id) || null;
      mount(list, data.length ? data.map(m => html`<li class="bubble ${m.sender_id === me ? 'mine' : ''}">${m.body}<time datetime="${m.created_at}">${timeAgo(m.created_at)}</time></li>`)
        : html`<li class="muted">Start the conversation. Introduce yourself and the project or opportunity.</li>`);
      list.scrollTop = list.scrollHeight;
    }
    if (data.some(m => m.recipient_id === me && !m.read_at)) {
      await sb.rpc('mark_thread_read', { other: id });
      window.dispatchEvent(new Event('xposure:badge'));
    }
  };
  await load();
  const timer = setInterval(load, 8000);

  const form = $('#send', root);
  const textarea = $('#body', root);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = textarea.value.trim();
    if (!body) return;
    try {
      await busy(e.submitter, async () => must(await sb.from('messages').insert({ sender_id: me, recipient_id: id, body })));
      textarea.value = '';
      await load();
    } catch (err) {
      const msg = /row-level security/i.test(err.message || '')
        ? "This message can't be sent. Artists can message recruiters, or reply once someone writes to them. Blocked members can't be messaged."
        : errMsg(err);
      toast(msg, 'error', 7000);
    }
  });
  $('#block', root).addEventListener('click', async e => {
    if (!confirm(`Block ${other.name}? Neither of you will be able to send messages to the other.`)) return;
    try {
      await busy(e.target, async () => must(await sb.from('blocks').insert({ blocker_id: me, blocked_id: id })));
      toast(`${other.name} is blocked.`, 'success');
    } catch (err) { toast(err.code === '23505' ? 'Already blocked.' : errMsg(err), 'error'); }
  });
  $('#report', root).addEventListener('click', () => {
    if (lastFromThem) openReport('message', lastFromThem.id, 'this conversation');
    else openReport('user', id, 'this member');
  });

  return () => clearInterval(timer);
}
