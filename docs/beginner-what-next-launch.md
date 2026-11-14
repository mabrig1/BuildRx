# Beginner launch journey — BuildRx

A beginner's actual challenge starts **after** source has been generated. This guide makes the next action visible on every project workspace on desktop and mobile.

## What is implemented

- A persistent **What next?** entry point beneath the workspace toolbar, linking directly to the existing GitHub and Deploy panels.
- A step-by-step path for **Build → GitHub → database decision → Vercel or Cloudflare → real public app test**.
- Read-only, authenticated status checks using existing project-scoped endpoints:
  - `GET /api/github/connection?projectId=`: account connection and linked repository (linking is **not** proof that latest source was pushed).
  - `GET /api/deploy/history?projectId=`: project-owned deployment history; a recorded Vercel live URL is **not** a full runtime smoke test.
  - `GET /api/deploy/cloudflare/status?projectId=`: GitHub checks produced by Cloudflare Builds; check success is **not** a verified Worker URL.
- User choice of Cloudflare/Vercel and MongoDB Atlas/Supabase/no database. Optional checkboxes reflect **self-reporting**, never privileged server-side release evidence.
- Preferences are stored only in project-scoped browser localStorage, no API tokens, passwords or database connection strings.
- Safety: checks are read-only, no deployment is started by opening the journey; the real Deploy panel remains the only handoff for hosting.

## Current deployment boundary

1. **Cloudflare Workers**: BuildRx supports generating and pushing a Next.js Workers source package, matching GitHub repo/branch, providing Workers Builds instructions, and reading available GitHub build checks. It does *not* deliver verified managed one-click production publishing or attest a public Worker URL. See issue #42 and `docs/cloudflare-one-click-operator-readiness.md`.
2. **Vercel**: BuildRx has a full-source deployment route and GitHub integration, but environment variables, database integration, and actual app tests must be verified for each app.
3. **MongoDB Atlas**: intended for document-shaped persistence when the generated app actually uses it. Set `MONGODB_URI` only in encrypted server-side configuration. On Cloudflare Workers, independently verify runtime compatibility before considering it deploy-ready.
4. **Supabase**: use when generated app uses its Auth/RLS/relational schema. RLS is separate from a successful deployment; configure its environment variables and test real row-level authorization.

**Provider recommendation caveat (November 2026):** Cloudflare documents vinext as its preferred path for new Next.js applications. BuildRx's existing Cloudflare preparation uses pinned OpenNext for the current reviewed adapter. This PR does not silently replace its runtime or claim compatibility; migration is a separate tested engineering slice.

## Acceptance checks

- Fresh project: build comes before GitHub and publishing.
- Account-only GitHub connection does not count as linked source.
- Cloudflare passing checks does not mark a public Worker live.
- Missing or failed hosting stays incomplete; an HTTPS URL cannot be guessed.
- A checked manual task is visibly labelled self-reported and cannot become a privileged server fact.
- On mobile, the What next? control remains outside the packed editor toolbar.
- Existing GitHub and Deploy panels are still directly accessible, and the journey can open them.
- No credentials are requested in the guide or persisted in localStorage.

## Suggested next engineering slices

- Read-only verified source digest and repo commit association, with explicit mismatch detection.
- After-deployment server smoke tests: route 200, auth path, representative CRUD against a disposable test dataset.
- Durable user journey state under the account (still distinct from trusted deployment evidence).
- Feature-flagged managed Cloudflare Workers for Platforms with tenant isolation, quota enforcement, rollback and smoke evidence before offering a real Publish button.
