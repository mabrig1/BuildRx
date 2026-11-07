import { describe, expect, it, vi } from "vitest";

import { BEGINNER_CODE_TEMPLATES, findBeginnerCodeTemplate } from "./beginner-catalog";
import { createBeginnerCodeSource } from "./beginner-code-templates";

describe("original beginner code clone archive", () => {
  it("contains four original, identifiable, creditable apps for complete beginners", () => {
    expect(BEGINNER_CODE_TEMPLATES).toHaveLength(4);
    expect(new Set(BEGINNER_CODE_TEMPLATES.map(t => t.id)).size).toBe(4);
    expect(BEGINNER_CODE_TEMPLATES.every(t => t.id.startsWith("beginner-"))).toBe(true);
    expect(BEGINNER_CODE_TEMPLATES.every(t => t.difficulty === "Beginner")).toBe(true);
    expect(findBeginnerCodeTemplate("github-arbitrary")).toBeUndefined();
  });

  it.each(BEGINNER_CODE_TEMPLATES.map(template => [template.id] as const))(
    "%s clones real Next.js source, full license, attribution and a readable guide", id => {
      const first = createBeginnerCodeSource(id);
      const second = createBeginnerCodeSource(id);
      expect(first).toEqual(second);
      expect(first.files.map(f => f.path)).toEqual(expect.arrayContaining([
        "package.json", "app/layout.tsx", "app/page.tsx", "app/globals.css",
        "README.md", "BUILD-RX-SOURCE.md", "LICENSE",
      ]));
      expect(first.files).toHaveLength(7);
      expect(first.securityPreflight.complete).toBe(true);
      expect(first.securityPreflight.status).toBe("no-indicators-observed");
      expect(first.sourceUrl).toBe("buildrx:starter/" + id);
      const files = new Map(first.files.map(f => [f.path, f.content]));
      const pkg = JSON.parse(files.get("package.json")!);
      expect(pkg.dependencies.next).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+$/);
      expect(pkg.scripts.build).toBe("next build");
      expect(pkg.scripts.postinstall).toBeUndefined();
      expect(files.get("LICENSE")).toContain("Permission is hereby granted");
      expect(files.get("BUILD-RX-SOURCE.md")).toContain("not an external GitHub clone");
      expect(files.get("README.md")).toContain("before publishing");
      expect(files.get("README.md")).not.toContain("sk-live-");
    }
  );

  it("provides working editable actions with clearly labeled demo-only persistence", () => {
    const taskPage = createBeginnerCodeSource("beginner-task-planner").files.find(f => f.path === "app/page.tsx")!.content;
    const stockPage = createBeginnerCodeSource("beginner-stock-list").files.find(f => f.path === "app/page.tsx")!.content;
    expect(taskPage).toContain("'use client'");
    expect(taskPage).toContain("localStorage.setItem");
    expect(taskPage).toContain("setTasks(");
    expect(stockPage).toContain("localStorage.setItem");
    expect(stockPage).toContain("setItems(");
    expect(stockPage).toContain("Math.max(0");
    for (const t of BEGINNER_CODE_TEMPLATES.filter(x => x.storage === "Browser only")) {
      const readme = createBeginnerCodeSource(t.id).files.find(f => f.path === "README.md")!.content;
      expect(readme).toContain("no accounts, shared database");
    }
  });

  it("never fetches from GitHub or executes app code while preparing an original starter", () => {
    const http = vi.spyOn(globalThis, "fetch");
    createBeginnerCodeSource("beginner-personal-portfolio");
    expect(http).not.toHaveBeenCalled();
    http.mockRestore();
    expect(() => createBeginnerCodeSource("https://github.com/unknown/malware")).toThrow(/Unknown/);
  });
});
