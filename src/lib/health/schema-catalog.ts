/**
 * Manifest of every table the platform's schema defines, plus
 * hand-verified recovery DDL for the small set of "golden path"
 * tables (auth → projects → chat/agent build → deploy) that user
 * flows depend on directly.
 *
 * Recovery SQL is deliberately NOT derived from the migration files
 * at runtime (fragile to parse safely, and migration files often
 * define several tables + shared policies together, so replaying one
 * whole file to fix a single missing table risks colliding with
 * objects that already exist). Instead each entry below is a
 * self-contained `create table if not exists ... ; alter ... enable
 * row level security ; create policy ...` reflecting the table's
 * *current* shape (base migration plus any later `alter table`
 * columns), safe to run in isolation.
 *
 * Tables outside this core set are still existence-checked (so the
 * health dashboard is honest about them), but their fix proposals
 * point at the migration file to re-apply manually rather than
 * offering a one-click SQL fix.
 */

export interface SchemaTableInfo {
  table: string;
  /** Migration file that (originally) defines this table. */
  migration: string;
  /** Self-contained, idempotent recreate script — only set for core tables. */
  recoverySql?: string;
}

const RECOVERY: Record<string, string> = {
  users: `create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  avatar_url text,
  role public.user_role not null default 'user',
  plan public.plan_id not null default 'free',
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;

create policy "Users can view own user row"
  on public.users for select
  using (auth.uid() = id);

create policy "Admins can view all users"
  on public.users for select
  using (public.is_admin());

create policy "Users can update own user row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update any user"
  on public.users for update
  using (public.is_admin());`,

  templates: `create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text not null default 'general',
  thumbnail_url text,
  prompt text not null,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger templates_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

alter table public.templates enable row level security;

create policy "Anyone can view active templates"
  on public.templates for select
  to anon, authenticated
  using (is_active);

create policy "Admins can manage templates"
  on public.templates for all
  using (public.is_admin())
  with check (public.is_admin());`,

  projects: `create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  template_id uuid references public.templates (id) on delete set null,
  name text not null,
  slug text unique,
  description text,
  status public.project_status not null default 'draft',
  is_public boolean not null default false,
  preview_url text,
  github_repo text,
  custom_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "Owners can view own projects"
  on public.projects for select
  using (auth.uid() = owner_id);

create policy "Anyone can view public projects"
  on public.projects for select
  to anon, authenticated
  using (is_public);

create policy "Admins can view all projects"
  on public.projects for select
  using (public.is_admin());

create policy "Owners can create projects"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update own projects"
  on public.projects for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete own projects"
  on public.projects for delete
  using (auth.uid() = owner_id);`,

  project_files: `create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null,
  content text not null default '',
  language text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);

create trigger project_files_updated_at
  before update on public.project_files
  for each row execute function public.set_updated_at();

alter table public.project_files enable row level security;

create policy "Owners can view own project files"
  on public.project_files for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Anyone can view public project files"
  on public.project_files for select
  to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.is_public));

create policy "Owners can create project files"
  on public.project_files for insert
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Owners can update own project files"
  on public.project_files for update
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Owners can delete own project files"
  on public.project_files for delete
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));`,

  chat_messages: `create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  role public.chat_role not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Owners can view project messages"
  on public.chat_messages for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Owners can create own project messages"
  on public.chat_messages for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

create policy "Owners can delete project messages"
  on public.chat_messages for delete
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));`,

  ai_generations: `create table if not exists public.ai_generations (
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

alter table public.ai_generations enable row level security;

create policy "Owners can view project generations"
  on public.ai_generations for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Admins can view all generations"
  on public.ai_generations for select
  using (public.is_admin());`,

  deployments: `create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  triggered_by uuid references public.users (id) on delete set null,
  status public.deployment_status not null default 'queued',
  provider text not null default 'app-creator',
  url text,
  domain text,
  logs text,
  vercel_deployment_id text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.deployments enable row level security;

create policy "Owners can view project deployments"
  on public.deployments for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Owners can create deployments"
  on public.deployments for insert
  with check (
    (triggered_by is null or triggered_by = auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

create policy "Admins can view all deployments"
  on public.deployments for select
  using (public.is_admin());`,

  subscriptions: `create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  plan public.plan_id not null default 'free',
  status public.subscription_status not null default 'active',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Admins can view all subscriptions"
  on public.subscriptions for select
  using (public.is_admin());`,

  usage_logs: `create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  action text not null,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint usage_logs_action_check check (
    action in ('ai_message', 'ai_generation', 'deployment', 'preview', 'export')
  )
);

alter table public.usage_logs enable row level security;

create policy "Users can view own usage"
  on public.usage_logs for select
  using (auth.uid() = user_id);

create policy "Admins can view all usage"
  on public.usage_logs for select
  using (public.is_admin());`,

  analytics: `create table if not exists public.analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  event_type text not null,
  properties jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);

alter table public.analytics enable row level security;

create policy "Users can insert own events"
  on public.analytics for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

create policy "Admins can view analytics"
  on public.analytics for select
  using (public.is_admin());`,

  integration_connections: `create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null,
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

create trigger integration_connections_updated_at
  before update on public.integration_connections
  for each row execute function public.set_updated_at();

alter table public.integration_connections enable row level security;

create policy "Users manage own connections"
  on public.integration_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);`,
};

export const SCHEMA_CATALOG: SchemaTableInfo[] = [
  { table: "users", migration: "20260715000200_users.sql", recoverySql: RECOVERY.users },
  { table: "templates", migration: "20260715000300_templates.sql", recoverySql: RECOVERY.templates },
  { table: "projects", migration: "20260715000400_projects_and_files.sql", recoverySql: RECOVERY.projects },
  { table: "project_files", migration: "20260715000400_projects_and_files.sql", recoverySql: RECOVERY.project_files },
  { table: "chat_messages", migration: "20260715000500_chat_and_ai.sql", recoverySql: RECOVERY.chat_messages },
  { table: "ai_generations", migration: "20260715000500_chat_and_ai.sql", recoverySql: RECOVERY.ai_generations },
  { table: "deployments", migration: "20260715000600_deployments.sql", recoverySql: RECOVERY.deployments },
  { table: "subscriptions", migration: "20260715000700_billing.sql", recoverySql: RECOVERY.subscriptions },
  { table: "usage_logs", migration: "20260715000700_billing.sql", recoverySql: RECOVERY.usage_logs },
  { table: "analytics", migration: "20260715000800_analytics.sql", recoverySql: RECOVERY.analytics },
  {
    table: "integration_connections",
    migration: "20260715001000_integrations.sql",
    recoverySql: RECOVERY.integration_connections,
  },
  { table: "invoices", migration: "20260715001200_billing_providers.sql" },
  { table: "course_enrollments", migration: "20260913063000_add_course_enrollments.sql" },
  { table: "user_ai_settings", migration: "20260719094925_ai_platform.sql" },
  { table: "model_comparisons", migration: "20260719094925_ai_platform.sql" },
  { table: "agents", migration: "20260719104152_agents.sql" },
  { table: "agent_knowledge_files", migration: "20260719104152_agents.sql" },
  { table: "agent_memories", migration: "20260719104152_agents.sql" },
  { table: "agent_conversations", migration: "20260719104152_agents.sql" },
  { table: "agent_messages", migration: "20260719104152_agents.sql" },
  { table: "documents", migration: "20260719121138_documents.sql" },
  { table: "content_pieces", migration: "20260719133027_content_studio.sql" },
  { table: "prompt_library", migration: "20260719133027_content_studio.sql" },
  { table: "knowledge_bases", migration: "20260719212526_rag.sql" },
  { table: "knowledge_documents", migration: "20260719212526_rag.sql" },
  { table: "knowledge_chunks", migration: "20260719212526_rag.sql" },
  { table: "workflows", migration: "20260719220022_workflows.sql" },
  { table: "workflow_steps", migration: "20260719220022_workflows.sql" },
  { table: "workflow_runs", migration: "20260719220022_workflows.sql" },
  { table: "workflow_run_steps", migration: "20260719220022_workflows.sql" },
  { table: "teams", migration: "20260719224645_teams.sql" },
  { table: "team_members", migration: "20260719224645_teams.sql" },
  { table: "team_invites", migration: "20260719224645_teams.sql" },
  { table: "api_keys", migration: "20260720071015_api_keys.sql" },
  { table: "system_logs", migration: "20260721050000_self_healing.sql" },
  { table: "system_health_snapshots", migration: "20260721050000_self_healing.sql" },
  { table: "system_fix_proposals", migration: "20260721050000_self_healing.sql" },
];

/** The core golden-path tables (auth → projects → chat/build → deploy). */
export const CORE_TABLES = new Set(Object.keys(RECOVERY));
