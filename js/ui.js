// Small UI toolkit. html`` escapes every interpolated value unless it is
// itself html`` output or wrapped in raw(), which keeps user content safe.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);

export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(String(s));

export function toHtml(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(toHtml).join('');
  if (v === null || v === undefined || v === false || v === true) return '';
  return esc(v);
}

export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += toHtml(vals[i]); });
  return new Raw(out);
}

export function mount(el, tpl) { if (el) el.innerHTML = toHtml(tpl); }
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const attr = (cond, name) => (cond ? raw(` ${name}`) : '');

export function safeUrl(u) {
  const s = String(u ?? '').trim();
  if (!s) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url.href : '';
  } catch { return ''; }
}

export const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));

export function toast(message, kind = 'info', ms = 4200) {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`;
  t.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  t.textContent = message;
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

export function errMsg(e) {
  const msg = e?.message || String(e || 'Something went wrong');
  if (e?.code === '23505') return 'That already exists.';
  if (e?.code === '42501' || /row-level security/i.test(msg)) return "You don't have permission to do that.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg;
}

export async function busy(btn, fn) {
  if (!btn) return fn();
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  try { return await fn(); } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
}

// Run an async action with a busy button and a toast on failure.
export async function act(btn, fn, success) {
  try {
    const r = await busy(btn, fn);
    if (success) toast(success, 'success');
    return r;
  } catch (e) {
    console.error(e);
    toast(errMsg(e), 'error');
    return undefined;
  }
}

export function options(list, selected, blank) {
  const opts = list.map(o => {
    const v = o.value ?? o;
    const l = o.label ?? o;
    return html`<option value="${v}"${attr(String(v) === String(selected ?? ''), 'selected')}>${l}</option>`;
  });
  return blank !== undefined ? [html`<option value="">${blank}</option>`, ...opts] : opts;
}

export function checks(name, list, selected = []) {
  return html`<div class="checks">${list.map(o => {
    const v = o.value ?? o;
    const l = o.label ?? o;
    return html`<label class="check"><input type="checkbox" name="${name}" value="${v}"${attr(selected.includes(v), 'checked')}><span>${l}</span></label>`;
  })}</div>`;
}

export function fmtDate(d) {
  if (!d) return '';
  const date = typeof d === 'string' && d.length === 10 ? new Date(`${d}T00:00:00`) : new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}

export const today = () => new Date().toISOString().slice(0, 10);

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

export function avatar(url, name, cls = '') {
  return html`<span class="avatar ${cls}" aria-hidden="true">${url ? html`<img src="${url}" alt="" loading="lazy">` : initials(name)}</span>`;
}

export function emptyState(title, body, action = '') {
  return html`<div class="empty"><h2>${title}</h2><p>${body}</p>${action}</div>`;
}

export function notFound(what = 'page') {
  return html`<div class="empty"><h2>We couldn't find that ${what}</h2>
    <p>It may have been removed, made private, or the link may be wrong.</p>
    <a class="btn" href="#/">Go to the home page</a></div>`;
}

export function modal(tpl, { label = 'Dialog', wide = false } = {}) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
    <button type="button" class="modal-close" aria-label="Close" data-close>&times;</button><div class="modal-body"></div></div>`;
  wrap.querySelector('.modal-body').innerHTML = toHtml(tpl);
  const prev = document.activeElement;
  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
    prev?.focus?.();
  }
  wrap.addEventListener('click', e => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  root.append(wrap);
  const first = wrap.querySelector('.modal-body input, .modal-body select, .modal-body textarea, .modal-body button') || wrap.querySelector('.modal-close');
  first.focus();
  return { el: wrap.querySelector('.modal-body'), close };
}

// Resize an image in the browser so uploads stay small (free storage tier).
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG or WebP).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is over 25 MB. Choose a smaller one.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch {
    throw new Error("This image format isn't supported. Save it as JPG or PNG and try again.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', quality));
}

export function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
