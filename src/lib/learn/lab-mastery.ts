import { getTrainingLab, labsForTrack, type TrainingTrackId } from "@/lib/learn/labs";

/** Reviewed formative knowledge checks. Scores are browser-local practice, not certified grading. */
export interface LabKnowledgeCheck {
  id: string;
  labId: string;
  prompt: string;
  choices: readonly string[];
  correctIndex: number;
  explanation: string;
}
type RawCheck = readonly [string, string, readonly string[], number, string];
const RAW_CHECKS: readonly RawCheck[] = [
  [
    "se01",
    "Which statement is testable acceptance evidence?",
    [
      "The system feels modern",
      "An unauthorized guest receives a denied response",
      "The app should be beautiful",
      "The backend is excellent"
    ],
    1,
    "A measurable pass/fail outcome is essential."
  ],
  [
    "se01",
    "Why define work that is out of scope?",
    [
      "To eliminate all tests",
      "To avoid writing requirements",
      "To keep the sprint bounded and reviewable",
      "To guarantee zero bugs"
    ],
    2,
    "A bounded scope makes delivery and verification practical."
  ],
  [
    "se02",
    "Where should a beginner make an experimental change?",
    [
      "Directly on production",
      "On a dedicated feature branch",
      "In a committed .env file",
      "In the deployment dashboard"
    ],
    1,
    "A feature branch isolates reviewable changes."
  ],
  [
    "se02",
    "What proves a reviewed change is the same code CI tested?",
    [
      "A screenshot of a green logo",
      "A link to any repository",
      "The exact commit SHA",
      "The user's display name"
    ],
    2,
    "The commit SHA links checks to the actual source revision."
  ],
  [
    "se03",
    "What does a good unit test primarily verify?",
    [
      "Behavior for known inputs and edge cases",
      "That a code comment exists",
      "A production URL is live",
      "That the author is experienced"
    ],
    0,
    "Tests should assert behavior, including negative and edge cases."
  ],
  [
    "se03",
    "Why test an invalid input?",
    [
      "It guarantees performance",
      "It makes TypeScript optional",
      "It establishes a safe failure behavior",
      "It allows storing secrets"
    ],
    2,
    "Invalid input behavior is part of a reliable function contract."
  ],
  [
    "se04",
    "Which CI setting is safest for reviewable student PRs?",
    [
      "Run arbitrary deployment jobs",
      "Commit encrypted secrets in source",
      "Grant all write permissions",
      "Use read-only permissions and fail on broken checks"
    ],
    3,
    "Least privilege and failing on invalid changes are foundational."
  ],
  [
    "se04",
    "What should follow an intentionally broken test run?",
    [
      "Ignore the failure",
      "Fix the branch and rerun on the intended commit",
      "Disable the test suite",
      "Merge immediately"
    ],
    1,
    "Restore safe behavior and verify again."
  ],
  [
    "se05",
    "What should happen before refactoring working logic?",
    [
      "Delete all tests",
      "Take a baseline test of current behavior",
      "Release without review",
      "Change every module"
    ],
    1,
    "Baseline tests protect behavior during refactoring."
  ],
  [
    "se05",
    "Which release note is most useful?",
    [
      "Everything works perfectly",
      "No limitations exist",
      "Known limitations and a reversible rollback plan",
      "Certification automatically granted"
    ],
    2,
    "Release evidence should state uncertainties and rollback."
  ],
  [
    "sys01",
    "Which system interaction crosses a trust boundary?",
    [
      "A local variable assignment",
      "Untrusted browser request entering the backend",
      "An internal function call",
      "Opening the source editor"
    ],
    1,
    "Browser/mobile requests must be validated at the server boundary."
  ],
  [
    "sys01",
    "Which requirement is measurable?",
    [
      "The API is always fast",
      "The interface is magic",
      "The system never fails",
      "95% of GET responses complete within an agreed latency threshold"
    ],
    3,
    "Service targets need measurable criteria and stated workloads."
  ],
  [
    "sys02",
    "Why use an idempotency key for retryable POST requests?",
    [
      "To allow duplicate charges",
      "To prevent a retry from creating duplicate effects",
      "To bypass authentication",
      "To cache passwords"
    ],
    1,
    "Idempotency makes retries safer after uncertain responses."
  ],
  [
    "sys02",
    "What does HTTP 409 usually indicate in this booking exercise?",
    [
      "A request conflict such as an already-reserved slot",
      "Successful deletion",
      "A missing token always",
      "A server is permanently down"
    ],
    0,
    "A 409 should communicate a specific state conflict."
  ],
  [
    "sys03",
    "Where should double-booking prevention ultimately be enforced?",
    [
      "Only in CSS",
      "Only in a client-side availability check",
      "Atomically in the database transaction or constraint",
      "In a marketing page"
    ],
    2,
    "Database-level atomicity prevents concurrent conflicting writes."
  ],
  [
    "sys03",
    "How should User B's attempt to read User A's booking be handled?",
    [
      "Allow if the URL is known",
      "Deny at the authorized server/data layer",
      "Hide a button but allow the API",
      "Give all learners admin rights"
    ],
    1,
    "Ownership enforcement must not depend only on frontend UI."
  ],
  [
    "sys04",
    "What prevents retries from sending duplicate reminder emails?",
    [
      "More retries without limits",
      "A brighter dashboard",
      "Idempotent processing and bounded retry policies",
      "Removing error logs"
    ],
    2,
    "Retries must account for already-processed work."
  ],
  [
    "sys04",
    "Which value should be excluded from structured production logs?",
    [
      "Request duration",
      "An internal correlation ID",
      "A sanitized error code",
      "An API secret or raw access token"
    ],
    3,
    "Logs must not expose credentials."
  ],
  [
    "sys05",
    "Where is a failure-injection drill safest?",
    [
      "Production without approval",
      "A deliberately isolated staging environment",
      "A user account with real payment data",
      "Any public random service"
    ],
    1,
    "Staging drills reduce risk to users and services."
  ],
  [
    "sys05",
    "What does RTO describe?",
    [
      "Maximum target time to restore service",
      "Repository total output",
      "Recommended token ownership",
      "Real-time optimization only"
    ],
    0,
    "Recovery Time Objective estimates acceptable restoration time."
  ],
  [
    "web01",
    "Where does the Next.js App Router define pages?",
    [
      "Only in package.json",
      "In app/ or src/app/ route files",
      "Only in .env",
      "In GitHub Actions"
    ],
    1,
    "The App Router uses filesystem routes."
  ],
  [
    "web01",
    "What belongs in .env.example?",
    [
      "Real API keys",
      "Production passwords",
      "Variable names and safe placeholders only",
      "A service-role token"
    ],
    2,
    "Examples must never include real secrets."
  ],
  [
    "web02",
    "Where must booking inputs be validated before persistence?",
    [
      "Only via HTML required attributes",
      "On the server as well as any client checks",
      "Only in a CSS file",
      "By AI-generated prose"
    ],
    1,
    "Server validation protects backend state."
  ],
  [
    "web02",
    "What improves form accessibility?",
    [
      "Removing visible labels",
      "Clickable non-semantic text only",
      "Labels associated with form fields and keyboard support",
      "Disabling focus outlines"
    ],
    2,
    "Explicit labels and keyboard navigation are practical accessibility baselines."
  ],
  [
    "web03",
    "What demonstrates real data persistence?",
    [
      "Form appears once",
      "A screenshot of a preview",
      "Records survive refresh and can be fetched by the rightful user",
      "A CSS animation runs"
    ],
    2,
    "Persistence requires a real backend storage round trip."
  ],
  [
    "web03",
    "What is the safest data access check?",
    [
      "Only hide other accounts in UI",
      "Confirm cross-account requests are denied server-side/RLS",
      "Trust any client-provided ownerId",
      "Disable auth to ease tests"
    ],
    1,
    "Test authorization with multiple accounts."
  ],
  [
    "web04",
    "What makes a browser test genuinely end-to-end?",
    [
      "Mocking the whole database in every test",
      "Only checking a component renders",
      "Exercising UI, server and real disposable persistence",
      "Checking code comments"
    ],
    2,
    "E2E tests exercise integrated behavior rather than only mocks."
  ],
  [
    "web04",
    "Why use disposable test data?",
    [
      "To prevent tests from modifying real customer records",
      "To hide all failures",
      "To skip authorization",
      "To guarantee zero downtime"
    ],
    0,
    "Isolated fixtures prevent harm to user data."
  ],
  [
    "web05",
    "What confirms the deployed application actually works?",
    [
      "A green build badge alone",
      "The presence of a repository URL",
      "Only a generated ZIP",
      "Live HTTPS smoke tests including data operations"
    ],
    3,
    "A build proves compilation, not real production behavior."
  ],
  [
    "web05",
    "Does preparing Cloudflare source mean a Worker is deployed?",
    [
      "Yes, automatically",
      "No, deployment and URL verification are separate",
      "Only if a README exists",
      "Yes, if the branch is named main"
    ],
    1,
    "Source preparation is distinct from verified deployment."
  ],
  [
    "mob01",
    "What is an Expo Go limitation?",
    [
      "It signs every app for store publication",
      "It automatically provides production backends",
      "Some native modules require a development build",
      "It is a server database"
    ],
    2,
    "Expo Go cannot support every native module."
  ],
  [
    "mob01",
    "Where should a first mobile screen be verified?",
    [
      "In a real device or emulator",
      "Only in a Markdown file",
      "Only via a GitHub diff",
      "Only in a spreadsheet"
    ],
    0,
    "Actual device rendering and behavior are necessary."
  ],
  [
    "mob02",
    "Which test best covers mobile navigation?",
    [
      "Only verifying the source file exists",
      "Going forward and back while preserving appropriate form state",
      "Only running lint",
      "Opening the home page in a desktop browser"
    ],
    1,
    "Navigation tests should exercise user interaction and state."
  ],
  [
    "mob02",
    "Which native usability issue deserves testing?",
    [
      "Only app title spelling",
      "Secret storage in source",
      "Touch targets and on-screen keyboard behavior",
      "Unrestricted admin access"
    ],
    2,
    "Mobile touch and keyboard behavior differs from desktop."
  ],
  [
    "mob03",
    "Which credential must not be embedded in a mobile app bundle?",
    [
      "A user-facing app title",
      "An ordinary public API endpoint name",
      "A service-role or backend secret token",
      "A static icon label"
    ],
    2,
    "Installed apps are public clients: embedded secrets can be extracted."
  ],
  [
    "mob03",
    "What should happen if an API denies access?",
    [
      "Pretend the request succeeded",
      "Show a safe error and protect the private data",
      "Disable authentication",
      "Return another user's booking"
    ],
    1,
    "Handle authorization failures without exposing private data."
  ],
  [
    "mob04",
    "What is true about a saved offline booking draft?",
    [
      "It is a confirmed server reservation",
      "It always synchronizes instantly",
      "It does not count as a confirmed booking until server acknowledgement",
      "It can bypass conflicts"
    ],
    2,
    "Make pending versus confirmed states explicit."
  ],
  [
    "mob04",
    "Why should reconnect submissions be idempotent?",
    [
      "To prevent duplicate bookings",
      "To weaken authentication",
      "To skip retries entirely",
      "To create extra records"
    ],
    0,
    "Idempotency supports safe replay after disconnection."
  ],
  [
    "mob05",
    "What does an EAS internal build prove?",
    [
      "Automatic App Store approval",
      "A test binary can be built for authorized testers",
      "Every workflow is secure",
      "The backend is deployed"
    ],
    1,
    "Internal builds do not imply public store publication."
  ],
  [
    "mob05",
    "Which final test is important before release?",
    [
      "Skip all permission denial scenarios",
      "Use only mock screenshots",
      "Verify denied permissions and bad-connectivity recovery on a device",
      "Publish immediately after compilation"
    ],
    2,
    "Real-world device failure paths matter."
  ]
];
export const LAB_KNOWLEDGE_CHECKS: readonly LabKnowledgeCheck[] = RAW_CHECKS.map(([labId,prompt,choices,correctIndex,explanation], index) => ({
  id: labId + "-q" + (index % 2 + 1),
  labId, prompt, choices, correctIndex, explanation,
}));
export function checksForLab(labId: string): readonly LabKnowledgeCheck[] {
  return LAB_KNOWLEDGE_CHECKS.filter(item => item.labId === labId);
}
export function prerequisitesForLab(labId: string): readonly string[] {
  const lab = getTrainingLab(labId);
  if (!lab) return [];
  const ordered = labsForTrack(lab.trackId);
  const position = ordered.findIndex(item => item.id === labId);
  return position > 0 ? [ordered[position - 1].id] : [];
}
export function nextLabForTrack(trackId: TrainingTrackId, doneLabIds: ReadonlySet<string>): string | null {
  const firstIncomplete = labsForTrack(trackId).find(item => !doneLabIds.has(item.id));
  return firstIncomplete?.id ?? null;
}
export type KnowledgeGrade = {
  answered: number;
  total: number;
  correct: number;
  passed: boolean;
  details: readonly { questionId: string; selectedIndex: number | null; isCorrect: boolean; explanation: string }[];
};
export function gradeLabKnowledge(labId: string, answers: Readonly<Record<string, number>>): KnowledgeGrade {
  const checks = checksForLab(labId);
  const details = checks.map(q => ({
    questionId: q.id,
    selectedIndex: Number.isInteger(answers[q.id]) && answers[q.id] >= 0 && answers[q.id] < q.choices.length ? answers[q.id] : null,
    isCorrect: answers[q.id] === q.correctIndex,
    explanation: q.explanation,
  }));
  const correct = details.filter(item => item.isCorrect).length;
  const answered = details.filter(item => item.selectedIndex !== null).length;
  return { answered, total: checks.length, correct, passed: checks.length > 0 && answered === checks.length && correct === checks.length, details };
}
