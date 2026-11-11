/**
 * Hands-on labs for modern software engineering, systems engineering,
 * full-stack web and mobile applications. Curated educational tasks only:
 * lab checkboxes are self-attested, not server-executed grading evidence.
 */
export const TRAINING_TRACKS = [
  {
    "id": "software-engineering",
    "title": "Software Development Engineering",
    "subtitle": "From requirements to tested, maintainable software",
    "stack": [
      "TypeScript",
      "Git",
      "GitHub",
      "Vitest",
      "GitHub Actions",
      "OWASP"
    ],
    "outcome": "A documented, tested issue-tracker service with reviewable pull requests and reliable CI.",
    "audience": "First-time developers and junior engineers",
    "capstone": "Engineering-ready mini issue tracker with test plan, pull request, CI, and security review"
  },
  {
    "id": "systems-engineering",
    "title": "Systems Engineering & Architecture",
    "subtitle": "Design secure, reliable systems before writing features",
    "stack": [
      "C4 diagrams",
      "REST/OpenAPI",
      "PostgreSQL",
      "Queues",
      "Observability",
      "Cloud design"
    ],
    "outcome": "A design dossier for a robust appointment-booking service, with measured failure recovery.",
    "audience": "Future technical leads, systems designers and architects",
    "capstone": "A booking-system architecture dossier with threat model, API contract, failure modes, and rollback exercise"
  },
  {
    "id": "fullstack-web",
    "title": "Full-Stack Web Applications",
    "subtitle": "Build, secure, test and publish a real full-stack app",
    "stack": [
      "Next.js App Router",
      "React",
      "TypeScript",
      "Supabase or MongoDB",
      "Vitest/Playwright",
      "Vercel/Cloudflare"
    ],
    "outcome": "A working multi-user web app with real data, authorization and tested public endpoints.",
    "audience": "Web developers and entrepreneurs shipping real SaaS products",
    "capstone": "Production-minded appointment/stock dashboard with CRUD, auth, isolation and deployment verification"
  },
  {
    "id": "mobile-app",
    "title": "Mobile Application Engineering",
    "subtitle": "Build and test native-feeling Android/iOS apps",
    "stack": [
      "React Native",
      "Expo",
      "TypeScript",
      "Expo Router",
      "Device APIs",
      "EAS"
    ],
    "outcome": "An installable internal-test Android/iOS app with navigation, storage and tested offline scenarios.",
    "audience": "Mobile app builders and cross-platform developers",
    "capstone": "Mobile field-visit/booking companion with offline drafts, sync, security and internal-test build"
  }
] as const;
export type TrainingTrackId = (typeof TRAINING_TRACKS)[number]["id"];
export const LAB_REFERENCE_URLS = {
  "github": "https://docs.github.com/en/get-started/start-your-journey/hello-world",
  "actions": "https://docs.github.com/en/actions",
  "next": "https://nextjs.org/docs/app",
  "nextInstall": "https://nextjs.org/docs/app/getting-started/installation",
  "expo": "https://docs.expo.dev/get-started/create-a-project/",
  "eas": "https://docs.expo.dev/build/setup/",
  "supabase": "https://supabase.com/docs/guides/database/postgres/row-level-security",
  "mongo": "https://www.mongodb.com/docs/drivers/node/current/get-started/",
  "cf": "https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/",
  "vercel": "https://vercel.com/docs/deployments",
  "owasp": "https://asvs.owasp.org/",
  "playwright": "https://playwright.dev/docs/intro",
  "vitest": "https://vitest.dev/guide/",
  "openapi": "https://spec.openapis.org/oas/latest.html",
  "c4": "https://c4model.com/",
  "expoRouter": "https://docs.expo.dev/router/introduction/",
  "expoTesting": "https://docs.expo.dev/develop/unit-testing/"
} as const;
export interface TrainingLab {
  id: string;
  trackId: TrainingTrackId;
  sequence: number;
  title: string;
  objective: string;
  durationMinutes: number;
  tasks: readonly string[];
  deliverables: readonly string[];
  acceptance: readonly string[];
  caution: string;
  references: readonly { label: string; url: string }[];
}

const RAW_LABS = [
  [
    "software-engineering",
    "se01",
    "Write real software requirements",
    "Create a 4-story backlog for a simple issue tracker.",
    [
      "Pick three roles: guest, member and administrator; state allowed actions.",
      "Write four user stories using 'As a ... I want ... so that ...'.",
      "For each story, give a positive and negative acceptance scenario.",
      "Record 2 security requirements and 1 accessibility requirement.",
      "Write an out-of-scope list to keep the first sprint small."
    ],
    [
      "docs/requirements.md",
      "docs/acceptance-checks.md"
    ],
    [
      "Each story can be checked without guessing.",
      "A denied unauthorized action is documented.",
      "Scope is limited enough for one sprint."
    ],
    "Do not mistake feature names for testable requirements.",
    [
      "github",
      "owasp"
    ]
  ],
  [
    "software-engineering",
    "se02",
    "Git and pull request laboratory",
    "Make a safe, reviewable change on a separate branch.",
    [
      "Create a local repository or clone your own training repository.",
      "Create branch feat/issue-title and make one intentional code change.",
      "Run the project checks locally and commit with a descriptive message.",
      "Open a pull request into the training default branch.",
      "Review the diff and document the revert command; do not merge failing checks."
    ],
    [
      "Commit SHA",
      "Pull request URL",
      "Review notes"
    ],
    [
      "The PR shows only the intended files.",
      "Tests were run on the branch.",
      "A rollback plan is written."
    ],
    "Never copy tokens into repository files or commit .env.local.",
    [
      "github",
      "actions"
    ]
  ],
  [
    "software-engineering",
    "se03",
    "TypeScript and automated unit tests",
    "Implement a pure task-priority function with testable behavior.",
    [
      "Create a strict TypeScript module that accepts priority and due date.",
      "Define normal, missing, and invalid inputs explicitly.",
      "Write unit tests for overdue, non-overdue, and invalid cases.",
      "Run typecheck and Vitest until both pass.",
      "Refactor the implementation without changing test behavior."
    ],
    [
      "src/lib/priority.ts",
      "src/lib/priority.test.ts",
      "Test summary"
    ],
    [
      "At least three tests assert behavior, not snapshots.",
      "Invalid inputs have safe outcomes.",
      "TypeScript and tests pass."
    ],
    "Avoid mocks that only test themselves instead of the implementation.",
    [
      "vitest",
      "next"
    ]
  ],
  [
    "software-engineering",
    "se04",
    "CI, code review and supply-chain safety",
    "Make repository checks block unreviewed broken changes.",
    [
      "Add a GitHub Actions workflow that installs locked dependencies.",
      "Run lint, typecheck, unit tests and build on pull requests.",
      "Deliberately introduce a type error on a test branch and observe CI fail.",
      "Restore the code, rerun checks, inspect the first failing log line.",
      "Add a checklist for dependency licenses, suspicious scripts, secrets and review."
    ],
    [
      ".github/workflows/ci.yml",
      "A failed and passing CI run",
      "Security checklist"
    ],
    [
      "CI fails on intentional breakage.",
      "Green checks correspond to the tested commit.",
      "No secrets appear in logs."
    ],
    "Do not run untrusted third-party install scripts without inspection.",
    [
      "actions",
      "owasp"
    ]
  ],
  [
    "software-engineering",
    "se05",
    "Refactor, review and release evidence",
    "Ship the issue tracker as a traceable learning release.",
    [
      "Identify duplicated logic and document why refactoring helps.",
      "Add a test that locks down the existing behavior.",
      "Refactor in a small pull request and inspect its changed files.",
      "Create release notes with known limitations and a revert path.",
      "Peer-review or self-review the story acceptance scenarios."
    ],
    [
      "Reviewed PR",
      "Release notes",
      "Acceptance evidence"
    ],
    [
      "Tests pass before and after the refactor.",
      "The release notes describe limitations.",
      "No unverified claims of production readiness."
    ],
    "A green build does not replace acceptance tests.",
    [
      "github",
      "owasp"
    ]
  ],
  [
    "systems-engineering",
    "sys01",
    "Requirements and system boundary diagram",
    "Draw a booking system context with clear trust boundaries.",
    [
      "List customers, staff, admin, email provider and database as actors/systems.",
      "Draw a context diagram showing each data flow.",
      "Mark externally trusted versus internal components.",
      "Name availability, latency, privacy and recovery requirements.",
      "Write tradeoffs for keeping one service versus multiple services."
    ],
    [
      "docs/context-diagram.md",
      "docs/nonfunctional-requirements.md"
    ],
    [
      "Every external data flow is labelled.",
      "Trust boundaries are marked.",
      "Nonfunctional requirements are measurable."
    ],
    "A diagram without flows or ownership is not an architecture decision.",
    [
      "c4",
      "owasp"
    ]
  ],
  [
    "systems-engineering",
    "sys02",
    "API contract and failure cases",
    "Design a booking API before implementing it.",
    [
      "Define GET /slots, POST /bookings and DELETE /bookings/{id}.",
      "Write request/response schemas, status codes and auth requirements.",
      "Describe duplicate requests, invalid input and unauthorized ownership.",
      "Document an idempotency key for retryable booking submissions.",
      "Create example success and 409 conflict responses."
    ],
    [
      "openapi.yaml",
      "API error matrix",
      "Idempotency notes"
    ],
    [
      "Every write defines authorization.",
      "Conflict responses have deterministic meaning.",
      "Examples match the specified schemas."
    ],
    "Never rely on the frontend alone to prevent duplicate bookings.",
    [
      "openapi",
      "owasp"
    ]
  ],
  [
    "systems-engineering",
    "sys03",
    "Database design and atomic scheduling",
    "Prevent simultaneous double-booking at the data layer.",
    [
      "Choose a relational booking table and a uniqueness constraint on slot+resource.",
      "Map owner_id and role-based access; write expected denial cases.",
      "Describe how a single transaction reserves a time slot.",
      "Test two concurrent claims: one succeeds and one conflicts.",
      "Document data migrations and backup/restore responsibilities."
    ],
    [
      "Schema diagram",
      "Concurrency test plan",
      "Authorization matrix"
    ],
    [
      "Duplicate bookings are rejected atomically.",
      "Cross-user reads/writes are denied by policy.",
      "A recovery plan exists."
    ],
    "Checking availability in the browser before saving is not an atomic guarantee.",
    [
      "supabase",
      "owasp"
    ]
  ],
  [
    "systems-engineering",
    "sys04",
    "Observability, queues and resilience",
    "Design a service that explains and recovers from failure.",
    [
      "List the main signals: error rate, latency, failed jobs and uptime.",
      "Define structured logs with request IDs but no credentials.",
      "Design a queue for email reminders with retry and dead-letter behavior.",
      "Sketch a circuit breaker and timeout policy for an external provider.",
      "Write an alert and incident runbook for a failed booking service."
    ],
    [
      "docs/observability.md",
      "docs/incident-runbook.md"
    ],
    [
      "Each signal has an owner and response.",
      "Retries avoid duplicate side effects.",
      "Log format excludes secrets and personal data."
    ],
    "Retries need idempotency and clear resource budgets.",
    [
      "c4",
      "owasp"
    ]
  ],
  [
    "systems-engineering",
    "sys05",
    "Capacity, failure injection and rollback",
    "Run a tabletop incident and release design review.",
    [
      "Estimate peak bookings per minute and required storage.",
      "Identify the first bottleneck and a reasonable load test method.",
      "Simulate database outage in a staging-only exercise and describe graceful errors.",
      "Describe backup verification, rollback and recovery time targets.",
      "Present design decisions, open risks and test evidence."
    ],
    [
      "Capacity worksheet",
      "Failure-injection report",
      "Architecture decision record"
    ],
    [
      "Failure handling protects customer data.",
      "Rollback restores a known-good state.",
      "Performance claims identify a measured method or are clearly estimates."
    ],
    "Do not induce outages or load test production services without authorization.",
    [
      "c4",
      "owasp"
    ]
  ],
  [
    "fullstack-web",
    "web01",
    "Bootstrap a modern Next.js workspace",
    "Create a TypeScript App Router project and verify its baseline.",
    [
      "Use an isolated training folder and run npx create-next-app@latest; choose TypeScript and App Router.",
      "Inspect package.json, app/page.tsx (or src/app/page.tsx), and layout.",
      "Run npm run dev and open the local URL.",
      "Add responsive navigation and accessible page headings.",
      "Commit a reproducible baseline with a README and .env.example names only."
    ],
    [
      "Working Next.js scaffold",
      "README.md",
      "First commit"
    ],
    [
      "Development app loads locally.",
      "TypeScript errors are absent.",
      "Mobile layout remains readable."
    ],
    "Use Node LTS that meets Next.js documented requirements.",
    [
      "nextInstall",
      "next"
    ]
  ],
  [
    "fullstack-web",
    "web02",
    "Forms, validation and accessible UI",
    "Implement a booking form that clearly handles errors.",
    [
      "Design Bookings and My Bookings pages with accessible labels.",
      "Add server-side input validation for every field.",
      "Handle loading, empty, success and error states.",
      "Use keyboard-only navigation and test at 360px width.",
      "Write two tests for valid and invalid booking input."
    ],
    [
      "src/app/book/page.tsx",
      "Input validation tests",
      "Responsive evidence"
    ],
    [
      "Invalid input never reaches persistence.",
      "Form labels and keyboard controls work.",
      "Errors tell users what action to take."
    ],
    "Client-side validation alone cannot secure a server route.",
    [
      "next",
      "vitest"
    ]
  ],
  [
    "fullstack-web",
    "web03",
    "Database persistence and identity isolation",
    "Persist real bookings and prevent one user reading another's data.",
    [
      "Choose Supabase Auth/Postgres or MongoDB based on your generated app's actual architecture.",
      "Define the booking schema and server-only credentials.",
      "Implement create/list/cancel operations in server routes.",
      "Enforce ownership on every read/write; for Supabase, enable and test RLS.",
      "Test User A and User B, refresh, and confirm records remain and are private."
    ],
    [
      "Schema migration or collection setup",
      "Server API routes",
      "Cross-account test record"
    ],
    [
      "Bookings survive refresh and restart.",
      "User B cannot access User A's records.",
      "Secrets never appear in client bundles."
    ],
    "Do not add MongoDB and Supabase simultaneously unless clear bounded roles are defined.",
    [
      "supabase",
      "mongo",
      "owasp"
    ]
  ],
  [
    "fullstack-web",
    "web04",
    "End-to-end testing and GitHub CI",
    "Verify the running app, not only generated source.",
    [
      "Write unit tests for validation and authorization rules.",
      "Create browser tests for booking, refresh and cancellation.",
      "Test negative cases and a second account; use disposable data.",
      "Configure CI for lint, types, tests and production build.",
      "Document the first failure and smallest fix from one failing run."
    ],
    [
      "Unit tests",
      "End-to-end test",
      "Passing CI run"
    ],
    [
      "The browser test confirms persistence.",
      "Unauthorized access is denied.",
      "The passing CI commit matches reviewed code."
    ],
    "Do not mock the entire backend for tests claimed as end-to-end.",
    [
      "playwright",
      "actions",
      "owasp"
    ]
  ],
  [
    "fullstack-web",
    "web05",
    "Deploy to Vercel or Cloudflare and prove readiness",
    "Publish the generated app and check its real functionality.",
    [
      "Push the complete generated application, not the BuildRx builder source.",
      "Choose Vercel or prepare the app's Cloudflare Workers handoff.",
      "Configure only required hosting environment variables securely.",
      "Wait for deployment evidence and open the real HTTPS URL.",
      "Test login, create, edit/cancel, refresh, mobile and error handling; record rollback notes."
    ],
    [
      "GitHub commit",
      "Hosting deployment URL",
      "Live smoke checklist"
    ],
    [
      "The tested URL runs actual app routes.",
      "Representative data writes survive refresh.",
      "There is a repeatable rollback path."
    ],
    "Cloudflare 'prepared' and green GitHub checks are NOT proof of live Workers deployment.",
    [
      "vercel",
      "cf",
      "owasp"
    ]
  ],
  [
    "mobile-app",
    "mob01",
    "Create your first Expo React Native application",
    "Run a mobile development project and inspect its platform boundaries.",
    [
      "Run npx create-expo-app@latest in a local training folder (do not execute unreviewed scripts).",
      "Inspect app routes, package.json, app.json and Expo scripts.",
      "Use Expo Go or an approved emulator/device for a development preview.",
      "Create two accessible screens and a reusable button.",
      "Document which features require a development build rather than Expo Go."
    ],
    [
      "Expo app repository",
      "Device/emulator screenshot",
      "Setup notes"
    ],
    [
      "Both screens render on a real or emulated device.",
      "Project source is committed without secrets.",
      "Known platform limitations are documented."
    ],
    "BuildRx's Next.js generator does not currently produce a verified React Native native binary.",
    [
      "expo",
      "expoRouter"
    ]
  ],
  [
    "mobile-app",
    "mob02",
    "Navigation and responsive native UI",
    "Build a mobile booking flow with usable routes and state.",
    [
      "Add Expo Router screens for Home, New Booking and My Bookings.",
      "Build inputs with correct labels, touch targets and keyboard handling.",
      "Add loading, empty and validation states.",
      "Try portrait and landscape sizes on Android; test iOS where devices are available.",
      "Record the key flow with a short screen video or screenshots."
    ],
    [
      "Expo Router screens",
      "Form component",
      "Accessibility test notes"
    ],
    [
      "Back navigation works.",
      "Touch targets and keyboard focus remain usable.",
      "No screen silently loses unsaved form state."
    ],
    "Mobile navigation and gesture behavior differ from browser tabs.",
    [
      "expoRouter",
      "expo"
    ]
  ],
  [
    "mobile-app",
    "mob03",
    "Secure API access and login",
    "Connect mobile screens to a real authorized backend.",
    [
      "Design a minimal server API with authorization and safe status codes.",
      "Use platform-appropriate auth flow and encrypted/token storage where needed.",
      "Keep service-role secrets out of the client and app bundle.",
      "Implement API calls with explicit loading, unauthorized and timeout states.",
      "Test two accounts and deny cross-user booking access."
    ],
    [
      "API client module",
      "Auth state diagram",
      "Authorization test matrix"
    ],
    [
      "Tokens are not embedded in source.",
      "Denied API calls show safe errors.",
      "Cross-user data is isolated."
    ],
    "Every installed mobile app is a public client; secrets inside it can be extracted.",
    [
      "expo",
      "supabase",
      "owasp"
    ]
  ],
  [
    "mobile-app",
    "mob04",
    "Offline drafts, synchronization and device testing",
    "Make a mobile app useful when the network is unreliable.",
    [
      "Store a temporary booking draft locally; avoid sensitive plaintext.",
      "Test opening forms with Wi-Fi and mobile data disabled.",
      "Show sync state clearly and avoid duplicate submissions on reconnect.",
      "Add retries with idempotent server writes and safe conflict handling.",
      "Test background/foreground behavior and accessibility on an actual device."
    ],
    [
      "Offline behavior checklist",
      "Sync decision notes",
      "Conflict test report"
    ],
    [
      "Offline drafts are not reported as confirmed bookings.",
      "Reconnect does not submit duplicates.",
      "Errors show a recovery action."
    ],
    "A local successful save is not a confirmed server booking.",
    [
      "expo",
      "owasp"
    ]
  ],
  [
    "mobile-app",
    "mob05",
    "Mobile QA, EAS internal builds and release safety",
    "Produce a tested internal build and deployment evidence.",
    [
      "Add unit tests for validation and offline state.",
      "Test device permissions, denied authorization and bad connectivity.",
      "Follow Expo EAS setup for a development/internal-distribution build.",
      "Install the resulting authorized test build and test actual workflows.",
      "Write release notes, privacy disclosure and app-store readiness limitations."
    ],
    [
      "Passing tests",
      "Internal test build or documented blocker",
      "Release checklist"
    ],
    [
      "Internal testers can install and exercise the build.",
      "Secrets and personal data are protected.",
      "No app-store publication is claimed without store approval."
    ],
    "BuildRx does not itself sign and publish iOS/Android packages in this learning feature.",
    [
      "eas",
      "expoTesting",
      "owasp"
    ]
  ]
] as const;
/** Explicitly ordered by track. Each step is a manual exercise, never executed by BuildRx. */
export const TRAINING_LABS: readonly TrainingLab[] = RAW_LABS.map((raw) => {
  const [trackId, id, title, objective, tasks, deliverables, acceptance, caution, keys] = raw;
  return {
    id, trackId: trackId as TrainingTrackId,
    sequence: Number(id.match(/\d+$/)?.[0] ?? 0),
    title, objective, durationMinutes: 50,
    tasks, deliverables, acceptance, caution,
    references: keys.map((key) => ({
      label: key.replace(/([a-z])([A-Z])/g, "$1 $2"),
      url: LAB_REFERENCE_URLS[key as keyof typeof LAB_REFERENCE_URLS],
    })),
  };
});
export function getTrainingLab(id: string): TrainingLab | undefined {
  return TRAINING_LABS.find(lab => lab.id === id);
}
export function labsForTrack(id: TrainingTrackId): readonly TrainingLab[] {
  return TRAINING_LABS.filter(lab => lab.trackId === id);
}
