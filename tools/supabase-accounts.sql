-- ============================================================================
-- RoboCL — account database (Supabase / PostgreSQL)
-- Run this once in your Supabase project: SQL editor → New query → paste → Run.
--
-- What you get
--   · robo_accounts — one row per user: username, bcrypt password hash, created,
--     last sign-in, sign-in count, failed attempts, language, is_admin.
--   · robo_events   — every signup / signin / signin_failed / signout / lockout
--     with time, device and browser (the "who used the site" log).
--   · RPC functions the website may call — and nothing else.
--
-- Security model (please read)
--   · Both tables have Row Level Security ON with NO policies, so the browser
--     (which only carries the public anon key) cannot read or write them.
--     No password hash can be pulled from the site.
--   · All access goes through SECURITY DEFINER functions that each do one thing.
--     Passwords are verified inside the database with bcrypt (pgcrypto's
--     crypt/gen_salt) — the stored value is not reversible.
--   · Brute force is throttled: 8 failed attempts for a username within 15
--     minutes locks that username out until the window passes.
--   · The account list is served by robo_admin_accounts, which requires an
--     account flagged is_admin AND that account's real password — so no secret
--     has to be published in the website's source.
--   · Nobody — not you, not anyone with database access — can read a password.
--     A lost password can only be reset, never recovered.
--
-- AFTER RUNNING THIS
--   1. sign up in the app with the username that should be the owner
--   2. run once, with your own name:
--        update robo_accounts set is_admin = true where username_lower = 'yourname';
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
  type       text not null,          -- signup | signin | signin_failed | signin_locked | signout | admin_view
  device     text,
  user_agent text,
  lang       text,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists robo_events_created_idx on public.robo_events (created_at desc);
create index if not exists robo_events_user_idx    on public.robo_events (lower(username), type, created_at desc);

-- ----------------------------------------------------------------- locked down
alter table public.robo_accounts enable row level security;
alter table public.robo_events   enable row level security;
-- deliberately no policies: the tables are unreachable from the browser

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

  return jsonb_build_object('ok', true, 'username', v_name, 'id', v_id);
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
       set last_login = now(), logins = logins + 1, lang = coalesce(p_lang, lang)
     where id = r.id;
    insert into robo_events (username, type, device, user_agent, lang)
    values (r.username, 'signin', coalesce(p_device, 'web'), p_ua, coalesce(p_lang, 'km'));
    return jsonb_build_object('ok', true, 'username', r.username, 'logins', r.logins + 1,
                              'created', r.created_at, 'last_login', now());
  end if;

  update robo_accounts set failed = failed + 1 where id = r.id;
  insert into robo_events (username, type, device, user_agent, lang, reason)
  values (r.username, 'signin_failed', coalesce(p_device, 'web'), p_ua, coalesce(p_lang, 'km'), 'bad_password');
  return jsonb_build_object('ok', false, 'error', 'bad_credentials');
end $$;

-- ----------------------------------------------------------------- sign out
create or replace function public.robo_logout(
  p_username text,
  p_device   text default 'web'
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  insert into robo_events (username, type, device) values (btrim(coalesce(p_username,'')), 'signout', coalesce(p_device,'web'));
  return jsonb_build_object('ok', true);
end $$;

-- ----------------------------------------------------------------- owner view
-- Requires an is_admin account AND its real password, so nothing secret lives in
-- the website source. Returns usernames and activity — never a password hash.
-- Re-running this file replaces it (a changed signature would otherwise create an
-- overload and leave the old, unthrottled version callable).
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
               'admin',      a.is_admin) order by a.created_at desc)
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

-- ----------------------------------------------------------------- permissions
-- the browser (anon role) may call these functions and nothing else
grant usage on schema public to anon;
grant execute on function public.robo_signup(text, text, text, text, text) to anon;
grant execute on function public.robo_login(text, text, text, text, text) to anon;
grant execute on function public.robo_logout(text, text) to anon;
grant execute on function public.robo_admin_accounts(text, text) to anon;
revoke all on public.robo_accounts from anon, authenticated;
revoke all on public.robo_events   from anon, authenticated;

-- ============================================================================
-- Useful queries for you (SQL editor — you are the owner, so you can read):
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
--   anyone currently locked out:
--     select username, count(*) from robo_events
--     where type = 'signin_failed' and created_at > now() - interval '15 minutes'
--     group by username having count(*) >= 8;
--
--   clear a lockout for someone who forgot their password:
--     delete from robo_events where lower(username) = lower('theirname')
--       and type in ('signin_failed','signin_locked');
--
--   reset a password for someone (they then use the new one):
--     update robo_accounts set pwhash = crypt('newpassword', gen_salt('bf', 10)),
--            failed = 0 where username_lower = lower('theirname');
--
--   download for a spreadsheet:
--     Table editor → robo_accounts → Export → CSV
-- ============================================================================
