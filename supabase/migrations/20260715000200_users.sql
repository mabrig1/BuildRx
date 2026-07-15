-- ============================================================
-- 0002 · Users
-- Application users, mirroring auth.users one-to-one.
-- ============================================================

create table public.users (
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

comment on table public.users is
  'Application profile for each auth.users row; created automatically on signup.';

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-create the application user when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, name, avatar_url)
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

-- Admin check used across RLS policies. SECURITY DEFINER avoids
-- recursive RLS evaluation against public.users.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Row Level Security ------------------------------------------
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
  using (public.is_admin());

-- Column-level privileges: regular users may only change their own
-- name / avatar / onboarding flag — never role or plan.
revoke update on public.users from authenticated, anon;
grant update (name, avatar_url, onboarded) on public.users to authenticated;
