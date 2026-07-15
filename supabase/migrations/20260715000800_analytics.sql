-- ============================================================
-- 0008 · Analytics
-- Product analytics events (page views, feature usage, funnels).
-- ============================================================

create table public.analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  event_type text not null,
  properties jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);

comment on table public.analytics is
  'Append-only product analytics events; queried by admins only.';

-- Indexes ------------------------------------------------------
create index analytics_event_created_idx
  on public.analytics (event_type, created_at desc);
create index analytics_user_created_idx
  on public.analytics (user_id, created_at desc);
create index analytics_project_id_idx on public.analytics (project_id);
create index analytics_session_id_idx on public.analytics (session_id);

-- Row Level Security ------------------------------------------
alter table public.analytics enable row level security;

-- Signed-in users may record events attributed to themselves (or
-- anonymous ones); only admins may read.
create policy "Users can insert own events"
  on public.analytics for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

create policy "Admins can view analytics"
  on public.analytics for select
  using (public.is_admin());
