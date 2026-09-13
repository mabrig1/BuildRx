# Generated App Certification Matrix

BuildRx release CI certifies generated applications independently of the BuildRx control plane.

## Certified classes

| Class | Representative architecture |
| --- | --- |
| CRUD SaaS | Multi-tenant CRM with customers, deals, activity, tasks, search, and ownership |
| Analytics / research | Dataset import, statistical analysis, results, and report workflows |
| Marketplace | Listings, orders, messages, seller console, and buyer/seller records |
| AI workflow app | Opportunity intake, AI drafting workspace, proposal versions, and human review queue |
| Content / business operations | Articles, authors, assignments, editorial review, and publishing schedule |

## What every matrix case proves

Each case runs through the actual BuildRx orchestrator with external AI/database credentials disabled so the result is deterministic. CI then verifies:

1. BuildRx produces a plan and a non-trivial generated file set.
2. BuildRx static QA reports no blocking findings.
3. Required production artifacts exist, including TypeScript, Tailwind/PostCSS, Supabase, MongoDB, schema, and release documentation.
4. The expected pages and domain tables for that app class were actually generated.
5. The generated application is written into its own fresh temporary directory.
6. A fresh `npm install` succeeds in that directory.
7. The generated app passes `npm run typecheck`.
8. The generated app passes an optimized `npm run build`.

A failure in any class blocks CI.

## Scope boundary

This matrix certifies buildability, exportability, and deterministic generated structure. It does not claim that credential-dependent external behavior is live. Provider-specific smoke tests for deployed Vercel previews, AI inference, payments, email, storage, or database connectivity should run as a separate integration layer with scoped test credentials.
