import { sb, must } from '../supabase.js';
import { uid } from '../state.js';
import { html, mount, raw, fmtDate, emptyState, toast, errMsg, busy } from '../ui.js';
import { APP_STATUS, PIPELINE, label } from '../constants.js';
import { statusPill } from '../shared.js';

function stepper(status) {
  if (status === 'rejected' || status === 'withdrawn') return html`<p style="margin:10px 0 0">${statusPill(status)}</p>`;
  const idx = PIPELINE.indexOf(status);
  return html`<ol class="stepper" aria-label="Application progress">${PIPELINE.map((s, i) => html`<li class="${i < idx ? 'done' : i === idx ? 'current' : ''}"${i === idx ? raw(' aria-current="step"') : ''}><span>${label(APP_STATUS, s)}</span></li>`)}</ol>`;
}

export default async function applications(root) {
  const { data, error } = await sb.from('applications')
    .select('id,status,created_at,updated_at,casting_call_id,casting_calls(id,title,deadline,status,projects(id,title,type))')
    .eq('artist_id', uid()).order('updated_at', { ascending: false });

  mount(root, html`
    <div class="page-head"><div><h1>My applications</h1><p>Every role you've applied for and where it stands.</p></div>
      <a class="btn" href="#/castings">Browse casting calls</a></div>
    ${error ? html`<p>${errMsg(error)}</p>` : !data.length
      ? emptyState('No applications yet', 'When you apply to a casting call, you can follow its progress here.', html`<a class="btn btn-primary" href="#/castings">Find a casting call</a>`)
      : data.map(a => {
        const c = a.casting_calls;
        const active = !['rejected', 'withdrawn', 'confirmed'].includes(a.status);
        return html`<div class="panel">
          <div class="panel-head">
            <div>${c ? html`<a class="item-link" href="#/casting/${c.id}">${c.title}</a>
              <div class="meta">${c.projects?.title || ''}${c.projects?.type ? `, ${c.projects.type}` : ''}</div>` : html`<b>Casting call removed</b>`}
              <div class="meta">Applied ${fmtDate(a.created_at)}. Last update ${fmtDate(a.updated_at)}.</div></div>
            ${active ? html`<button class="btn btn-sm btn-ghost" type="button" data-withdraw="${a.id}">Withdraw</button>` : ''}
          </div>
          ${stepper(a.status)}
        </div>`;
      })}`);

  if (root.dataset.bound) return;
  root.dataset.bound = '1';
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-withdraw]');
    if (!b || !confirm('Withdraw this application? The recruiter will be told, and you can\'t apply to this call again.')) return;
    try {
      await busy(b, async () => must(await sb.from('applications').update({ status: 'withdrawn' }).eq('id', b.dataset.withdraw)));
      toast('Application withdrawn.', 'success');
      applications(root);
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}
