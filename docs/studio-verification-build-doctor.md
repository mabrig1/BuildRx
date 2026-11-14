# BuildRx Lab Verification Kit and Build Doctor — November 12, 2026

This additive change follows PR #59's reviewed training ZIP manifests. It does not merge, deploy, or alter production settings.

## 1. Reviewed CI and offline verification packaging

Web (Next.js) and Software Engineering (TypeScript/Vitest) training ZIPs now include:

- `.github/workflows/buildrx-training-verify.yml` — reviewed GitHub Actions **template** with `contents: read`, 12-minute timeout, `persist-credentials: false`, `pull_request` / `workflow_dispatch` only, no `pull_request_target`, no deployment, no secrets, and lifecycle scripts disabled for the installation step.
- `scripts/verify-training.mjs` — read-only local presence and npm-script checks; deliberately does not evaluate student code.
- `VERIFICATION-GUIDE.md` — exact local prerequisites and GitHub steps, warnings about permissions and untrusted code, and distinctions between source checks, compilation and live-app verification.

The actual `npm run typecheck` and `npm run build` (web) or `npm test` (TypeScript) run only **when a learner executes them locally or intentionally commits the template to their own repository**, never on BuildRx's hosting infrastructure.

Mobile Expo and architecture design ZIPs do *not* receive a fake GitHub build workflow. They continue as truthful overlays and design dossiers.

`buildStudioExport` checks for collisions with generated guide names and refuses to overwrite learner content.

## 2. Build Doctor at /learn/doctor

A new browser-only deterministic troubleshooting assistant:

- Accepts no more than 12,000 characters of user-pasted build output, never sends it to a server, never stores it, never executes it or calls an LLM.
- Recognizes common TypeScript errors, module resolution, missing lockfiles, Vitest hoisted mocks, assertion failures, Wrangler/Cloudflare configuration, missing environment variable names, generic build errors, and preview 404 / starter "Hello World" symptoms.
- Shows the first *matching* line in the pasted excerpt, with basic secret/token/connection-string redaction. It does not claim to have found the first actual error in logs it has not seen.
- Suggests the smallest low-risk **manual** diagnostic and verification sequence. It will not change GitHub, Vercel, Cloudflare, user database access, billing or production settings.
- Every result explicitly states the classification is based only on the provided excerpt; "Unknown" is a valid result rather than a fabricated root cause.

**Secret safety:** The user is instructed to remove private data before pasting. Regex redaction is not a security guarantee. Never paste full credentials; rotate leaked keys. Browser-only analysis is not a substitute for a real repository/log investigation.

## Test and release gates

- Verification pack test: workflow permissions and trigger scope; read-only checkout, time bound, no elevated secrets or deployment; correct files only for web/TypeScript.
- Build Doctor tests: log classification, no-guess fallback, credential redaction, terminal escape cleanup, and input bounds.
- Existing tests and CI lint/typecheck/build/certification plus DevShield.
- **Manual**: copy source pack to a disposable GitHub repo; confirm Actions only run after opt-in and check exact SHA; try real local build; inspect screen-size/accessibility and browser privacy behavior; verify no logs are uploaded.

This PR does **not** implement untrusted multi-tenant full-stack server execution. A remote code runner would require much stronger isolation, package/network controls, CPU/memory/time quotas and signed evidence.
