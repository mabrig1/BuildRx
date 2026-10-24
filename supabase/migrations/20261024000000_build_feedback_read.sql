-- Owner-scoped feedback read. Retain the existing admin analytics policy and
-- insert policy; do not reveal other analytics event families to users.
-- Apply only after review; this migration is never executed by the agent.
create policy "Project owners read their own build feedback"
  on public.analytics for select
  to authenticated
  using (
    event_type = 'build_feedback'
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.owner_id = (select auth.uid())
    )
  );
