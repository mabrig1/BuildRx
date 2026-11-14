-- MABRIG BuildRx Client Management Center: user-owned support and private admin notes.
-- These tables contain private client information and must never be public.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in (
    'paid-course', 'account', 'builder', 'lab', 'deployment', 'billing', 'other'
  )),
  subject text not null check (char_length(btrim(subject)) between 5 and 160),
  message text not null check (char_length(btrim(message)) between 12 and 2000),
  reference text check (reference is null or char_length(reference) <= 140),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  last_updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);
drop trigger if exists support_tickets_updated_at on public.support_tickets;
create trigger support_tickets_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;
create policy "Users view own tickets" on public.support_tickets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Admins view all tickets" on public.support_tickets
  for select to authenticated using (public.is_admin());
create policy "Signed-in users create only their own open tickets"
  on public.support_tickets for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'open'
    and priority = 'normal' and last_updated_by is null);
create policy "Admins manage ticket state"
  on public.support_tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Column grants prevent a signed-in user from forging an "urgent",
-- "resolved", or "assigned" ticket using the Data API.
revoke all on public.support_tickets from anon, authenticated;
grant select on public.support_tickets to authenticated;
grant insert (user_id, category, subject, message, reference)
  on public.support_tickets to authenticated;
grant update (status, priority, last_updated_by)
  on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  content text not null check (char_length(btrim(content)) between 8 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists client_notes_client_created_idx
  on public.client_notes (client_id, created_at desc);
alter table public.client_notes enable row level security;
create policy "Admins view private client notes" on public.client_notes
  for select to authenticated using (public.is_admin());
create policy "Admins create their own private client notes" on public.client_notes
  for insert to authenticated
  with check (public.is_admin() and author_id = (select auth.uid()));

revoke all on public.client_notes from anon, authenticated;
grant select, insert (client_id, author_id, content) on public.client_notes to authenticated;
grant all on public.client_notes to service_role;
