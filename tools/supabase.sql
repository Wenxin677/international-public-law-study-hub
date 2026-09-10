-- ============================================================================
-- RoboCL — optional cloud collection of sign-ups and sign-ins (Supabase)
-- Run this in your Supabase project: SQL editor → New query → paste → Run.
--
-- What it creates: one table that accepts *inserts only* from the website.
-- The anon key shipped in the site cannot read the table back, so nobody can
-- pull the list of users from the browser — you read it in the Supabase
-- dashboard (Table editor) or export it as CSV from there.
--
-- What is stored: username, event (signup / signin / signout), device, user agent,
-- and the time. Passwords and password hashes are NEVER sent.
-- ============================================================================

create table if not exists public.robo_users (
  id          bigint generated always as identity primary key,
  username    text        not null,
  type        text        not null default 'signup',   -- signup | signin | signin_failed | signout
  device      text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- keep the table tidy and fast
create index if not exists robo_users_created_idx on public.robo_users (created_at desc);
create index if not exists robo_users_username_idx on public.robo_users (lower(username));

alter table public.robo_users enable row level security;

-- allow the website (anon key) to INSERT only
drop policy if exists "robo insert only" on public.robo_users;
create policy "robo insert only"
  on public.robo_users
  for insert
  to anon
  with check (true);

-- no select / update / delete policy → the public site cannot read the data back

-- ---------------------------------------------------------------------------
-- Handy queries for you (run them in the SQL editor):
--
--   all users who ever signed up, newest first:
--     select username, min(created_at) as signed_up, count(*) as events
--     from public.robo_users group by username order by signed_up desc;
--
--   everyone who signed in, with how many times:
--     select username, count(*) as signins
--     from public.robo_users where type = 'signin'
--     group by username order by signins desc;
--
--   CSV export (the dashboard's "Export" button does the same):
--     select username, type, device, created_at from public.robo_users order by created_at desc;
-- ---------------------------------------------------------------------------
