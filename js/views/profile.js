import { sb, must, publicUrl, BUCKET } from '../supabase.js';
import { state, uid, loadProfile } from '../state.js';
import { html, mount, $, $$, options, checks, toast, errMsg, busy, safeUrl, compressImage, initials, raw } from '../ui.js';
import { ARTIST_TYPES, LANGUAGES, DISTRICTS, GENDERS, EXPERIENCE, AVAILABILITY, SOCIALS } from '../constants.js';

const MAX_PHOTOS = 12;

export async function edit(root) {
  return state.profile?.role === 'recruiter' ? recruiterEdit(root) : artistEdit(root);
}

function creditRow(c = {}) {
  return html`<div class="credit-row">
    <input type="text" name="credit_title" aria-label="Production" placeholder="Production" value="${c.title || ''}" maxlength="120">
    <input type="text" name="credit_role" aria-label="Role" placeholder="Role" value="${c.role || ''}" maxlength="80">
    <input type="text" name="credit_year" aria-label="Year" placeholder="Year" inputmode="numeric" value="${c.year || ''}" maxlength="4">
    <input type="text" name="credit_type" aria-label="Type" placeholder="Film, teledrama, ad…" value="${c.type || ''}" maxlength="40">
    <button type="button" class="btn btn-sm btn-ghost" data-remove-credit>Remove</button>
  </div>`;
}

async function artistEdit(root) {
  const me = uid();
  const { data: a, error } = await sb.from('artist_profiles').select('*').eq('user_id', me).maybeSingle();
  if (error || !a) { mount(root, html`<p>${errMsg(error || 'Profile not found')}</p>`); return; }
  let photos = (await sb.from('artist_photos').select('*').eq('user_id', me).order('created_at')).data || [];

  const statusNotice = {
    pending: html`<div class="notice notice-warn"><p><b>Waiting for review.</b> Add a clear main photo, your artist type, languages and skills. We approve complete profiles first, and you'll get a notification when yours is live.</p></div>`,
    approved: html`<div class="notice notice-ok"><p><b>Your profile is live.</b> Recruiters can find you in search${a.is_public ? '' : ' (currently hidden, because search visibility is off)'}.</p></div>`,
    rejected: html`<div class="notice notice-bad"><p><b>Your profile needs changes.</b> Update it and save; it goes straight back into review.</p></div>`,
  }[a.status];

  mount(root, html`
    <div class="page-head"><div><h1>My artist profile</h1><p>This is what recruiters see.</p></div>
      <a class="btn" href="#/artist/${me}">Preview public profile</a></div>
    ${statusNotice}
    <div class="stack">
      <section class="form-section">
        <h2>Main photo</h2>
        <div class="avatar-edit">
          <div class="profile-photo" id="avatar-box"></div>
          <div class="stack" style="max-width:360px">
            <p class="hint">A recent, well-lit headshot facing the camera. It's shown on your card in search.</p>
            <label class="btn upload">Upload main photo<input type="file" accept="image/*" id="avatar-input"></label>
          </div>
        </div>
      </section>

      <form id="artist-form" class="stack">
        <section class="form-section form">
          <h2>About you</h2>
          <div class="grid-2">
            <div class="field"><label for="stage_name">Professional name</label><input id="stage_name" name="stage_name" type="text" required maxlength="80" value="${a.stage_name}"></div>
            <div class="field"><label for="full_name">Full name</label><input id="full_name" name="full_name" type="text" maxlength="120" value="${state.profile.full_name}">
              <p class="hint">Not shown on your public profile. Signed-in members can see it, for example in messages.</p></div>
          </div>
          <div class="field"><label for="headline">Headline</label><input id="headline" name="headline" type="text" maxlength="120" value="${a.headline}" placeholder="e.g. Bilingual actor and TV presenter"></div>
          <div class="field"><span class="label">I work as</span>${checks('artist_types', ARTIST_TYPES, a.artist_types)}</div>
          <div class="field"><label for="bio">Biography</label><textarea id="bio" name="bio" maxlength="3000" rows="6" placeholder="Training, notable work, what you're looking for">${a.bio}</textarea></div>
        </section>

        <section class="form-section form">
          <h2>Casting details</h2>
          <div class="grid-3">
            <div class="field"><label for="location">District</label><select id="location" name="location">${options(DISTRICTS, a.location, 'Choose a district')}</select></div>
            <div class="field"><label for="gender">Gender</label><select id="gender" name="gender">${options(GENDERS, a.gender, 'Choose')}</select></div>
            <div class="field"><label for="height_cm">Height (cm)</label><input id="height_cm" name="height_cm" type="number" min="50" max="250" value="${a.height_cm ?? ''}"></div>
          </div>
          <div class="grid-3">
            <div class="field"><label for="age_min">Playing age from</label><input id="age_min" name="playing_age_min" type="number" min="10" max="100" value="${a.playing_age_min ?? ''}"></div>
            <div class="field"><label for="age_max">Playing age to</label><input id="age_max" name="playing_age_max" type="number" min="10" max="100" value="${a.playing_age_max ?? ''}"></div>
            <div class="field"><label for="experience_level">Experience</label><select id="experience_level" name="experience_level">${options(EXPERIENCE, a.experience_level)}</select></div>
          </div>
          <p class="hint" style="margin-top:-6px">Playing age is the range you can convincingly portray on screen, not your actual age.</p>
          <div class="field"><span class="label">Languages you can perform in</span>${checks('languages', LANGUAGES, a.languages)}</div>
          <div class="field"><label for="skills">Skills</label><input id="skills" name="skills" type="text" value="${(a.skills || []).join(', ')}" placeholder="e.g. kandyan dance, horse riding, stunt work, singing">
            <p class="hint">Separate skills with commas. Up to 25.</p></div>
          <div class="field"><label for="availability">Availability</label><select id="availability" name="availability">${options(AVAILABILITY, a.availability)}</select></div>
        </section>

        <section class="form-section form">
          <h2>Showreel and links</h2>
          <div class="field"><label for="showreel_url">Showreel link</label><input id="showreel_url" name="showreel_url" type="url" value="${a.showreel_url}" placeholder="YouTube or Vimeo link">
            <p class="hint">YouTube and Vimeo links play directly on your profile.</p></div>
          <div class="grid-2">${SOCIALS.map(s => html`<div class="field"><label for="social_${s.key}">${s.label}</label>
            <input id="social_${s.key}" name="social_${s.key}" type="url" value="${a.social_links?.[s.key] || ''}"></div>`)}</div>
        </section>

        <section class="form-section form">
          <h2>Credits</h2>
          <p class="hint">Productions you've appeared in, newest first.</p>
          <div id="credits" class="stack">${(a.credits || []).map(creditRow)}</div>
          <div><button type="button" class="btn btn-sm" id="add-credit">Add a credit</button></div>
        </section>

        <section class="form-section form">
          <h2>Visibility</h2>
          <label class="toggle"><input type="checkbox" name="is_public"${a.is_public ? raw(' checked') : ''}>
            <span><b>Show my profile in search.</b> When off, only recruiters you've applied to can see it.</span></label>
        </section>

        <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">Save profile</button></div>
      </form>

      <section class="form-section">
        <div class="panel-head"><h2>Portfolio photos</h2><span class="meta" id="photo-count"></span></div>
        <p class="hint">Up to ${MAX_PHOTOS} photos. Mix headshots, full-length and character shots. Large photos are resized automatically.</p>
        <div class="photo-grid" id="photo-grid" style="margin:14px 0"></div>
        <label class="btn upload" id="photo-upload-label">Add photos<input type="file" accept="image/*" multiple id="photo-input"></label>
      </section>
    </div>`);

  const renderAvatar = path => {
    const url = publicUrl(path);
    mount($('#avatar-box', root), url ? html`<img src="${url}" alt="Your main photo">` : html`<span class="initials" aria-hidden="true">${initials(a.stage_name)}</span>`);
  };
  const renderPhotos = () => {
    mount($('#photo-count', root), `${photos.length} of ${MAX_PHOTOS}`);
    mount($('#photo-grid', root), photos.length ? photos.map(p => html`<div class="photo-tile">
      <img src="${publicUrl(p.path)}" alt="" loading="lazy">
      <button type="button" class="btn btn-sm btn-danger" data-del-photo="${p.id}">Delete</button></div>`)
      : html`<p class="muted">No portfolio photos yet.</p>`);
    $('#photo-upload-label', root).hidden = photos.length >= MAX_PHOTOS;
  };
  renderAvatar(a.avatar_path);
  renderPhotos();

  // Credits rows
  $('#add-credit', root).addEventListener('click', () => {
    const box = $('#credits', root);
    if (box.children.length >= 30) { toast('You can list up to 30 credits.', 'error'); return; }
    box.insertAdjacentHTML('beforeend', creditRow().s);
    box.lastElementChild.querySelector('input').focus();
  });
  $('#credits', root).addEventListener('click', e => {
    if (e.target.closest('[data-remove-credit]')) e.target.closest('.credit-row').remove();
  });

  // Main photo
  $('#avatar-input', root).addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const label = e.target.closest('label');
    label.setAttribute('aria-busy', 'true');
    try {
      const blob = await compressImage(file, 1000);
      const path = `${me}/avatar-${Date.now()}.jpg`;
      must(await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' }));
      must(await sb.from('artist_profiles').update({ avatar_path: path }).eq('user_id', me));
      if (a.avatar_path) await sb.storage.from(BUCKET).remove([a.avatar_path]);
      a.avatar_path = path;
      renderAvatar(path);
      toast('Main photo updated.', 'success');
    } catch (err) { toast(errMsg(err), 'error'); } finally { label.removeAttribute('aria-busy'); }
  });

  // Portfolio photos
  $('#photo-input', root).addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) toast(`Only ${room} more ${room === 1 ? 'photo fits' : 'photos fit'}. Uploading the first ${room}.`);
    const label = e.target.closest('label');
    label.setAttribute('aria-busy', 'true');
    let added = 0;
    for (const file of files.slice(0, room)) {
      try {
        const blob = await compressImage(file, 1600);
        const path = `${me}/photos/${crypto.randomUUID()}.jpg`;
        must(await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' }));
        const row = must(await sb.from('artist_photos').insert({ user_id: me, path }).select().single());
        photos.push(row);
        added++;
        renderPhotos();
      } catch (err) { toast(`${file.name}: ${errMsg(err)}`, 'error'); }
    }
    label.removeAttribute('aria-busy');
    if (added) toast(`${added} ${added === 1 ? 'photo' : 'photos'} added.`, 'success');
  });
  $('#photo-grid', root).addEventListener('click', async e => {
    const btn = e.target.closest('[data-del-photo]');
    if (!btn || !confirm('Delete this photo?')) return;
    const p = photos.find(x => x.id === btn.dataset.delPhoto);
    try {
      await busy(btn, async () => {
        must(await sb.from('artist_photos').delete().eq('id', p.id));
        await sb.storage.from(BUCKET).remove([p.path]);
      });
      photos = photos.filter(x => x.id !== p.id);
      renderPhotos();
    } catch (err) { toast(errMsg(err), 'error'); }
  });

  // Save details
  $('#artist-form', root).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const num = k => { const v = String(fd.get(k) ?? '').trim(); return v === '' ? null : Number(v); };
    const min = num('playing_age_min');
    const max = num('playing_age_max');
    if (min && max && min > max) { toast('Playing age "from" must be lower than "to".', 'error'); return; }

    const links = {};
    for (const s of SOCIALS) {
      const rawV = String(fd.get(`social_${s.key}`) || '').trim();
      if (!rawV) continue;
      const u = safeUrl(rawV);
      if (!u) { toast(`The ${s.label} link isn't a valid web address.`, 'error'); return; }
      links[s.key] = u;
    }
    const reelRaw = String(fd.get('showreel_url') || '').trim();
    const reel = safeUrl(reelRaw);
    if (reelRaw && !reel) { toast('The showreel link isn\'t a valid web address.', 'error'); return; }

    const titles = fd.getAll('credit_title');
    const roles = fd.getAll('credit_role');
    const years = fd.getAll('credit_year');
    const types = fd.getAll('credit_type');
    const credits = titles.map((t, i) => ({
      title: String(t).trim(), role: String(roles[i]).trim(), year: String(years[i]).trim(), type: String(types[i]).trim(),
    })).filter(c => c.title);

    const skills = [...new Set(String(fd.get('skills') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean))].slice(0, 25);

    const update = {
      stage_name: String(fd.get('stage_name')).trim(),
      headline: String(fd.get('headline') || '').trim(),
      artist_types: fd.getAll('artist_types'),
      bio: String(fd.get('bio') || '').trim(),
      location: fd.get('location') || '',
      gender: fd.get('gender') || '',
      height_cm: num('height_cm'),
      playing_age_min: min,
      playing_age_max: max,
      languages: fd.getAll('languages'),
      skills,
      experience_level: fd.get('experience_level'),
      availability: fd.get('availability'),
      showreel_url: reel,
      social_links: links,
      credits,
      is_public: fd.get('is_public') === 'on',
    };
    try {
      await busy(e.submitter, async () => {
        must(await sb.from('artist_profiles').update(update).eq('user_id', me));
        const fullName = String(fd.get('full_name') || '').trim();
        if (fullName !== state.profile.full_name) {
          must(await sb.from('profiles').update({ full_name: fullName }).eq('id', me));
          await loadProfile();
        }
      });
      toast('Profile saved.', 'success');
      if (a.status === 'rejected') edit(root);
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}

async function recruiterEdit(root) {
  const me = uid();
  const { data: r } = await sb.from('recruiter_profiles').select('*').eq('user_id', me).maybeSingle();
  if (!r) { mount(root, html`<p>Profile not found.</p>`); return; }
  mount(root, html`
    <div class="page-head"><div><h1>My recruiter profile</h1><p>Artists see this when you contact them or post a casting call.</p></div></div>
    ${r.verified
      ? html`<div class="notice notice-ok"><p><b>You're a verified recruiter.</b> Your public projects and open casting calls are visible to artists.</p></div>`
      : html`<div class="notice notice-warn"><p><b>Verification pending.</b> You can search artists, create projects and draft casting calls now. Calls become public once we verify you, usually after a short call or email check. Filling in your organisation and website helps.</p></div>`}
    <form class="form form-section" id="rec-form">
      <div class="grid-2">
        <div class="field"><label for="full_name">Your name</label><input id="full_name" name="full_name" type="text" required maxlength="120" value="${state.profile.full_name}"></div>
        <div class="field"><label for="position">Your role</label><input id="position" name="position" type="text" maxlength="80" value="${r.position}" placeholder="e.g. Casting director"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="organisation">Organisation</label><input id="organisation" name="organisation" type="text" maxlength="120" value="${r.organisation}" placeholder="Production company, agency or studio"></div>
        <div class="field"><label for="website">Website or page</label><input id="website" name="website" type="url" value="${r.website}"></div>
      </div>
      <div class="field"><label for="company_info">About your organisation</label>
        <textarea id="company_info" name="company_info" maxlength="2000" placeholder="What you produce and notable work">${r.company_info}</textarea></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Save profile</button></div>
    </form>`);
  $('#rec-form', root).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const siteRaw = String(fd.get('website') || '').trim();
    const site = safeUrl(siteRaw);
    if (siteRaw && !site) { toast('The website isn\'t a valid web address.', 'error'); return; }
    try {
      await busy(e.submitter, async () => {
        must(await sb.from('recruiter_profiles').update({
          organisation: String(fd.get('organisation') || '').trim(), position: String(fd.get('position') || '').trim(),
          company_info: String(fd.get('company_info') || '').trim(), website: site,
        }).eq('user_id', me));
        must(await sb.from('profiles').update({ full_name: String(fd.get('full_name')).trim() }).eq('id', me));
        await loadProfile();
      });
      toast('Profile saved.', 'success');
    } catch (err) { toast(errMsg(err), 'error'); }
  });
}
