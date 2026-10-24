# BuildRx: video-inspired SDLC integration

Source: user-provided ~26-minute Google Cloud/Claude Code demonstration, reviewed
24 October 2026. This document describes what is **implemented** on this
feature branch, not a claim that Google's services have been provisioned.

## Source pattern and BuildRx mapping

| Demonstration | BuildRx equivalent | Implementation state |
| --- | --- | --- |
| Product manager defines idea, goals and acceptance tests | planner + FounderOps | Existing, exposed in the blueprint |
| Figma / UX flows and screen iterations | architect + UI agent | Existing UI generator; live Figma MCP import is NOT connected |
| Parallel backend API, pipeline, dashboard subagents | coding, database, UI tracks | Typed track contracts added; actual pipeline remains sequential |
| Agent tool access via Google Cloud MCP | Built-in VFS tools with scoped writes | Existing deterministic tools; Google Cloud MCP NOT connected |
| Security engineer reviews before shipping | security, QA, repair + approval gates | Existing scanning; explicit release constraints documented |
| Cloud Run / Firestore deployment | User-controlled Vercel/Netlify/Railway; Supabase data | Existing providers; no Cloud Run/Firestore configured |
| BigQuery + feedback analysis | private user feedback in Supabase analytics | Owner-scoped feedback and explicit opt-in reuse added |
| Feedback-informed iteration | workspace feedback → next build prompt | Implemented as manual consent, not autonomous background rebuild |

## Work in this branch

- Deterministic architecture handoff `docs/SDLC-WORKFLOW.md` saved
  **inside each newly generated app** at the Architect step.
- Six SDLC roles, three independently described implementation tracks,
  and hard human-reviewed external-action release gates.
- Interactive 1–5 build feedback and comments within the Build app panel.
- `GET/POST /api/agents/feedback` validates the session, project owner,
  data shape and common credential patterns, with rate limiting.
- Feedback is stored under `analytics.event_type = build_feedback`, with
  a new narrowly scoped owner-read RLS policy. It never automatically flows
  to an LLM or external analytics and never silently retriggers a build.
- Feedback UI offers an explicit **Use in next build** action, which only
  edits the unsent prompt. User still clicks Start build.
- Unit tests cover blueprint claims, feedback validation and consent.

## Prerequisites and smoke test

1. Review and merge this feature branch **only after CI checks pass**.
2. Apply `supabase/migrations/20261024000000_build_feedback_read.sql`
   through normal controlled database migration process. This branch
   does not execute the SQL.
3. Build and deploy BuildRx to a **preview environment** with a test
   Supabase account and project. Do not modify production integrations.
4. Start a test app build; inspect `docs/SDLC-WORKFLOW.md` in the generated
   file explorer. Confirm generation, static checks and the preview work.
5. Save a rating and a non-sensitive comment. Reload: only that owner's
   comments should be readable. A second account gets 404 on GET and POST
   for the original project.
6. Click **Use in next build**; verify the feedback appears in the prompt
   without automatically launching a build.
7. Check rejected unknown fields, oversized messages, secrets, rate limits,
   unauthenticated requests and demo-mode 503 behavior.
8. Run `npm run typecheck`, `npm run test`, and `npm run build`.
   Independently check generated-app certification and real browser flow.

## Explicitly not implemented

- Actual concurrent agents: VFS collision-safe parallel execution needs
  per-worker isolated file maps, a deterministic merge, deadlines and tests.
- Google Cloud billing/project/region/ADC/IAM setup, Figma MCP and BigQuery.
- Auto-fixing code in response to stored feedback without user approval.
- Device/browser live end-to-end evidence, full dependency/build verification
  on this unmerged branch.
- Production approval UI or automated external deployment (existing
  Deploy/GitHub panels already require a separate user action).

External paid services, cloud IAM changes, secret entry, destructive
migrations and production promotions require explicit owner approval.
