import { afterEach, describe, expect, it, vi } from "vitest";

import { deployToVercel } from "@/lib/deploy/providers";

describe("deployToVercel", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uploads source by digest and deploys a real Next.js project", async () => {
    vi.useFakeTimers();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, init });
        if (url.endsWith("/v2/files")) {
          return new Response("{}", { status: 200 });
        }
        if (url.endsWith("/v13/deployments") && init?.method === "POST") {
          return Response.json({ id: "dpl_123", url: "buildpilot.vercel.app" });
        }
        return Response.json({
          readyState: "READY",
          url: "buildpilot.vercel.app",
        });
      })
    );

    const deployment = deployToVercel(
      "test-token",
      {
        projectName: "BuildPilot",
        githubRepo: null,
        framework: "nextjs",
        files: [
          { path: "package.json", content: '{"scripts":{"build":"next build"}}' },
          { path: "src/app/page.tsx", content: "export default function Page() {}" },
        ],
      },
      vi.fn()
    );
    await vi.runAllTimersAsync();
    const outcome = await deployment;

    expect(outcome).toEqual({
      status: "live",
      url: "https://buildpilot.vercel.app",
      providerId: "dpl_123",
    });
    expect(requests.filter((request) => request.url.endsWith("/v2/files"))).toHaveLength(2);

    const create = requests.find(
      (request) =>
        request.url.endsWith("/v13/deployments") && request.init?.method === "POST"
    );
    const body = JSON.parse(String(create?.init?.body));
    expect(body.projectSettings.framework).toBe("nextjs");
    expect(body.files).toEqual([
      expect.objectContaining({ file: "package.json", sha: expect.any(String) }),
      expect.objectContaining({ file: "src/app/page.tsx", sha: expect.any(String) }),
    ]);
    expect(body.files[0]).not.toHaveProperty("data");
  });
});
