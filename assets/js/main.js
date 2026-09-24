import { sb, configured } from './supabase.js';
import { state, loadProfile } from './state.js';
import { html, mount, $, toast, attr, notFound } from './ui.js';

// [path pattern, view module, export name, options]
const routes = [
  ['/', 'home', 'default'],
  ['/login', 'auth', 'login', { guestOnly: true }],
  ['/signup', 'auth', 'signup', { guestOnly: true }],
  ['/reset', 'auth', 'reset'],
  ['/update-password', 'auth', 'updatePassword'],
  ['/artists', 'artists', 'search'],
  ['/artist/:id', 'artists', 'view'],
  ['/me', 'profile', 'edit', { auth: true }],
  ['/account', 'account', 'default', { auth: true }],
  ['/castings', 'castings', 'list'],
  ['/casting/:id', 'castings', 'view'],
  ['/projects', 'projects', 'list', { auth: true, role: 'recruiter' }],
  ['/project/new', 'projects', 'edit', { auth: true, role: 'recruiter' }],
  ['/project/:id/edit', 'projects', 'edit', { auth: true, role: 'recruiter' }],
  ['/project/:id', 'projects', 'view'],
  ['/applications', 'applications', 'default', { auth: true, role: 'artist' }],
  ['/shortlists', 'shortlists', 'list', { auth: true, role: 'recruiter' }],
  ['/shortlist/:id', 'shortlists', 'view', { auth: true, role: 'recruiter' }],
  ['/messages', 'messages', 'inbox', { auth: true }],
  ['/messages/:id', 'messages', 'thread', { auth: true }],
  ['/notifications', 'notifications', 'default', { auth: true }],
  ['/admin', 'admin', 'default', { auth: true, admin: true }],
];

let booted = false;
let recovering = false;
let cleanup = null;
let navToken = 0;

function match(pattern, path) {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

function renderNav(path) {
  const p = state.profile;
  const signedIn = !!state.session;
  const links = [['/castings', 'Casting calls'], ['/artists', 'Find artists']];
  if (p?.role === 'artist') links.push(['/applications', 'My applications']);
  if (p?.role === 'recruiter') links.push(['/projects', 'My projects'], ['/shortlists', 'Shortlists']);
  if (signedIn) links.push(['/messages', 'Messages']);
  if (p?.is_admin) links.push(['/admin', 'Admin']);
  const isActive = href => path === href || path.startsWith(href.replace(/s$/, '') + '/');

  mount($('#topbar'), html`<div class="topbar-inner">
    <a class="logo" href="#/"><span class="logo-mark" aria-hidden="true"></span>Xposure</a>
    <button class="btn btn-sm menu-btn" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
    <nav id="primary-nav" class="nav" aria-label="Main">
      ${links.map(([h, l]) => html`<a href="#${h}"${attr(isActive(h), 'aria-current="page"')}>${l}</a>`)}
      <div class="nav-account">
        ${signedIn
          ? html`<a href="#/notifications"${attr(path === '/notifications', 'aria-current="page"')}>Notifications<span class="badge" id="badge" hidden></span></a>
                 <a href="#/me"${attr(path === '/me', 'aria-current="page"')}>My profile</a>
                 <a href="#/account"${attr(path === '/account', 'aria-current="page"')}>Account</a>`
          : html`<a href="#/login">Log in</a><a class="btn btn-primary btn-sm" href="#/signup">Join free</a>`}
      </div>
    </nav>
  </div>`);
  const btn = $('.menu-btn');
  btn.addEventListener('click', () => {
    const open = $('#primary-nav').classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  refreshBadge();
}

async function refreshBadge() {
  if (!state.session) return;
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  const b = $('#badge');
  if (!b) return;
  if (count) { b.textContent = count > 99 ? '99+' : String(count); b.hidden = false; }
  else b.hidden = true;
}

function gate(message, action) {
  return html`<div class="empty"><h2>${message}</h2>${action}</div>`;
}

async function route() {
  const hash = location.hash;
  if (hash && !hash.startsWith('#/')) return; // in-page anchors like #main
  const [path, qs] = (hash.slice(1) || '/').split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const token = ++navToken;

  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  $('#modal-root').replaceChildren();
  renderNav(path);

  const main = $('#main');
  const root = document.createElement('div');
  root.className = 'view';
  main.replaceChildren(root);

  let found = null;
  let params = {};
  for (const r of routes) {
    const m = match(r[0], path);
    if (m) { found = r; params = m; break; }
  }
  if (!found) { mount(root, notFound()); return; }

  const [, mod, fn, opts = {}] = found;
  if (opts.auth && !state.session) {
    location.replace(`#/login?next=${encodeURIComponent(path + (qs ? `?${qs}` : ''))}`);
    return;
  }
  if (opts.guestOnly && state.session) { location.replace('#/'); return; }
  if (opts.role && state.profile?.role !== opts.role) {
    mount(root, gate(opts.role === 'recruiter' ? 'This page is for recruiter accounts' : 'This page is for artist accounts',
      html`<p class="muted">You're signed in with a different account type.</p><a class="btn" href="#/">Go to the home page</a>`));
    return;
  }
  if (opts.admin && !state.profile?.is_admin) {
    mount(root, gate('Administrators only', html`<a class="btn" href="#/">Go to the home page</a>`));
    return;
  }

  mount(root, html`<p class="loading">Loading…</p>`);
  try {
    const m = await import(`./views/${mod}.js`);
    const result = await m[fn](root, params, query);
    if (token !== navToken) { if (typeof result === 'function') result(); return; }
    if (typeof result === 'function') cleanup = result;
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    if (token === navToken) {
      mount(root, html`<div class="empty"><h2>This page didn't load</h2>
        <p>${e?.message || 'Unexpected error'}. Refresh the page to try again.</p></div>`);
    }
  }
}

function setupView() {
  mount($('#topbar'), html`<div class="topbar-inner"><span class="logo"><span class="logo-mark" aria-hidden="true"></span>Xposure</span></div>`);
  mount($('#main'), html`<div class="view"><div class="auth-card">
    <h1>Connect your database</h1>
    <p>Xposure needs a Supabase project to store profiles, projects and photos.</p>
    <p>Open <code>assets/js/config.js</code> and paste your Supabase project URL and anon key. The README walks through the full setup, which takes about ten minutes.</p>
  </div></div>`);
}

async function boot() {
  if (!configured) { setupView(); return; }

  // Links from Supabase emails arrive as #access_token=...&type=... or #error=...
  const h = location.hash;
  const hp = new URLSearchParams(h && !h.startsWith('#/') ? h.slice(1) : '');
  if (hp.get('type') === 'recovery') recovering = true;

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') recovering = true;
    const changed = (state.session?.user?.id ?? null) !== (session?.user?.id ?? null);
    state.session = session;
    if (booted && changed) {
      // Defer: Supabase recommends not awaiting other calls inside this callback.
      setTimeout(async () => { await loadProfile(); route(); }, 0);
    }
  });

  const { data } = await sb.auth.getSession();
  state.session = data.session;
  await loadProfile();
  booted = true;

  if (hp.get('error_description')) {
    toast(hp.get('error_description'), 'error', 8000);
    history.replaceState(null, '', `${location.pathname}#/`);
  } else if (recovering) {
    history.replaceState(null, '', `${location.pathname}#/update-password`);
  } else if (hp.get('access_token')) {
    history.replaceState(null, '', `${location.pathname}${state.profile ? '#/me' : '#/'}`);
    if (hp.get('type') === 'signup') toast('Email confirmed. Welcome to Xposure.', 'success');
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('xposure:badge', refreshBadge);
  setInterval(refreshBadge, 60000);
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
