-- ============================================================
-- 0014 · AI Agents: agent builder, knowledge files, memory, chat
-- ============================================================
-- Distinct from the pre-existing planner/ui/database/coding/debug/
-- deployment build pipeline (public.projects + chat_messages) — these
-- are user-created, reusable AI assistants ("custom GPTs"), not tied
-- to a specific project.

create type public.agent_visibility as enum ('private', 'unlisted', 'public');

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  description text,
  icon text not null default '🤖',
  system_prompt text not null default 'You are a helpful assistant.',
  provider public.ai_provider not null default 'nvidia',
  model text not null default '',
  -- Enabled built-in tool ids, e.g. ["calculator","get_current_time"].
  tools jsonb not null default '[]'::jsonb,
  visibility public.agent_visibility not null default 'private',
  -- Set when visibility moves off 'private'; powers the /agents/share/:slug link.
  share_slug text unique,
  forked_from uuid references public.agents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agents is
  'User-created AI agents: system prompt, provider/model, enabled tools, and sharing.';

create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create index agents_owner_id_idx on public.agents (owner_id);
create index agents_visibility_idx on public.agents (visibility) where visibility = 'public';

alter table public.agents enable row level security;

create policy "Owners and non-private agents are viewable"
  on public.agents for select
  using (owner_id = auth.uid() or visibility <> 'private');

create policy "Users can create own agents"
  on public.agents for insert
  with check (owner_id = auth.uid());

create policy "Owners can update own agents"
  on public.agents for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete own agents"
  on public.agents for delete
  using (owner_id = auth.uid());

-- Knowledge files ------------------------------------------------
-- Plain-text context injected into the agent's system prompt (capped
-- client/server-side). Full retrieval/embeddings land in a later phase
-- (RAG) — this is deliberately simple static context for now.
create table public.agent_knowledge_files (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  name text not null,
  content text not null,
  size_bytes integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.agent_knowledge_files is
  'Plain-text reference material an agent includes in its context. Owner-only, regardless of agent visibility.';

create index agent_knowledge_files_agent_id_idx on public.agent_knowledge_files (agent_id);

alter table public.agent_knowledge_files enable row level security;

create policy "Owners manage own agent knowledge files"
  on public.agent_knowledge_files for all
  using (
    exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid())
  );

-- Memory -----------------------------------------------------------
-- Facts an agent has been told to remember, persisted across
-- conversations (distinct from conversation history itself).
create table public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

comment on table public.agent_memories is
  'Facts the agent has been told to remember about a given user, injected into future conversations.';

create index agent_memories_agent_user_idx on public.agent_memories (agent_id, user_id, created_at desc);

alter table public.agent_memories enable row level security;

create policy "Users can view own memories"
  on public.agent_memories for select
  using (user_id = auth.uid());

create policy "Users can create own memories on accessible agents"
  on public.agent_memories for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.agents a
      where a.id = agent_id and (a.owner_id = auth.uid() or a.visibility <> 'private')
    )
  );

create policy "Users can delete own memories"
  on public.agent_memories for delete
  using (user_id = auth.uid());

-- Conversations (memory threads) ------------------------------------
create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_conversations is
  'One chat thread between a user and an agent.';

create trigger agent_conversations_updated_at
  before update on public.agent_conversations
  for each row execute function public.set_updated_at();

create index agent_conversations_agent_user_idx
  on public.agent_conversations (agent_id, user_id, updated_at desc);

alter table public.agent_conversations enable row level security;

create policy "Users can view own conversations"
  on public.agent_conversations for select
  using (user_id = auth.uid());

create policy "Users can create own conversations on accessible agents"
  on public.agent_conversations for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.agents a
      where a.id = agent_id and (a.owner_id = auth.uid() or a.visibility <> 'private')
    )
  );

create policy "Users can update own conversations"
  on public.agent_conversations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own conversations"
  on public.agent_conversations for delete
  using (user_id = auth.uid());

-- Messages ------------------------------------------------------------
create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null default '',
  -- [{ id, name, arguments }, …] — set on assistant messages that called a tool.
  tool_calls jsonb,
  tool_name text,
  tool_call_id text,
  created_at timestamptz not null default now()
);

comment on table public.agent_messages is
  'Messages within an agent conversation, including tool calls and their results.';

create index agent_messages_conversation_created_idx
  on public.agent_messages (conversation_id, created_at);

alter table public.agent_messages enable row level security;

create policy "Users can view messages in own conversations"
  on public.agent_messages for select
  using (
    exists (
      select 1 from public.agent_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in own conversations"
  on public.agent_messages for insert
  with check (
    exists (
      select 1 from public.agent_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete messages in own conversations"
  on public.agent_messages for delete
  using (
    exists (
      select 1 from public.agent_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
