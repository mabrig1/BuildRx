# BuildRx Studio: verified reviewed starters and local error explanations

This stacked upgrade follows PR #59 (local exportable starter ZIPs), PR #58 (opt-in external React preview), and earlier Learning Center changes #54–57.

## What is materially different

**A real, disposable compile/test check** now exists: `.github/workflows/studio-starter-certification.yml`.

- The workflow generates exactly two **trusted, unchanged BuildRx training baseline exports** from `newStudioWorkspace()` via `src/lib/learn/studio-export-fixtures.test.ts`.
- The fixtures are written under GitHub Actions `runner.temp`, never into a student account or production hosting directory.
- It installs dependencies and then runs the **TypeScript test starter** `npm run typecheck` and `npm test`.
- It separately installs dependencies and runs **Next.js web starter** `npm run typecheck` and `npm run build`.
- The workflow uses **npm 11.19.1 only within this disposable job**, because the first run hit npm 10's known Arborist dependency-resolution crash when installing a fresh Vitest package without a lockfile. No BuildRx production package or user npm configuration is changed.
- Permissions are `contents: read`; there are no deployment secrets, project credentials, database migrations, user-written source packages, artifact uploads or production publishing steps.
- On success it writes an explicitly scoped statement to the GitHub Actions run summary.

The workflow passing means **reviewed starter packages build/test as installed on CI**, not that edited student source is compiled or hosted. No grading/certification privileges are granted to learners from a green baseline check.

## Beginner-friendly error explanation

The Studio now includes **Understand your build error**, powered by `studio-failure-guide.ts` and its browser-only React component.

- Students can paste a short, sanitized error excerpt and click **Explain first blocker**.
- Recognizes npm Arborist `edgesOut`, peer conflict `ERESOLVE`, missing `package.json`, missing import, TypeScript errors, missing Next build output, Cloudflare Worker configuration, private-preview 404 and `Hello world` placeholders.
- Explains a likely category and reversible *next investigations*. It never claims that a real remote provider or application was inspected.
- Entirely local and deterministic. **No AI provider, API, network request, application deployment or log upload**.
- Detects familiar API tokens, MongoDB/Postgres connection strings, Bearer authorization and private keys before state updates; a sensitive paste is discarded, not echoed or stored. Users must still manually redact other private information.
- Test coverage checks known categories, unknown fallbacks and secret refusal. A static regex matcher is not a substitute for live logs or comprehensive secret scanning.

## Explicitly deferred

- Executing arbitrary user-edited ZIPs, npm scripts or third-party packages in production BuildRx
- Multi-tenant remote terminal/containers, resource quotas, billing quotas or signed student certification
- Automatic GitHub push, Cloudflare/Vercel deployment, MongoDB/Supabase Auth configuration
- Native Expo APK/IPA builds
- Automatically asserting the user's own modified source has passed CI

## Release checklist

1. Review the new job logs for a **successful** reviewed web production build and test-starter test run.
2. Verify the primary PR CI (lint, typecheck, tests, production build, generated-app certification) and DevShield before merge.
3. Manually inspect 320px UI and test the input with harmless errors, a token-looking value, a very long log and unknown errors. Confirm no network transmission.
4. Leave PRs in stacked order: **#54 → #55 → #56 → #57 → #58 → #59 → this PR**.
5. No production deploy or merge is included.

**Observed first workflow blocker:** npm's Arborist crashed reading `edgesOut` during the fresh Vitest install. The recommended response was a CI-scoped npm update, not adding `--force`/blind `--legacy-peer-deps`, merging a broken branch, or changing secrets.

External upstream confirmation: https://github.com/npm/cli/issues/9787
