-- Phase 8: Team Features — teams, membership, invites, and additive
-- sharing of projects with a team. Additive throughout: no existing
-- policy is dropped or narrowed, only new permissive policies are
-- added (Postgres OR's multiple permissive policies for the same
-- command together), so personal/owner-only access keeps working
-- exactly as before.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teams_owner_id_idx on public.teams (owner_id);

create trigger teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index team_members_team_id_idx on public.team_members (team_id);
create index team_members_user_id_idx on public.team_members (user_id);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index team_invites_team_id_idx on public.team_invites (team_id);

-- Helper functions -------------------------------------------------
-- security definer so team_members' own RLS policies can call these
-- without recursing into themselves (the standard Supabase pattern
-- for membership checks).

create function public.is_team_member(check_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = check_team_id and user_id = auth.uid()
  );
$$;

comment on function public.is_team_member is
  'True if the current user belongs to the given team. security definer to avoid RLS recursion on team_members.';

create function public.team_member_role(check_team_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.team_members
  where team_id = check_team_id and user_id = auth.uid()
  limit 1;
$$;

comment on function public.team_member_role is
  'The current user''s role on the given team, or null if not a member.';

-- RLS: teams ---------------------------------------------------------
alter table public.teams enable row level security;

create policy "Members can view their teams"
  on public.teams for select
  using (public.is_team_member(id));

create policy "Users can create teams they own"
  on public.teams for insert
  with check (owner_id = auth.uid());

create policy "Owners can update their teams"
  on public.teams for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete their teams"
  on public.teams for delete
  using (owner_id = auth.uid());

-- RLS: team_members ----------------------------------------------------
alter table public.team_members enable row level security;

create policy "Members can view their team's roster"
  on public.team_members for select
  using (public.is_team_member(team_id));

create policy "Users can add themselves as owner of a team they own"
  on public.team_members for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid())
  );

create policy "Users can join via a pending invite addressed to them"
  on public.team_members for insert
  with check (
    user_id = auth.uid()
    and role <> 'owner'
    and exists (
      select 1 from public.team_invites i
      where i.team_id = team_members.team_id
        and i.status = 'pending'
        and i.expires_at > now()
        and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- Owners/admins can promote/demote between admin and member — the
-- owner row itself is untouched by this policy (old role <> 'owner'),
-- so ownership can never change or be granted through it.
create policy "Owners and admins can change a member's role"
  on public.team_members for update
  using (role <> 'owner' and public.team_member_role(team_id) in ('owner', 'admin'))
  with check (role in ('admin', 'member'));

create policy "Members can leave, owners and admins can remove members"
  on public.team_members for delete
  using (
    (user_id = auth.uid() and role <> 'owner')
    or public.team_member_role(team_id) in ('owner', 'admin')
  );

-- RLS: team_invites ----------------------------------------------------
alter table public.team_invites enable row level security;

create policy "Owners and admins can view their team's invites"
  on public.team_invites for select
  using (public.team_member_role(team_id) in ('owner', 'admin'));

create policy "Owners and admins can create invites"
  on public.team_invites for insert
  with check (
    invited_by = auth.uid()
    and public.team_member_role(team_id) in ('owner', 'admin')
  );

create policy "Owners and admins can revoke invites"
  on public.team_invites for delete
  using (public.team_member_role(team_id) in ('owner', 'admin'));

-- Additive team-sharing for projects ------------------------------
-- A project's owner_id never changes — team_id just optionally opens
-- it up to collaborators. Existing owner-only/public/admin policies
-- are untouched.

alter table public.projects add column team_id uuid references public.teams (id) on delete set null;

create index projects_team_id_idx on public.projects (team_id) where team_id is not null;

create policy "Team members can view team projects"
  on public.projects for select
  using (team_id is not null and public.is_team_member(team_id));

-- with check still requires team_id is not null, so a team member
-- cannot use this policy to unshare a project (that stays an
-- owner-only action via the existing owner update policy).
create policy "Team members can update team projects"
  on public.projects for update
  using (team_id is not null and public.is_team_member(team_id))
  with check (team_id is not null and public.is_team_member(team_id));

create policy "Team members can view team project files"
  on public.project_files for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.team_id is not null and public.is_team_member(p.team_id)
    )
  );

create policy "Team members can create team project files"
  on public.project_files for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.team_id is not null and public.is_team_member(p.team_id)
    )
  );

create policy "Team members can update team project files"
  on public.project_files for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.team_id is not null and public.is_team_member(p.team_id)
    )
  );

create policy "Team members can delete team project files"
  on public.project_files for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.team_id is not null and public.is_team_member(p.team_id)
    )
  );
