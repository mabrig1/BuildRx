-- ============================================================
-- 0004 · Projects and project files
-- ============================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  template_id uuid references public.templates (id) on delete set null,
  name text not null,
  slug text unique,
  description text,
  status public.project_status not null default 'draft',
  is_public boolean not null default false,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'User-owned app projects built through the AI chat.';

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Generated source files belonging to a project.
create table public.project_files (
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

comment on table public.project_files is
  'Virtual filesystem of AI-generated source files per project.';

create trigger project_files_updated_at
  before update on public.project_files
  for each row execute function public.set_updated_at();

-- Indexes ------------------------------------------------------
create index projects_owner_id_idx on public.projects (owner_id);
create index projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);
create index projects_template_id_idx on public.projects (template_id);
create index projects_public_idx on public.projects (id) where is_public;
-- project_files (project_id, path) unique constraint doubles as the
-- project_id lookup index.

-- Row Level Security ------------------------------------------
alter table public.projects enable row level security;
alter table public.project_files enable row level security;

-- Projects: owners get full CRUD, public projects are readable by all.
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
  using (auth.uid() = owner_id);

-- Project files: scoped through project ownership / visibility.
create policy "Owners can view own project files"
  on public.project_files for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Anyone can view public project files"
  on public.project_files for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.is_public
    )
  );

create policy "Owners can create project files"
  on public.project_files for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners can update own project files"
  on public.project_files for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners can delete own project files"
  on public.project_files for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
