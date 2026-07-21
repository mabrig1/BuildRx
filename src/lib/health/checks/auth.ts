import { classifyThrown } from "@/lib/health/error-response";
import { withRetry } from "@/lib/health/retry";
import type { CheckResult, FixCandidate, HealthStatus } from "@/lib/health/types";
import { isSupabaseConfigured, supabaseServiceRoleKey } from "@/lib/supabase/config";

export interface AuthCheckOutcome {
  result: CheckResult;
  fixes: FixCandidate[];
}

/**
 * Authentication Agent: confirms the service-role key works against
 * the Auth admin API, and looks for the specific failure mode that
 * broke signups once already — a public.users profile row missing
 * for a real auth.users account (see health_auth_profile_gap()).
 */
export async function checkAuth(): Promise<AuthCheckOutcome> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return {
      result: {
        subsystem: "auth",
        label: "Authentication",
        status: "degraded",
        summary: "Running in demo mode — Supabase is not configured, so sign-in is disabled.",
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
      fixes: [],
    };
  }

  if (!supabaseServiceRoleKey()) {
    return {
      result: {
        subsystem: "auth",
        label: "Authentication",
        status: "down",
        summary:
          "SUPABASE_SERVICE_ROLE_KEY is not set — server-side auth admin calls and RLS-bypassing writes (signup backfill, chat persistence) will fail.",
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
      fixes: [],
    };
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const [usersProbe, gapProbe] = await Promise.all([
      withRetry(() => supabase.auth.admin.listUsers({ page: 1, perPage: 1 }), {
        attempts: 2,
      }),
      withRetry(() => supabase.rpc("health_auth_profile_gap"), { attempts: 2 }),
    ]);

    if (usersProbe.error) throw usersProbe.error;
    if (gapProbe.error) throw gapProbe.error;

    const gap = gapProbe.data ?? 0;
    const fixes: FixCandidate[] = [];
    if (gap > 0) {
      fixes.push({
        code: "AUTH_PROFILE_GAP",
        title: `Backfill ${gap} missing user profile(s)`,
        description: `${gap} account(s) exist in auth.users with no matching public.users row — those users hit foreign-key errors ("Your account profile is incomplete") anywhere a project, subscription, or usage row is created, because the signup trigger silently failed for them.`,
        sqlFix: `insert into public.users (id, email, name, avatar_url)\nselect au.id, au.email, au.raw_user_meta_data ->> 'name', au.raw_user_meta_data ->> 'avatar_url'\nfrom auth.users au\nleft join public.users pu on pu.id = au.id\nwhere pu.id is null\non conflict (id) do nothing;`,
      });
    }

    const status: HealthStatus = gap > 0 ? "degraded" : "healthy";
    const summary =
      gap > 0
        ? `${gap} signed-up user(s) are missing an application profile row.`
        : "Auth admin API reachable; every signed-up user has a profile.";

    return {
      result: {
        subsystem: "auth",
        label: "Authentication",
        status,
        summary,
        detail: { profileGap: gap },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
      fixes,
    };
  } catch (error) {
    const diagnosed = classifyThrown(error, "auth");
    return {
      result: {
        subsystem: "auth",
        label: "Authentication",
        status: "down",
        summary: diagnosed.message,
        detail: { cause: diagnosed.cause, code: diagnosed.code },
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
      fixes: [],
    };
  }
}
