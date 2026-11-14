# Interactive software engineering missions (BuildRx)

This release extends the **main authenticated BuildRx application**, not just its public course page.

## Working training flow

Open **/learn/engineering** from dashboard, Learning Center, or premium Academy.

- Pick one of four realistic scenarios: campus used-devices, BOSAL retail stock, service booking, offline fieldwork.
- Work through five sequenced engineering decisions per scenario (20 questions total). Answers are validated against authored answer keys, with explanatory feedback. A correct choice unlocks the next stage.
- Read scenario-specific requirements, business rules, safety issues and acceptance criteria.
- Optional short scope addition; create a real BuildRx project via the existing authenticated CreateProjectDialog. Prompt includes concrete user story, requirements, acceptance criteria, test plan and release safeguards.
- Open the matched existing **/learn/labs?lab=**, **/learn/playground?exercise=** (real browser-isolated JS/HTML/CSS tests), **/learn/studio?track=** multi-file source editor, Build Doctor and Capstone Evidence Portfolio.
- Download a Markdown brief containing scope, checks, prompt and clearly labelled **local** practice score.

## Scope boundaries

- Scenario decision scoring is deterministic, local and educational. Completing 20 questions is NOT evidence the learner has built, tested or deployed anything.
- Only question answer indices are persisted in browser localStorage; optional learner scope text is NOT saved as progress. Do not paste passwords, keys, private documents or real personal information.
- The app builder is an existing separate service/action, and the learner must review and confirm project creation. Project quotas, provider availability, security limits and existing enrolment controls apply.
- No new server-side code execution, privileged GitHub/Cloudflare/Vercel calls, background work, database migrations, credentials, payment changes, certificate issuance or auto-deployment.
- Quiz results are not shared across devices and are not verified staff grades. A human must assess functional capstone evidence.

## Verification

- Unit tests: 4 unique missions, 5 decisions each, known valid lab and playground IDs per track, safe local progress parser, prompt length and release caution.
- CI: npm ci, npm run lint, npm run typecheck, npm run test, npm run build, generated-app certification, DevShield.
- Manual: /learn and /dashboard link visible; /learn/engineering loads for signed-in user; wrong choice shows retry hint; correct answer unlocks next stage; refreshing restores progress; switching missions isolates progress; reset only current scenario; create-app dialog pre-fills the selected mission; each lab/studio/playground link goes to the right training stack; export Markdown opens; test narrow mobile layout and keyboard navigation.
- Confirm that learners with no production Supabase configuration are not accidentally granted paid course access by demo mode before public launch.

## Release policy

This is stacked on draft BuildRx PR #66, which itself depends on PR #64 and the unmerged Academy training chain. Do NOT independently merge into default branch or deploy production until previous dependencies and full CI/manual release gates are resolved.
