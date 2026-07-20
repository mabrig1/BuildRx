-- ============================================================
-- 20260720201205 · Restore standard Supabase role grants
--
-- An unrecorded "hardening" run revoked SELECT/INSERT/UPDATE/DELETE
-- on every public table from anon, authenticated and service_role
-- (leaving only REFERENCES/TRIGGER/TRUNCATE), and stripped the
-- default privileges for future objects created by postgres. That
-- broke every PostgREST/RLS data path with
-- "permission denied for table <name>". RLS policies were and are
-- intact — they are the intended authorization layer; table-level
-- DML grants are required underneath them.
--
-- Applied to the live project on 2026-07-20 via MCP as version
-- 20260720201205; this file records it in the repo.
-- ============================================================

-- Schema usage (idempotent).
grant usage on schema public to anon, authenticated, service_role;

-- Table DML back to platform defaults; RLS continues to gate rows.
grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated, service_role;

-- Re-apply the intentional column-level narrowing on public.users:
-- regular users may only change their own name/avatar/onboarding
-- flag — never role or plan (migration 0002).
revoke update on public.users from anon, authenticated;
grant update (name, avatar_url, onboarded) on public.users to authenticated;

-- Sequences and functions back to platform defaults.
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;
grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- Keep the deliberate hardening of the signup trigger function:
-- only its owner (postgres) ever needs to run it.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- Restore default privileges for future objects created by postgres,
-- so the next migration-created table isn't broken again.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions
  to anon, authenticated, service_role;

-- Backfill application profiles for auth users created before the
-- users table/trigger existed (their absence breaks the
-- projects.owner_id foreign key on insert).
insert into public.users (id, email, name, avatar_url)
select
  au.id,
  au.email,
  au.raw_user_meta_data ->> 'name',
  au.raw_user_meta_data ->> 'avatar_url'
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null
on conflict (id) do nothing;
