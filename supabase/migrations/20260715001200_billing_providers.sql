-- ============================================================
-- 0012 · Billing providers (Paystack / Flutterwave) + invoices
-- ============================================================

-- Provider-agnostic subscription references.
alter table public.subscriptions
  add column provider text,
  add column provider_ref text;

alter table public.subscriptions
  add constraint subscriptions_provider_check check (
    provider is null or provider in ('paystack', 'flutterwave', 'stripe')
  );

comment on column public.subscriptions.provider_ref is
  'Provider-side reference (transaction/subscription code).';

-- Invoices: one row per successful (or attempted) charge.
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null,
  reference text not null unique,
  plan public.plan_id not null,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  status text not null default 'paid',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invoices_provider_check check (
    provider in ('paystack', 'flutterwave', 'stripe')
  ),
  constraint invoices_status_check check (
    status in ('paid', 'pending', 'failed', 'refunded')
  )
);

comment on table public.invoices is
  'Billing invoices; written by the server (webhooks/verification) only.';

create index invoices_user_created_idx
  on public.invoices (user_id, created_at desc);

alter table public.invoices enable row level security;

-- Users read their own invoices; all writes are service-role.
create policy "Users can view own invoices"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "Admins can view all invoices"
  on public.invoices for select
  using (public.is_admin());
