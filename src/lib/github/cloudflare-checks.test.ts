import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "@/lib/github/client";

const SHA = "a".repeat(40);

function mockChecks(checkRuns: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/commits?")) {
      return Response.json([{
        sha: SHA,
        html_url: `https://github.com/demo/shop/commit/${SHA}`,
        commit: { message: "update", author: { name: "Owner", date: "2026-11-04" } },
      }]);
    }
    if (url.includes("/check-runs")) {
      return Response.json({ check_runs: checkRuns });
    }
    return Response.json({ message: "unexpected" }, { status: 404 });
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare BuildRx publication checks", () => {
  it("does not interpret other providers' successful checks as Cloudflare success", async () => {
    mockChecks([{
      name: "Vercel", status: "completed", conclusion: "success",
      app: { name: "Vercel", slug: "vercel" },
    }]);
    const result = await new GitHubClient("test-token").getCloudflareBuildCheck("demo/shop", "main");
    expect(result.state).toBe("not_connected");
    expect(result.checkCount).toBe(0);
  });

  it("recognizes a Cloudflare build as passing without claiming a live URL", async () => {
    mockChecks([{
      name: "Workers Builds / my-app", status: "completed", conclusion: "success",
      app: { name: "Cloudflare Workers and Pages", slug: "cloudflare-workers-and-pages" },
      details_url: "https://dash.cloudflare.com/example",
    }]);
    const result = await new GitHubClient("test-token").getCloudflareBuildCheck("demo/shop", "main");
    expect(result.state).toBe("passed");
    expect(result.checkCount).toBe(1);
    expect(result.checksUrl).toBe("https://dash.cloudflare.com/example");
    expect(result).not.toHaveProperty("url");
  });

  it("reports failures and in-progress builds without making success claims", async () => {
    mockChecks([{
      name: "Cloudflare build", status: "completed", conclusion: "failure",
      app: { name: "Cloudflare" }, details_url: "https://attacker.example/hook",
    }]);
    const failed = await new GitHubClient("test-token").getCloudflareBuildCheck("demo/shop", "main");
    expect(failed.state).toBe("failed");
    expect(failed.checksUrl).toBeNull();

    mockChecks([{
      name: "Build", status: "in_progress", conclusion: null,
      app: { name: "Cloudflare Workers and Pages" },
    }]);
    const pending = await new GitHubClient("test-token").getCloudflareBuildCheck("demo/shop", "main");
    expect(pending.state).toBe("building");
  });
});
