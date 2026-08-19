import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertSafePath,
  buildFileTree,
  demoProjectIds,
  getFileSystem,
  languageFromPath,
  type FileEntry,
} from "@/lib/files/manager";

const entry = (path: string): FileEntry => ({
  path,
  language: null,
  size: 0,
  updatedAt: null,
});

describe("languageFromPath", () => {
  it.each([
    ["src/app/page.tsx", "tsx"],
    ["src/lib/util.ts", "typescript"],
    ["script.js", "javascript"],
    ["component.jsx", "jsx"],
    ["styles.css", "css"],
    ["index.html", "html"],
    ["schema.sql", "sql"],
    ["package.json", "json"],
    ["README.md", "markdown"],
  ])("maps %s", (path, expected) => {
    expect(languageFromPath(path)).toBe(expected);
  });

  it("falls back to the raw extension for unmapped types", () => {
    expect(languageFromPath("logo.svg")).toBe("svg");
    expect(languageFromPath("data.yaml")).toBe("yaml");
  });

  it("is case-insensitive", () => {
    expect(languageFromPath("Page.TSX")).toBe("tsx");
  });

  it("uses the last extension of a multi-part name", () => {
    expect(languageFromPath("next.config.ts")).toBe("typescript");
  });

  it("treats a dotfile's suffix as its extension", () => {
    // ".env" splits to ["", "env"] — the last part wins.
    expect(languageFromPath(".env")).toBe("env");
  });

  it("lower-cases the filename when there is no extension", () => {
    expect(languageFromPath("Dockerfile")).toBe("dockerfile");
  });
});

describe("assertSafePath", () => {
  it("accepts a normal project path", () => {
    expect(() => assertSafePath("src/app/page.tsx")).not.toThrow();
  });

  it.each(["../secrets", "/etc/passwd", "src\\app", ""])(
    "throws for %j",
    (path) => {
      expect(() => assertSafePath(path)).toThrow(/Unsafe file path/);
    }
  );

  it("names the offending path in the error", () => {
    expect(() => assertSafePath("../secrets")).toThrow("../secrets");
  });
});

describe("buildFileTree", () => {
  it("returns nothing for no entries", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("nests files under their directories", () => {
    const tree = buildFileTree([entry("src/app/page.tsx")]);

    expect(tree).toEqual([
      {
        name: "src",
        path: "src",
        type: "dir",
        children: [
          {
            name: "app",
            path: "src/app",
            type: "dir",
            children: [
              { name: "page.tsx", path: "src/app/page.tsx", type: "file" },
            ],
          },
        ],
      },
    ]);
  });

  it("merges siblings into one directory node", () => {
    const tree = buildFileTree([
      entry("src/app/page.tsx"),
      entry("src/app/layout.tsx"),
      entry("src/lib/util.ts"),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children!.map((n) => n.name)).toEqual(["app", "lib"]);
    expect(tree[0].children![0].children!.map((n) => n.name)).toEqual([
      "layout.tsx",
      "page.tsx",
    ]);
  });

  it("sorts directories before files at every level", () => {
    const tree = buildFileTree([
      entry("package.json"),
      entry("src/app/page.tsx"),
      entry("README.md"),
      entry("preview/index.html"),
    ]);

    // Files are ordered by localeCompare, which is case-insensitive —
    // "package.json" before "README.md", not ASCII order.
    expect(tree.map((n) => `${n.type}:${n.name}`)).toEqual([
      "dir:preview",
      "dir:src",
      "file:package.json",
      "file:README.md",
    ]);
  });

  it("keeps a file and a directory that share a name distinct", () => {
    const tree = buildFileTree([entry("lib"), entry("lib/util.ts")]);

    expect(tree.map((n) => `${n.type}:${n.name}`)).toEqual([
      "dir:lib",
      "file:lib",
    ]);
    expect(tree[0].children).toHaveLength(1);
  });

  it("carries the full path on every node", () => {
    const tree = buildFileTree([entry("a/b/c.ts")]);
    const b = tree[0].children![0];

    expect(tree[0].path).toBe("a");
    expect(b.path).toBe("a/b");
    expect(b.children![0].path).toBe("a/b/c.ts");
  });

  it("gives files no children key", () => {
    const tree = buildFileTree([entry("a.ts")]);

    expect(tree[0]).not.toHaveProperty("children");
  });

  it("does not mutate the input array's order", () => {
    const entries = [entry("z.ts"), entry("a.ts")];
    buildFileTree(entries);

    expect(entries.map((e) => e.path)).toEqual(["z.ts", "a.ts"]);
  });
});

// ------------------------------------------------------------------
// Demo filesystem — the in-memory backend used before Supabase is set up
// ------------------------------------------------------------------

describe("the demo filesystem", () => {
  const globalStore = globalThis as unknown as {
    __appCreatorFiles?: Map<string, unknown>;
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete globalStore.__appCreatorFiles;
  });

  afterEach(() => {
    delete globalStore.__appCreatorFiles;
  });

  it("round-trips a file", async () => {
    const fs = getFileSystem("demo-1");
    await fs.write({ path: "src/app/page.tsx", content: "export default 1;" });

    await expect(fs.read("src/app/page.tsx")).resolves.toEqual({
      path: "src/app/page.tsx",
      content: "export default 1;",
      language: "tsx",
    });
  });

  it("infers the language when none is given", async () => {
    const fs = getFileSystem("demo-1");
    await fs.write({ path: "schema.sql", content: "create table t();" });

    await expect(fs.read("schema.sql")).resolves.toMatchObject({
      language: "sql",
    });
  });

  it("honours an explicit language over the inferred one", async () => {
    const fs = getFileSystem("demo-1");
    await fs.write({ path: "a.txt", content: "x", language: "markdown" });

    await expect(fs.read("a.txt")).resolves.toMatchObject({
      language: "markdown",
    });
  });

  it("returns null for a file that does not exist", async () => {
    await expect(getFileSystem("demo-1").read("nope.ts")).resolves.toBeNull();
  });

  it("overwrites on a repeated write", async () => {
    const fs = getFileSystem("demo-1");
    await fs.write({ path: "a.ts", content: "first" });
    await fs.write({ path: "a.ts", content: "second" });

    await expect(fs.read("a.ts")).resolves.toMatchObject({ content: "second" });
    await expect(fs.list()).resolves.toHaveLength(1);
  });

  it("writes many files at once and reports their sizes", async () => {
    const fs = getFileSystem("demo-1");
    await fs.writeMany([
      { path: "a.ts", content: "12345" },
      { path: "b.ts", content: "123" },
    ]);

    const listed = await fs.list();
    expect(listed.map((f) => [f.path, f.size])).toEqual([
      ["a.ts", 5],
      ["b.ts", 3],
    ]);
  });

  it("tolerates an empty writeMany", async () => {
    const fs = getFileSystem("demo-1");
    await expect(fs.writeMany([])).resolves.toBeUndefined();
    await expect(fs.list()).resolves.toEqual([]);
  });

  it("deletes a file", async () => {
    const fs = getFileSystem("demo-1");
    await fs.write({ path: "a.ts", content: "x" });
    await fs.delete("a.ts");

    await expect(fs.list()).resolves.toEqual([]);
  });

  it("renames a file, preserving content", async () => {
    const fs = getFileSystem("demo-1");
    await fs.write({ path: "a.ts", content: "keep me" });
    await fs.rename("a.ts", "b/c.ts");

    await expect(fs.read("a.ts")).resolves.toBeNull();
    await expect(fs.read("b/c.ts")).resolves.toMatchObject({
      content: "keep me",
    });
  });

  it("throws when renaming a file that does not exist", async () => {
    await expect(getFileSystem("demo-1").rename("a.ts", "b.ts")).rejects.toThrow(
      "File not found: a.ts"
    );
  });

  it("keeps projects isolated from each other", async () => {
    await getFileSystem("demo-1").write({ path: "a.ts", content: "one" });
    await getFileSystem("demo-2").write({ path: "a.ts", content: "two" });

    await expect(getFileSystem("demo-1").read("a.ts")).resolves.toMatchObject({
      content: "one",
    });
    expect(demoProjectIds().sort()).toEqual(["demo-1", "demo-2"]);
  });

  describe("rejects unsafe paths at every entry point", () => {
    it.each([
      ["read", (fs: ReturnType<typeof getFileSystem>) => fs.read("../etc/passwd")],
      [
        "write",
        (fs: ReturnType<typeof getFileSystem>) =>
          fs.write({ path: "../etc/passwd", content: "x" }),
      ],
      [
        "writeMany",
        (fs: ReturnType<typeof getFileSystem>) =>
          fs.writeMany([{ path: "/etc/passwd", content: "x" }]),
      ],
      [
        "delete",
        (fs: ReturnType<typeof getFileSystem>) => fs.delete("../etc/passwd"),
      ],
    ])("%s", async (_label, act) => {
      await expect(act(getFileSystem("demo-1"))).rejects.toThrow(
        /Unsafe file path/
      );
    });

    it("rename, via its destination", async () => {
      const fs = getFileSystem("demo-1");
      await fs.write({ path: "a.ts", content: "x" });

      await expect(fs.rename("a.ts", "../escaped.ts")).rejects.toThrow(
        /Unsafe file path/
      );
    });
  });
});
