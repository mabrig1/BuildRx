create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.api_keys is
  'Self-service API keys for /api/v1/*. Only a SHA-256 hash and short prefix are stored — the raw key is shown once at creation.';

create index api_keys_owner_id_idx on public.api_keys (owner_id);
create index api_keys_key_hash_idx on public.api_keys (key_hash);

alter table public.api_keys enable row level security;

create policy "Owners manage their API keys"
  on public.api_keys for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
