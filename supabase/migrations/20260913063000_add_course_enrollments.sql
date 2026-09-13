-- One-time premium course entitlements for MABRIG Tech+.
-- Payment activation is written only by trusted server code using the service role.

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  course_slug text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'refunded', 'revoked')),
  provider text,
  provider_ref text unique,
  amount numeric(12,2) not null default 0,
  currency text not null default 'NGN',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_slug)
);

create index if not exists course_enrollments_user_id_idx
  on public.course_enrollments (user_id);

create index if not exists course_enrollments_course_slug_idx
  on public.course_enrollments (course_slug);

alter table public.course_enrollments enable row level security;

create policy "Users can view own course enrollments"
  on public.course_enrollments for select
  using (auth.uid() = user_id);

create policy "Admins can view all course enrollments"
  on public.course_enrollments for select
  using (public.is_admin());
