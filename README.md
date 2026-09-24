# Xposure Artist Connect

A mobile-first casting platform for Sri Lanka: artists build portfolios, recruiters create projects, characters and casting calls, review applications, shortlist and message talent.

It runs for **$0/month** at the start:

| Piece | Service | Cost |
|---|---|---|
| Website (HTML/CSS/JS, installable PWA) | GitHub Pages | Free |
| Database, logins, photo storage, security rules | Supabase free tier | Free |
| Keeping the database awake | GitHub Actions (`.github/workflows/keepalive.yml`) | Free |

There is no build step. The site is plain HTML + JavaScript modules, so you edit a file, push, and it's live.

---

## 1. Create the backend (Supabase, ~10 minutes)

1. Sign up at <https://supabase.com> and create a **new project**. Pick a region close to Sri Lanka (e.g. Singapore / Mumbai). Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**. This creates every table, the security rules (Row Level Security), the notification triggers and the `media` storage bucket for photos.
3. Open **Project Settings → API** and copy:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **anon / publishable key**
4. Paste both into `assets/js/config.js`.
   > The anon key is meant to be public; the database rules decide what each user can do. **Never** paste the `service_role` / secret key into this project.

## 2. Publish the website (GitHub Pages)

1. Create a GitHub repository (e.g. `xposure`) and push the contents of this folder to the `main` branch (the folder containing `index.html` must be the repository root).
2. In the repository: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`** → Save.
3. After a minute your site is live at `https://YOUR-USERNAME.github.io/xposure/`.

## 3. Connect logins to your site

In Supabase: **Authentication → URL Configuration**

- **Site URL:** `https://YOUR-USERNAME.github.io/xposure/`
- **Redirect URLs:** add the same URL, plus `http://localhost:8080/` for local testing.

This is what makes the "confirm your email" and "reset password" links return to your app.

### Email sending (important)

Supabase's built-in email sender is for testing only and sends just a handful of emails per hour. Before inviting real users, either:

- **Recommended:** set up free custom SMTP under **Authentication → Emails → SMTP Settings** using a free tier from a provider such as Resend or Brevo (you'll need a domain you can verify), **or**
- during a small private beta, turn off **Confirm email** under **Authentication → Sign In / Providers → Email** so people can sign in immediately.

## 4. Make yourself the administrator

Sign up on your live site, then run this in the Supabase SQL Editor (with your email):

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Reload the site and an **Admin** link appears. From there you approve artist profiles, verify recruiters and handle reports.

## 5. Keep the free database awake (optional but recommended)

Free Supabase projects pause after about a week with no activity. The included workflow pings it every 3 days. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY`. You can run it manually from the **Actions** tab to test. (GitHub disables scheduled workflows in repositories with no commits for 60 days; re-enable from the Actions tab if that happens.) If the project does pause, just click **Restore** in the Supabase dashboard; no data is lost.

---

## Local development

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Any static server works. Opening `index.html` directly from disk will not work because the app uses JavaScript modules.

**When you deploy an update**, change `VERSION` in `sw.js` (e.g. `xposure-v2`) so installed copies of the app pick up the new files.

---

## How the platform works

**Roles.** At sign-up people choose **Artist** or **Recruiter / casting professional** and confirm they're 18 or older. Admins are flagged manually (step 4).

**Trust & safety (manual, as the plan recommends).**
- New artist profiles are **pending** until an admin approves them. Only approved artists appear in search and can apply.
- Recruiters must be **verified** by an admin before their projects and casting calls become public. This protects artists from fake casting scams.
- The first 300 artists and first 20 recruiters are automatically marked **Founding** members.
- Anyone signed in can **report** a profile, casting call or message; users can **block** each other.

**Main screens** (all URLs are `#/…` so they work on GitHub Pages):

| Plan section | Where it lives |
|---|---|
| Registration, login, password reset, email verification | `#/signup`, `#/login`, `#/reset` |
| Artist profile & portfolio (photo, bio, location, age range, languages, skills, experience, credits, up to 12 photos, showreel, socials, availability) | `#/me` |
| Recruiter profile (organisation, position, company, verification) | `#/me` |
| Talent search with filters (type, age, gender, district, language, skills, experience, availability) | `#/artists` |
| Projects, characters, casting calls | `#/projects`, `#/project/…` |
| Public casting board | `#/castings` |
| Applications with the full status pipeline (Applied → Reviewing → Shortlisted → Audition → Callback → Selected → Confirmed, or Rejected / Withdrawn), self-tape link, message, chosen photos | Artists: `#/applications` · Recruiters: inside each project |
| Private shortlists with notes | `#/shortlists` |
| Messaging | `#/messages` |
| Notifications (new applications, status changes, messages, approvals) | `#/notifications` |
| Admin: approve profiles, verify recruiters, reports, stats | `#/admin` |
| Account: change password, unblock, **download my data**, **delete my account** | `#/account` |

**Media.** Photos are resized in the browser before upload (keeps you well inside the free 1 GB storage). Videos and self-tapes are YouTube/Vimeo/Drive links rather than uploads, because video would exhaust free storage quickly.

**Messaging** checks for new messages every few seconds while a conversation is open. Recruiters can message anyone; artists can message recruiters or reply to people who contacted them.

---

## Free-tier limits to watch

Check <https://supabase.com/pricing> for current numbers. Roughly: 500 MB database, 1 GB file storage, 2 projects, projects pause when inactive. For the milestones in the plan (up to ~1,000 artists with resized photos) this should be enough; the first thing you're likely to outgrow is **storage** or **email sending**. Upgrading Supabase later needs no code changes.

GitHub Pages is free for public repositories. Your code is public; your **data** is not; it lives in Supabase behind the security rules.

## Security notes

- Every table has Row Level Security. Users can only change their own data; recruiters see only applications to their own projects; shortlists and notes are private to their owner; artists' contact details are never shown publicly (contact happens through in-app messaging).
- Portfolio photos are stored in a **public** bucket so they load fast and free. Anyone with a photo's exact URL can view it. Don't put anything in photos that shouldn't be public.
- Users cannot promote themselves to admin, verify themselves or approve their own profile: database triggers block it. You can do these things from the SQL Editor or the admin screen.

## Deliberately not in this first version

These are in the plan but should wait, per its own "build only what users need" principle:

- **Child artists (under 18).** Sign-up is 18+ only. A parent/guardian workflow needs legal and safeguarding review before launch.
- **Terms of Service and Privacy Policy.** You need these before a public launch; have them reviewed for Sri Lankan law (including the Personal Data Protection Act).
- **AI features** (character generator, casting assistant, portfolio assistant, script breakdown). When ready, add them as **Supabase Edge Functions** so the AI API key stays on the server, never in this public website. Add per-user usage limits.
- Production company teams, agencies managing artists, agreements & signing, budgets, auditions scheduling, payments/subscriptions, phone/ID verification, native iOS/Android apps (they can reuse this same Supabase backend).
- Search beyond Postgres filters (OpenSearch etc.) is only worth it at much larger scale.

## Project structure

```
index.html              app shell
manifest.webmanifest    PWA install info
sw.js                   offline cache (bump VERSION on deploy)
assets/css/app.css      design system
assets/js/config.js     ← your Supabase URL + anon key
assets/js/main.js       router, navigation, auth gating
assets/js/views/*.js    one file per area (artists, castings, projects, …)
supabase/schema.sql     database, security rules, triggers, storage
.github/workflows/keepalive.yml
```
