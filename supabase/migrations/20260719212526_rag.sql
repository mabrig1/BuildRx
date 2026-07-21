-- Phase 6: RAG (Retrieval-Augmented Generation) — knowledge bases the
-- user can upload documents into, chunked and embedded for semantic
-- search, then used to ground chat answers with citations.

create extension if not exists vector with schema extensions;

create table public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_bases_owner_id_idx on public.knowledge_bases (owner_id);

alter table public.knowledge_bases enable row level security;

create policy "Owners manage their knowledge bases"
  on public.knowledge_bases for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger knowledge_bases_updated_at
  before update on public.knowledge_bases
  for each row execute function public.set_updated_at();

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null references public.knowledge_bases (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  file_type text not null,
  size_bytes bigint,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  chunk_count integer not null default 0,
  warning text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_documents_kb_id_idx on public.knowledge_documents (knowledge_base_id);
create index knowledge_documents_owner_id_idx on public.knowledge_documents (owner_id);

alter table public.knowledge_documents enable row level security;

create policy "Owners manage their knowledge documents"
  on public.knowledge_documents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger knowledge_documents_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  knowledge_base_id uuid not null references public.knowledge_bases (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now()
);

create index knowledge_chunks_document_id_idx on public.knowledge_chunks (document_id);
create index knowledge_chunks_kb_id_idx on public.knowledge_chunks (knowledge_base_id);
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.knowledge_chunks enable row level security;

create policy "Owners manage their knowledge chunks"
  on public.knowledge_chunks for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Cosine-similarity search over one knowledge base's chunks, scoped to
-- the caller (security invoker — runs under the caller's RLS, and the
-- owner_id filter below is redundant with RLS but keeps the query
-- planner from needing to prove it).
create function public.match_knowledge_chunks(
  query_embedding extensions.vector(1024),
  target_kb_id uuid,
  match_owner_id uuid,
  match_count integer default 6
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  chunk_index integer
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    knowledge_chunks.id,
    knowledge_chunks.document_id,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity,
    knowledge_chunks.chunk_index
  from public.knowledge_chunks
  where knowledge_chunks.knowledge_base_id = target_kb_id
    and knowledge_chunks.owner_id = match_owner_id
    and knowledge_chunks.embedding is not null
  order by knowledge_chunks.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

comment on function public.match_knowledge_chunks is
  'Cosine-similarity nearest-neighbor search over knowledge_chunks, scoped to one knowledge base and owner.';
