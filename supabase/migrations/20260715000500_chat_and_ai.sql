-- ============================================================
-- 0005 · Chat messages and AI generations
-- ============================================================

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  role public.chat_role not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.chat_messages is
  'Per-project AI conversation history. user_id is null for assistant/system messages.';

-- One row per model call; token accounting and status for billing/limits.
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  message_id uuid references public.chat_messages (id) on delete set null,
  user_id uuid references public.users (id) on delete set null,
  model text not null,
  status public.generation_status not null default 'pending',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.ai_generations is
  'One row per LLM call: model, token usage, timing, and outcome.';

-- Indexes ------------------------------------------------------
create index chat_messages_project_created_idx
  on public.chat_messages (project_id, created_at);
create index chat_messages_user_id_idx on public.chat_messages (user_id);

create index ai_generations_project_created_idx
  on public.ai_generations (project_id, created_at desc);
create index ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);
create index ai_generations_message_id_idx
  on public.ai_generations (message_id);

-- Row Level Security ------------------------------------------
alter table public.chat_messages enable row level security;
alter table public.ai_generations enable row level security;

-- Chat messages: readable by the project owner; users may insert their
-- own messages. Assistant/system rows are written by the service role.
create policy "Owners can view project messages"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners can create own project messages"
  on public.chat_messages for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners can delete project messages"
  on public.chat_messages for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- AI generations: read-only for project owners; written exclusively by
-- the service role (no insert/update policies for authenticated).
create policy "Owners can view project generations"
  on public.ai_generations for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Admins can view all generations"
  on public.ai_generations for select
  using (public.is_admin());
