# Security

A summary of BuildRx's security posture, current as of the Phase 13 audit, for anyone extending or deploying this codebase.

## Authentication & authorization

- Sessions are Supabase Auth (email/password + Google OAuth), secure httpOnly cookies, no tokens in `localStorage`.
- Every table with user data has Postgres RLS enabled; almost nothing is filtered in application code alone. New tables get RLS in the same migration that creates them, never a follow-up.
- Recursive RLS checks (e.g. "is this user a member of this team") go through `SECURITY DEFINER` helper functions (`is_team_member`, `team_member_role`, `is_admin`) rather than a self-referencing policy, to avoid infinite-recursion errors. These functions are intentionally callable via RPC by `anon`/`authenticated` — the Supabase advisor flags that as a WARN on every scan; it's expected, not a gap, since the client legitimately calls them.
- `public.users` only grants `UPDATE` on `(name, avatar_url, onboarded)` to `authenticated` at the column level — `role` and `plan` cannot be self-escalated even if a client bypassed the UI.
- `public.handle_new_user()` (the signup trigger) has `EXECUTE` revoked from `anon`/`authenticated` — it's only ever meant to fire via the `on_auth_user_created` trigger, not be called directly through `/rest/v1/rpc/`.

## Rate limiting & quota enforcement

- `src/lib/rate-limit.ts` — in-memory sliding-window limiter. Single-instance only; on a multi-instance deployment, move this to Redis (Upstash) or similar before relying on it for hard limits.
- Every route that calls an AI provider is both rate-limited (per-minute, `NVIDIA_RATE_LIMIT_RPM` or 20/min default) and gated by the caller's monthly plan quota (402 once exhausted):
  - Session-based routes use `authorizeAiRequest()` (`src/lib/ai/route-helpers.ts`) or `enforceAiUsageLimits()` (`src/lib/ai/rate-guard.ts`) for routes that already do their own auth (Content Studio, Documents, RAG chat, Workflow runs).
  - Session-less routes (API keys, the inbound workflow webhook trigger) use `checkAiRequestLimitSessionless()` (`src/lib/ai/quota-sessionless.ts`) against the service-role client with an explicit owner filter — see the note in that file for why the session-based quota check (`lib/billing/limits.ts`, which relies on RLS to scope "the current user") silently no-ops when there's no session.
  - The inbound workflow webhook trigger additionally has its own token-keyed rate limit (30/min) independent of the quota check, since the token itself has no session to key a per-user limit off of.

## Outbound requests (SSRF)

- The workflow `webhook` step (`isSafeWebhookUrl()` in `src/lib/workflows/steps.ts`) blocks the obvious loopback/private-network hostnames (`localhost`, `127.*`, `0.0.0.0`, `::1`, `10.*`, `192.168.*`, etc.) before making an outbound POST. This is a pattern-match guard, not a full defense — it doesn't resolve DNS to catch a hostname that resolves to a private IP. Acceptable for a user-configured automation step; would need a resolve-then-check if this became a more general-purpose HTTP-fetching feature.

## Security headers

`next.config.ts` sets on every route: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and `Strict-Transport-Security` (2 years, subdomains, preload-eligible). The WebContainer preview route additionally gets `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` for `SharedArrayBuffer`.

**Known gap: no Content-Security-Policy.** Deliberately not added — the app embeds Monaco, Sandpack, and WebContainers (inline workers, blob URLs, eval-adjacent bundling) plus optional PostHog, and getting a CSP right for all of that without breaking the editor/preview needs hands-on testing against a real browser session, not a blind policy written from source inspection alone. Treat this as the next security task if it's picked up.

## Known dependency vulnerabilities (`npm audit --omit=dev`)

Three transitive advisories, none with a non-breaking fix available:

| Package | Via | Fix would require |
| --- | --- | --- |
| `dompurify` | `monaco-editor` | Upgrading `monaco-editor` to `0.56.0` (breaking) |
| `postcss` | `next` | Downgrading `next` to a `9.x` canary (absurd — would break the whole app) |
| `uuid` | `exceljs` | Upgrading `exceljs` past `3.5.0` (breaking) |

`npm audit fix --force` was deliberately not run, since it downgrades Next.js itself. Re-check these when the upstream packages ship a compatible patched release.

## Not controllable from this codebase

- **Leaked-password protection** (Supabase Auth → Policies → Password Security) is off. There's no Supabase MCP/API tool in this environment to toggle it — it needs to be enabled from the Supabase dashboard directly.
- **`public.rls_auto_enable()`** shows as a `SECURITY DEFINER`-executable-by-`anon` WARN but isn't defined in any migration in this repo — it's a Supabase-platform-managed function, not something this codebase created or owns, so no migration here alters it.
