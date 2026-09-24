import { sb } from '../supabase.js';
import { state } from '../state.js';
import { html, mount, $, today } from '../ui.js';
import { callList, CALL_FIELDS } from './castings.js';

export default async function home(root) {
  const p = state.profile;
  const ctas = !p
    ? html`<a class="btn btn-primary btn-lg" href="#/signup?role=artist">Create an artist profile</a>
           <a class="btn btn-lg" href="#/signup?role=recruiter">I'm casting a project</a>`
    : p.role === 'artist'
      ? html`<a class="btn btn-primary btn-lg" href="#/me">Update my profile</a>
             <a class="btn btn-lg" href="#/castings">Browse casting calls</a>`
      : html`<a class="btn btn-primary btn-lg" href="#/artists">Find artists</a>
             <a class="btn btn-lg" href="#/project/new">Create a project</a>`;

  mount(root, html`
    <section class="hero">
      <div>
        <h1 class="display">Get seen.<br>Get cast.</h1>
        <p class="lede">Xposure connects Sri Lankan actors, models, dancers, presenters and performers with the casting directors, producers and agencies looking for them.</p>
        <div class="actions">${ctas}</div>
      </div>
      <div class="hero-board" aria-labelledby="board-h">
        <div class="board-head"><h2 id="board-h">Casting now</h2><a href="#/castings">See all calls</a></div>
        <div id="home-calls"><p class="muted">Loading casting calls…</p></div>
      </div>
    </section>
    <section class="split">
      <div><h2>For artists</h2><p>Build one professional profile with your photos, showreel, languages, skills and credits. Apply to casting calls and follow each application from start to finish. Your profile is free.</p></div>
      <div><h2>For recruiters</h2><p>Search talent by type, playing age, district, language and skills. Create projects, describe your characters, publish casting calls and keep private shortlists with notes.</p></div>
      <div><h2>Checked by people</h2><p>Every artist profile is reviewed before it appears in search, and casting calls go public only from verified recruiters. If something looks wrong, report it and we'll look into it.</p></div>
    </section>`);

  const { data, error } = await sb.from('casting_calls').select(CALL_FIELDS)
    .eq('status', 'open').or(`deadline.is.null,deadline.gte.${today()}`)
    .order('created_at', { ascending: false }).limit(5);
  mount($('#home-calls', root), error
    ? html`<p class="muted">Casting calls couldn't load. Refresh the page to try again.</p>`
    : callList(data, { empty: html`<p class="muted">No open calls right now. New calls from verified recruiters appear here first.</p>` }));
}
