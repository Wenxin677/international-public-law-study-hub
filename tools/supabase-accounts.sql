-- ============================================================================
-- RoboCL — account database (Supabase / PostgreSQL)
-- Run this once in your Supabase project: SQL editor → New query → paste → Run.
--
-- What you get
--   · robo_accounts — one row per user: username, bcrypt password hash, created,
--     last sign-in, sign-in count, failed attempts, language.
--   · robo_events   — every signup / signin / signin_failed / signout with time,
--     device and browser (this is the "who used the site" log).
--   · three RPC functions the website may call.
--
-- Security model (please read)
--   · The tables have Row Level Security ON with NO policies, so the browser
--     (which only holds the public anon key) cannot read or write them at all.
--     No password hash can ever be pulled from the site.
--   · All access goes through SECURITY DEFINER functions that do exactly one
--     thing each. Passwords are verified inside the database with bcrypt
--     (pgcrypto's crypt/gen_salt) — the stored value is not reversible.
--   · Nobody — not you, not anyone with database access — can read a password.
--     A lost password can only be reset, never recovered.
--
-- BEFORE YOU RUN IT
--   Replace SET_YOUR_OWN_SECRET below with a long random word of your own. It is
--   the key that lets the in-app admin page list accounts (usernames and activity
--   only — never hashes). Keep the same value in docs/data/config.js.
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
  constraint robo_accounts_username_key unique (username_lower),
  constraint robo_accounts_username_shape check (username ~ '^[A-Za-z0-9_.]{3,20}$')
);

-- ----------------------------------------------------------------- events
create table if not exists public.robo_events (
  id         bigint generated always as identity primary key,
  username   text,
  type       text not null,          -- signup | signin | signin_failed | signout | test
  device     text,
  user_agent text,
  lang       text,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists robo_events_created_idx on public.robo_events (created_at desc);
create index if not exists robo_events_user_idx    on public.robo_events (lower(username));

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
  if p_password is null or length(p_password) < 6 then
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
  v_name text := btrim(coalesce(p_username, ''));
  r      robo_accounts;
begin
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
-- Replace the secret below with your own long random word (see the header note).
create or replace function public.robo_admin_accounts(p_secret text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> 'SET_YOUR_OWN_SECRET' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  return jsonb_build_object('ok', true, 'accounts', coalesce((
    select jsonb_agg(jsonb_build_object(
             'username',   a.username,
             'created',    a.created_at,
             'last_login', a.last_login,
             'logins',     a.logins,
             'failed',     a.failed,
             'lang',       a.lang) order by a.last_login desc nulls last)
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
-- the browser (anon role) may only call these three functions
grant usage on schema public to anon;
grant execute on function public.robo_signup(text, text, text, text, text) to anon;
grant execute on function public.robo_login(text, text, text, text, text) to anon;
grant execute on function public.robo_logout(text, text) to anon;
grant execute on function public.robo_admin_accounts(text) to anon;
revoke all on public.robo_accounts from anon, authenticated;
revoke all on public.robo_events   from anon, authenticated;

-- ============================================================================
-- Useful queries for you (SQL editor — you are the owner, so you can read):
--
--   everyone, newest first:
--     select username, created_at, last_login, logins, failed
--     from robo_accounts order by created_at desc;
--
--   who signed in today:
--     select username, type, device, created_at from robo_events
--     where type = 'signin' and created_at > current_date order by created_at desc;
--
--   busiest accounts:
--     select username, logins from robo_accounts order by logins desc limit 20;
--
--   download for a spreadsheet:
--     Table editor → robo_accounts → Export → CSV
--
-- To reset someone's password (they must set a new one):
--   update robo_accounts
--      set pwhash = crypt('newpassword', gen_salt('bf', 10))
--    where username_lower = lower('theirname');
-- ============================================================================
