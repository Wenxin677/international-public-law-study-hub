-- ============================================================================
-- RoboCL — the study site's database (Supabase / PostgreSQL)
-- Run once: Supabase → SQL Editor → New query → paste all of this → Run.
-- Safe to run again later (it replaces functions and leaves your data alone).
--
-- WHAT THIS CREATES
--   Tables
--     robo_accounts  one row per person: username, bcrypt password hash, created,
--                    last sign-in, sign-in count, failed attempts, language,
--                    is_admin (only you).
--     robo_events    the log: signup / signin / signin_failed / signin_locked /
--                    signout / admin_view / admin_denied, with time, device and
--                    browser. This is the "who used the site" history.
--     robo_sessions  one row per signed-in browser. The browser keeps a long
--                    random token; only its SHA-256 hash is stored here, so a
--                    copy of this table cannot be used to sign in.
--     robo_progress  per person, per lesson: studied?, best quiz score, attempts,
--                    when. This is what makes progress follow a student from
--                    their phone to a laptop.
--     robo_notes     per person, per lesson: their own study notes.
--   Relationships (foreign keys)
--     robo_sessions.user_id, robo_progress.user_id, robo_notes.user_id
--       → robo_accounts.id   ON DELETE CASCADE  (delete an account and its
--                            sessions, progress and notes go with it)
--     robo_progress / robo_notes primary key = (user_id, lesson_id), so one row
--       per person per lesson — a repeat visit updates, never duplicates.
--   Functions (the only way in — see the security model below)
--     sign-up / sign-in / sign-out, session check,
--     progress get + save, notes get + save,
--     owner views: account list and class progress.
--
-- SECURITY MODEL (please read — this is why it is safe to publish the site)
--   · Every table has Row Level Security ON with NO policies, and the public role
--     (anon — the key that ships inside the website) has every privilege
--     REVOKED. So the browser cannot read or write any table directly: no
--     password hash and no other student's work can be pulled out of the site.
--   · "Users can only reach their own data" is enforced inside the functions:
--     each one looks the caller up by their session token and then filters by
--     that user id. A token is 32 random bytes; only its hash is stored. There
--     is no way to ask for another person's rows — the function never takes a
--     username from the caller.
--   · Passwords are bcrypt (pgcrypto crypt/gen_salt) — not reversible by anyone,
--     including you. A lost password can be reset, never recovered.
--   · Brute force is throttled: 8 failed attempts for a username within 15
--     minutes lock that username until the window passes. The owner list has the
--     same throttle.
--   · The owner views need an is_admin account AND that account's real password,
--     so no secret is published in the site's source.
--
-- AFTER RUNNING THIS
--   1. sign up in the app with the username that should be the owner
--   2. run once with your own name:
--        update robo_accounts set is_admin = true where username_lower = 'yourname';
--
-- HOW TO CHECK WHAT IS IN HERE
--   Easiest: the website's admin.html → sign in with your owner username and
--            password → "Load every account from the database" (and the class
--            progress table). CSV export is there too.
--   Raw:     Table editor → pick a table. Or SQL editor with the queries at the
--            bottom of this file.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- accounts
create table if not exists public.robo_accounts (
  id             bigint generated always as identity primary key,
  username       text        not null,
  username_lower text        generated always as (lower(btrim(username))) stored,
  pwhash         text        not null,                       -- bcrypt, never plaintext
  created_at     timestamptz not null default now(),
  last_login     timestamptz,
  logins         integer     not null default 0,
  failed         integer     not null default 0,
  lang           text        default 'km',
  is_admin       boolean     not null default false,
  constraint robo_accounts_username_key unique (username_lower),
  constraint robo_accounts_username_shape check (username ~ '^[A-Za-z0-9_.]{3,20}$')
);

-- ----------------------------------------------------------------- events
create table if not exists public.robo_events (
  id         bigint generated always as identity primary key,
  username   text,
  type       text not null,   -- signup | signin | signin_failed | signin_locked
                              -- | signout | admin_view | admin_denied
  device     text,
  user_agent text,
  lang       text,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists robo_events_created_idx on public.robo_events (created_at desc);
create index if not exists robo_events_user_idx    on public.robo_events (lower(username), type, created_at desc);

-- ----------------------------------------------------------------- sessions
create table if not exists public.robo_sessions (
  id         bigint generated always as identity primary key,
  user_id    bigint      not null references public.robo_accounts (id) on delete cascade,
  token_hash text        not null unique,        -- sha256 of the browser's token
  device     text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked    boolean     not null default false
);
create index if not exists robo_sessions_user_idx on public.robo_sessions (user_id);

-- ----------------------------------------------------------------- progress
create table if not exists public.robo_progress (
  user_id    bigint      not null references public.robo_accounts (id) on delete cascade,
  lesson_id  text        not null,               -- e.g. 'ch3-l2'
  studied    boolean     not null default false,
  quiz_best  integer,                            -- best correct answers so far
  quiz_total integer,                            -- how many questions that quiz had
  attempts   integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists robo_progress_user_idx on public.robo_progress (user_id);

-- ----------------------------------------------------------------- notes
create table if not exists public.robo_notes (
  user_id    bigint      not null references public.robo_accounts (id) on delete cascade,
  lesson_id  text        not null,
  body       text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists robo_notes_user_idx on public.robo_notes (user_id);

-- ----------------------------------------------------------------- locked down
alter table public.robo_accounts enable row level security;
alter table public.robo_events   enable row level security;
alter table public.robo_sessions enable row level security;
alter table public.robo_progress enable row level security;
alter table public.robo_notes    enable row level security;
-- deliberately no policies: the tables are unreachable from the browser, and
-- per-user access happens inside the functions below, by session token.

-- ----------------------------------------------------------------- helpers
-- (not granted to the public role: only the functions below use them)
create or replace function public.robo_token_hash(p_token text)
returns text language sql immutable as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.robo_uid_for_token(p_token text)
returns bigint
language sql security definer set search_path = public, extensions stable as $$
  select s.user_id
    from public.robo_sessions s
   where s.token_hash = public.robo_token_hash(p_token)
     and not s.revoked
     and s.expires_at > now()
   limit 1
$$;

create or replace function public.robo_new_session(p_user_id bigint, p_device text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(32), 'hex');
begin
  insert into robo_sessions (user_id, token_hash, device)
  values (p_user_id, public.robo_token_hash(v_token), coalesce(p_device, 'web'));
  return v_token;                     -- handed to the browser once; only its hash is kept
end $$;

-- ----------------------------------------------------------------- sign up
create or replace function public.robo_signup(
  p_username text,
  p_password text,
  p_lang     text default 'km',
  p_device   text default 'web',
  p_ua       text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text := btrim(coalesce(p_username, ''));
  v_id   bigint;
  v_tok  text;
begin
  if v_name !~ '^[A-Za-z0-9_.]{3,20}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_username');
  end if;
  if p_password is null or length(p_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'bad_password');
  end if;
  if exists (select 1 from robo_accounts where username_lower = lower(v_name)) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;

  insert into robo_accounts (username, pwhash, lang, logins, last_login)
  values (v_name, crypt(p_password, gen_salt('bf', 10)), coalesce(p_lang, 'km'), 1, now())
  returning id into v_id;

  insert into robo_events (username, type, device, user_agent, lang)
  values (v_name, 'signup', coalesce(p_device, 'web'), p_ua, coalesce(p_lang, 'km'));

  v_tok := public.robo_new_session(v_id, p_device);
  return jsonb_build_object('ok', true, 'username', v_name, 'id', v_id, 'token', v_tok,
                            'expires_days', 14);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'taken');
end $$;

-- ----------------------------------------------------------------- sign in
create or replace function public.robo_login(
  p_username text,
  p_password text,
  p_device   text default 'web',
  p_ua       text default null,
  p_lang     text default 'km'
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name   text := btrim(coalesce(p_username, ''));
  v_fails  integer;
  r        robo_accounts;
begin
  -- brute-force guard, checked before anything else so it also slows down
  -- guessing at usernames that do not exist
  select count(*) into v_fails
    from robo_events
   where lower(username) = lower(v_name)
     and type = 'signin_failed'
     and created_at > now() - interval '15 minutes';

  if v_fails >= 8 then
    insert into robo_events (username, type, device, user_agent, lang, reason)
    values (v_name, 'signin_locked', coalesce(p_device, 'web'), p_ua, coalesce(p_lang, 'km'), 'too_many_attempts');
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  select * into r from robo_accounts where username_lower = lower(v_name);

  if not found then
    insert into robo_events (username, type, device, user_agent, lang, reason)
    values (v_name, 'signin_failed', coalesce(p_device, 'web'), p_ua, coalesce(p_lang, 'km'), 'no_account');
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;

  if r.pwhash = crypt(p_password, r.pwhash) then
    update robo_accounts
       set last_login = now(), logins = logins + 1, lang = coalesce(p_lang, lang), failed = 0
     where id = r.id;
    insert into robo_events (username, type, device, user_agent, lang)
    values (r.username, 'signin', coalesce(p_device, 'web'), p_ua, coalesce(p_lang, 'km'));
    return jsonb_build_object('ok', true, 'username', r.username, 'logins', r.logins + 1,
                              'created', r.created_at, 'last_login', now(), 'admin', r.is_admin,
                              'token', public.robo_new_session(r.id, p_device), 'expires_days', 14);
  end if;

  update robo_accounts set failed = failed + 1 where id = r.id;
  insert into robo_events (username, type, device, user_agent, lang, reason)
  values (r.username, 'signin_failed', coalesce(p_device, 'web'), p_ua, coalesce(p_lang, 'km'), 'bad_password');
  return jsonb_build_object('ok', false, 'error', 'bad_credentials');
end $$;

-- ----------------------------------------------------------------- sign out
-- changed signature: the token is what actually ends the session (drop the old one)
drop function if exists public.robo_logout(text, text);
create or replace function public.robo_logout(
  p_username text,
  p_token    text default null,
  p_device   text default 'web'
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_token is not null then
    update robo_sessions set revoked = true
     where token_hash = public.robo_token_hash(p_token) and not revoked;
  end if;
  insert into robo_events (username, type, device)
  values (btrim(coalesce(p_username, '')), 'signout', coalesce(p_device, 'web'));
  return jsonb_build_object('ok', true);
end $$;

-- ----------------------------------------------------------------- session check
-- the site calls this on load to confirm the stored token is still good
create or replace function public.robo_session_check(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r robo_accounts;
begin
  select a.* into r
    from robo_accounts a
   where a.id = public.robo_uid_for_token(p_token);

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  return jsonb_build_object('ok', true, 'username', r.username, 'admin', r.is_admin,
                            'lang', r.lang, 'created', r.created_at, 'last_login', r.last_login);
end $$;

-- ----------------------------------------------------------------- progress
create or replace function public.robo_progress_get(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid bigint := public.robo_uid_for_token(p_token);
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  return jsonb_build_object('ok', true, 'progress', coalesce((
    select jsonb_agg(jsonb_build_object(
             'lesson',   p.lesson_id,
             'studied',  p.studied,
             'best',     p.quiz_best,
             'total',    p.quiz_total,
             'attempts', p.attempts,
             'updated',  p.updated_at) order by p.lesson_id)
      from robo_progress p where p.user_id = v_uid), '[]'::jsonb));
end $$;

-- one call does both "mark studied" and "save a quiz result"; only this user's row
create or replace function public.robo_progress_put(
  p_token    text,
  p_lesson   text,
  p_studied  boolean default null,
  p_best     integer default null,
  p_total    integer default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  bigint := public.robo_uid_for_token(p_token);
  v_les  text   := btrim(coalesce(p_lesson, ''));
  v_row  robo_progress;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  if v_les = '' or length(v_les) > 40 then
    return jsonb_build_object('ok', false, 'error', 'bad_lesson');
  end if;

  insert into robo_progress as t (user_id, lesson_id, studied, quiz_best, quiz_total, attempts, updated_at)
  values (v_uid, v_les, coalesce(p_studied, false), p_best, p_total,
          case when p_best is null then 0 else 1 end, now())
  on conflict (user_id, lesson_id) do update
     set studied    = coalesce(p_studied, t.studied),
         -- keep the best score, never let a worse run overwrite a better one
         quiz_best  = greatest(coalesce(p_best, t.quiz_best), coalesce(t.quiz_best, p_best)),
         quiz_total = coalesce(p_total, t.quiz_total),
         attempts   = t.attempts + case when p_best is null then 0 else 1 end,
         updated_at = now()
  returning * into v_row;

  return jsonb_build_object('ok', true, 'lesson', v_row.lesson_id, 'studied', v_row.studied,
                            'best', v_row.quiz_best, 'total', v_row.quiz_total,
                            'attempts', v_row.attempts, 'updated', v_row.updated_at);
end $$;

-- ----------------------------------------------------------------- notes
create or replace function public.robo_notes_get(p_token text, p_lesson text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid bigint := public.robo_uid_for_token(p_token);
  v_les text   := nullif(btrim(coalesce(p_lesson, '')), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  return jsonb_build_object('ok', true, 'notes', coalesce((
    select jsonb_agg(jsonb_build_object('lesson', n.lesson_id, 'body', n.body, 'updated', n.updated_at)
                     order by n.lesson_id)
      from robo_notes n
     where n.user_id = v_uid and (v_les is null or n.lesson_id = v_les)), '[]'::jsonb));
end $$;

create or replace function public.robo_notes_put(p_token text, p_lesson text, p_body text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  bigint := public.robo_uid_for_token(p_token);
  v_les  text   := btrim(coalesce(p_lesson, ''));
  v_body text   := left(coalesce(p_body, ''), 20000);   -- 20k characters is plenty
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  if v_les = '' or length(v_les) > 40 then
    return jsonb_build_object('ok', false, 'error', 'bad_lesson');
  end if;
  insert into robo_notes as t (user_id, lesson_id, body, updated_at)
  values (v_uid, v_les, v_body, now())
  on conflict (user_id, lesson_id) do update set body = excluded.body, updated_at = now();
  return jsonb_build_object('ok', true, 'lesson', v_les, 'length', length(v_body));
end $$;

-- ----------------------------------------------------------------- owner views
-- Requires an is_admin account AND its real password, so nothing secret lives in
-- the website source. Returns usernames and activity — never a password hash.
-- (a changed signature would otherwise create an overload and leave the old,
--  unthrottled version callable, so drop it first)
drop function if exists public.robo_admin_accounts(text);
drop index if exists public.robo_events_user_idx;

create or replace function public.robo_admin_accounts(
  p_username text,
  p_password text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text := btrim(coalesce(p_username, ''));
  r      robo_accounts;
begin
  -- same throttle as sign-in: this is the other anonymous password check
  if (select count(*) from robo_events
        where lower(username) = lower(v_name)
          and type = 'admin_denied'
          and created_at > now() - interval '15 minutes') >= 8 then
    insert into robo_events (username, type, reason) values (v_name, 'admin_denied', 'locked');
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  select * into r from robo_accounts where username_lower = lower(v_name);

  if not found or not r.is_admin or r.pwhash <> crypt(coalesce(p_password, ''), r.pwhash) then
    -- do not say which of the three failed, but do record the attempt
    insert into robo_events (username, type, reason) values (v_name, 'admin_denied', 'forbidden');
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into robo_events (username, type, reason) values (r.username, 'admin_view', 'account list');

  return jsonb_build_object(
    'ok', true,
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'username',   a.username,
               'created',    a.created_at,
               'last_login', a.last_login,
               'logins',     a.logins,
               'failed',     a.failed,
               'lang',       a.lang,
               'admin',      a.is_admin,
               'studied',    (select count(*) from robo_progress p where p.user_id = a.id and p.studied),
               'quizzes',    (select count(*) from robo_progress p where p.user_id = a.id and p.quiz_best is not null),
               'notes',      (select count(*) from robo_notes n where n.user_id = a.id and n.body <> ''))
               order by a.created_at desc)
        from robo_accounts a), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'username',   e.username,
               'type',       e.type,
               'device',     e.device,
               'created',    e.created_at,
               'reason',     e.reason) order by e.created_at desc)
        from (select * from robo_events order by created_at desc limit 300) e), '[]'::jsonb));
end $$;

-- the class picture: who is actually studying, and how they are scoring
create or replace function public.robo_admin_progress(
  p_username text,
  p_password text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text := btrim(coalesce(p_username, ''));
  r      robo_accounts;
begin
  if (select count(*) from robo_events
        where lower(username) = lower(v_name)
          and type = 'admin_denied'
          and created_at > now() - interval '15 minutes') >= 8 then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  select * into r from robo_accounts where username_lower = lower(v_name);
  if not found or not r.is_admin or r.pwhash <> crypt(coalesce(p_password, ''), r.pwhash) then
    insert into robo_events (username, type, reason) values (v_name, 'admin_denied', 'forbidden');
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into robo_events (username, type, reason) values (r.username, 'admin_view', 'class progress');

  return jsonb_build_object('ok', true, 'students', coalesce((
    select jsonb_agg(jsonb_build_object(
             'username',     a.username,
             'last_login',   a.last_login,
             'studied',      coalesce(p.studied, 0),
             'quizzes',      coalesce(p.quizzes, 0),
             'answered',     coalesce(p.answered, 0),
             'correct',      coalesce(p.correct, 0),
             'percent',      case when coalesce(p.answered, 0) > 0
                                  then round(100.0 * coalesce(p.correct,0) / p.answered) end,
             'last_study',   p.last_update)
             order by coalesce(p.studied, 0) desc, a.username)
      from robo_accounts a
      left join (
        select user_id,
               count(*) filter (where studied)                            as studied,
               count(*) filter (where quiz_best is not null)              as quizzes,
               sum(quiz_total)                                            as answered,
               sum(quiz_best)                                             as correct,
               max(updated_at)                                            as last_update
          from robo_progress group by user_id) p on p.user_id = a.id), '[]'::jsonb));
end $$;

-- housekeeping: drop sessions that have expired or been signed out
create or replace function public.robo_session_purge()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  delete from robo_sessions where revoked or expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ----------------------------------------------------------------- permissions
-- the browser (anon role) may call these functions and nothing else
grant usage on schema public to anon;
grant execute on function public.robo_signup(text, text, text, text, text) to anon;
grant execute on function public.robo_login(text, text, text, text, text) to anon;
grant execute on function public.robo_logout(text, text, text) to anon;
grant execute on function public.robo_session_check(text) to anon;
grant execute on function public.robo_progress_get(text) to anon;
grant execute on function public.robo_progress_put(text, text, boolean, integer, integer) to anon;
grant execute on function public.robo_notes_get(text, text) to anon;
grant execute on function public.robo_notes_put(text, text, text) to anon;
grant execute on function public.robo_admin_accounts(text, text) to anon;
grant execute on function public.robo_admin_progress(text, text) to anon;

revoke all on public.robo_accounts from anon, authenticated;
revoke all on public.robo_events   from anon, authenticated;
revoke all on public.robo_sessions from anon, authenticated;
revoke all on public.robo_progress from anon, authenticated;
revoke all on public.robo_notes    from anon, authenticated;
revoke execute on function public.robo_token_hash(text) from anon, authenticated;
revoke execute on function public.robo_uid_for_token(text) from anon, authenticated;
revoke execute on function public.robo_new_session(bigint, text) from anon, authenticated;
revoke execute on function public.robo_session_purge() from anon, authenticated;

-- ============================================================================
-- Queries for you (SQL editor — you are the owner, so you can read the tables)
--
--   make yourself the owner:
--     update robo_accounts set is_admin = true where username_lower = 'yourname';
--
--   everyone, newest first:
--     select username, created_at, last_login, logins, failed, is_admin
--     from robo_accounts order by created_at desc;
--
--   who signed in today:
--     select username, device, created_at from robo_events
--     where type = 'signin' and created_at > current_date order by created_at desc;
--
--   how each student is doing:
--     select a.username, count(*) filter (where p.studied) as lessons_studied,
--            sum(p.quiz_best) as correct, sum(p.quiz_total) as answered,
--            round(100.0 * sum(p.quiz_best) / nullif(sum(p.quiz_total),0)) as percent,
--            max(p.updated_at) as last_study
--     from robo_accounts a left join robo_progress p on p.user_id = a.id
--     group by a.username order by lessons_studied desc;
--
--   one student's progress rows:
--     select p.* from robo_progress p
--     join robo_accounts a on a.id = p.user_id where a.username_lower = 'theirname'
--     order by p.lesson_id;
--
--   one student's notes:
--     select n.lesson_id, n.body, n.updated_at from robo_notes n
--     join robo_accounts a on a.id = n.user_id where a.username_lower = 'theirname';
--
--   delete one account (their sessions, progress and notes go too — cascade):
--     delete from robo_accounts where username_lower = 'theirname';
--
--   anyone currently locked out:
--     select username, count(*) from robo_events
--     where type = 'signin_failed' and created_at > now() - interval '15 minutes'
--     group by username having count(*) >= 8;
--
--   clear a lockout for someone who mistyped:
--     delete from robo_events where lower(username) = lower('theirname')
--       and type in ('signin_failed','signin_locked');
--
--   reset a password for someone (they then use the new one):
--     update robo_accounts set pwhash = crypt('newpassword', gen_salt('bf', 10)),
--            failed = 0 where username_lower = lower('theirname');
--
--   tidy the session table:
--     select robo_session_purge();
--
--   download for a spreadsheet:
--     Table editor → robo_accounts → Export → CSV
-- ============================================================================
