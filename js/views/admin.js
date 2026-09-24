import { sb, must, publicUrl } from '../supabase.js';
import { html, mount, $, raw, avatar, fmtDate, timeAgo, emptyState, toast, errMsg, busy } from '../ui.js';
import { ageRange } from '../shared.js';

const TABS = [['review', 'Artist review'], ['recruiters', 'Recruiters'], ['reports', 'Reports'], ['overview', 'Overview']];

export default async function admin(root, _p, q) {
  const tab = TABS.some(t => t[0] === q.tab) ? q.tab : 'review';
  mount(root, html`
    <div class="page-head"><div><h1>Admin</h1><p>Review profiles, verify recruiters and handle reports.</p></div></div>
    <nav class="tabs" aria-label="Admin sections">${TABS.map(([k, l]) => html`<a href="#/admin?tab=${k}"${k === tab ? raw(' aria-current="page"') : ''}>${l}</a>`)}</nav>
    <div id="admin-body"><p class="loading">Loading…</p></div>`);
  const body = $('#admin-body', root);
  await ({ review, recruiters, reports, overview })[tab](body);
}

async function review(body) {
  const { data, error } = await sb.from('artist_profiles').select('*').eq('status', 'pending').order('updated_at', { ascending: true }).limit(100);
  if (error) { mount(body, html`<p>${errMsg(error)}</p>`); return; }
  if (!data.length) { mount(body, emptyState('Review queue is empty', 'New and edited artist profiles appear here.')); return; }
  mount(body, html`<p class="meta">${data.length} waiting. Oldest first. Check the photo is real and appropriate, and the details make sense.</p>
    ${data.map(a => html`<div class="panel"><div class="panel-head">
      <div class="app-artist">${avatar(publicUrl(a.avatar_path), a.stage_name, 'avatar-lg')}
        <span><a class="item-link" href="#/artist/${a.user_id}">${a.stage_name || 'No name'}</a>
          <small>${[(a.artist_types || []).join(', '), a.location, ageRange(a.playing_age_min, a.playing_age_max) ? `plays ${ageRange(a.playing_age_min, a.playing_age_max)}` : ''].filter(Boolean).join('. ')}</small>
          <small>Updated ${timeAgo(a.updated_at)}</small></span></div>
      <div class="row"><button class="btn btn-primary btn-sm" type="button" data-approve="${a.user_id}">Approve</button>
        <button class="btn btn-danger btn-sm" type="button" data-reject="${a.user_id}">Needs changes</button></div></div>
      ${a.bio ? html`<p class="meta" style="margin:10px 0 0">${a.bio.slice(0, 280)}${a.bio.length > 280 ? '…' : ''}</p>` : html`<p class="meta" style="margin:10px 0 0">No biography.</p>`}
    </div>`)}`);
  body.onclick = async e => {
    const b = e.target.closest('[data-approve],[data-reject]');
    if (!b) return;
    const approve = !!b.dataset.approve;
    try {
      await busy(b, async () => must(await sb.from('artist_profiles').update({ status: approve ? 'approved' : 'rejected' }).eq('user_id', b.dataset.approve || b.dataset.reject)));
      toast(approve ? 'Approved. The artist has been notified.' : 'Marked as needing changes. The artist has been notified.', 'success');
      review(body);
    } catch (err) { toast(errMsg(err), 'error'); }
  };
}

async function recruiters(body) {
  const { data, error } = await sb.from('recruiter_profiles').select('*, profiles(full_name,created_at)').order('verified').order('updated_at', { ascending: false }).limit(200);
  if (error) { mount(body, html`<p>${errMsg(error)}</p>`); return; }
  if (!data.length) { mount(body, emptyState('No recruiters yet', 'Recruiter accounts appear here after sign-up.')); return; }
  const { data: emails } = await sb.rpc('admin_user_emails', { ids: data.map(r => r.user_id) });
  const emailOf = Object.fromEntries((emails || []).map(x => [x.id, x.email]));
  mount(body, html`<p class="meta">Verify recruiters after confirming who they are, for example by phone or a work email. Verified recruiters' public casting calls become visible to artists.</p>
    <div class="panel"><ul class="list">${data.map(r => html`<li class="panel-head">
      <div><b>${r.profiles?.full_name || 'No name'}</b> ${r.verified ? html`<span class="pill pill-ok">Verified</span>` : html`<span class="pill pill-spot">Unverified</span>`}
        ${r.founding ? html`<span class="pill pill-brand">Founding</span>` : ''}
        <div class="meta">${[r.position, r.organisation].filter(Boolean).join(', ') || 'No organisation given'}</div>
        <div class="meta small">${emailOf[r.user_id] || ''}${r.website ? html`. <a href="${r.website}" target="_blank" rel="noopener noreferrer">Website</a>` : ''}. Joined ${fmtDate(r.profiles?.created_at)}</div>
        ${r.company_info ? html`<p class="meta" style="margin:6px 0 0">${r.company_info.slice(0, 240)}</p>` : ''}</div>
      <button class="btn btn-sm ${r.verified ? '' : 'btn-primary'}" type="button" data-verify="${r.user_id}" data-to="${r.verified ? '0' : '1'}">${r.verified ? 'Remove verification' : 'Verify'}</button>
    </li>`)}</ul></div>`);
  body.onclick = async e => {
    const b = e.target.closest('[data-verify]');
    if (!b) return;
    try {
      await busy(b, async () => must(await sb.from('recruiter_profiles').update({ verified: b.dataset.to === '1' }).eq('user_id', b.dataset.verify)));
      recruiters(body);
    } catch (err) { toast(errMsg(err), 'error'); }
  };
}

const targetLink = r => ({ artist: `#/artist/${r.target_id}`, project: `#/project/${r.target_id}`, casting_call: `#/casting/${r.target_id}` })[r.target_type];

async function reports(body) {
  const { data, error } = await sb.from('reports').select('*').eq('status', 'open').order('created_at').limit(100);
  if (error) { mount(body, html`<p>${errMsg(error)}</p>`); return; }
  if (!data.length) { mount(body, emptyState('No open reports', 'Reports from members appear here.')); return; }
  const msgIds = data.filter(r => r.target_type === 'message').map(r => r.target_id);
  const { data: msgs } = msgIds.length ? await sb.from('messages').select('id,body,sender_id,created_at').in('id', msgIds) : { data: [] };
  const msgOf = Object.fromEntries((msgs || []).map(m => [m.id, m]));
  mount(body, html`<div class="panel"><ul class="list">${data.map(r => {
    const link = targetLink(r);
    const m = msgOf[r.target_id];
    return html`<li><div class="panel-head">
      <div><b>${r.reason}</b> <span class="pill">${r.target_type.replace('_', ' ')}</span>
        <div class="meta small">${timeAgo(r.created_at)}${link ? html`. <a href="${link}">Open reported item</a>` : ''}</div>
        ${r.details ? html`<p style="margin:6px 0 0;white-space:pre-wrap">${r.details}</p>` : ''}
        ${m ? html`<blockquote class="panel" style="margin:8px 0 0;white-space:pre-wrap">${m.body}<div class="meta small">Sent ${fmtDate(m.created_at)} by member ${m.sender_id}</div></blockquote>` : ''}
        ${r.target_type === 'user' || r.target_type === 'message' ? html`<div class="meta small">Member id: ${m ? m.sender_id : r.target_id}</div>` : ''}</div>
      <div class="row"><button class="btn btn-sm btn-primary" type="button" data-resolve="${r.id}">Resolved</button>
        <button class="btn btn-sm" type="button" data-dismiss="${r.id}">Dismiss</button></div></div></li>`;
  })}</ul></div>`);
  body.onclick = async e => {
    const b = e.target.closest('[data-resolve],[data-dismiss]');
    if (!b) return;
    try {
      await busy(b, async () => must(await sb.from('reports').update({ status: b.dataset.resolve ? 'resolved' : 'dismissed', resolved_at: new Date().toISOString() }).eq('id', b.dataset.resolve || b.dataset.dismiss)));
      reports(body);
    } catch (err) { toast(errMsg(err), 'error'); }
  };
}

async function overview(body) {
  const count = async (table, f = x => x) => (await f(sb.from(table).select('*', { count: 'exact', head: true }))).count ?? 0;
  const [artists, live, recs, verified, projects, calls, apps, confirmed] = await Promise.all([
    count('artist_profiles'), count('artist_profiles', q => q.eq('status', 'approved')),
    count('recruiter_profiles'), count('recruiter_profiles', q => q.eq('verified', true)),
    count('projects'), count('casting_calls', q => q.eq('status', 'open')),
    count('applications'), count('applications', q => q.eq('status', 'confirmed')),
  ]);
  const stat = (n, l) => html`<div class="stat"><b>${n}</b>${l}</div>`;
  mount(body, html`
    <p class="meta">Your plan's key measure is confirmed casting connections, not sign-ups.</p>
    <div class="stat-grid">
      ${stat(confirmed, 'Confirmed castings')}${stat(apps, 'Applications')}${stat(calls, 'Open casting calls')}${stat(projects, 'Projects')}
      ${stat(live, `Live artists of ${artists}`)}${stat(verified, `Verified recruiters of ${recs}`)}
    </div>
    <p class="meta" style="margin-top:18px">Milestones from the plan: 100 artists, 10 recruiters, 10 projects; then 300, 20, 25; then 1,000, 50, 100.</p>`);
}
