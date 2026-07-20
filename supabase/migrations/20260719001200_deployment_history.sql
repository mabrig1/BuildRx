-- Phase 12: Deployment — lets a project owner delete a deployment
-- history entry (previously there was no DELETE policy on
-- deployments at all, so the history list could only ever grow).

create policy "Owners can delete project deployments"
  on public.deployments for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
