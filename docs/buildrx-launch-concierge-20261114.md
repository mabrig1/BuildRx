# BuildRx Launch Concierge — 2026-11-14

## Customer journey

- New project: answer three easy questions (idea, people, main job), choose data/style/payment needs, prepare an editable product brief, then create a project. The existing agent build pipeline runs using that brief.
- Project workspace: use App Doctor for a read-only, owner-scoped scan of saved files. App Doctor identifies supported structure/import/security problems, including unfinished Hello World pages.
- Review AI repair: explicitly open the existing eleven-agent builder with the Repair command. The owner reviews the run before it starts. Existing bounded repair and recheck rules apply.
- After source checks: test the Preview, then use the existing What next? guide for GitHub, database, Vercel or Cloudflare, and real public-function tests.

## Security and release boundaries

- GET /api/projects/[projectId]/doctor requires a current authenticated user who owns the project. It does not trust query-supplied user identity.
- The diagnostic reads only a bounded saved source snapshot (up to the existing agent file limit and 2 MB of text).
- It never executes scripts, runs a model, writes files, triggers hosting or pushes to GitHub.
- Static QA and the existing DevShield security indicator scan are reused; security findings route to manual review instead of unattended execution.
- Diagnostic JSON contains no raw saved source or provider credentials.
- A green static scan does NOT certify runtime behavior, persistent data, payments, security, hosting, or live login.
- Public /demo is an illustrative interactive walkthrough, not a generated deployed customer app.
- No changes to payments, database schema, secrets, customer quotas or hosting configuration.

## Required release checks

1. GitHub lint, typecheck, unit tests, production build, generated-app certification and source-security must pass.
2. Verify the public /demo page, home page and features page.
3. Verify App Doctor blocks anonymous and cross-owner requests without reading files, returns 413 for oversized snapshots and no false deployment success.
4. Walk through one authorized project: Draft > Build > App Doctor > approved Repair > Preview > What next? No secrets or real payments.
5. Verify the exact production Vercel deployment for the merge SHA, then test public routes. The authenticated workspace cannot be independently confirmed without an owner session.
6. In case of failed production deployment, inspect the first failing log/commit and follow the project's approved rollback method.
