-- ============================================================
-- 0016 · Document AI: upload PDF/DOCX/XLSX/image, extract, summarize
-- ============================================================
-- No blob storage is configured yet — extraction happens synchronously
-- at upload time and only the extracted content (text/tables) is kept,
-- not the original file bytes. See src/lib/documents/extract.ts.

create type public.document_file_type as enum ('pdf', 'docx', 'xlsx', 'image');
create type public.document_status as enum ('processing', 'ready', 'failed');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  file_type public.document_file_type not null,
  size_bytes integer not null default 0,
  status public.document_status not null default 'processing',
  extracted_text text not null default '',
  -- [{ name, rows: string[][] }, …] — populated directly for XLSX; empty
  -- for other types until /extract-tables is run (AI-inferred, best-effort).
  tables jsonb not null default '[]'::jsonb,
  summary text,
  tables_markdown text,
  report_markdown text,
  -- Non-fatal extraction caveat, e.g. "scanned PDF, no text layer".
  warning text,
  error text,
  -- Default provider/model used for this document's AI operations.
  provider public.ai_provider not null default 'nvidia',
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.documents is
  'Uploaded documents (PDF/DOCX/XLSX/image): extracted text/tables plus cached AI summary/report. Original file bytes are not retained.';

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create index documents_owner_created_idx on public.documents (owner_id, created_at desc);

alter table public.documents enable row level security;

create policy "Owners can view own documents"
  on public.documents for select
  using (owner_id = auth.uid());

create policy "Owners can create own documents"
  on public.documents for insert
  with check (owner_id = auth.uid());

create policy "Owners can update own documents"
  on public.documents for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete own documents"
  on public.documents for delete
  using (owner_id = auth.uid());
