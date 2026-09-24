import { sb, must } from '../supabase.js';
import { state } from '../state.js';
import { html, mount, $, toast, errMsg, busy, attr } from '../ui.js';

const baseUrl = () => `${location.origin}${location.pathname}`;
const safeNext = n => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/');

export async function login(root, _p, query) {
  mount(root, html`<div class="auth-card">
    <h1>Log in</h1>
    <form class="form" id="login-form">
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary" type="submit">Log in</button>
    </form>
    <p class="small" style="margin-top:18px"><a href="#/reset">Forgot your password?</a></p>
    <p class="small">New to Xposure? <a href="#/signup">Create a free account</a></p>
  </div>`);
  $('#login-form', root).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await busy(e.submitter, async () => must(await sb.auth.signInWithPassword({
        email: String(fd.get('email')).trim(), password: fd.get('password') })));
      location.hash = `#${safeNext(query.next)}`;
    } catch (err) {
      toast(/Invalid login/i.test(err.message) ? 'That email and password don\'t match. Check them and try again.' : errMsg(err), 'error');
    }
  });
}

export async function signup(root, _p, query) {
  const role = query.role === 'recruiter' ? 'recruiter' : 'artist';
  mount(root, html`<div class="auth-card">
    <h1>Join Xposure</h1>
    <p class="muted">Free for artists and recruiters during our founding period.</p>
    <form class="form" id="signup-form">
      <fieldset><legend class="sr-only">Account type</legend>
        <div class="role-choice">
          <label><span><input type="radio" name="role" value="artist"${attr(role === 'artist', 'checked')}> <b>I'm an artist</b></span><span>Build a profile and apply to castings</span></label>
          <label><span><input type="radio" name="role" value="recruiter"${attr(role === 'recruiter', 'checked')}> <b>I'm casting</b></span><span>Find talent and post casting calls</span></label>
        </div>
      </fieldset>
      <div class="field"><label for="full_name">Full name</label><input id="full_name" name="full_name" type="text" autocomplete="name" required maxlength="120"></div>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
        <p class="hint">At least 8 characters.</p></div>
      <label class="toggle"><input type="checkbox" name="adult" required><span>I am 18 or older. Accounts for under-18s aren't available yet.</span></label>
      <label class="toggle"><input type="checkbox" name="terms" required><span>I agree to use Xposure honestly and understand my public profile can be seen by visitors and recruiters.</span></label>
      <button class="btn btn-primary" type="submit">Create account</button>
    </form>
    <p class="small" style="margin-top:18px">Already a member? <a href="#/login">Log in</a></p>
  </div>`);
  $('#signup-form', root).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get('email')).trim();
    try {
      const data = await busy(e.submitter, async () => must(await sb.auth.signUp({
        email, password: fd.get('password'),
        options: {
          emailRedirectTo: baseUrl(),
          data: { role: fd.get('role'), full_name: String(fd.get('full_name')).trim(), adult_confirmed: 'true' },
        },
      })));
      if (data.session) { toast('Welcome to Xposure.', 'success'); location.hash = '#/me'; return; }
      mount(root, html`<div class="auth-card"><h1>Check your email</h1>
        <p>We sent a confirmation link to <b>${email}</b>. Open it on this device to finish creating your account.</p>
        <p class="muted small">No email after a few minutes? Check your spam folder.</p></div>`);
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

export async function reset(root) {
  mount(root, html`<div class="auth-card">
    <h1>Reset your password</h1>
    <p class="muted">Enter your email and we'll send you a link to choose a new password.</p>
    <form class="form" id="reset-form">
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
      <button class="btn btn-primary" type="submit">Send reset link</button>
    </form></div>`);
  $('#reset-form', root).addEventListener('submit', async e => {
    e.preventDefault();
    const email = String(new FormData(e.target).get('email')).trim();
    try {
      await busy(e.submitter, async () => must(await sb.auth.resetPasswordForEmail(email, { redirectTo: baseUrl() })));
      mount(root, html`<div class="auth-card"><h1>Check your email</h1>
        <p>If an account exists for <b>${email}</b>, a reset link is on its way.</p></div>`);
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

export async function updatePassword(root) {
  if (!state.session) {
    mount(root, html`<div class="auth-card"><h1>Link expired</h1>
      <p>Request a new reset link and open it on this device.</p><a class="btn btn-primary" href="#/reset">Request a new link</a></div>`);
    return;
  }
  mount(root, html`<div class="auth-card">
    <h1>Choose a new password</h1>
    <form class="form" id="pw-form">
      <div class="field"><label for="password">New password</label>
        <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
        <p class="hint">At least 8 characters.</p></div>
      <button class="btn btn-primary" type="submit">Save password</button>
    </form></div>`);
  $('#pw-form', root).addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await busy(e.submitter, async () => must(await sb.auth.updateUser({ password: new FormData(e.target).get('password') })));
      toast('Password saved.', 'success');
      location.hash = '#/';
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}
