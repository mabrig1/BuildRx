-- Tighten function EXECUTE grants flagged by the security advisor.

-- Event-trigger function: invoked by the system on DDL, never by
-- clients — no API role needs EXECUTE.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated, service_role;

-- Signed-in users legitimately bump install counts from the app;
-- anonymous visitors have no reason to (spammable counter).
revoke execute on function public.increment_template_installs(uuid)
  from public, anon;

-- NOT revoked (required at query time by RLS policy evaluation for
-- both anon and authenticated): is_admin(), is_team_member(uuid),
-- team_member_role(uuid).
