create policy "Team members can view teammates' profiles"
  on public.users for select
  using (
    exists (
      select 1
      from public.team_members mine
      join public.team_members theirs on theirs.team_id = mine.team_id
      where mine.user_id = auth.uid()
        and theirs.user_id = users.id
    )
  );
