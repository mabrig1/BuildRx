-- ============================================================
-- 20260721035525 · Self-healing platform core
--
-- Structured error/log history, point-in-time health-check
-- snapshots, and an approval-gated fix-proposal queue. Fixes are
-- never auto-applied to production — an admin must approve a
-- proposal before its SQL runs (see admin_exec_sql below).
--
-- Applied to the live project via MCP as version 20260721035525
-- (the apply timestamp); this file records it in the repo.
-- ============================================================

create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  source text not null,
  message text not null,
  code text,
  subsystem text,
  context jsonb not null default '{}'::jsonb,
  stack text,
  created_at timestamptz not null default now()
);

comment on table public.system_logs is
  'Structured error/event log written by the server (Debug Agent); backs the health dashboard error history.';

create index system_logs_created_at_idx on public.system_logs (created_at desc);
create index system_logs_level_created_idx on public.system_logs (level, created_at desc);
create index system_logs_subsystem_idx on public.system_logs (subsystem, created_at desc);

create table public.system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  overall_status text not null check (overall_status in ('healthy', 'degraded', 'down')),
  checks jsonb not null,
  taken_at timestamptz not null default now()
);

comment on table public.system_health_snapshots is
  'Point-in-time result of every subsystem health check (Monitoring Agent); kept for dashboard history.';

create index system_health_snapshots_taken_at_idx
  on public.system_health_snapshots (taken_at desc);

create table public.system_fix_proposals (
  id uuid primary key default gen_random_uuid(),
  subsystem text not null,
  code text not null,
  title text not null,
  description text not null,
  sql_fix text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'applied', 'rejected', 'failed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  applied_at timestamptz,
  result text
);

comment on table public.system_fix_proposals is
  'Auto-diagnosed fixes (Auto-Fix Agent) awaiting explicit admin approval before being applied to production. Never auto-executed.';

-- Only one open proposal per (subsystem, code) at a time.
create unique index system_fix_proposals_pending_dedupe_idx
  on public.system_fix_proposals (subsystem, code)
  where status = 'pending';

create index system_fix_proposals_status_idx
  on public.system_fix_proposals (status, created_at desc);

-- Row Level Security ------------------------------------------
-- All three tables are written only by the service role (bypasses
-- RLS); admins get read access for the dashboard.
alter table public.system_logs enable row level security;
alter table public.system_health_snapshots enable row level security;
alter table public.system_fix_proposals enable row level security;

create policy "Admins can view system logs"
  on public.system_logs for select
  using (public.is_admin());

create policy "Admins can view health snapshots"
  on public.system_health_snapshots for select
  using (public.is_admin());

create policy "Admins can view fix proposals"
  on public.system_fix_proposals for select
  using (public.is_admin());

-- ------------------------------------------------------------
-- admin_exec_sql: executes a single pre-approved DDL fix.
--
-- service_role only — never reachable from anon/authenticated,
-- so the browser can never call it. Application code must only
-- ever pass the stored `sql_fix` of a proposal an admin has just
-- approved; this function additionally refuses statements that
-- look destructive (drop/truncate/delete/grant/revoke/alter role)
-- as defense in depth, since fix proposals are meant to be
-- additive schema repairs (create table, add column, add policy),
-- not data or privilege changes.
-- ------------------------------------------------------------
create or replace function public.admin_exec_sql(sql text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if sql ~* '\y(drop|truncate|delete\s+from|grant|revoke|alter\s+role|alter\s+system)\y' then
    raise exception 'admin_exec_sql: statement type not permitted (%)', left(sql, 60);
  end if;
  execute sql;
end;
$$;

revoke all on function public.admin_exec_sql(text) from public, anon, authenticated;
grant execute on function public.admin_exec_sql(text) to service_role;

-- ------------------------------------------------------------
-- health_table_status: read-only existence/RLS check (Database
-- Agent). Uses to_regclass()/pg_class against a caller-supplied
-- table-name list — no dynamic SQL, so unlike admin_exec_sql this
-- carries no execution risk and only needs read access to the
-- catalog.
-- ------------------------------------------------------------
create or replace function public.health_table_status(table_names text[])
returns table(table_name text, table_exists boolean, rls_enabled boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    t.name,
    (to_regclass('public.' || t.name) is not null) as table_exists,
    coalesce(
      (
        select c.relrowsecurity
        from pg_catalog.pg_class c
        where c.oid = to_regclass('public.' || t.name)
      ),
      false
    ) as rls_enabled
  from unnest(table_names) as t(name);
end;
$$;

revoke all on function public.health_table_status(text[]) from public, anon, authenticated;
grant execute on function public.health_table_status(text[]) to service_role;

-- ------------------------------------------------------------
-- health_auth_profile_gap: counts auth.users rows with no matching
-- public.users profile (Authentication Agent). A non-zero result is
-- exactly the failure mode fixed once already by
-- 20260720201205_restore_role_grants.sql (signup trigger silently
-- broken, e.g. by a grants regression) — this makes it detectable
-- and self-fixable instead of resurfacing as scattered FK errors.
-- ------------------------------------------------------------
create or replace function public.health_auth_profile_gap()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gap integer;
begin
  select count(*) into gap
  from auth.users au
  left join public.users pu on pu.id = au.id
  where pu.id is null;
  return gap;
end;
$$;

revoke all on function public.health_auth_profile_gap() from public, anon, authenticated;
grant execute on function public.health_auth_profile_gap() to service_role;
