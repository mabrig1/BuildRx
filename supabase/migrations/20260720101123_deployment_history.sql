create policy "Owners can delete project deployments"
  on public.deployments for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
