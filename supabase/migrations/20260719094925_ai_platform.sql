-- ============================================================
-- 0013 · AI platform: multi-provider settings, model comparisons
-- ============================================================

create type public.ai_provider as enum (
  'nvidia',
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'grok'
);

-- Per-user default provider/model for the AI Settings page. One row per
-- user; upserted by the settings form.
create table public.user_ai_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  default_provider public.ai_provider not null default 'nvidia',
  default_model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_ai_settings is
  'Per-user default AI provider/model, set on the AI Settings page.';

create trigger user_ai_settings_updated_at
  before update on public.user_ai_settings
  for each row execute function public.set_updated_at();

alter table public.user_ai_settings enable row level security;

create policy "Users can view own AI settings"
  on public.user_ai_settings for select
  using (auth.uid() = user_id);

create policy "Users can upsert own AI settings"
  on public.user_ai_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own AI settings"
  on public.user_ai_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Saved "model comparison mode" runs: one prompt fanned out across
-- several provider/model pairs, with each result (text, tokens, cost,
-- latency) captured as it came back.
create table public.model_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  prompt text not null,
  -- [{ provider, model, text, promptTokens, completionTokens, costUsd, durationMs, error? }, …]
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.model_comparisons is
  'A single prompt run across multiple provider/model pairs side by side ("compare models" mode).';

create index model_comparisons_user_created_idx
  on public.model_comparisons (user_id, created_at desc);

alter table public.model_comparisons enable row level security;

create policy "Users can view own comparisons"
  on public.model_comparisons for select
  using (auth.uid() = user_id);

create policy "Users can create own comparisons"
  on public.model_comparisons for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own comparisons"
  on public.model_comparisons for delete
  using (auth.uid() = user_id);

-- Track which provider served each generation (was implicitly NVIDIA or
-- Anthropic before; now that /api/ai/complete can hit any of them, make
-- it explicit). Backfill existing rows from the model name they already
-- recorded, then default new rows to nvidia going forward.
alter table public.ai_generations
  add column provider public.ai_provider not null default 'nvidia';

update public.ai_generations
set provider = (case
  when model ilike 'claude%' then 'anthropic'
  when model ilike 'gpt-%' or model ilike 'o1%' or model ilike 'o3%' or model ilike 'o4%' then 'openai'
  when model ilike 'gemini%' then 'gemini'
  when model ilike 'deepseek%' then 'deepseek'
  when model ilike 'grok%' then 'grok'
  else 'nvidia'
end)::public.ai_provider
where true;

create index ai_generations_provider_idx on public.ai_generations (provider);
