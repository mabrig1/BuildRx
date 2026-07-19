-- Phase 7: Workflows — multi-step automations chaining together
-- already-built AI capabilities (a raw completion, an agent turn, a
-- Content Studio piece, a Knowledge Base question) and an outbound
-- webhook. Runs synchronously step-by-step (no queue/worker in this
-- deployment), triggered either manually or via a per-workflow inbound
-- webhook URL.

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default true,
  trigger_type text not null default 'manual' check (trigger_type in ('manual', 'webhook')),
  webhook_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflows_owner_id_idx on public.workflows (owner_id);

alter table public.workflows enable row level security;

create policy "Owners manage their workflows"
  on public.workflows for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger workflows_updated_at
  before update on public.workflows
  for each row execute function public.set_updated_at();

create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  name text not null,
  type text not null check (type in ('ai_generate', 'agent_run', 'content_generate', 'kb_chat', 'webhook')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, position)
);

create index workflow_steps_workflow_id_idx on public.workflow_steps (workflow_id);

alter table public.workflow_steps enable row level security;

create policy "Owners manage their workflow steps"
  on public.workflow_steps for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger workflow_steps_updated_at
  before update on public.workflow_steps
  for each row execute function public.set_updated_at();

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  trigger text not null default 'manual' check (trigger in ('manual', 'webhook')),
  trigger_input text,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index workflow_runs_workflow_id_idx on public.workflow_runs (workflow_id);
create index workflow_runs_owner_id_idx on public.workflow_runs (owner_id);

alter table public.workflow_runs enable row level security;

create policy "Owners manage their workflow runs"
  on public.workflow_runs for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table public.workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  step_name text not null,
  step_type text not null,
  status text not null check (status in ('completed', 'failed')),
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index workflow_run_steps_run_id_idx on public.workflow_run_steps (run_id);

alter table public.workflow_run_steps enable row level security;

create policy "Owners manage their workflow run steps"
  on public.workflow_run_steps for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
