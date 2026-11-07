# DevShield AI preflight integration for BuildRx (2026-11-07)

## Enforcement

BuildRx now screens in-memory, bounded source snapshots before:
- Importing pinned MIT GitHub starters (before creating project records).
- Pulling linked GitHub code into project storage (after verified ownership).
- Pushing edited source to GitHub, which might trigger CI/CD.
- Preparing Cloudflare Workers source and making a GitHub repository commit.
- Sending real source to Vercel, Netlify or Railway deployments.

Users can click **Launch → Check my app security**, or call GET /api/projects/security-preflight?projectId=<uuid>. The endpoint verifies ownership, returns redacted evidence, never publishes code, and disables caching. All server-side publishing handlers rescan; skipping the button does not bypass checks.

## Provenance

Static detector adapted from mabrig1/mabrig-devshield-ai PR #42, immutable merge commit 92a54b59170ff150387f63e1bfeb92a0151964f5:
https://github.com/mabrig1/mabrig-devshield-ai/pull/42

Checks the November 2026 Dr.Web indicators, suspicious Visual Studio/MSBuild build hooks, PowerShell encoded/download-to-execute commands, whitespace-hidden Python/Go operations, Python decoded execution, Go PowerShell invocation, and BuildRx-specific unsafe npm lifecycle/package scripts.

## Fail-closed safety boundary

- Scans inspect file strings only; never execute imported code, npm, git, shells or network operations.
- An incomplete source scan or high/critical finding prevents source import or deployment.
- Reports expose only fixed messages, file paths, line numbers and rule IDs, never matched source or credentials.
- A report with no indicators is *not* a guarantee of safety, a malware-free certificate or a deployment authorization.
- Text-only VFS cannot unpack archives, assess binary executables, scan installed dependencies, or fully parse Visual Studio .suo files.
- Real production builds need separate isolation, no inherited operator secrets, quotas, verified releases, rollback and hostname checks.
- Cloudflare Workers managed publishing and per-tenant operator credentials remain outside scope, as tracked in BuildRx issue #42; this integration does not deploy Workers or create tokens.

## Verification

Run npm ci, npm run lint, npm run typecheck, npm test, npm run build and npm run certify:generated-app. Unit regression tests verify suspicious patterns, failure on incomplete scans and clean-source behavior. No new services, environment variables or migrations are required.

Rollback by reverting the feature commit/PR. Existing source remains unchanged; release verification and provider readiness remain separate safeguards.
