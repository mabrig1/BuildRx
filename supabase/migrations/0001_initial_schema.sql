-- App-Creator initial schema
-- Run with: npx supabase db push  (or apply via the Supabase SQL editor)

-- ============================================================
-- Enums
-- ============================================================
create type public.user_role as enum ('user', 'admin');
create type public.plan_id as enum ('free', 'pro', 'team');
create type public.project_status as enum ('draft', 'generating', 'ready', 'error');
create type public.deployment_status as enum ('queued', 'building', 'live', 'failed');
create type public.chat_role as enum ('user', 'assistant', 'system');

-- ============================================================
-- Profiles (mirrors auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  role public.user_role not null default 'user',
  plan public.plan_id not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Projects
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  status public.project_status not null default 'draft',
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

-- ============================================================
-- Chat messages
-- ============================================================
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  role public.chat_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_project_id_idx on public.chat_messages (project_id);

-- ============================================================
-- Deployments
-- ============================================================
create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  status public.deployment_status not null default 'queued',
  url text,
  created_at timestamptz not null default now()
);

create index deployments_project_id_idx on public.deployments (project_id);

-- ============================================================
-- Subscriptions (billing)
-- ============================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan public.plan_id not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.chat_messages enable row level security;
alter table public.deployments enable row level security;
alter table public.subscriptions enable row level security;

-- Profiles: users can read/update their own profile.
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Projects: owners have full access.
create policy "Owners can view own projects"
  on public.projects for select
  using (auth.uid() = owner_id);

create policy "Owners can create projects"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update own projects"
  on public.projects for update
  using (auth.uid() = owner_id);

create policy "Owners can delete own projects"
  on public.projects for delete
  using (auth.uid() = owner_id);

-- Chat messages: scoped to project owner.
create policy "Owners can view project messages"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners can create project messages"
  on public.chat_messages for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- Deployments: scoped to project owner.
create policy "Owners can view project deployments"
  on public.deployments for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- Subscriptions: users can view their own subscription.
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);
