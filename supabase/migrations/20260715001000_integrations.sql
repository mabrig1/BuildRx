-- ============================================================
-- 0010 · Integrations
-- Connected external accounts (GitHub, deploy providers) and
-- project ↔ repository linkage.
-- ============================================================

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null,
  -- NOTE: store provider tokens encrypted at rest in production
  -- (Supabase Vault / KMS). RLS keeps rows owner-only either way.
  access_token text not null,
  account_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider),
  constraint integration_connections_provider_check check (
    provider in ('github', 'vercel', 'netlify', 'railway')
  )
);

comment on table public.integration_connections is
  'Per-user tokens for external integrations (GitHub, deploy providers).';

create trigger integration_connections_updated_at
  before update on public.integration_connections
  for each row execute function public.set_updated_at();

create index integration_connections_user_idx
  on public.integration_connections (user_id);

alter table public.integration_connections enable row level security;

create policy "Users manage own connections"
  on public.integration_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Project ↔ GitHub repository linkage.
alter table public.projects
  add column github_repo text;

comment on column public.projects.github_repo is
  'Linked GitHub repository as owner/name.';
