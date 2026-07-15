-- ============================================================
-- 0001 · Enums and shared functions
-- ============================================================

-- Enums -------------------------------------------------------
create type public.user_role as enum ('user', 'admin');

create type public.plan_id as enum ('free', 'pro', 'team');

create type public.project_status as enum (
  'draft',
  'generating',
  'ready',
  'error',
  'archived'
);

create type public.deployment_status as enum (
  'queued',
  'building',
  'live',
  'failed',
  'canceled'
);

create type public.chat_role as enum ('user', 'assistant', 'system');

create type public.generation_status as enum (
  'pending',
  'streaming',
  'completed',
  'failed'
);

create type public.subscription_status as enum (
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete'
);

-- Shared functions --------------------------------------------

-- Keeps updated_at current on any table that attaches the trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
