# Cloudflare one-click readiness — bounded second slice (2026-11-07)

**This does not turn on one-click publishing.** The new functionality verifies specific operator-side Cloudflare API prerequisites without creating or deploying Workers, spending funds, or exposing any credentials. BuildRx issue #42 remains open.

## What was implemented

1. PR #46 merged: DevShield rejects malicious source before cloud preparation, GitHub push/pull and provider deployment.
2. PR #45 merged: owner-scoped, feature-flagged managed preflight returns source digest and explicit blockers, never a fake URL or deploy permission.
3. This change binds the managed source digest to DevShield malware detection. Suspect or unscannable source receives no digest or usable verification.
4. New *admin-only*, feature-flagged operator preflight checks Cloudflare's documented **GET** endpoints for Workers Scripts and Builds tokens. It checks the configured build token UUID exists. It **never** creates a token, starts a build, changes a worker or exports source.
5. The Launch panel includes an optional user-triggered check that explains managed hosting availability honestly, preserving the existing Cloudflare GitHub handoff.

## Operator API

GET /api/admin/cloudflare/managed-readiness

Disabled unless BUILDRX_MANAGED_OPERATOR_PREFLIGHT_ENABLED=true. Also refuses demo/no-auth installations. Only authenticated admin-role users may invoke it.

Configuration names (server-only, never NEXT_PUBLIC_):

- BUILDRX_MANAGED_CF_ACCOUNT_ID: 32-character Cloudflare account ID.
- BUILDRX_MANAGED_CF_BUILDS_TOKEN: user-scoped Cloudflare Workers Builds Configuration token (requires Workers Scripts Read for the script list).
- BUILDRX_MANAGED_CF_BUILD_TOKEN_UUID: UUID of an existing Cloudflare build/deploy token.
- BUILDRX_MANAGED_SOURCE_TOKEN: reserved operator source control credential. Presence only: this check **does not** verify GitHub App authorization.

The source-control credential must never be supplied by a BuildRx customer. Do not grant cloud deploy permissions to tenant source repositories or pass owner credentials to a build worker.

Probe behavior:

- Missing/malformed configuration: **zero network requests**.
- Configured: two read-only requests against fixed api.cloudflare.com endpoints, timeout 8s each.
- Provider error response bodies, tokens, account ID, build-token UUID and raw Worker names are not returned to users.
- Even when both read checks pass: `readyForManagedPublishing: false`. Token presence is **not** proof of correct per-project worker binding, Github App installation, build orchestration, isolated tenants, quota and spending enforcement, rollback or live URL health.

Official reference (2026-10-30): https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/
Cloudflare Workers for Platforms alternative: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/

## Required for real managed one-click launch (NOT IMPLEMENTED)

- Choose an operator-funded architecture (Workers for Platforms preferred for tenant-isolated scripts, or carefully governed Workers Builds); scope an isolated resource and unique stable identity per app.
- Verify hosting entitlements, account-level spending caps and per-tenant quotas *atomically* before accepting jobs.
- Store an immutable, verified release snapshot and digest; isolated builder must not inherit web-server credentials or execute untrusted packages in the web request.
- Privileged deploy worker must receive only signed artifacts with an attested hash, not arbitrary user-provided code, and be allowed to deploy only its tenant namespace.
- Durable idempotent publish state and explicit rollback to a last-known-good release; reject duplicate and stale jobs.
- Verify a Cloudflare-provided HTTPS hostname, health and relevant app flows (auth, DB writes where applicable) before marking live.
- Only after these pass may the one-click button say Publish rather than Prepare, and only after a real staging end-to-end trial.

## Verification and rollback

Use npm run lint, npm run typecheck, npm test, npm run build, and npm run certify:generated-app. Unit tests exercise read-only Cloudflare auth, no token leakage, missing settings and stale/unsafe source denial. Admin route tests deny anonymous/demo accounts. Nothing is deployed by this PR.

Rollback: revert the PR or leave the two feature flags unset. No new storage schema or Cloudflare account configuration changes.
