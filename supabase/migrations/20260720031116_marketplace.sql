alter table public.templates add column source_project_id uuid references public.projects (id) on delete set null;
alter table public.templates add column install_count integer not null default 0;

create index templates_install_count_idx
  on public.templates (install_count desc)
  where is_active;

create policy "Users can view their own templates"
  on public.templates for select
  using (created_by = auth.uid());

create policy "Users can publish their own templates"
  on public.templates for insert
  with check (created_by = auth.uid());

create policy "Users can update their own templates"
  on public.templates for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Users can delete their own templates"
  on public.templates for delete
  using (created_by = auth.uid());

create function public.increment_template_installs(target_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.templates
  set install_count = install_count + 1
  where id = target_id and is_active;
$$;

comment on function public.increment_template_installs is
  'Bumps a template''s install_count by 1. security definer so any signed-in user can call it without a general UPDATE grant on templates.';
