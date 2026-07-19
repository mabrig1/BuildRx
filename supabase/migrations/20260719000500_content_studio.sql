-- ============================================================
-- 0017 · Content Studio: blog/ebook/social/email/ad/video writers,
-- prompt library
-- ============================================================

create type public.content_type as enum (
  'blog_post',
  'ebook',
  'social_post',
  'email',
  'ad_copy',
  'video_script'
);

create type public.content_status as enum ('ready', 'failed');

create table public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  type public.content_type not null,
  title text not null,
  -- Type-specific generation inputs (topic, tone, platform, …) — kept so "regenerate" can reuse or tweak them.
  inputs jsonb not null default '{}'::jsonb,
  content text not null default '',
  cover_image_data_url text,
  status public.content_status not null default 'ready',
  error text,
  provider public.ai_provider not null default 'nvidia',
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_pieces is
  'Generated content from the Content Studio writers (blog, ebook, social, email, ad copy, video script).';

create trigger content_pieces_updated_at
  before update on public.content_pieces
  for each row execute function public.set_updated_at();

create index content_pieces_owner_created_idx
  on public.content_pieces (owner_id, created_at desc);
create index content_pieces_owner_type_idx
  on public.content_pieces (owner_id, type);

alter table public.content_pieces enable row level security;

create policy "Owners can view own content"
  on public.content_pieces for select
  using (owner_id = auth.uid());

create policy "Owners can create own content"
  on public.content_pieces for insert
  with check (owner_id = auth.uid());

create policy "Owners can update own content"
  on public.content_pieces for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete own content"
  on public.content_pieces for delete
  using (owner_id = auth.uid());

-- Prompt library ----------------------------------------------------
create table public.prompt_library (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  -- A content_type, or 'general' for prompts not tied to one writer.
  category text not null default 'general',
  prompt_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prompt_library is
  'User-saved reusable prompts, browsable/searchable from the Content Studio.';

create trigger prompt_library_updated_at
  before update on public.prompt_library
  for each row execute function public.set_updated_at();

create index prompt_library_owner_created_idx
  on public.prompt_library (owner_id, created_at desc);

alter table public.prompt_library enable row level security;

create policy "Owners can view own prompts"
  on public.prompt_library for select
  using (owner_id = auth.uid());

create policy "Owners can create own prompts"
  on public.prompt_library for insert
  with check (owner_id = auth.uid());

create policy "Owners can update own prompts"
  on public.prompt_library for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete own prompts"
  on public.prompt_library for delete
  using (owner_id = auth.uid());
