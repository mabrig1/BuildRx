-- Follow-up to 20260719000800_teams.sql: public.users is self-view-only
-- (plus admins), so without this, a team member roster would show
-- nothing but the current user's own name/email — every other
-- member's public.users row is invisible under existing RLS. This
-- adds one additive SELECT policy: visible to a user if they share
-- any team with the row's owner. Existing policies are untouched.

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
