import { describe, expect, it } from "vitest";
import { prepareCloudflareSource } from "@/lib/deploy/cloudflare";

const initial = [
  { path: "package.json", content: JSON.stringify({
    name: "sample", scripts: { build: "next build" }, dependencies: { next: "15.5.20", react: "19.1.0" }
  }) },
  { path: "src/app/page.tsx", content: "export default function Page() { return <h1>Test</h1>; }" },
  { path: "src/app/layout.tsx", content: "export default function Layout({children}) { return <html><body>{children}</body></html>; }" },
  { path: "src/app/api/items/route.ts", content: "export async function GET() { return Response.json([]); }" },
];

describe("prepareCloudflareSource", () => {
  it("publishes the real Next.js source instead of a static demo preview", () => {
    const result = prepareCloudflareSource(initial, "Research Board");
    const files = new Map(result.files.map(f => [f.path, f.content]));
    expect(result.workerName).toBe("buildrx-research-board");
    expect(files.get("src/app/api/items/route.ts")).toContain("Response.json");
    expect(files.has("open-next.config.ts")).toBe(true);
    expect(files.has("wrangler.jsonc")).toBe(true);
    expect(files.has(".github/workflows/cloudflare-deploy.yml")).toBe(true);
    const config = JSON.parse(files.get("wrangler.jsonc")!);
    expect(config.main).toBe(".open-next/worker.js");
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(config.assets.directory).toBe(".open-next/assets");
    const pkg = JSON.parse(files.get("package.json")!);
    expect(pkg.scripts.build).toBe("next build");
    expect(pkg.scripts["cloudflare:build"]).toMatch(/opennextjs-cloudflare build/);
    expect(pkg.scripts["cloudflare:setup"]).toContain("1.20.15");
  });

  it("keeps the deployment workflow manual and never embeds cloud credentials", () => {
    const files = prepareCloudflareSource(initial, "My Shop").files;
    const workflow = files.find(f => f.path.endsWith("cloudflare-deploy.yml"))!.content;
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("  push:");
    expect(workflow).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(workflow).not.toContain("sk-proj-");
    expect(workflow).toContain("npm run cloudflare:publish");
  });

  it("rejects unsupported projects, malicious paths and leaked credentials", () => {
    expect(() => prepareCloudflareSource(initial.filter(f => f.path !== "package.json"), "site")).toThrow(/Next.js/);
    expect(() => prepareCloudflareSource([...initial, { path: "../../exfiltrate", content: "x" }], "site")).toThrow(/invalid/i);
    expect(() => prepareCloudflareSource([...initial, { path: ".github/workflows/custom.yml", content: "run: echo yes" }], "site")).toThrow(/workflow/);
    expect(() => prepareCloudflareSource([...initial, { path: ".env.production", content: "PRIVATE_KEY=x" }], "site")).toThrow(/private/i);
    expect(() => prepareCloudflareSource([...initial, { path: "src/key.ts", content: "const key = 'nvapi-" + "x".repeat(30) + "';" }], "site")).toThrow(/credential/i);
  });

  it("never silently overwrites user Cloudflare configuration", () => {
    expect(() => prepareCloudflareSource([...initial, { path: "wrangler.jsonc", content: "{}" }], "site")).toThrow(/already defines/i);
    const conflicting = [...initial];
    conflicting[0] = { ...initial[0], content: JSON.stringify({
      dependencies: { next: "15.5.20" }, scripts: { "cloudflare:publish": "echo custom" }
    }) };
    expect(() => prepareCloudflareSource(conflicting, "site")).toThrow(/already defines/i);
  });

  it("uses valid, constrained worker names and protects source size", () => {
    const result = prepareCloudflareSource(initial, "../🚀" + "Z".repeat(200));
    expect(result.workerName).toMatch(/^buildrx-[a-z0-9-]+$/);
    expect(result.workerName.length).toBeLessThanOrEqual(63);
    const huge = [...initial, { path: "big.txt", content: "a".repeat(3_000_001) }];
    expect(() => prepareCloudflareSource(huge, "site")).toThrow(/3 MB/);
  });
});
