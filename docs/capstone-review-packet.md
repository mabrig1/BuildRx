# BuildRx Academy — Capstone Evidence Portfolio (2026-11-12)

Stacked follow-up to **PR #62** (hands-on learning mastery and twelve introductory code exercises). This feature closes a specific gap between **self-reported practice progress** and **evidence that a mentor can actually review**.

## Student experience

Visit `/learn/capstone` from the dashboard, Knowledge Center, Engineering Labs or Multi-file Project Studio.

1. Choose one of four education tracks: software engineering, systems engineering, full-stack web, or React Native/Expo mobile.
2. Identify the capstone title, canonical HTTPS GitHub repository, **full 40-character commit SHA**, optional GitHub Actions run from the **same repository**, and optional public HTTPS demo.
3. Fill six **track-specific evidence descriptions** stating the file paths, test commands or documents a qualified reviewer should inspect. Every criterion explains **how a reviewer would verify it**.
4. The page reports **documented criteria 0–6**, never a pass score. A complete packet means *ready to request review*; it does not certify competence or authenticity.
5. Write a short reflection about limitations and unresolved defects.
6. Download a **self-reported Markdown review brief** or versioned JSON backup, or import a validated JSON packet for the currently selected track.
7. An instructor can use the packet to independently inspect exact commit/file/test evidence, request corrections, and decide any separate formal assessment.

## Engineering trust boundaries

- **No GitHub API calls from this feature.** A syntactically valid URL/SHA/CI run does not establish access, ownership, commit ancestry, successful tests, deployed state, employment, certification or learner identity.
- **No automatic grading or badges:** contents, scores and metadata stay in the browser's localStorage, with explicit warnings that they are self-reported. No server receipt or credentialed GitHub verification.
- **No uploads:** exports are created as downloadable client-side files. Opening user-entered repository, commit, CI or demo links happens only on explicit click, in a separate tab with `rel=noopener noreferrer`.
- **Credential hygiene:** recognizable tokens, connection strings, bearer credentials, passwords and private key strings block JSON imports, autosave and export. This is a heuristic guard, not guaranteed prevention of every possible secret.
- **Strict imported data:** version, training track, six rubric IDs, text length and secret screening are checked; unknown metadata keys are discarded. A packet cannot be imported into another track.
- **Link checks:** canonical HTTPS github.com repo URL and full commit SHA required for "reviewable references"; GitHub Actions run must match repository; public demo URLs must use HTTPS and must not be local/loopback or credential-bearing. No network call is made.
- **No merged/deployed changes:** this feature is kept on a separate branch, with no DB migrations, secret settings, billing changes, privileged account operations, untrusted code execution or certificate issuance.

## Distinct rubrics

| Track | Six source/evidence review categories |
| --- | --- |
| Software engineering | Requirements, source traceability, unit tests, CI/review, security, release/rollback |
| Systems engineering | Requirements/boundaries, architecture, OpenAPI, atomic data/isolation, operations, recovery |
| Full-stack web | Accessible UI, server validation, database persistence, identity isolation, CI/tests, deployment/rollback |
| Mobile | Native navigation, input, API/token safety, offline sync, device QA, internal build/distribution |

Every rubric entry contains **requested evidence** and **reviewer verification action**. A learner's note such as "tests passed" remains an unverified claim until an instructor repeats/inspects the test.

## Verification

Automated tests cover:
- Exactly 6 distinct review items per track with meaningful expected evidence and reviewer actions.
- Canonical GitHub link validation, complete 40-character SHA, CI repo matching and HTTPS public demo checks.
- Cross-track import refusal, oversized/malformed/secret-bearing data rejection, unknown field stripping and browser-only storage model.
- Evidence completeness counting, missing item guidance, status wording that explicitly denies automatic verification or certification.

Manual pre-merge checks still required for 320px mobile view, keyboard navigation, import/export round-trip, browser storage failure, link click behavior, input secret detection, accessible labels, and confirmation that **no network request** transmits learner notes.

## Later (not implemented in this PR)

A real independently verified assessment workflow would require student opt-in, authenticated GitHub repository permissions (least privilege), exact commit/test run provenance, reviewer identity and authorization, explicit consent for any artifact storage, safe isolated code execution, signed immutable review decisions, appeals/corrections, privacy policy, and certificate revocation. No untrusted client-side checklist or URL alone can establish that evidence.
