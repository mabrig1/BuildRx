# Managed publishing preflight (issue #42)

This is an internal, read-only engineering slice. It does not implement managed
hosting, create releases, queue builds, reserve names or publish applications.
Existing Launch, Cloudflare setup and template flows are unchanged.

## Endpoint and flag

GET /api/deploy/managed/preflight?projectId=<uuid>

Disabled by default (404). BUILDRX_MANAGED_PREFLIGHT_ENABLED=true exposes
diagnostics only. It never enables publication. Signed-in non-demo owners may
inspect their project; ownership failures stop before source reads.
All responses use Cache-Control: no-store.

The result always has canPublish=false and deployed=false. Missing or unverified
safeguards are stable blocker codes. No live URL, credential value, account ID,
source contents or provider error detail is returned. No client-supplied
verification, quotas, tenant identity or operator configuration is trusted.

## Configuration contract, not operator setup

The following proposed server-only names are checked for presence, without any
provider request: BUILDRX_MANAGED_CF_ACCOUNT_ID,
BUILDRX_MANAGED_CF_BUILDS_TOKEN, BUILDRX_MANAGED_CF_BUILD_TOKEN_UUID,
BUILDRX_MANAGED_SOURCE_TOKEN. Do not add real secrets for this slice.
Presence changes only the diagnostic from missing configuration to unverified
authorization. It cannot remove the execution blocker.

## Exact source and future release contract

The source digest hashes a versioned JSON array of sorted path/content pairs
after existing deployment exclusions. It covers a bounded single-query snapshot,
not a branch name or mutable Ready label. Invalid, incomplete or credential-like
source receives no digest. Existing credential detection is heuristic, not proof
that arbitrary source is safe to execute.

ManagedRelease describes server-owned tenant/project IDs, source digest,
provider deployment ID, artifact hash, verified hostname and previous-good
release ID. Nothing persists it yet. Its fields do not grant permission.

The endpoint deliberately supplies no verification attestation because the
repository has no trusted durable attestation tied to this snapshot. Before an
executor is added, persist immutable source, have an isolated builder attest to
that same digest, and atomically revalidate ownership/entitlement and reserve
quota when enqueueing. Recompute artifact evidence separately after platform
configuration is applied. Changes after preflight must never reuse old approval.

## Remaining gates

Choose and review Workers for Platforms versus managed Builds. Establish
restricted operator credentials and repositories, unique tenant resource mapping,
isolated builds without shared deployment credentials, runtime compatibility,
atomic quotas/spend limits, idempotent durable jobs, abuse controls and cleanup.
Retrieve a real provider hostname; bind smoke tests to the exact deployment.
Only verified HTTPS/routes/auth/CRUD/integrations may promote a release to live.
Retain the previous-good release and test rollback before enabling customers.
Do not reuse the manual workflow as the shared credential-bearing build runner.

## Verification and reversal

Unit tests cover deterministic/content-sensitive hashing, secret filtering,
invalid source and stale/failed evidence. Route tests cover flag/auth/ownership,
database errors, overflow, sanitized output and no external calls/writes.
Run the standard CI suite. No live tests or provider credentials are required.
Revert the additive files, or leave the flag unset. No migrations, production
data changes, tokens, Workers or Cloudflare settings are required.
