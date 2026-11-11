# BuildRx Project Studio — explicit React UI live preview

Follow-up to PR #57's client-only multi-file Studio, PR #56's isolated JavaScript practice runner, and training PRs #54–55.

## What changed
- The **full-stack web** track now starts with two small dedicated UI files: `src/lab/App.jsx` and `src/lab/styles.css` alongside the unchanged Next.js source.
- Learners edit these two files in the existing multi-file editor and explicitly choose **Run UI preview** to display a functioning React demo using the **already-installed** `@codesandbox/sandpack-react`.
- Demo implements a usable add-entry form with in-memory React state and explicit warnings that this is not saved in a database.
- Preview is hidden/unmounted by default; the learner must check an external-service notice before it mounts. Code **will be sent to CodeSandbox's externally served sandbox**. It is not equivalent to BuildRx executing code solely in its own browser origin.
- Only the two dedicated UI files are copied to the sandbox; the Next.js application, server routes, APIs, environment variables, user records and other Studio files are never passed.
- Preview snapshots are frozen until **Run updated UI** is pressed again. Editing source files does not silently resubmit updates to CodeSandbox. **Stop preview** unmounts it.
- Basic bounded source checks reject sensitive credential patterns, additional packages/imports, network/storage APIs and resource URLs. These are preventative checks for a beginner demo, not a full security proof.
- Missing demo files can be restored separately without overwriting other edited project source.
- No new dependency, backend route, database migration, external token, deployment job or production setting.

## What it is **not**
- Not a local-only preview (external CodeSandbox service is used).
- Not Next.js server execution, Node/npm, Supabase, MongoDB, real authentication, concurrency, API calls, full-stack or native/mobile development.
- Not a verified project test suite, trusted secure code runner, certification or an independent production smoke test.
- Sandpack's own externally hosted iframe is a separate origin but may access its permitted network environment. Do not put sensitive code, secrets or private data into the sandbox.

## Safety gates
- Explicit opt-in is needed each session.
- Running is allowed only for `fullstack-web`, with no recognized secrets anywhere in the local workspace.
- Fixed `src/lab/App.jsx` / `src/lab/styles.css` mapping to Sandpack `/App.js` and `/styles.css`; no arbitrary npm dependencies, package.json, or server code are transferred.
- Source caps: 12K app characters and 8K CSS. Import, network, browser storage, dynamic evaluation, external resource strings and iframe/script tags are rejected.
- The Sandpack preview mounts **only** when the learner explicitly confirms sharing source; it is removed by Stop or changing tracks. No automatic execution when the learning page first opens.
- The hosted sandbox has independent provider rules and data handling; BuildRx does not claim that it is an accredited security isolation environment.

## Verification
Run lint, typecheck, Vitest, production build, certification and DevShield before merging. Tests cover starter inclusion, exact source mapping, rejection of other track files, no transfer of arbitrary project data, credential and resource/API rejection, and size boundaries.

Manually verify opt-in + opt-out lifecycle and consent, CodeSandbox preview error/success states, 320px responsive layout, source-unchanged-between-runs behavior, old saved workspace migration, and no unauthorized requests. Sandpack's external connection may be blocked by adblockers, browsers, Content-Security-Policy, privacy extensions or offline use; the user should see a truthful failure or stop it, not a fake success.

## Future development
A **truly isolated backend test runner** for multi-file Next.js/Node projects will require tenant-isolated ephemeral environments (or reviewed, permission-bounded WebContainer integration), no production credentials, filesystem/network controls, CPU/time quotas, verified app build/route tests and signed test evidence. This PR does not claim to provide that functionality.

Official Sandpack references:
- https://sandpack.codesandbox.io/docs/getting-started/usage
- https://sandpack.codesandbox.io/docs/guides/hosting-the-bundler
