-- ============================================================
-- 0006 · Deployments
-- ============================================================

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  triggered_by uuid references public.users (id) on delete set null,
  status public.deployment_status not null default 'queued',
  url text,
  vercel_deployment_id text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.deployments is
  'Deployment attempts per project; status transitions are driven by the server.';

-- Indexes ------------------------------------------------------
create index deployments_project_created_idx
  on public.deployments (project_id, created_at desc);
create index deployments_triggered_by_idx
  on public.deployments (triggered_by);
create index deployments_status_idx
  on public.deployments (status)
  where status in ('queued', 'building');

-- Row Level Security ------------------------------------------
alter table public.deployments enable row level security;

-- Owners can see and request deployments; status/url updates are
-- performed by the service role.
create policy "Owners can view project deployments"
  on public.deployments for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners can create deployments"
  on public.deployments for insert
  with check (
    (triggered_by is null or triggered_by = auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Admins can view all deployments"
  on public.deployments for select
  using (public.is_admin());
