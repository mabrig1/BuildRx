import { TRAINING_TRACKS, type TrainingTrackId } from "@/lib/learn/labs";
import { containsLikelyPrivateValue } from "@/lib/learn/lab-mastery-progress";

/**
 * Capstone evidence is SELF-REPORTED metadata. No private repo, commit,
 * CI job, deployed URL, test result or learner identity is verified by this module.
 * This module performs no network access and awards no certificates.
 */
export const CAPSTONE_STORAGE_KEY = "buildrx-capstone-evidence-v1";
export const CAPSTONE_RECORD_VERSION = 1 as const;
export const CAPSTONE_TITLE_LIMIT = 100;
export const CAPSTONE_NOTE_LIMIT = 350;
export const CAPSTONE_REFLECTION_LIMIT = 800;
export const CAPSTONE_URL_LIMIT = 280;
export const CAPSTONE_MAX_STORAGE_CHARS = 24_000;

export interface CapstoneCriterion {
  id: string;
  title: string;
  requestedEvidence: string;
  reviewerCheck: string;
}
export const CAPSTONE_RUBRICS: Readonly<Record<TrainingTrackId, readonly CapstoneCriterion[]>> = {
  "software-engineering": [
    { id: "requirements", title: "Testable requirements", requestedEvidence: "A requirements file and acceptance criteria for user roles and negative cases", reviewerCheck: "Inspect the stories and reproduce the stated acceptance checks" },
    { id: "implementation", title: "Source and traceability", requestedEvidence: "A named source file and the commit SHA containing it", reviewerCheck: "Confirm the file exists at the recorded commit and meets requirements" },
    { id: "tests", title: "Unit tests and negative scenarios", requestedEvidence: "Test file paths, assertions, test command and a reproducible test outcome", reviewerCheck: "Rerun tests in an independent clean environment" },
    { id: "ci", title: "CI and review", requestedEvidence: "A read-only CI workflow, relevant run URL and reviewed pull request", reviewerCheck: "Inspect permissions, run result, branch and exact commit SHA" },
    { id: "security", title: "Basic security and privacy", requestedEvidence: "Dependency inspection and a safe handling plan for errors and secrets", reviewerCheck: "Inspect repository history and run appropriate independent security checks" },
    { id: "release", title: "Release and rollback", requestedEvidence: "A release note, limitations and documented revert procedure", reviewerCheck: "Confirm release evidence and rehearse a safe rollback in a test environment" },
  ],
  "systems-engineering": [
    { id: "scope", title: "System boundary and requirements", requestedEvidence: "Actors, trust boundaries, functional and measurable nonfunctional requirements", reviewerCheck: "Validate external flows and test whether requirements are measurable" },
    { id: "architecture", title: "Architecture decisions", requestedEvidence: "Context/container diagrams and architecture decision records", reviewerCheck: "Review component responsibilities, assumptions and trade-offs" },
    { id: "api", title: "API contract", requestedEvidence: "OpenAPI document with valid schemas and authorization/error responses", reviewerCheck: "Validate the contract using an independent OpenAPI tool" },
    { id: "data", title: "Data isolation and atomicity", requestedEvidence: "Schema, ownership matrix and concurrent booking test plan", reviewerCheck: "Inspect constraints and reproduce denied cross-user/concurrent requests" },
    { id: "operations", title: "Observability and resilience", requestedEvidence: "Logging signals, retry/idempotency policy, alert triggers and runbook", reviewerCheck: "Check that failure/retry behavior can be observed and handled safely" },
    { id: "recovery", title: "Capacity, security and recovery", requestedEvidence: "Capacity assumptions, threat model, rollback and backup/restore exercise", reviewerCheck: "Challenge assumptions and inspect documented recovery evidence" },
  ],
  "fullstack-web": [
    { id: "interface", title: "Accessible interface", requestedEvidence: "Screens, keyboard navigation and representative mobile layout test", reviewerCheck: "Open the actual app and test labels, focus and responsiveness" },
    { id: "server", title: "Server-side validation", requestedEvidence: "API/server implementation with invalid input rejection tests", reviewerCheck: "Send allowed and rejected requests against a disposable environment" },
    { id: "persistence", title: "Real data persistence", requestedEvidence: "Schema and create/read/update test records that survive refresh", reviewerCheck: "Verify a real backend/database round trip independently" },
    { id: "authorization", title: "Authentication and user isolation", requestedEvidence: "Two-account ownership tests including denied reads and writes", reviewerCheck: "Use separate accounts to reproduce permission boundaries" },
    { id: "testing", title: "Tests and CI", requestedEvidence: "Unit/E2E test files, meaningful negative tests and CI run URL", reviewerCheck: "Verify the source revision and rerun tests on the exact commit" },
    { id: "deployment", title: "Deployment and rollback", requestedEvidence: "HTTPS demo, smoke-test notes, release limitations and rollback method", reviewerCheck: "Independently check deployed routes, data operations and safe rollback" },
  ],
  "mobile-app": [
    { id: "screens", title: "Native screen and navigation", requestedEvidence: "Expo source and real-device navigation/back-button test", reviewerCheck: "Run on a supported device or emulator and inspect accessibility" },
    { id: "input", title: "Mobile forms and validation", requestedEvidence: "Screenshots/tests for keyboard behavior and invalid fields", reviewerCheck: "Reproduce rejected input and keyboard/portrait behavior on a device" },
    { id: "api", title: "API authorization and token safety", requestedEvidence: "Client/server API contract and two-account denial checks", reviewerCheck: "Confirm no service-role keys are bundled and authorization is enforced server-side" },
    { id: "offline", title: "Offline drafts and synchronization", requestedEvidence: "Offline test showing drafts remain unconfirmed until server acknowledgment", reviewerCheck: "Disconnect/reconnect a real device, including duplicate and conflict cases" },
    { id: "device", title: "Real device quality checks", requestedEvidence: "Device list, OS versions, error handling and accessibility results", reviewerCheck: "Repeat negative-permission, background and poor connectivity scenarios" },
    { id: "distribution", title: "Internal test build and release safety", requestedEvidence: "Authorized internal build record, reviewer test notes and privacy statement", reviewerCheck: "Inspect internal build and permissions; do not infer store approval" },
  ],
};

export interface CapstoneRecord {
  version: 1;
  trackId: TrainingTrackId;
  projectTitle: string;
  repoUrl: string;
  commitSha: string;
  ciRunUrl: string;
  demoUrl: string;
  reflection: string;
  evidence: Record<string, string>;
}

export type CapstoneStore = Partial<Record<TrainingTrackId, CapstoneRecord>>;
export interface EvidenceReview {
  documented: number;
  required: number;
  missing: string[];
  errors: string[];
  hasReviewableReferences: boolean;
  description: string;
}

const isText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.length <= limit;

export function newCapstoneRecord(trackId: TrainingTrackId): CapstoneRecord {
  return {
    version: CAPSTONE_RECORD_VERSION, trackId, projectTitle: "",
    repoUrl: "", commitSha: "", ciRunUrl: "", demoUrl: "", reflection: "",
    evidence: Object.fromEntries(CAPSTONE_RUBRICS[trackId].map(item => [item.id, ""])),
  };
}

export function parseGithubRepository(value: string): { owner: string; repo: string; url: string } | null {
  if (!value || value.length > CAPSTONE_URL_LIMIT) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com" ||
        parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    const match = /^\/([a-z\d-]{1,39})\/([a-z\d_.-]{1,100})\/?$/i.exec(parsed.pathname);
    if (!match || match[1].startsWith("-") || match[1].endsWith("-") ||
        match[2] === "." || match[2] === ".." || match[2].endsWith(".git")) return null;
    return { owner: match[1], repo: match[2], url: `https://github.com/${match[1]}/${match[2]}` };
  } catch { return null; }
}

export function validFullCommitSha(value: string): boolean {
  return /^[a-f\d]{40}$/i.test(value);
}

export function validGithubCiRun(value: string, repoUrl: string): boolean {
  if (!value || value.length > CAPSTONE_URL_LIMIT) return false;
  const repo = parseGithubRepository(repoUrl);
  if (!repo) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.hostname.toLowerCase() !== "github.com" ||
        u.port || u.username || u.password || u.search || u.hash) return false;
    const segments = u.pathname.split("/").filter(Boolean);
    return segments.length === 5 && segments[0].toLowerCase() === repo.owner.toLowerCase() &&
      segments[1].toLowerCase() === repo.repo.toLowerCase() &&
      segments[2] === "actions" && segments[3] === "runs" && /^[1-9]\d*$/.test(segments[4]);
  } catch { return false; }
}

export function validPublicDemoUrl(value: string): boolean {
  if (!value || value.length > CAPSTONE_URL_LIMIT) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port ||
        u.hostname.length > 200 || !u.hostname.includes(".") || u.search || u.hash) return false;
    const host = u.hostname.toLowerCase();
    if (/^(?:localhost|127\.|0\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host) ||
        /\.(?:localhost|local|internal|test|invalid)$/.test(host) ||
        /^\[/.test(host) || host.endsWith(".localhost")) return false;
    return true;
  } catch { return false; }
}

function recordValues(record: CapstoneRecord): string[] {
  return [record.projectTitle, record.repoUrl, record.commitSha, record.ciRunUrl,
    record.demoUrl, record.reflection, ...Object.values(record.evidence)];
}

export function containsCapstoneSensitiveText(record: CapstoneRecord): boolean {
  return recordValues(record).some(containsLikelyPrivateValue);
}

/** Parse imported/local JSON, discard unknown keys, never trust a status flag. */
export function parseCapstoneRecord(raw: unknown, expectedTrack?: TrainingTrackId):
  | { ok: true; record: CapstoneRecord }
  | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Choose a valid BuildRx capstone JSON packet." };
  }
  const item = raw as Record<string, unknown>;
  if (item.version !== CAPSTONE_RECORD_VERSION ||
      !TRAINING_TRACKS.some(t => t.id === item.trackId)) {
    return { ok: false, reason: "Unsupported capstone version or training track." };
  }
  const trackId = item.trackId as TrainingTrackId;
  if (expectedTrack && expectedTrack !== trackId) {
    return { ok: false, reason: "This packet belongs to a different learning pathway." };
  }
  if (!isText(item.projectTitle, CAPSTONE_TITLE_LIMIT) ||
      !isText(item.repoUrl, CAPSTONE_URL_LIMIT) ||
      !isText(item.commitSha, 40) ||
      !isText(item.ciRunUrl, CAPSTONE_URL_LIMIT) ||
      !isText(item.demoUrl, CAPSTONE_URL_LIMIT) ||
      !isText(item.reflection, CAPSTONE_REFLECTION_LIMIT) ||
      !item.evidence || typeof item.evidence !== "object" || Array.isArray(item.evidence)) {
    return { ok: false, reason: "The packet contains malformed or oversized fields." };
  }
  const rawEvidence = item.evidence as Record<string, unknown>;
  const record = newCapstoneRecord(trackId);
  for (const criterion of CAPSTONE_RUBRICS[trackId]) {
    const note = rawEvidence[criterion.id];
    if (!isText(note, CAPSTONE_NOTE_LIMIT)) {
      return { ok: false, reason: `Evidence for ${criterion.title} is invalid or too long.` };
    }
    record.evidence[criterion.id] = note;
  }
  record.projectTitle = item.projectTitle;
  record.repoUrl = item.repoUrl;
  record.commitSha = item.commitSha;
  record.ciRunUrl = item.ciRunUrl;
  record.demoUrl = item.demoUrl;
  record.reflection = item.reflection;
  if (containsCapstoneSensitiveText(record)) {
    return { ok: false, reason: "Remove passwords, access tokens, private keys and connection strings before storing this packet." };
  }
  return { ok: true, record };
}

export function capstoneEvidenceReview(record: CapstoneRecord): EvidenceReview {
  const criteria = CAPSTONE_RUBRICS[record.trackId];
  const missing = criteria.filter(item => !record.evidence[item.id].trim()).map(item => item.title);
  const errors: string[] = [];
  if (!record.projectTitle.trim()) errors.push("Give the project a descriptive title.");
  if (!parseGithubRepository(record.repoUrl)) errors.push("Provide a canonical HTTPS GitHub repository URL.");
  if (!validFullCommitSha(record.commitSha)) errors.push("Provide a complete 40-character Git commit SHA.");
  if (record.ciRunUrl && !validGithubCiRun(record.ciRunUrl, record.repoUrl)) {
    errors.push("The GitHub Actions run must belong to the same repository.");
  }
  if (record.demoUrl && !validPublicDemoUrl(record.demoUrl)) {
    errors.push("Use a valid public HTTPS demo URL without credentials or query parameters.");
  }
  if (containsCapstoneSensitiveText(record)) errors.push("Remove possible secrets from the packet.");
  const documented = criteria.length - missing.length;
  return {
    documented, required: criteria.length, missing, errors,
    hasReviewableReferences: documented === criteria.length && errors.length === 0,
    description: "This is a source-reference completeness check only. BuildRx has not fetched the repository, executed its CI, visited the demo, validated evidence or granted a qualification.",
  };
}

function quoteBlock(text: string): string {
  return text.split(/\r?\n/).map(line => "> " + line.replace(/[\u0000-\u001f\u007f]/g, " ")).join("\n");
}

/** Portable, self-reported review request. Never sign or certify client claims. */
export function capstoneReviewMarkdown(record: CapstoneRecord): string {
  const track = TRAINING_TRACKS.find(item => item.id === record.trackId);
  const review = capstoneEvidenceReview(record);
  return [
    "# BuildRx capstone — SELF-REPORTED review request",
    "",
    "**Status: NOT INDEPENDENTLY VERIFIED. Not a certificate or deployment approval.**",
    "",
    "Track: " + (track?.title ?? record.trackId),
    "Title: " + record.projectTitle,
    "Repository URL: " + (record.repoUrl || "(not provided)"),
    "Full commit SHA: " + (record.commitSha || "(not provided)"),
    "CI run URL: " + (record.ciRunUrl || "(not provided)"),
    "Demo URL: " + (record.demoUrl || "(not provided)"),
    "",
    "## Evidence checklist",
    ...CAPSTONE_RUBRICS[record.trackId].flatMap(item => [
      "",
      "### " + item.title,
      "Requested: " + item.requestedEvidence,
      "Learner note:",
      quoteBlock(record.evidence[item.id] || "(not yet documented)"),
      "Reviewer must: " + item.reviewerCheck,
    ]),
    "",
    "## Learner reflection",
    quoteBlock(record.reflection || "(not yet documented)"),
    "",
    "## Completeness only — not a grade",
    "Documented items: " + review.documented + " of " + review.required,
    ...review.errors.map(error => "- " + error),
    "",
    "An independent instructor must authenticate the learner, inspect the exact repository",
    "and commit, rerun tests in a safe environment, evaluate each criterion and approve",
    "any future certificate through a separate authorized review process.",
    "",
  ].join("\n");
}

export function parseCapstoneStore(raw: unknown): CapstoneStore {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const output: CapstoneStore = {};
  for (const track of TRAINING_TRACKS) {
    const parsed = parseCapstoneRecord((raw as Record<string, unknown>)[track.id], track.id);
    if (parsed.ok) output[track.id] = parsed.record;
  }
  return output;
}
