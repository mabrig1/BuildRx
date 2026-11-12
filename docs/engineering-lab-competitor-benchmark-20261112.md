# BuildRx Engineering Labs — Competitive Feature Benchmark & Upgrade Evidence
**Date:** 2026-11-12  
**Scope:** Public official feature documentation versus code present in BuildRx's stacked academy feature branch. **Not** a hands-on performance, accuracy, cost or security penetration benchmark. All BuildRx features shown here are *proposed in open PRs* and are not automatically on the live production site.

## Benchmark methodology

Compare documented user workflows rather than arbitrary popularity scores. For each category, record (A) a capability explicitly documented by the competing platform, (B) what the current BuildRx branch actually contains, (C) an actionable gap, and (D) a concrete verification requirement. Product capabilities/pricing can change. Recheck official sources before changing commercial commitments.

| Reference product | Documented useful pattern | BuildRx branch state | Remaining gap |
| --- | --- | --- | --- |
| **freeCodeCamp** | Curriculum v9 groups theory, guided workshops, standalone labs, reviews/quizzes and certification projects with automated tests | 4 tracks / 20 authored workshops, 40 new formative questions, 12 curated coding problems, checklist/evidence journaling | Robust assessment of authentic student projects; much deeper content catalogue |
| **Exercism** | Concept prerequisites, learning/practice modes, test-first progression and mentoring | New recommended prerequisites and guided/explore modes; deterministic quiz feedback; optional AI lab coach | Verified exercise submissions, rigorous multi-language test runners and human mentoring |
| **Scrimba** | Contextual explanations linked to interactive code/screencasts | Existing optional AI Lab Mentor; explanatory material and contextual exercise links | Code-line/screencast-context grounded explanations, interactive lessons |
| **Codecademy Code Challenges** | Editable challenges, test output and next-study suggestions | Isolated JS challenge runner, formative feedback, new 12 challenges, recommended next workshop | Richer test reports, multi-file assessments, feedback on student code quality |
| **StackBlitz / WebContainers** | In-browser Node.js environment, terminal, package manager and full-stack previews | Only browser JS worker, opt-in external React Sandpack demo and ZIP source export | No real integrated Next.js server or terminal; WebContainer deployment requires browser compatibility, isolation, consent/licensing review |
| **GitHub Codespaces** | Cloud development containers, terminal, git, port-forwarded previews | Exportable local files and opt-in read-only GitHub Actions verification template | No provisioned ephemeral tenant workspace or independent runtime testing |
| **Replit** | Integrated cloud authoring, runtime and deployment ecosystem (check current documentation before treating this as a like-for-like grade) | Guided BuildRx project creation/launch flow; academy branches not merged | No learner-controlled hosted terminal/runtime in Academy |

## Primary evidence (official product sources)

- freeCodeCamp curricular architecture (updated Nov 9 2026): https://contribute.freecodecamp.org/how-to-work-on-coding-challenges/
- freeCodeCamp independent laboratory tests: https://contribute.freecodecamp.org/how-to-work-on-labs/
- Exercism prerequisites and TDD: https://exercism.org/docs/building/tracks/practice-exercises
- Exercism learning vs practice modes: https://exercism.org/docs/building/product/unlocking-exercises/
- Scrimba interactive explanations: https://docs.scrimba.com/explain/scrims
- Codecademy code challenge test feedback: https://help.codecademy.com/hc/en-us/articles/4407586127515-Code-Challenges
- StackBlitz WebContainers versus frontend-only runtimes: https://developer.stackblitz.com/guides/user-guide/available-environments
- WebContainers October 2026 browser and isolation caveats: https://webcontainers.io/guides/browser-support
- GitHub Codespaces with forwarded ports: https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace

## Upgrade implemented in the current branch

### 1. Concept learning progression
- Five workshops per track now form a recommended dependency sequence. **Open practice** keeps every workshop accessible for experienced users.
- Guided view suggests the next *self-reported incomplete* workshop, without locking or falsely certifying anything.
- Local learning-mode preference persists in the browser.

### 2. Knowledge checks and specific remediation
- 40 hand-authored multiple-choice questions (two per workshop) validate understanding of acceptance criteria, code reviews, testing, system boundaries, atomic transactions, auth, RLS, CI, mobile offline sync, and publish verification.
- Choice explanations appear after submitting; retries are allowed; best local quiz result and attempt count are saved locally.
- All correct results are explicitly labelled **local knowledge check passed**, not verified grading, security clearance, official qualification or certification.

### 3. Evidence journal and teach-back
- Learners can record short personal reflections and an evidence-file note for each workshop (without uploading files or secret data).
- The UI explains that a student-written assertion of passing CI or production behavior is *not* independent evidence.
- Formative question hints and direct links to coding challenges connect explanation → practice → reflection.

### 4. Doubling runnable micro-challenges
- Browser runner now offers **12** predefined exercises (previously 6), adding idempotency, bounded retries, data summaries, input validation, offline queues and default-deny authorization decisions.
- The isolated browser runner remains bounded and separated from authenticated BuildRx code. No full-stack server execution is claimed.

## Meaningful verification rubric for this release

| Check | Acceptance requirement |
| --- | --- |
| Content integrity | Every one of 20 workshops has two questions with unique IDs, four unique answer options, valid answer indexes and informative explanations |
| Guided path | Each track has 5 ordered exercises; open practice never blocks access |
| Quiz consistency | Incomplete answers never pass; erroneous answers explain what to review; best local score and attempts survive reload without pretending to be server-verified |
| Safe storage | Invalid/oversized/unknown browser records discarded; note length bounded, recognizable tokens blocked from saving; no API calls by self-assessment |
| Practice runner | 12 reviewed tasks; each JS test set bounded; uses the pre-existing isolated iframe and worker; source not executed on BuildRx server |
| Release gates | GitHub lint, typecheck, Vitest, production build, generated-app certification and DevShield; manual 320px and desktop accessibility test |
| Trust boundary | Do not award certificates, billing perks, owner privileges or publication rights based on localStorage quiz/test indicators |

## Next upgrades, prioritized by impact/risk

1. **Contextual formative feedback:** targeted code explanations tied to an actual selected exercise, with explicit opt-in and bounded source transfer. No automatic sharing of user code.
2. **Authentic project evidence:** learner-submitted repository/commit and test report with strict authorization, provenance, safe malware/content scanning and verified build signatures; begin with a private, opt-in pilot before any badge system.
3. **Cloud lab pilot:** investigate GitHub Codespaces launch workflow or commercial WebContainers; validate device/browser constraints, Cloudflare/Vercel CSP, pricing, project isolation, egress controls, ephemeral token/secret boundaries and permission scoping before introducing remote execution.
4. **Human mentor review and team cohorts:** independent scoring rubric, explicit consent, private instructor queues and appeals; never confuse a static quiz score with professional competence.
5. **Accessibility/mobile and low-bandwidth support:** keyboard navigation, audio/text alternatives, offline lessons, reduced bundle sizes and measurable student completion tests on Nigerian mobile conditions.

## Limits of this benchmark

No provider's latency, pricing, retention, course completion rates, server reliability, AI accuracy, vulnerability resistance, privacy promises or actual customer outcomes were independently tested. There is **no numerical competitiveness score** because that would require a common workload, dated measurement methodology and directly observed data. The matrix is a transparent feature/evidence gap analysis, not proof BuildRx exceeds any incumbent. No competitor's proprietary code, curriculum or branding was copied.
