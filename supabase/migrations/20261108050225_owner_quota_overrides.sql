-- Account-scoped BuildRx plan-quota overrides.
-- Applied to the BuildRx Supabase project as migration 20261108050225.
-- Only authenticated users can read their own flags. Writes are operator/service-role only.
-- These flags do not bypass provider limits, abuse protections, or rate limits.
CREATE TABLE public.account_quota_overrides (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  unlimited_projects boolean NOT NULL DEFAULT false,
  unlimited_ai_requests boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.account_quota_overrides IS
  'Privileged, revocable exemptions from BuildRx application plan quotas; not from provider budgets or safety rate limits.';

ALTER TABLE public.account_quota_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account owners can read own quota exemptions"
ON public.account_quota_overrides FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

REVOKE ALL ON TABLE public.account_quota_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.account_quota_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_quota_overrides TO service_role;
