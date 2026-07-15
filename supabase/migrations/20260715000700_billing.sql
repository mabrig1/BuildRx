-- ============================================================
-- 0007 · Billing: subscriptions and usage logs
-- ============================================================

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  plan public.plan_id not null default 'free',
  status public.subscription_status not null default 'active',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'One row per user; kept in sync with Stripe by the webhook handler.';

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Metered actions used for plan limits and billing.
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  action text not null,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint usage_logs_action_check check (
    action in ('ai_message', 'ai_generation', 'deployment', 'preview', 'export')
  )
);

comment on table public.usage_logs is
  'Append-only metering of billable actions; written by the service role.';

-- Indexes ------------------------------------------------------
create index usage_logs_user_created_idx
  on public.usage_logs (user_id, created_at desc);
create index usage_logs_action_created_idx
  on public.usage_logs (action, created_at desc);
create index usage_logs_project_id_idx on public.usage_logs (project_id);

-- Row Level Security ------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.usage_logs enable row level security;

-- Subscriptions: users read their own; all writes go through the
-- service role (Stripe webhooks).
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Admins can view all subscriptions"
  on public.subscriptions for select
  using (public.is_admin());

-- Usage logs: users read their own; inserts are service-role only so
-- clients cannot forge or suppress metering.
create policy "Users can view own usage"
  on public.usage_logs for select
  using (auth.uid() = user_id);

create policy "Admins can view all usage"
  on public.usage_logs for select
  using (public.is_admin());
