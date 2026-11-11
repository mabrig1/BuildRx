# BuildRx Interactive Coding Laboratory — first safe browser execution slice

Stacked follow-up to PR #55 (knowledge center + 20 engineering labs) and PR #54 ("What next?" launch journey).

## Available at `/learn/playground`

- Six curated practice challenges: total calculation, slot filtering, an authorization decision, mobile-style name search, accessible HTML form, and responsive CSS cards.
- Editable mobile-friendly code textarea with per-exercise draft autosave in browser-local storage; reset, hints, download source and direct links to related workshop labs.
- **Run code & tests:** JavaScript runs inside a **disposable Web Worker created from an opaque-origin, script-only sandboxed iframe**. Browser-origin code and BuildRx server functions never eval user input.
- **HTML/CSS:** script-disabled sandbox preview with CSP blocking network, navigation to top, subframes and form submission. Introductory structural pattern checks only.
- Feedback shows which reviewed test cases pass or fail. It deliberately does **not** create a certificate, change project status, or claim a real user app was built.

## Security contract

1. The JS iframe MUST remain `sandbox="allow-scripts"`, **without `allow-same-origin`**. It runs an authored static runner document and receives user source via `postMessage` only after load.
2. The runner starts the student code **inside a worker**, not in the parent iframe or authenticated BuildRx origin. Its CSP blocks network connections (`connect-src 'none'`) and resource loading; blob Workers are permitted only for this disposable execution path.
3. The iframe message handler verifies `event.source === window.parent`; the React app validates messages against the active iframe window and run ID.
4. Student input is bounded at 12,000 characters; tests are preauthored, limited to 8 cases and have no arbitrary remote sources. Worker lifetime is 2.5 seconds; parent watchdog is 5 seconds. A blocked Worker yields an error, not a privileged eval fallback.
5. Per-exercise draft code stays only in the browser; no uploaded code, remote package installation, npm execution, secrets, databases, external runtime, or GitHub write access. Credential-shaped text is refused for running/autosaving.
6. HTML preview uses `sandbox=""` (no scripts, same-origin or forms) and strict CSP. It is **not** a general safe parser/sanitizer and must never be embedded into the authenticated page without the sandbox.
7. JS tests and HTML/CSS heuristics are **formative**, trivially gamable by a determined learner. Do not grant certifications, paid benefits or deployment permissions from these results.

## Scope deliberately deferred

- Real npm/Node/Next.js/Expo multi-file execution
- Authentic compilation, package installation, desktop/Android/iOS builds
- Real Docker container runner, untrusted learner code uploads and CI grading
- Signed artifacts, verified GitHub commit evidence, certificates, cross-device progress
- Auto-deployment and production data writes

A future remote execution system would require tenant isolation, no accessible platform credentials or production networks, separate ephemeral identities, CPU/memory/time quotas, egress controls, malware/supply-chain policies and reviewed post-run cleanup. No such system is claimed in this release.

## Verification

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run certify:generated-app`, DevShield security review.

Manual browser tests: Chrome and Firefox opaque-origin worker support; worker failure fallback; 2.5s infinite-loop cancellation; HTTP/network requests blocked; renderer remains owner-session isolated; HTML <script> does not execute; phone-sized textarea/iframe display; restart/reset; code length and secrets guard; messages forged from other frames are ignored.

**Important:** In-browser Worker + iframe execution is a useful introductory sandbox, not a production-grade security boundary for arbitrary hostile programs. This preview is limited to small code snippets. A robust remote/wasm isolation layer is needed before accepting arbitrary real projects or granting evidence-backed grading.
