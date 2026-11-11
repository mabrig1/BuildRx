# BuildRx Engineering Practical Laboratory — applied learning tracks

**Scope:** This extends PR #55 (free Knowledge Center) and PR #54 ("What next?" launch flow). These are **guided exercises**, not automatic local IDE execution, not an interactive VM, not a certificate and not evidence that an app has been tested live.

## 4 modern learning pathways / 20 workshops

| Pathway | Core stack | 5 practical labs | Capstone |
| --- | --- | --- | --- |
| Software Development Engineering | TypeScript, Git/GitHub, Vitest, GitHub Actions, OWASP | Requirements & acceptance, Git PR, unit testing, CI/security, refactoring & release review | Issue-tracker engineering release |
| Systems Engineering & Architecture | C4 diagrams, REST/OpenAPI, PostgreSQL, reliability, observability | Context & boundaries, API contract, atomic bookings, queues & resilience, failure tests & rollback | Booking-system architecture dossier |
| Full-Stack Web Apps | Next.js App Router, React, TypeScript, Supabase **or** MongoDB, Playwright, Vercel/Cloudflare | Scaffold, accessible UI, persistence & auth, E2E CI, deployed smoke tests | Authenticated booking/stock management app |
| Mobile App Engineering | React Native, Expo, Expo Router, mobile auth, offline sync, EAS | Expo scaffold, native navigation, secure APIs, offline drafts, internal test build | Offline-first field visit/booking companion |

Open `/learn/labs` from the dashboard or from `/learn`. Deep links supported by track (`/learn/labs?track=mobile-app`) or lab (`/learn/labs?lab=mob03`).

Each lab has: 50-minute exercise, task checklist, expected artifacts, acceptance checklist, safety notes, direct official references, downloadable Markdown lab brief, optional AI Lab Mentor and a clear statement that completion is self-reported.

Four curated **starter code kits** are included alongside these labs: TypeScript issue rules with Vitest tests, system context/OpenAPI design stub, accessible Next.js App Router pages, and an Expo React Native screen. Learners can inspect/copy each reviewed file or include the snippets in a downloaded Markdown lab brief. These examples are explicitly *scaffolds* rather than complete or certified applications; BuildRx does not execute or install them.

## Learning model

1. **Explain:** Read one official-source-linked lab and its objective.
2. **Do:** Run commands and create source/docs in a personal training environment, local machine, or reviewed repository.
3. **Record:** Maintain the specified artifacts; nothing is silently uploaded to BuildRx.
4. **Verify:** Run checks/tests on the actual application and record observations. A checkbox is **not** verification evidence.
5. **Reflect:** Use optional AI Lab Mentor for a lab walkthrough or five-day plan. Output is a training draft, not a test result.
6. **Build capstone:** Complete five labs and prepare the track's capstone with actual repo/tests before applying to the paid Tech+ course if desired.

## Technology and boundary decisions

- **Web:** Next.js App Router and TypeScript, server-side authorization, data persistence, CI and real public URL checks. Modern stack choices must match the generated app's actual source.
- **Systems:** Clarify requirements/trust boundaries, design a defensible API, protect atomic reservations, apply idempotency, observability, resilience, and review release rollback.
- **Mobile:** React Native/Expo training is run separately. The current BuildRx source generator is Next.js; the learning feature **does not** compile, sign, distribute, or publish native binaries. Consult Expo/EAS documentation for device testing and internal builds.
- **Cloudflare:** Source `prepare` and passing GitHub checks do not prove a working Worker URL. The managed one-click Cloudflare deployment has additional security/tenant isolation/rollback prerequisites (issue #42).
- **Databases:** Supabase RLS or bounded MongoDB ownership must be tested with multiple identities. Never store secrets in frontend code, GitHub, student goals or lesson checkboxes.
- **Paid Tech+:** `/course` billing and enrollment remain entirely separate.

## AI Lab Mentor API

Existing authenticated, rate-limited and metered `POST /api/learn/coach` additionally accepts `{labId, level, mode, goal}` from a strict allowlist of labs. Sending `lessonId` and `labId` together is rejected; user text is bounded and credential patterns denied. AI model remains the existing provider fallback; no new vendor keys or infrastructure privileges introduced.

## Verification / known limitations

Automated tests validate all 20 curated lab IDs, ordering, reference URLs and adequate tasks/checks, safe lab mentor inputs, rejection of arbitrary labs/tokens, and request metering. Run lint, typecheck, Vitest, production build, generated-app certification, DevShield.

Learning progress is **browser-local only**, not durable cross-device, graded, or certificated. Browser checkboxes are explicitly self-reported; no sandboxed execution is claimed. A future assessed-labs feature requires an isolated runner, resource quotas, malware checks, signed artifacts, deterministic grading and abuse limits before enabling submitted code execution.

Reference starting points (check for changes before executing commands):
- Next.js App Router: https://nextjs.org/docs/app
- Expo create project: https://docs.expo.dev/get-started/create-a-project/
- Expo EAS build: https://docs.expo.dev/build/setup/
- OWASP ASVS: https://asvs.owasp.org/
- GitHub Actions: https://docs.github.com/en/actions
