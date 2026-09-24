-- =====================================================================
-- Xposure Artist Connect: database schema for Supabase
-- Run this once in Supabase: Dashboard > SQL Editor > New query > Run.
-- Every table uses Row Level Security, so the public "anon" key in the
-- web app can only do what the policies below allow.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('artist','recruiter')),
  full_name   text not null default '',
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.artist_profiles (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  stage_name        text not null default '',
  headline          text not null default '' check (char_length(headline) <= 120),
  artist_types      text[] not null default '{}',
  bio               text not null default '' check (char_length(bio) <= 3000),
  location          text not null default '',
  gender            text not null default '',
  playing_age_min   int check (playing_age_min between 10 and 100),
  playing_age_max   int check (playing_age_max between 10 and 100),
  height_cm         int check (height_cm between 50 and 250),
  languages         text[] not null default '{}',
  skills            text[] not null default '{}',
  experience_level  text not null default 'emerging'
                    check (experience_level in ('emerging','intermediate','experienced','professional')),
  credits           jsonb not null default '[]'::jsonb,
  showreel_url      text not null default '',
  social_links      jsonb not null default '{}'::jsonb,
  availability      text not null default 'available'
                    check (availability in ('available','limited','unavailable')),
  avatar_path       text not null default '',
  is_public         boolean not null default true,
  status            text not null default 'pending' check (status in ('pending','approved','rejected')),
  founding          boolean not null default false,
  updated_at        timestamptz not null default now(),
  check (playing_age_min is null or playing_age_max is null or playing_age_min <= playing_age_max)
);

create table public.recruiter_profiles (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  organisation  text not null default '',
  position      text not null default '',
  company_info  text not null default '' check (char_length(company_info) <= 2000),
  website       text not null default '',
  verified      boolean not null default false,
  founding      boolean not null default false,
  updated_at    timestamptz not null default now()
);

create table public.artist_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.artist_profiles(user_id) on delete cascade,
  path        text not null,
  caption     text not null default '',
  created_at  timestamptz not null default now(),
  check (split_part(path, '/', 1) = user_id::text)
);

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 140),
  description   text not null default '' check (char_length(description) <= 5000),
  type          text not null default 'Film',
  genre         text not null default '',
  location      text not null default '',
  start_date    date,
  end_date      date,
  status        text not null default 'casting'
                check (status in ('development','casting','in_production','wrapped','cancelled')),
  is_public     boolean not null default true,
  contact_info  text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (start_date is null or end_date is null or start_date <= end_date)
);

create table public.characters (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 100),
  role_type    text not null default 'Supporting',
  age_min      int check (age_min between 0 and 100),
  age_max      int check (age_max between 0 and 100),
  gender       text not null default 'Any',
  languages    text[] not null default '{}',
  skills       text[] not null default '{}',
  description  text not null default '' check (char_length(description) <= 3000),
  created_at   timestamptz not null default now()
);

create table public.casting_calls (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  character_id         uuid references public.characters(id) on delete set null,
  title                text not null check (char_length(title) between 2 and 140),
  requirements         text not null default '',
  location             text not null default '',
  shoot_dates          text not null default '',
  experience_required  text not null default 'any',
  deadline             date,
  audition_type        text not null default 'Self-tape',
  compensation         text not null default '',
  instructions         text not null default '',
  status               text not null default 'open' check (status in ('draft','open','closed')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.applications (
  id               uuid primary key default gen_random_uuid(),
  casting_call_id  uuid not null references public.casting_calls(id) on delete cascade,
  artist_id        uuid not null references public.artist_profiles(user_id) on delete cascade,
  message          text not null default '' check (char_length(message) <= 2000),
  selftape_url     text not null default '',
  status           text not null default 'applied' check (status in
                   ('applied','reviewing','shortlisted','audition','callback','selected','confirmed','rejected','withdrawn')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (casting_call_id, artist_id)
);

create table public.shortlists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 100),
  created_at  timestamptz not null default now()
);

create table public.shortlist_items (
  shortlist_id  uuid not null references public.shortlists(id) on delete cascade,
  artist_id     uuid not null references public.artist_profiles(user_id) on delete cascade,
  note          text not null default '' check (char_length(note) <= 2000),
  created_at    timestamptz not null default now(),
  primary key (shortlist_id, artist_id)
);

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 4000),
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);

create table public.blocks (
  blocker_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid default auth.uid() references public.profiles(id) on delete set null,
  target_type  text not null check (target_type in ('artist','recruiter','project','casting_call','message','user')),
  target_id    uuid not null,
  reason       text not null,
  details      text not null default '' check (char_length(details) <= 2000),
  status       text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  link        text not null default '',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Indexes for search and common lookups
create index artist_profiles_search_idx on public.artist_profiles (status, is_public, updated_at desc);
create index artist_profiles_types_idx  on public.artist_profiles using gin (artist_types);
create index artist_profiles_langs_idx  on public.artist_profiles using gin (languages);
create index artist_profiles_skills_idx on public.artist_profiles using gin (skills);
create index artist_photos_user_idx     on public.artist_photos (user_id);
create index projects_owner_idx         on public.projects (owner_id);
create index characters_project_idx     on public.characters (project_id);
create index casting_calls_project_idx  on public.casting_calls (project_id);
create index casting_calls_open_idx     on public.casting_calls (status, created_at desc);
create index applications_call_idx      on public.applications (casting_call_id);
create index applications_artist_idx    on public.applications (artist_id);
create index shortlists_owner_idx       on public.shortlists (owner_id);
create index messages_recipient_idx     on public.messages (recipient_id, created_at desc);
create index messages_sender_idx        on public.messages (sender_id, created_at desc);
create index notifications_user_idx     on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- HELPER FUNCTIONS (security definer so policies can use them safely)
-- ---------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.owns_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = pid and owner_id = auth.uid());
$$;

create or replace function public.owns_call(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.casting_calls c join public.projects p on p.id = c.project_id
    where c.id = cid and p.owner_id = auth.uid());
$$;

-- A project is "live" when it is public and its owner is a verified recruiter.
create or replace function public.project_is_live(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p join public.recruiter_profiles r on r.user_id = p.owner_id
    where p.id = pid and p.is_public and r.verified);
$$;

create or replace function public.applied_to_call(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.applications where casting_call_id = cid and artist_id = auth.uid());
$$;

create or replace function public.applied_to_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.applications a join public.casting_calls c on c.id = a.casting_call_id
    where c.project_id = pid and a.artist_id = auth.uid());
$$;

-- Can the current user apply to this call right now?
create or replace function public.call_accepting(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.casting_calls c
    where c.id = cid and c.status = 'open'
      and (c.deadline is null or c.deadline >= current_date)
      and public.project_is_live(c.project_id))
  and exists (
    select 1 from public.artist_profiles a
    where a.user_id = auth.uid() and a.status = 'approved');
$$;

-- Who may see an artist profile beyond the public, approved ones.
create or replace function public.can_view_artist(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select aid = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.artist_profiles a
               where a.user_id = aid and a.status = 'approved' and a.is_public)
    or exists (select 1 from public.applications ap
               join public.casting_calls c on c.id = ap.casting_call_id
               join public.projects p on p.id = c.project_id
               where ap.artist_id = aid and p.owner_id = auth.uid())
    or exists (select 1 from public.shortlist_items si
               join public.shortlists s on s.id = si.shortlist_id
               where si.artist_id = aid and s.owner_id = auth.uid());
$$;

-- Messaging rule: recruiters can message anyone; artists can message
-- recruiters, or reply to anyone who has already written to them.
-- Blocks in either direction stop messages.
create or replace function public.can_message(recipient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and recipient <> auth.uid()
    and exists (select 1 from public.profiles where id = recipient)
    and not exists (select 1 from public.blocks
                    where (blocker_id = recipient and blocked_id = auth.uid())
                       or (blocker_id = auth.uid() and blocked_id = recipient))
    and (
      (select role from public.profiles where id = auth.uid()) = 'recruiter'
      or (select role from public.profiles where id = recipient) = 'recruiter'
      or exists (select 1 from public.messages where sender_id = recipient and recipient_id = auth.uid())
    );
$$;

create or replace function public.mark_thread_read(other uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = other and read_at is null;
$$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

create or replace function public.admin_user_emails(ids uuid[])
returns table (id uuid, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select u.id, u.email::text from auth.users u where u.id = any(ids);
end $$;

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------

-- Create profile rows when someone signs up. Adults only in this version.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data->>'role', 'artist');
  fname text := left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120);
begin
  if r not in ('artist','recruiter') then r := 'artist'; end if;
  if coalesce(new.raw_user_meta_data->>'adult_confirmed', 'false') <> 'true' then
    raise exception 'Members must confirm they are 18 or older';
  end if;
  insert into public.profiles (id, role, full_name) values (new.id, r, fname);
  if r = 'artist' then
    insert into public.artist_profiles (user_id, stage_name, founding)
    values (new.id, fname, (select count(*) from public.artist_profiles) < 300);
  else
    insert into public.recruiter_profiles (user_id, founding)
    values (new.id, (select count(*) from public.recruiter_profiles) < 20);
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create trigger casting_calls_updated before update on public.casting_calls
  for each row execute function public.set_updated_at();

-- Members cannot promote themselves. (auth.uid() is null when you run
-- SQL from the dashboard, so admins can still be set there.)
create or replace function public.guard_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_admin := old.is_admin;
    new.id := old.id;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profiles();

create or replace function public.guard_artist_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id := old.user_id;
    new.founding := old.founding;
    -- A rejected profile goes back into the review queue once edited.
    new.status := case when old.status = 'rejected' then 'pending' else old.status end;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger artist_profiles_guard before update on public.artist_profiles
  for each row execute function public.guard_artist_profiles();

create or replace function public.guard_recruiter_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id := old.user_id;
    new.verified := old.verified;
    new.founding := old.founding;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger recruiter_profiles_guard before update on public.recruiter_profiles
  for each row execute function public.guard_recruiter_profiles();

create or replace function public.limit_artist_photos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.artist_photos where user_id = new.user_id) >= 12 then
    raise exception 'You can upload up to 12 portfolio photos';
  end if;
  return new;
end $$;
create trigger artist_photos_limit before insert on public.artist_photos
  for each row execute function public.limit_artist_photos();

create or replace function public.check_call_character() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.character_id is not null and not exists (
    select 1 from public.characters where id = new.character_id and project_id = new.project_id) then
    raise exception 'That character belongs to a different project';
  end if;
  return new;
end $$;
create trigger casting_calls_character before insert or update on public.casting_calls
  for each row execute function public.check_call_character();

-- Artists may only withdraw; recruiters may only move the status.
create or replace function public.guard_applications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;
  if public.owns_call(old.casting_call_id) then
    if old.status = 'withdrawn' then raise exception 'This application was withdrawn by the artist'; end if;
    if new.status = 'withdrawn' then raise exception 'Only the artist can withdraw an application'; end if;
  elsif old.artist_id = auth.uid() then
    if new.status <> 'withdrawn' then raise exception 'Artists can only withdraw an application'; end if;
  else
    raise exception 'Not allowed';
  end if;
  new.casting_call_id := old.casting_call_id;
  new.artist_id := old.artist_id;
  new.message := old.message;
  new.selftape_url := old.selftape_url;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;
create trigger applications_guard before update on public.applications
  for each row execute function public.guard_applications();

-- Notifications ------------------------------------------------------

create or replace function public.status_label(s text) returns text
language sql immutable as $$
  select case s
    when 'applied' then 'Applied' when 'reviewing' then 'Reviewing'
    when 'shortlisted' then 'Shortlisted' when 'audition' then 'Audition'
    when 'callback' then 'Callback' when 'selected' then 'Selected'
    when 'confirmed' then 'Confirmed' when 'rejected' then 'Not selected'
    when 'withdrawn' then 'Withdrawn' else s end;
$$;

create or replace function public.notify_new_application() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select p.owner_id,
         'New application: ' || c.title,
         coalesce(nullif(a.stage_name, ''), 'An artist') || ' applied to ' || p.title,
         '#/project/' || p.id
  from public.casting_calls c
  join public.projects p on p.id = c.project_id
  left join public.artist_profiles a on a.user_id = new.artist_id
  where c.id = new.casting_call_id;
  return new;
end $$;
create trigger applications_notify_insert after insert on public.applications
  for each row execute function public.notify_new_application();

create or replace function public.notify_application_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'withdrawn' then
    insert into public.notifications (user_id, title, body, link)
    select p.owner_id, 'Application withdrawn: ' || c.title,
           coalesce(nullif(a.stage_name, ''), 'An artist') || ' withdrew their application',
           '#/project/' || p.id
    from public.casting_calls c
    join public.projects p on p.id = c.project_id
    left join public.artist_profiles a on a.user_id = new.artist_id
    where c.id = new.casting_call_id;
  else
    insert into public.notifications (user_id, title, body, link)
    select new.artist_id, 'Application update: ' || c.title,
           'Your status is now ' || public.status_label(new.status) || '.',
           '#/applications'
    from public.casting_calls c where c.id = new.casting_call_id;
  end if;
  return new;
end $$;
create trigger applications_notify_update after update of status on public.applications
  for each row execute function public.notify_application_status();

create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  link_to text := '#/messages/' || new.sender_id;
  who text;
begin
  if exists (select 1 from public.notifications
             where user_id = new.recipient_id and link = link_to and read_at is null) then
    return new;
  end if;
  select coalesce(nullif(a.stage_name, ''), nullif(p.full_name, ''), 'a member')
    into who
  from public.profiles p left join public.artist_profiles a on a.user_id = p.id
  where p.id = new.sender_id;
  insert into public.notifications (user_id, title, body, link)
  values (new.recipient_id, 'New message from ' || coalesce(who, 'a member'), left(new.body, 140), link_to);
  return new;
end $$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message();

create or replace function public.notify_artist_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      insert into public.notifications (user_id, title, body, link)
      values (new.user_id, 'Your profile is live',
              'Recruiters can now find you in search, and you can apply to casting calls.', '#/me');
    elsif new.status = 'rejected' then
      insert into public.notifications (user_id, title, body, link)
      values (new.user_id, 'Your profile needs changes',
              'Update your profile and it will go back into the review queue.', '#/me');
    end if;
  end if;
  return new;
end $$;
create trigger artist_profiles_notify after update of status on public.artist_profiles
  for each row execute function public.notify_artist_review();

create or replace function public.notify_recruiter_verified() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verified and not old.verified then
    insert into public.notifications (user_id, title, body, link)
    values (new.user_id, 'Your recruiter account is verified',
            'Your public projects and open casting calls are now visible to artists.', '#/projects');
  end if;
  return new;
end $$;
create trigger recruiter_profiles_notify after update of verified on public.recruiter_profiles
  for each row execute function public.notify_recruiter_verified();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.artist_profiles    enable row level security;
alter table public.recruiter_profiles enable row level security;
alter table public.artist_photos      enable row level security;
alter table public.projects           enable row level security;
alter table public.characters         enable row level security;
alter table public.casting_calls      enable row level security;
alter table public.applications       enable row level security;
alter table public.shortlists         enable row level security;
alter table public.shortlist_items    enable row level security;
alter table public.messages           enable row level security;
alter table public.blocks             enable row level security;
alter table public.reports            enable row level security;
alter table public.notifications      enable row level security;

-- profiles
create policy "profiles readable by members" on public.profiles
  for select to authenticated using (true);
create policy "profiles editable by owner" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- artist_profiles
create policy "artist profiles visible" on public.artist_profiles
  for select using ((status = 'approved' and is_public) or public.can_view_artist(user_id));
create policy "artist profiles editable by owner" on public.artist_profiles
  for update to authenticated using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- recruiter_profiles
create policy "recruiter profiles visible" on public.recruiter_profiles
  for select using (verified or auth.uid() is not null);
create policy "recruiter profiles editable by owner" on public.recruiter_profiles
  for update to authenticated using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- artist_photos
create policy "photos visible with profile" on public.artist_photos
  for select using (public.can_view_artist(user_id));
create policy "photos added by owner" on public.artist_photos
  for insert to authenticated with check (user_id = auth.uid());
create policy "photos edited by owner" on public.artist_photos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "photos removed by owner or admin" on public.artist_photos
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- projects
create policy "projects visible" on public.projects
  for select using (public.project_is_live(id) or owner_id = auth.uid()
                    or public.is_admin() or public.applied_to_project(id));
create policy "recruiters create projects" on public.projects
  for insert to authenticated with check (owner_id = auth.uid() and public.my_role() = 'recruiter');
create policy "owners update projects" on public.projects
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete projects" on public.projects
  for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- characters
create policy "characters visible" on public.characters
  for select using (public.project_is_live(project_id) or public.owns_project(project_id)
                    or public.is_admin() or public.applied_to_project(project_id));
create policy "owners add characters" on public.characters
  for insert to authenticated with check (public.owns_project(project_id));
create policy "owners update characters" on public.characters
  for update to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "owners delete characters" on public.characters
  for delete to authenticated using (public.owns_project(project_id));

-- casting_calls
create policy "casting calls visible" on public.casting_calls
  for select using ((status = 'open' and public.project_is_live(project_id))
                    or public.owns_project(project_id) or public.is_admin()
                    or public.applied_to_call(id));
create policy "owners add casting calls" on public.casting_calls
  for insert to authenticated with check (public.owns_project(project_id));
create policy "owners update casting calls" on public.casting_calls
  for update to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "owners delete casting calls" on public.casting_calls
  for delete to authenticated using (public.owns_project(project_id) or public.is_admin());

-- applications
create policy "applications visible to artist and recruiter" on public.applications
  for select to authenticated using (artist_id = auth.uid() or public.owns_call(casting_call_id) or public.is_admin());
create policy "approved artists apply" on public.applications
  for insert to authenticated with check (artist_id = auth.uid() and status = 'applied'
                                          and public.call_accepting(casting_call_id));
create policy "applications updated by artist or recruiter" on public.applications
  for update to authenticated using (artist_id = auth.uid() or public.owns_call(casting_call_id) or public.is_admin());

-- shortlists
create policy "shortlists visible to owner" on public.shortlists
  for select to authenticated using (owner_id = auth.uid());
create policy "recruiters create shortlists" on public.shortlists
  for insert to authenticated with check (owner_id = auth.uid() and public.my_role() = 'recruiter'
                                          and (project_id is null or public.owns_project(project_id)));
create policy "owners update shortlists" on public.shortlists
  for update to authenticated using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (project_id is null or public.owns_project(project_id)));
create policy "owners delete shortlists" on public.shortlists
  for delete to authenticated using (owner_id = auth.uid());

create policy "shortlist items for owner" on public.shortlist_items
  for all to authenticated
  using (exists (select 1 from public.shortlists s where s.id = shortlist_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shortlists s where s.id = shortlist_id and s.owner_id = auth.uid()));

-- messages
create policy "messages visible to participants" on public.messages
  for select to authenticated using (
    sender_id = auth.uid() or recipient_id = auth.uid()
    or (public.is_admin() and exists (select 1 from public.reports r
                                      where r.target_type = 'message' and r.target_id = messages.id)));
create policy "members send allowed messages" on public.messages
  for insert to authenticated with check (sender_id = auth.uid() and public.can_message(recipient_id));

-- blocks
create policy "blocks for owner" on public.blocks
  for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- reports
create policy "members file reports" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy "reports visible to reporter and admin" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "admins handle reports" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- notifications
create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- STORAGE: one public bucket for photos, each member writes only to
-- their own folder ({user_id}/...). Files are resized in the browser
-- before upload to stay inside the free storage allowance.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "media upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media update own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media list own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
