import type { TrainingTrackId } from "@/lib/learn/labs";

export const ENGINEERING_STAGES = [
  { id: "scope", title: "Understand the problem", skill: "Define the user, minimum useful workflow and measurable acceptance" },
  { id: "architecture", title: "Design the system", skill: "Choose safe data ownership, interfaces and persistent storage" },
  { id: "implementation", title: "Code and verify", skill: "Write a testable feature and check success and failure paths" },
  { id: "hardening", title: "Secure and debug", skill: "Protect users and isolate failures with evidence" },
  { id: "release", title: "Release with proof", skill: "Use GitHub, CI, preview checks and rollback preparation" },
] as const;

export type EngineeringDecision = {
  question: string;
  choices: readonly [string, string, string];
  correctIndex: 0 | 1 | 2;
  explanation: string;
  retryHint: string;
};
export type EngineeringMission = {
  id: string;
  trackId: TrainingTrackId;
  title: string;
  duration: string;
  audience: string;
  problem: string;
  outcome: string;
  userStory: string;
  stack: readonly string[];
  labId: string;
  exerciseId: string;
  requirements: readonly string[];
  acceptance: readonly string[];
  decisions: readonly EngineeringDecision[];
};
export const ENGINEERING_MISSIONS: readonly EngineeringMission[] = [
  {
    id: "devices", trackId: "software-engineering", title: "Campus Device Trade", duration: "60–90 min",
    audience: "Student marketplace operators", labId: "se03", exerciseId: "js-validation",
    stack: ["TypeScript", "React", "Validation", "GitHub", "Vitest"],
    problem: "Students need a reliable way to offer used laptops and phones without exposing ownership documents to buyers.",
    outcome: "A moderated device listing workflow with server-side validation, private evidence and test cases.",
    userStory: "As a student, I can submit a used-device listing for operator review and see whether it was approved.",
    requirements: [
      "Submit a device brand, model, condition, asking price and ownership declaration.",
      "Owner reviews and approves listings; pending devices are not visible as approved goods.",
      "Private ownership evidence is accessible only to authorised reviewers, with a clear retention policy.",
      "Provide error, empty, loading and approval/rejection states."
    ],
    acceptance: [
      "A listing with missing model or negative price is rejected by server-side validation.",
      "Unreviewed listings cannot appear in the approved public catalogue.",
      "One student cannot read another seller's private ownership evidence.",
      "A reviewer can record an approval or rejection with an audit event."
    ],
    decisions: [
      { question: "What should be agreed before generating a marketplace UI?", choices: [
        "Choose animations and start creating product cards.",
        "Write the listing-to-review user story and checks for approval.",
        "Connect payment processing before the review workflow."
      ], correctIndex: 1, explanation: "Begin with a bounded workflow and acceptance criteria. A beautiful catalogue does not prove safe moderation.", retryHint: "A useful first step defines who does what and how you will know it worked." },
      { question: "Where should the approval decision be enforced?", choices: [
        "In a trusted API/database policy that checks the reviewer's role.",
        "Only by hiding the Approve button with CSS.",
        "In a public localStorage flag."
      ], correctIndex: 0, explanation: "Server/database authorization must control approval, regardless of what the browser displays.", retryHint: "Assume a user can edit HTML and browser storage." },
      { question: "Which test best protects the main business rule?", choices: [
        "A screenshot showing four laptops.",
        "A test that checks the logo text.",
        "A test showing a pending listing never appears as approved."
      ], correctIndex: 2, explanation: "The tested behaviour must trace the intended business rule, including a negative case.", retryHint: "Test what would cause actual harm if it failed." },
      { question: "How should uploaded proof-of-ownership documents be handled?", choices: [
        "Make their storage URLs public for convenient verification.",
        "Restrict access to authorised reviewers and define retention/deletion.",
        "Embed the documents into source code."
      ], correctIndex: 1, explanation: "Evidence documents are sensitive. Store them privately, authorize access and minimise retention.", retryHint: "The public listing should not expose personal documents." },
      { question: "The preview shows the homepage, but no listing can be saved. What now?", choices: [
        "Verify create/read workflows and API/database permissions before declaring a release ready.",
        "Publish immediately because the page looks complete.",
        "Rename the repository to fix functionality."
      ], correctIndex: 0, explanation: "Release evidence must include successful end-to-end behaviour, not just a rendered UI.", retryHint: "A release gate checks actual feature behaviour, not only appearance." },
    ],
  },
  {
    id: "inventory", trackId: "fullstack-web", title: "BOSAL Store Inventory", duration: "60–90 min",
    audience: "Supermarket and restaurant operators", labId: "web03", exerciseId: "js-totals",
    stack: ["Next.js", "TypeScript", "Supabase", "Payments", "Tests"],
    problem: "A local retailer needs searchable items, stock changes, order records and accurate cart totals.",
    outcome: "A full-stack product catalogue with valid checkout totals, protected inventory and reliable order states.",
    userStory: "As a buyer, I can find products, build a basket and submit an order with a correct server-checked total.",
    requirements: [
      "Search products by category and show images, item names and available quantities.",
      "Separate demo product data from confirmed inventory and real payment status.",
      "Calculate cart totals reliably and recalculate prices on the server before an order.",
      "Only an authorised operator can edit product stock and order fulfilment status."
    ],
    acceptance: [
      "An empty basket costs zero; quantities and prices cannot be negative.",
      "A browser-modified total cannot change the final charged server amount.",
      "Out-of-stock items cannot be purchased through a race condition.",
      "Orders show pending, confirmed, rejected and fulfilled states correctly."
    ],
    decisions: [
      { question: "The owner asks to 'make the store look populated.' What should you clarify first?", choices: [
        "Whether the products are demo content or actual stock with verified prices.",
        "Which font has the strongest brand effect.",
        "How many fake customer reviews to add."
      ], correctIndex: 0, explanation: "A real product must clearly distinguish demonstration goods from inventory a merchant can fulfil.", retryHint: "Ask which information customers may safely rely on." },
      { question: "Where should the final order total be calculated?", choices: [
        "Only in a client-side React hook.",
        "From a trusted server-side product price and validated quantity.",
        "By trusting the number in the browser checkout form."
      ], correctIndex: 1, explanation: "Server-side pricing avoids client tampering, and stock changes should be handled atomically.", retryHint: "A buyer can edit the request leaving the browser." },
      { question: "Which checkout test reveals a real defect?", choices: [
        "The checkout button is purple.",
        "The home image loads.",
        "A zero-quantity item and edited client total cannot create a wrong charge."
      ], correctIndex: 2, explanation: "Boundary cases and adversarial inputs help prove checkout logic.", retryHint: "Prioritise test cases that could affect money." },
      { question: "Two users order the last item at the same time. What should protect stock?", choices: [
        "A one-second delay in the UI.",
        "A database transaction/conditional update that prevents overselling.",
        "Refreshing the product card after a purchase."
      ], correctIndex: 1, explanation: "Concurrency should be handled in the trusted persistence layer, not with UI timing.", retryHint: "Think about two requests arriving before either page refreshes." },
      { question: "The app deploys but customers get an error submitting orders. What proves readiness?", choices: [
        "Production-build success only.",
        "An attractive landing-page screenshot.",
        "A checked live order flow, error logs, configuration, rollback path and payment test."
      ], correctIndex: 2, explanation: "Deployment is not a functional release until critical transactions are tested end-to-end.", retryHint: "A live URL alone cannot prove business workflows." },
    ],
  },
  {
    id: "booking", trackId: "systems-engineering", title: "Appointment Booking System", duration: "60–90 min",
    audience: "Service providers, clinics and businesses", labId: "sys03", exerciseId: "js-slots",
    stack: ["System design", "REST API", "Postgres", "Concurrency", "Observability"],
    problem: "Customers must reserve time slots without accidental double bookings or lost confirmations.",
    outcome: "An architecture brief and working reservation prototype with concurrency and recovery thinking.",
    userStory: "As a customer, I can reserve one available slot and receive a confirmation for that reservation.",
    requirements: [
      "Show only available slots, and distinguish draft selections from confirmed bookings.",
      "Persist reservations with atomic no-double-booking protection.",
      "Record a request identifier to avoid duplicate writes on retries.",
      "Document failure modes and how the operator identifies or repairs failed notifications."
    ],
    acceptance: [
      "Two simultaneous requests cannot confirm the same exclusive slot.",
      "Retrying the same reservation request does not create another booking.",
      "Rejected slots display an actionable error without altering confirmed data.",
      "The operator can trace a reservation through logs without exposing personal details."
    ],
    decisions: [
      { question: "What is the essential outcome in a booking system?", choices: [
        "A calendar with colourful slots.",
        "A reliable confirmed reservation with no conflicting booking.",
        "An automatic thank-you message before saving the slot."
      ], correctIndex: 1, explanation: "The business promise is a confirmed exclusive reservation, not the interface.", retryHint: "Consider what the customer is actually paying or waiting for." },
      { question: "Which architecture best prevents two users claiming the same slot?", choices: [
        "A database uniqueness constraint or transaction backed by a reservation API.",
        "Disable the button for 500 ms.",
        "Ask the browser to check localStorage before booking."
      ], correctIndex: 0, explanation: "Concurrency controls belong in the database or other trusted serialisation boundary.", retryHint: "A browser can know only its own recent state." },
      { question: "Which test provides meaningful evidence?", choices: [
        "A button click succeeds once.",
        "The spinner rotates during loading.",
        "Two concurrent attempts produce at most one confirmed reservation."
      ], correctIndex: 2, explanation: "Reproducing races is how you validate the core reliability requirement.", retryHint: "Test simultaneous users, not just a single happy path." },
      { question: "An email provider times out after a confirmed booking. What should happen?", choices: [
        "Delete the reservation to hide the error.",
        "Keep durable booking state, queue/record notification retry and avoid duplicate sends.",
        "Confirm a second booking so the email is more likely to arrive."
      ], correctIndex: 1, explanation: "Notifications are side effects; retry them safely without duplicating primary transactions.", retryHint: "Do not make a real booking dependent on an unreliable notification." },
      { question: "Before releasing the system, which evidence matters?", choices: [
        "Concurrency tests, reservation logs, known limitations and a rollback procedure.",
        "Only the public URL.",
        "Only the selected colour palette."
      ], correctIndex: 0, explanation: "A release review should cover correctness, observability and recovery.", retryHint: "Think about what the operator needs when a customer reports a missed booking." },
    ],
  },
  {
    id: "offline", trackId: "mobile-app", title: "Offline Field-Visit App", duration: "60–90 min",
    audience: "Mobile field officers and research teams", labId: "mob03", exerciseId: "js-mobile-queue",
    stack: ["React Native", "Expo", "Local storage", "Sync", "Security"],
    problem: "Field staff need to save work without reliable mobile data and safely sync changes later.",
    outcome: "A mobile prototype with private offline drafts, duplicate-safe sync, and a realistic testing plan.",
    userStory: "As a field officer, I can record a visit offline and sync it once without losing or exposing my notes.",
    requirements: [
      "Collect a short visit form with input validation and clear offline status.",
      "Save unsent drafts locally with data minimisation and protected access.",
      "Queue sync events with unique identifiers and visible confirmation/retry states.",
      "Test airplane mode, process restarts, repeated submissions and low-bandwidth usage."
    ],
    acceptance: [
      "A draft survives a restart in the intended supported environment.",
      "Repeated sync attempts do not create duplicate visit records.",
      "Unauthorised users cannot read stored draft records.",
      "The app clearly distinguishes local draft, queued, failed and synced states."
    ],
    decisions: [
      { question: "What must an offline-first field app do reliably?", choices: [
        "Show a green network icon all the time.",
        "Save a valid draft on the device before connectivity is restored.",
        "Disable the form whenever the connection disappears."
      ], correctIndex: 1, explanation: "Offline-first means the core action can occur without a network request.", retryHint: "The user must not lose their work when data runs out." },
      { question: "Where do pending offline submissions belong?", choices: [
        "In an appropriate persistent local store with bounded sync queue records.",
        "Only in in-memory React state.",
        "In a public analytics event."
      ], correctIndex: 0, explanation: "Persistent local storage permits recovery, with platform-appropriate privacy controls.", retryHint: "Would the data survive the application process restarting?" },
      { question: "Which test best verifies offline correctness?", choices: [
        "Count the number of buttons.",
        "Check the logo on Wi-Fi.",
        "Save offline, restart, retry sync twice and verify only one server record."
      ], correctIndex: 2, explanation: "Exercise real failure paths: restart, offline, retries and duplicate prevention.", retryHint: "You should test without internet and through a restart." },
      { question: "How should potentially sensitive field notes be handled?", choices: [
        "Persist every note in logs for debugging.",
        "Collect only needed data, protect local storage and require authorized sync.",
        "Include note contents in crash-report URLs."
      ], correctIndex: 1, explanation: "Local storage is not automatically private; design explicit protection and minimise data.", retryHint: "Assume devices can be lost or shared." },
      { question: "When may you say the mobile app is ready for external release?", choices: [
        "After a preview screenshot.",
        "When a developer simulator launches.",
        "After verified device testing, offline scenarios, a reproducible build and release review."
      ], correctIndex: 2, explanation: "Native device behaviour and reliable sync need actual device/build testing.", retryHint: "Browser previews do not establish mobile device reliability." },
    ],
  },
];

export type EngineeringProgress = Record<string, number[]>;
export const ENGINEERING_PROGRESS_KEY = "buildrx-engineering-missions-v1";

export function missionById(id: string | null | undefined): EngineeringMission | undefined {
  return ENGINEERING_MISSIONS.find((mission) => mission.id === id);
}
export function safeEngineeringProgress(raw: unknown): EngineeringProgress {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const safe: EngineeringProgress = {};
  for (const mission of ENGINEERING_MISSIONS) {
    const answers = source[mission.id];
    if (!Array.isArray(answers)) continue;
    safe[mission.id] = mission.decisions.map((question, i) =>
      answers[i] === question.correctIndex ? question.correctIndex : -1
    );
  }
  return safe;
}
export function passedEngineeringSteps(mission: EngineeringMission, progress: EngineeringProgress): number {
  const answers = progress[mission.id] ?? [];
  return mission.decisions.filter((question, i) => answers[i] === question.correctIndex).length;
}
export function nextEngineeringStep(mission: EngineeringMission, progress: EngineeringProgress): number {
  const answers = progress[mission.id] ?? [];
  const first = mission.decisions.findIndex((question, i) => answers[i] !== question.correctIndex);
  return first < 0 ? mission.decisions.length - 1 : first;
}
export function engineeringPrompt(mission: EngineeringMission, optionalGoal = ""): string {
  const goal = optionalGoal.trim().slice(0, 180);
  return [
    "Act as a rigorous software engineering copilot. Create an editable, testable app for this training project.",
    "Project: " + mission.title,
    "User problem: " + mission.problem,
    "Primary user story: " + mission.userStory,
    "Stack guidance: " + mission.stack.join(", "),
    ...(goal ? ["Learner's additional scope (validate and clarify before using): " + goal] : []),
    "Requirements:",
    ...mission.requirements.map((item, i) => String(i + 1) + ". " + item),
    "Acceptance tests:",
    ...mission.acceptance.map((item, i) => String(i + 1) + ". " + item),
    "Build a complete vertical slice. Produce files, a concise setup README, tests for failure paths and a security checklist.",
    "Mark unimplemented features honestly. Avoid fake database integrations, credentials, simulated payments represented as real, and placeholder-only pages.",
    "Propose a GitHub/CI/preview/deployment verification plan and rollback. No production deployment without explicit human approval.",
  ].join("\n");
}
