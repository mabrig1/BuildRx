-- ============================================================
-- 0003 · Templates
-- Starter templates users can create projects from.
-- ============================================================

create table public.templates (
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

comment on table public.templates is
  'Curated starter templates; the prompt seeds the first AI generation.';

create trigger templates_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

-- Indexes ------------------------------------------------------
create index templates_category_idx on public.templates (category);
create index templates_active_featured_idx
  on public.templates (is_featured)
  where is_active;

-- Row Level Security ------------------------------------------
alter table public.templates enable row level security;

create policy "Anyone can view active templates"
  on public.templates for select
  to anon, authenticated
  using (is_active);

create policy "Admins can manage templates"
  on public.templates for all
  using (public.is_admin())
  with check (public.is_admin());
