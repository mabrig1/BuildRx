import { describe, expect, it, vi } from "vitest";

import {
  inspectPublicGithubEvidence, PUBLIC_GITHUB_API,
  type PublicGithubRequester, type PublicEvidenceInput,
} from "./public-github-evidence";

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const REPOSITORY = "https://github.com/mabrig1/BuildRx";
const RUN = "https://github.com/mabrig1/BuildRx/actions/runs/12345";
const input: PublicEvidenceInput = { repoUrl: REPOSITORY, commitSha: SHA, ciRunUrl: RUN };

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

function publicRequester(options?: {
  runSha?: string;
  runRepo?: string;
  runStatus?: string;
  conclusion?: string | null;
  repoStatus?: number;
  commitStatus?: number;
  runStatusCode?: number;
}): PublicGithubRequester {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/mabrig1/BuildRx")) {
      return options?.repoStatus ? json({ message: "Not Found" }, options.repoStatus) :
        json({ full_name: "mabrig1/BuildRx", private: false });
    }
    if (url.endsWith("/git/commits/" + SHA)) {
      return options?.commitStatus ? json({ message: "Not Found" }, options.commitStatus) : json({ sha: SHA });
    }
    if (url.endsWith("/actions/runs/12345")) {
      return options?.runStatusCode ? json({ message: "Unavailable" }, options.runStatusCode) :
        json({
          id: 12345, head_sha: options?.runSha ?? SHA,
          repository: { full_name: options?.runRepo ?? "mabrig1/BuildRx" },
          status: options?.runStatus ?? "completed",
          conclusion: options?.conclusion === undefined ? "success" : options.conclusion,
        });
    }
    throw Error("Unexpected URL: " + url);
  });
}

describe("opt-in public GitHub evidence metadata checks", () => {
  it("checks precisely the public repo, exact commit and matching Actions run", async () => {
    const requester = publicRequester();
    const result = await inspectPublicGithubEvidence(input, requester);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.reason);
    expect(result.snapshot).toMatchObject({
      repositoryPublic: "found",
      commit: "found",
      ciRun: "matching",
      runStatus: "completed",
      runConclusion: "success",
      independentlyVerifiedTests: false,
      independentlyVerifiedDeployment: false,
      independentlyVerifiedLearner: false,
    });
    expect(requester).toHaveBeenCalledTimes(3);
    const fetches = vi.mocked(requester).mock.calls;
    expect(fetches.map(call => call[0])).toEqual([
      PUBLIC_GITHUB_API + "/repos/mabrig1/BuildRx",
      PUBLIC_GITHUB_API + "/repos/mabrig1/BuildRx/git/commits/" + SHA,
      PUBLIC_GITHUB_API + "/repos/mabrig1/BuildRx/actions/runs/12345",
    ]);
    for (const [url, options] of fetches) {
      expect(url.startsWith(PUBLIC_GITHUB_API + "/")).toBe(true);
      expect(options).toMatchObject({
        method: "GET",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
      });
      expect(JSON.stringify(options)).not.toContain("Authorization");
      expect(JSON.stringify(options)).not.toContain("X-GitHub-Api-Version");
      expect(JSON.stringify(options)).not.toContain("token");
      expect(options.body).toBeUndefined();
    }
  });

  it("does not fetch runs when no CI URL is submitted", async () => {
    const requester = publicRequester();
    const result = await inspectPublicGithubEvidence({ ...input, ciRunUrl: "" }, requester);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.reason);
    expect(result.snapshot.ciRun).toBe("not-supplied");
    expect(requester).toHaveBeenCalledTimes(2);
  });

  it("refuses malformed references before any network activity", async () => {
    const requester = publicRequester();
    for (const invalid of [
      { ...input, repoUrl: "https://github.com.evil.example/mabrig1/BuildRx" },
      { ...input, commitSha: "abc" },
      { ...input, ciRunUrl: "https://github.com/mabrig1/Other/actions/runs/12345" },
      { ...input, repoUrl: "https://github.com/user/repo?authorization=bad" },
    ]) {
      const result = await inspectPublicGithubEvidence(invalid, requester);
      expect(result.ok).toBe(false);
    }
    expect(requester).not.toHaveBeenCalled();
  });

  it("does not infer repo/commit existence after access denial or rate limits", async () => {
    for (const status of [403, 404, 429]) {
      const requester = publicRequester({ repoStatus: status });
      const result = await inspectPublicGithubEvidence(input, requester);
      expect(result.ok).toBe(true);
      if (!result.ok) throw Error(result.reason);
      expect(result.snapshot.repositoryPublic).toBe("unavailable");
      expect(result.snapshot.commit).toBe("not-checked");
      expect(result.snapshot.ciRun).toBe("unavailable");
      expect(requester).toHaveBeenCalledTimes(1);
    }
    const failCommit = publicRequester({ commitStatus: 404 });
    const result = await inspectPublicGithubEvidence(input, failCommit);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.reason);
    expect(result.snapshot.repositoryPublic).toBe("found");
    expect(result.snapshot.commit).toBe("unavailable");
    expect(result.snapshot.ciRun).toBe("unavailable");
    expect(failCommit).toHaveBeenCalledTimes(2);
  });

  it("marks a mismatched workflow as conflicting rather than successful", async () => {
    for (const settings of [
      { runSha: OTHER_SHA },
      { runRepo: "mabrig1/Other" },
    ]) {
      const result = await inspectPublicGithubEvidence(input, publicRequester(settings));
      expect(result.ok).toBe(true);
      if (!result.ok) throw Error(result.reason);
      expect(result.snapshot.ciRun).toBe("mismatched");
      expect(result.snapshot.runConclusion).toBeNull();
    }
  });

  it("does not describe a pending, failed or unknown workflow as passing", async () => {
    const pending = await inspectPublicGithubEvidence(
      input, publicRequester({ runStatus: "in_progress", conclusion: null }),
    );
    expect(pending.ok).toBe(true);
    if (!pending.ok) throw Error(pending.reason);
    expect(pending.snapshot).toMatchObject({
      ciRun: "matching", runStatus: "in_progress", runConclusion: null,
      independentlyVerifiedTests: false,
    });
    const fail = await inspectPublicGithubEvidence(
      input, publicRequester({ runStatus: "completed", conclusion: "failure" }),
    );
    expect(fail.ok).toBe(true);
    if (!fail.ok) throw Error(fail.reason);
    expect(fail.snapshot.runConclusion).toBe("failure");
    expect(fail.snapshot.independentlyVerifiedTests).toBe(false);
    const unavailable = await inspectPublicGithubEvidence(input, publicRequester({ runStatusCode: 404 }));
    expect(unavailable.ok).toBe(true);
    if (!unavailable.ok) throw Error(unavailable.reason);
    expect(unavailable.snapshot.ciRun).toBe("unavailable");
  });

  it("returns an honest unavailable result for browser CORS/network failures", async () => {
    const requester: PublicGithubRequester = vi.fn(async () => { throw Error("Failed to fetch"); });
    const result = await inspectPublicGithubEvidence(input, requester);
    expect(result.ok).toBe(false);
    if (result.ok) throw Error("Unexpected success");
    expect(result.reason).toMatch(/GitHub was unreachable|browser blocked/);
    expect(result.reason).not.toContain("verified");
  });

  it("rejects mismatched commit metadata even on HTTP 200", async () => {
    const requester: PublicGithubRequester = vi.fn(async (url: string) => {
      if (url.endsWith("/mabrig1/BuildRx")) return json({ full_name: "mabrig1/BuildRx", private: false });
      return json({ sha: OTHER_SHA });
    });
    const result = await inspectPublicGithubEvidence(input, requester);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.reason);
    expect(result.snapshot.commit).toBe("unavailable");
    expect(result.snapshot.ciRun).toBe("unavailable");
    expect(requester).toHaveBeenCalledTimes(2);
  });
});
