# Cloudflare Workers for Platforms: isolated-artifact release boundary (November 7, 2026)

## Objective

Give BuildRx customers a future **one-click Publish** flow without requiring GitHub or Cloudflare accounts. This PR is an executable, tested provider adapter and readiness/smoke-check contract, NOT a live release mechanism. User-facing publishing remains the existing verified provider flow and the guided Cloudflare handoff.

## Platform architecture decision

Use **Workers for Platforms (WfP)** for tenant-generated Workers rather than putting arbitrary customer programs directly into founder-owned standalone Workers. Cloudflare's recommended architecture is one shared dispatch namespace per environment (`buildrx-staging`, `buildrx-production`), one isolated user Worker script per application, and a trusted dispatch Worker that enforces routing and controls. Do NOT create a namespace per customer.

Sources:
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/how-workers-for-platforms-works/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/platform-examples/
- https://developers.cloudflare.com/api/resources/workers_for_platforms/subresources/dispatch/

## Implemented code

- `cloudflare-wfp-readiness.ts`: read-only GET of a specifically configured dispatch namespace. Result never claims the service is publish-ready.
- `GET /api/admin/cloudflare/wfp-readiness`: admin-only, off by default, refuses demo mode, never returns the operator account ID or API token.
- `cloudflare-wfp-artifact.ts`: versioned canonical Ed25519 signed build attestation, independent durable-lease consistency checks, SHA-256 artifact hash, 10-minute maximum attestation validity, strict project/tenant IDs, stable script name, 2 MB single-module cap. Only when a private operator flag is enabled can a trusted caller send a multipart PUT to a fixed WfP user-Worker API endpoint. The module is NOT imported by any HTTP upload or publish route.
- `cloudflare-wfp-smoke.ts`: no-redirect GET health probe with a per-request unpredictable nonce and artifact-digest echo; verifies an exact operator-configured dispatch hostname, with no user-provided URL. A successful smoke probe is not full application certification.
- Regression tests cover modified artifacts, invalid proof/lease/signature, tenant mismatches, disabled flags, Cloudflare error responses, hostname restrictions, redirects and stale smoke results.

## Critical boundary before one-click can go live

**The uploader cannot publish a Next.js source checkout directly.** WfP accepts built Worker modules; the current adapter handles only an *already compiled single ES module*, without static assets or resource bindings. Existing BuildRx Next.js 15 applications require an isolated OpenNext build pipeline plus an asset-publishing flow, and per-project service/configuration checks. Do NOT send raw `package.json` or source code to this adapter as a compiled artifact.

The pending private coordinator must establish all of the following, before enabling any feature flag:

1. Authenticated project owner, verified App Router build and DevShield source checks, immutable source digest.
2. A durable, transactionally reserved release job and quota lease with a unique idempotency key and atomically enforced tenant project/spend limits.
3. A *separate unprivileged build sandbox* with no Cloudflare token, GitHub token, database credentials or unrelated tenant data. Run npm lifecycle scripts only in that sandbox.
4. An independently trusted signing service that only signs verified artifact SHA-256, source SHA-256, owner/project identity, namespace, lease ID, idempotency key and short expiry. Never give signing keys to the builder or customers.
5. A trusted database read of the same persisted lease and account-scoped deployment mapping by the private operator worker. A fake user boolean/object must never be accepted as lease proof.
6. A scoped WfP token kept only in the private deployment worker, not in the BuildRx web frontend or an untrusted build environment. Confirm outbound network restrictions, namespace quotas and dispatch routing.
7. Versioned asset uploads/bindings, a rollback path to the last known good artifact, and exact-origin HTTPS + auth/database/function integration smoke tests. The app must not be marked LIVE merely because Cloudflare returned success to a script PUT.

## Environment (leave OFF now)

Set `BUILDRX_WFP_OPERATOR_READINESS_ENABLED=true` ONLY for authenticated, read-only operator diagnostics. `BUILDRX_WFP_ARTIFACT_UPLOAD_ENABLED` is **false by default** and has no caller in production.

Separate operator settings are `BUILDRX_MANAGED_WFP_ACCOUNT_ID`, `BUILDRX_MANAGED_WFP_API_TOKEN`, `BUILDRX_MANAGED_WFP_NAMESPACE` and `BUILDRX_WFP_DISPATCH_HOST`. All must remain server-only; never use `NEXT_PUBLIC_`. A real backend should independently verify namespace ownership and durable per-project lease before importing the uploader.

## Verification and rollback

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run certify:generated-app`. These unit tests mock HTTP and do not contact Cloudflare. The feature changes no database tables, bills, DNS records, Workers, tokens, secrets, production permissions or deployments.

Rollback by reverting the PR, or leave both new flags false. BuildRx issue #42 remains open until a nontechnical new user actually publishes and updates a verified app using the isolated system, with real hostname and rollback tests.
