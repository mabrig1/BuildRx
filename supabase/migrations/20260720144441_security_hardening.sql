-- NOTE: this is the *recorded* security_hardening migration, synced
-- from the live DB. Around the same time it was applied, an
-- unrecorded SQL run also revoked all DML on public tables from
-- anon/authenticated/service_role, which broke the app; that damage
-- is reverted by 20260720201205_restore_role_grants.sql.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
