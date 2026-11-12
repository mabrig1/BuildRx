import {
  parseGithubRepository, validFullCommitSha, validGithubCiRun,
} from "@/lib/learn/capstone-evidence";

/**
 * PUBLIC GitHub metadata only. This is a deliberately opt-in, client-side
 * check. There is no use of BuildRx's connected GitHub token, no server
 * proxy and no repository-content download or CI rerun.
 *
 * WARNING: a successful GitHub status does not prove test coverage,
 * correct code, account ownership, learner identity, or deployment.
 */
export const PUBLIC_GITHUB_API = "https://api.github.com";
export const EVIDENCE_CHECK_TIMEOUT_MS = 9000;

export type EvidenceStatus = "found" | "unavailable" | "not-checked";
export type RunMatchStatus =
  | "not-supplied" | "matching" | "mismatched" | "unavailable";

export interface GithubEvidenceSnapshot {
  source: "GitHub public REST API";
  checkedAt: string;
  repository: string;
  claimedCommit: string;
  repositoryPublic: EvidenceStatus;
  commit: EvidenceStatus;
  ciRun: RunMatchStatus;
  runStatus: string | null;
  runConclusion: string | null;
  details: string[];
  independentlyVerifiedTests: false;
  independentlyVerifiedDeployment: false;
  independentlyVerifiedLearner: false;
}

export interface PublicEvidenceInput {
  repoUrl: string;
  commitSha: string;
  ciRunUrl: string;
}

export type PublicEvidenceOutcome =
  | { ok: true; snapshot: GithubEvidenceSnapshot }
  | { ok: false; reason: string };

type PublicJsonResponse = Pick<Response, "status" | "ok" | "json">;
export type PublicGithubRequester = (
  url: string,
  init: RequestInit,
) => Promise<PublicJsonResponse>;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

const plainString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

function apiFailure(status: number): string {
  if (status === 403 || status === 429) {
    return "GitHub public API request was limited or denied. Try later; do not interpret this as a missing repository or commit.";
  }
  if (status === 404) {
    return "GitHub returned 404. This can mean missing, renamed, or non-public data; no existence conclusion is confirmed.";
  }
  return "GitHub public API returned HTTP " + status + ". This evidence could not be confirmed.";
}

const requestHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

/** URLs are composed entirely from validated repo+SHA+numeric run ID. */
function githubApiUrl(parts: readonly string[]): string {
  return PUBLIC_GITHUB_API + "/" + parts.map(encodeURIComponent).join("/");
}

async function readPublicJson(
  endpoint: string,
  request: PublicGithubRequester,
  signal?: AbortSignal,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number }> {
  const response = await request(endpoint, {
    method: "GET",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    headers: requestHeaders,
    signal,
  });
  if (!response.ok) return { ok: false, status: response.status };
  const data = record(await response.json());
  return data ? { ok: true, data } : { ok: false, status: 502 };
}

/**
 * Can inspect publicly accessible repo/commit/Actions run metadata only.
 * All requests require explicit user invocation in the UI.
 * A failed check must never be promoted into "verified".
 */
export async function inspectPublicGithubEvidence(
  input: PublicEvidenceInput,
  requester: PublicGithubRequester = fetch,
  signal?: AbortSignal,
): Promise<PublicEvidenceOutcome> {
  const parsedRepo = parseGithubRepository(input.repoUrl);
  if (!parsedRepo) return { ok: false, reason: "Enter a canonical HTTPS GitHub repository URL before checking." };
  if (!validFullCommitSha(input.commitSha)) {
    return { ok: false, reason: "Enter the exact complete 40-character Git commit SHA." };
  }
  if (input.ciRunUrl && !validGithubCiRun(input.ciRunUrl, input.repoUrl)) {
    return { ok: false, reason: "The Actions run must be a valid URL belonging to the same repository." };
  }
  const snapshot: GithubEvidenceSnapshot = {
    source: "GitHub public REST API",
    checkedAt: new Date().toISOString(),
    repository: parsedRepo.url,
    claimedCommit: input.commitSha.toLowerCase(),
    repositoryPublic: "not-checked",
    commit: "not-checked",
    ciRun: input.ciRunUrl ? "unavailable" : "not-supplied",
    runStatus: null,
    runConclusion: null,
    details: [],
    independentlyVerifiedTests: false,
    independentlyVerifiedDeployment: false,
    independentlyVerifiedLearner: false,
  };
  const base = ["repos", parsedRepo.owner, parsedRepo.repo];
  try {
    const repoResponse = await readPublicJson(githubApiUrl(base), requester, signal);
    if (!repoResponse.ok) {
      snapshot.repositoryPublic = "unavailable";
      snapshot.details.push("Repository metadata: " + apiFailure(repoResponse.status));
      return { ok: true, snapshot };
    }
    const fullName = plainString(repoResponse.data.full_name);
    if (repoResponse.data.private !== false ||
        fullName?.toLowerCase() !== (parsedRepo.owner + "/" + parsedRepo.repo).toLowerCase()) {
      snapshot.repositoryPublic = "unavailable";
      snapshot.details.push("Repository returned non-public or mismatched metadata; checking stopped.");
      return { ok: true, snapshot };
    }
    snapshot.repositoryPublic = "found";
    snapshot.details.push("GitHub reports a publicly accessible repository with this owner and name.");

    const commitResponse = await readPublicJson(
      githubApiUrl([...base, "git", "commits", input.commitSha]),
      requester, signal,
    );
    if (!commitResponse.ok) {
      snapshot.commit = "unavailable";
      snapshot.details.push("Commit metadata: " + apiFailure(commitResponse.status));
      return { ok: true, snapshot };
    }
    const remoteSha = plainString(commitResponse.data.sha);
    if (remoteSha?.toLowerCase() !== input.commitSha.toLowerCase()) {
      snapshot.commit = "unavailable";
      snapshot.details.push("GitHub returned a different commit SHA. Claim not confirmed.");
      return { ok: true, snapshot };
    }
    snapshot.commit = "found";
    snapshot.details.push("GitHub returned a Git commit object matching the complete submitted SHA.");

    if (!input.ciRunUrl) return { ok: true, snapshot };
    const segments = new URL(input.ciRunUrl).pathname.split("/").filter(Boolean);
    const id = segments[4];
    const runResponse = await readPublicJson(
      githubApiUrl([...base, "actions", "runs", id]), requester, signal,
    );
    if (!runResponse.ok) {
      snapshot.ciRun = "unavailable";
      snapshot.details.push("Actions run metadata: " + apiFailure(runResponse.status));
      return { ok: true, snapshot };
    }
    const runRepo = record(runResponse.data.repository);
    const runSha = plainString(runResponse.data.head_sha);
    const runId = runResponse.data.id;
    const matched =
      (typeof runId === "number" || typeof runId === "string") &&
      String(runId) === id &&
      runSha?.toLowerCase() === input.commitSha.toLowerCase() &&
      plainString(runRepo?.full_name)?.toLowerCase() ===
        (parsedRepo.owner + "/" + parsedRepo.repo).toLowerCase();
    snapshot.ciRun = matched ? "matching" : "mismatched";
    if (!matched) {
      snapshot.details.push("Actions run does not match the submitted run ID, repository and complete commit SHA.");
      return { ok: true, snapshot };
    }
    snapshot.runStatus = plainString(runResponse.data.status);
    snapshot.runConclusion = plainString(runResponse.data.conclusion);
    snapshot.details.push("Actions run metadata matches this repository and SHA. GitHub reports status: " +
      (snapshot.runStatus ?? "unknown") + ", conclusion: " + (snapshot.runConclusion ?? "not available") + ".");
    snapshot.details.push("A successful workflow is not independently rerun tests, validated user workflows or a deployed application.");
    return { ok: true, snapshot };
  } catch (err) {
    if (signal?.aborted) return { ok: false, reason: "The public GitHub metadata check was stopped." };
    // No exception objects or remote errors sent to the UI: these can
    // contain headers, credentials or third-party response data.
    return { ok: false, reason: "GitHub was unreachable, the browser blocked cross-origin requests, or the check failed. No result can be confirmed." };
  }
}
