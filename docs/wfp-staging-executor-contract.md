# BuildRx managed publishing — Workers for Platforms staging execution contract

**Stage:** engineering-only implementation. This does NOT deploy an app, turn on billing, create Cloudflare resources, configure DNS, or make one-click publishing available to customers.

## Why Workers for Platforms

Cloudflare Workers for Platforms (WFP) supports a dispatch namespace containing isolated customer Workers invoked by a platform-owned dispatch Worker. This fits BuildRx's goal of zero GitHub/Cloudflare credentials for customers better than granting broad Workers Builds access to individual customer repositories. The service is an operator-run paid product (Cloudflare documentation currently lists **$25/month** before overages); do not activate or subscribe without explicit approval and quota/spend controls.

Documentation:
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/how-workers-for-platforms-works/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/platform-examples/
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/

## What this PR implements

1. `src/lib/deploy/wfp-staging-artifact.ts`: stable opaque per-tenant/project Worker naming, single-module SHA-256 digest and short-lived HMAC attestation bound to tenant, project, source digest, builder ID and module hash.
2. `src/lib/deploy/wfp-staging-uploader.ts`: staging-only multipart WFP script upload interface. Requires two independent explicit switches, staging namespace and server-side operator-scoped token. All invalid/mismatched artifacts block **before** any network call.
3. `platform/dispatcher/src/index.ts`: Cloudflare dynamic-dispatch Worker sample that routes only verified app hostnames with trusted `status:live` mappings; missing, staging, disabled, malformed, spoofed or unknown routes return generic 404/503/502.
4. Mocked tests verify URL/host restrictions, no Cloudflare write without explicit staging settings, tenant identity isolation, time-limited artifact signatures, tamper resistance, no secret leakage and no fake live URL.

## Staging-only environment (do not enable on BuildRx web frontend)

Only an isolated deploy worker — not the Next.js web server — may receive:

```
BUILDRX_MANAGED_WFP_STAGING_UPLOAD_ENABLED=false
BUILDRX_MANAGED_WFP_EXECUTOR_CONTEXT=disabled
BUILDRX_MANAGED_WFP_STAGING_NAMESPACE=buildrx-staging
# BUILDRX_MANAGED_WFP_ACCOUNT_ID=<operator account id>
# BUILDRX_MANAGED_WFP_STAGING_UPLOAD_TOKEN=<narrow staging-only credential>
# BUILDRX_MANAGED_WFP_ARTIFACT_VERIFY_KEY=<secret shared with trusted isolated builder>
# BUILDRX_MANAGED_WFP_TRUSTED_BUILDER_ID=isolated-builder-v1
```

Both execution flags must be deliberately changed and the staging namespace must match exactly `buildrx-staging`. There is **no public HTTP endpoint** that calls this library. This is NOT sufficient to make it safe to deploy untrusted applications: before enabling, the future builder must produce signed artifacts from an immutable verified source snapshot in a sandbox with no operator secrets; a separate deploy worker must compare source digests and enforce tenant quotas with durable idempotent state.

Cloudflare WFP docs: the script upload uses `PUT /accounts/{id}/workers/dispatch/namespaces/buildrx-staging/scripts/{name}` with multipart `metadata` and JS module. The code never permits production namespace uploading. A 2xx result only means `uploaded_unverified`; **it never means live or returns a hostname**.

## Standalone dispatch Worker

`platform/dispatcher/src/index.ts` is *not deployed or wired to the BuildRx web app*. It requires:

- An operator-controlled domain, for example `apps.example.com`, verified and routed in Cloudflare (no actual domain configured by this PR).
- `APP_BASE_DOMAIN` as the exact domain suffix.
- An `APP_ROUTES` KV binding whose values are written **only after** a trusted deployment smoke test and a durable release promotion: `{workerName: 'brx-...', status:'live', releaseId:'64 hex characters'}`.
- A `TENANT_WORKERS` WFP dispatch namespace binding.
- Real per-tenant resource limits and egress protections configured with Cloudflare's WFP controls.

The dispatcher never guesses a Worker, trusts X-Forwarded-Host, or serves unpromoted source. Route records and DNS must be provisioned by a separately reviewed service, not by a customer request.

## Important limitations and next engineering slice

- No source-to-OpenNext artifact builder exists yet. The uploader handles only **one prebuilt JS module** and does not support full Next.js module graphs, static assets, private bindings or databases. It cannot make an arbitrary generated Next.js application work yet.
- No durable job queue, transactionally enforced quotas, billing entitlement, immutable signed source snapshot, artifact store, hostname availability verification, active/previous-good release state, promotion or rollback exists.
- WFP requires an operator-owned paid subscription and managed namespace. Do not assume it is free or deployed.
- No real Cloudflare API calls occur in automated tests. Existing manual Cloudflare GitHub handoff remains the only available Cloudflare publish path.

Next safe slice: isolated OpenNext compiler that emits a signed bundle with module graphs/assets; durable idempotent release reservations and limits; staging upload and true HTTPS functional certification; atomic hostname promotion to keep previous good release on failure; then a narrow customer-facing Publish button.

## Reversal

Revert this PR or leave staging switches unset. No migrations, Cloudflare settings, Github secrets, new infrastructure or production data were changed.
