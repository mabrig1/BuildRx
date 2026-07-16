-- ============================================================
-- 0011 · Deployment providers
-- Provider-aware deployments with logs, plus custom domains.
-- ============================================================

alter table public.deployments
  add column provider text not null default 'app-creator',
  add column logs text,
  add column domain text;

alter table public.deployments
  add constraint deployments_provider_check check (
    provider in ('app-creator', 'vercel', 'netlify', 'railway')
  );

comment on column public.deployments.logs is
  'Build/deploy log captured during the deployment run.';

-- Owners may update their own deployment records (status transitions
-- are driven by the server acting on the owner''s session).
create policy "Owners can update project deployments"
  on public.deployments for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

alter table public.projects
  add column custom_domain text;

comment on column public.projects.custom_domain is
  'Custom domain attached to the deployed project.';
