# BuildRx guided beginner Clone Vault (review-only)

This change is stacked on [Clone Vault PR #50](https://github.com/mabrig1/BuildRx/pull/50). Nothing in this feature merges, deploys, updates Cloudflare, creates credentials or migrates production data.

## Evidence labels

| Label | Meaning | What it does NOT mean |
| --- | --- | --- |
| **Source reviewed** | ID is in the server allowlist: four original BuildRx MIT templates, or four Vercel MIT examples at immutable commit `cc65c414d283e22e587828c94770d9b12522bbb4`. Import is guarded by DevShield, static secret checks and size limits. | Safe third-party dependencies, production readiness, completed backend, green CI, full runtime test or deployed URL. |
| **Planned** | Idea and setup notes only (booking, learning portal, ecommerce, analytics, AI assistant). | Cloneable source or a real audited repository. |
| **Deployment not verified** | No hosting/availability probe is asserted by the catalog. | That the project is currently live, passed provider checks or has credentials. |
| **Self-reported check** | The beginner manually ticked a checklist item. | Independently verified GitHub Action, Cloudflare/Vercel account readiness or deployment. |

Original source trace: [BuildRx starter implementation at PR #50 head](https://github.com/mabrig1/BuildRx/blob/67fed4a2df164cab42dc3f12cd66a3423efa3695/src/lib/projects/beginner-code-templates.ts). The four external sources are official `vercel/next.js` examples at the one pinned immutable commit. They are not independently maintained BuildRx applications.

## Mobile-first user journey

1. Search and filter by requested categories, difficulty and approved/planned status.
2. Select up to three cards for side-by-side comparison (source, runtime/deployment evidence, services and next action).
3. Open a guide: check provenance, setup steps, environment-variable **names**, editable parts, rollback approach.
4. Enter non-secret working title/audience; record self-reported local setup and GitHub/Cloudflare/Vercel readiness. This progress is saved **only in this browser's localStorage**, not owner-scoped server storage. On a shared device clear the notes.
5. Explicitly affirm source review and private-Draft/security limitations before creating a draft. The POST body contains **only** an approved server-side template ID.
6. On successful import, the UI shows a link to the new private Draft; it never claims publication or a verified database. Copy the customization brief and edit the actual project files in the workspace.

**Security boundaries:** no user-supplied GitHub URL, branch, commit or path; no hidden install hooks or server-side npm execution; no API key entry or token creation; no real readiness checks masquerading as success. Third-party dependencies, images and external assets may need manual review. Browser fields try to reject obvious credential patterns, but **users must not paste any credential into notes**. For real integrations, use server-side settings and validate authorization/data persistence separately.

## Preview failure investigation (7 November 2026)

Reported failed project: **AppointmentScheduler**, 38 files saved, "Preview renders — preview returned HTTP 404". This **did not establish that the generated application was running or absent**. The previous verifier made an unauthenticated `fetch(`${NEXT_PUBLIC_APP_URL}/api/preview/${projectId}`)` from the server, which could not carry the project owner's session and could receive **404** for owner-protected preview content. Its iframe had also been affected by duplicate X-Frame-Options values.

[PR #51](https://github.com/mabrig1/BuildRx/pull/51), **merged into the default branch on 7 November 2026**, already:
- Changes verification to read `preview/index.html` through the same owner-scoped preview handler in the active request.
- Names the verified property **Saved workspace preview** (saved HTML document), without claiming a real hosted deployment.
- Corrects same-origin iframe framing/CSP response handling.
- Adds a **Repair** command that attempts to resume from saved files and build brief without overwriting unchanged files.
- Includes regression checks; the base branch CI [run 42411359900](https://github.com/mabrig1/BuildRx/actions/runs/42411359900) was green.

This resolves the **identified false 404 verification path in source**. Whether the live `buildrx.online` deployment includes this merged commit is **not verified** here. If the latest instance is running that version: open saved AppointmentScheduler workspace, enter **Repair**, then inspect `preview/index.html`, database permissions, visual rendering and functional tests. A present HTML file is **not** proof that Supabase Auth, RLS, atomic staff-slot booking, SMS/email or production deployment works.

### Proposed acceptance

- 8 approved source IDs available, 5 plans visibly disabled from cloning.
- Filters/search and up-to-3 comparisons work at mobile widths.
- No secrets required; no client-supplied upstream source accepted by import API.
- Local checklist survives reload on same device; clearing notes does not delete a real private Draft.
- Clone requires source/security acknowledgment and records the returned real project ID; planned IDs cannot import.
- CI: lint, typecheck, tests, Next build, generated-app certification.
- **Not claimed**: running end-to-end AppointmentScheduler Supabase integration, live provider readiness or deployment.
