-- ============================================================
-- 0013 · Security hardening
-- Fixes flagged by the Supabase security advisor:
--  1. public.set_updated_at had a mutable search_path (WARN:
--     function_search_path_mutable) — pin it, same as every other
--     SECURITY DEFINER function in this schema already does.
--  2. public.handle_new_user is only ever invoked by the
--     on_auth_user_created trigger on auth.users, never called
--     directly by clients — revoke the default PUBLIC execute grant
--     so it isn't reachable via /rest/v1/rpc/handle_new_user (WARN:
--     anon/authenticated_security_definer_function_executable).
--     Trigger firing does not require an EXECUTE grant, so this
--     doesn't affect signup.
-- ============================================================

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
