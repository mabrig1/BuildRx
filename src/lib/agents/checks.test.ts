import { describe, expect, it } from "vitest";

import { checksPass, runStaticChecks } from "@/lib/agents/checks";
import type { AppPlan, CheckFinding, WorkflowContext } from "@/lib/agents/types";

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const EMPTY_PLAN: AppPlan = {
  appName: "Test App",
  summary: "",
  pages: [],
  components: [],
  dataModel: [],
  features: [],
};

/** The files runStaticChecks requires before it reports anything else. */
const SCAFFOLD: Record<string, string> = {
  "preview/index.html": "<!doctype html><html></html>",
  "src/app/page.tsx": "export default function Page() { return null; }",
  "src/app/layout.tsx":
    "export default function Layout({ children }) { return children; }",
  "src/app/globals.css": "body { margin: 0; }",
  "package.json": JSON.stringify({
    name: "generated",
    scripts: { build: "next build" },
    dependencies: {},
  }),
};

function contextOf(files: Record<string, string>): WorkflowContext {
  return {
    projectId: "p1",
    userId: "u1",
    prompt: "build me an app",
    persist: false,
    files: new Map(
      Object.entries(files).map(([path, content]) => [path, { path, content }])
    ),
  };
}

/** A scaffolded project plus the given overrides/additions. */
function scaffolded(extra: Record<string, string> = {}) {
  return contextOf({ ...SCAFFOLD, ...extra });
}

const rules = (findings: CheckFinding[]) => findings.map((f) => f.rule);

function withPackage(pkg: Record<string, unknown>) {
  return { "package.json": JSON.stringify(pkg) };
}

// ------------------------------------------------------------------

describe("runStaticChecks", () => {
  it("passes a complete scaffold with an empty plan", () => {
    const findings = runStaticChecks(scaffolded(), EMPTY_PLAN);

    expect(findings).toEqual([]);
    expect(checksPass(findings)).toBe(true);
  });

  describe("required project structure", () => {
    it.each([
      ["preview/index.html", "missing-preview", "error"],
      ["src/app/page.tsx", "missing-home-page", "error"],
      ["src/app/layout.tsx", "missing-layout", "error"],
      ["src/app/globals.css", "missing-globals-css", "warning"],
      ["package.json", "missing-package-json", "error"],
    ])("flags a missing %s", (path, rule, severity) => {
      const files = { ...SCAFFOLD };
      delete files[path];

      const finding = runStaticChecks(contextOf(files), EMPTY_PLAN).find(
        (f) => f.rule === rule
      );

      expect(finding).toBeDefined();
      expect(finding!.severity).toBe(severity);
      expect(finding!.fix).toBe("auto");
    });

    it("treats a missing globals.css as non-blocking", () => {
      const files = { ...SCAFFOLD };
      delete files["src/app/globals.css"];

      expect(checksPass(runStaticChecks(contextOf(files), EMPTY_PLAN))).toBe(
        true
      );
    });
  });

  describe("package.json", () => {
    it("flags invalid JSON", () => {
      const findings = runStaticChecks(
        scaffolded({ "package.json": "{ not json" }),
        EMPTY_PLAN
      );

      expect(rules(findings)).toContain("invalid-package-json");
    });

    it("flags a missing build script as a warning", () => {
      const findings = runStaticChecks(
        scaffolded(withPackage({ name: "generated" })),
        EMPTY_PLAN
      );
      const finding = findings.find((f) => f.rule === "missing-build-script");

      expect(finding?.severity).toBe("warning");
    });

    it("blocks Tailwind v4 when the PostCSS plugin is missing", () => {
      const findings = runStaticChecks(
        scaffolded({
          ...withPackage({
            scripts: { build: "next build" },
            devDependencies: { tailwindcss: "^4.1.0" },
          }),
          "src/app/globals.css": '@import "tailwindcss";',
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).toContain("missing-tailwind-postcss-package");
      expect(checksPass(findings)).toBe(false);
    });

    it("blocks Tailwind v4 when PostCSS config is missing", () => {
      const findings = runStaticChecks(
        scaffolded({
          ...withPackage({
            scripts: { build: "next build" },
            devDependencies: {
              tailwindcss: "^4.1.0",
              "@tailwindcss/postcss": "^4.1.0",
            },
          }),
          "src/app/globals.css": '@import "tailwindcss";',
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).toContain("missing-tailwind-postcss-config");
      expect(checksPass(findings)).toBe(false);
    });

    it("accepts a complete Tailwind v4 PostCSS setup", () => {
      const findings = runStaticChecks(
        scaffolded({
          ...withPackage({
            scripts: { build: "next build" },
            devDependencies: {
              tailwindcss: "^4.1.0",
              "@tailwindcss/postcss": "^4.1.0",
            },
          }),
          "src/app/globals.css": '@import "tailwindcss";',
          "postcss.config.mjs":
            'export default { plugins: { "@tailwindcss/postcss": {} } };',
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("missing-tailwind-postcss-package");
      expect(rules(findings)).not.toContain("missing-tailwind-postcss-config");
    });
  });

  describe("file structure", () => {
    it("flags an empty code file", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/components/empty.tsx": "   \n  " }),
        EMPTY_PLAN
      );
      const finding = findings.find((f) => f.rule === "broken-file");

      expect(finding?.message).toBe("file is empty");
      expect(finding?.fix).toBe("llm");
    });

    it("flags unbalanced braces", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/lib/util.ts": "export function f() { return 1;" }),
        EMPTY_PLAN
      );

      expect(
        findings.find((f) => f.rule === "broken-file")?.message
      ).toMatch(/unbalanced braces/);
    });

    it("flags a page with no default export", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/app/about/page.tsx": "export const x = 1;" }),
        EMPTY_PLAN
      );

      expect(
        findings.find((f) => f.file === "src/app/about/page.tsx")?.message
      ).toBe("page file has no default export");
    });

    it("ignores non-code files", () => {
      const findings = runStaticChecks(
        scaffolded({ "README.md": "# unbalanced { brace" }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("broken-file");
    });
  });

  describe("import resolution", () => {
    it("resolves an @/ alias to src/", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/app/page.tsx":
            'import { Button } from "@/components/button";\nexport default function P() { return null; }',
          "src/components/button.tsx": "export const Button = () => null;",
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("missing-import");
    });

    it("resolves a relative import", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/app/page.tsx":
            'import { x } from "./helper";\nexport default function P() { return null; }',
          "src/app/helper.ts": "export const x = 1;",
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("missing-import");
    });

    it("resolves a parent-relative import", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/app/about/page.tsx":
            'import { x } from "../helper";\nexport default function P() { return null; }',
          "src/app/helper.ts": "export const x = 1;",
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("missing-import");
    });

    it("resolves a directory import to its index file", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/app/page.tsx":
            'import { x } from "@/lib";\nexport default function P() { return null; }',
          "src/lib/index.ts": "export const x = 1;",
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("missing-import");
    });

    it("flags an import with no matching file", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/app/page.tsx":
            'import { Button } from "@/components/button";\nexport default function P() { return null; }',
        }),
        EMPTY_PLAN
      );
      const finding = findings.find((f) => f.rule === "missing-import");

      expect(finding?.message).toBe(
        'imports "@/components/button" but no such file exists'
      );
      expect(finding?.fix).toBe("auto");
    });

    it("detects require() and dynamic import() as well as static imports", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/lib/a.ts": 'const x = require("@/missing/one");',
          "src/lib/b.ts": 'const y = import("@/missing/two");',
        }),
        EMPTY_PLAN
      );

      expect(
        findings.filter((f) => f.rule === "missing-import")
      ).toHaveLength(2);
    });
  });

  describe("dependency declarations", () => {
    it("flags a package used but not declared", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/lib/db.ts": 'import { z } from "zod";' }),
        EMPTY_PLAN
      );
      const finding = findings.find((f) => f.rule === "undeclared-dependency");

      expect(finding?.message).toBe(
        'uses package "zod" but package.json does not declare it'
      );
    });

    it("accepts a declared package", () => {
      const findings = runStaticChecks(
        scaffolded({
          ...withPackage({
            scripts: { build: "next build" },
            dependencies: { zod: "^4.0.0" },
          }),
          "src/lib/db.ts": 'import { z } from "zod";',
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("undeclared-dependency");
    });

    it("accepts a package declared only as a devDependency", () => {
      const findings = runStaticChecks(
        scaffolded({
          ...withPackage({
            scripts: { build: "next build" },
            devDependencies: { vitest: "^4.0.0" },
          }),
          "src/lib/a.ts": 'import { describe } from "vitest";',
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("undeclared-dependency");
    });

    it.each(["next", "react", "react-dom", "fs", "path", "crypto"])(
      "treats %s as always provided",
      (pkg) => {
        const findings = runStaticChecks(
          scaffolded({ "src/lib/a.ts": `import x from "${pkg}";` }),
          EMPTY_PLAN
        );

        expect(rules(findings)).not.toContain("undeclared-dependency");
      }
    );

    it("accepts node: prefixed builtins", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/lib/a.ts": 'import { createHash } from "node:crypto";' }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("undeclared-dependency");
    });

    it("resolves a scoped package to its @scope/name", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/lib/a.ts": 'import { createClient } from "@supabase/supabase-js";',
        }),
        EMPTY_PLAN
      );

      expect(
        findings.find((f) => f.rule === "undeclared-dependency")?.message
      ).toContain('"@supabase/supabase-js"');
    });

    it("resolves a deep import to its package root", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/lib/a.ts": 'import x from "date-fns/format";' }),
        EMPTY_PLAN
      );

      expect(
        findings.find((f) => f.rule === "undeclared-dependency")?.message
      ).toContain('"date-fns"');
    });
  });

  describe("security scanning", () => {
    // Obviously-fake values shaped like the real thing.
    it.each([
      ["hardcoded-nvidia-key", `const k = "nvapi-${"A".repeat(24)}";`],
      ["hardcoded-secret-key", `const k = "sk-${"B".repeat(24)}";`],
      [
        "hardcoded-jwt",
        `const t = "eyJ${"C".repeat(45)}.${"D".repeat(25)}.${"E".repeat(15)}";`,
      ],
    ])("flags %s", (rule, content) => {
      const findings = runStaticChecks(
        scaffolded({ "src/lib/secret.ts": content }),
        EMPTY_PLAN
      );

      expect(rules(findings)).toContain(rule);
    });

    it("scans non-code files for secrets too", () => {
      const findings = runStaticChecks(
        scaffolded({ ".env.local": `NVIDIA_API_KEY=nvapi-${"A".repeat(24)}` }),
        EMPTY_PLAN
      );

      expect(rules(findings)).toContain("hardcoded-nvidia-key");
    });

    it("flags eval() as a warning, not a blocker", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/lib/a.ts": "const r = eval(userInput);" }),
        EMPTY_PLAN
      );

      expect(findings.find((f) => f.rule === "eval-usage")?.severity).toBe(
        "warning"
      );
    });

    it("flags a secret exposed through a NEXT_PUBLIC_ variable", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/lib/a.ts":
            "const k = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;",
        }),
        EMPTY_PLAN
      );

      expect(rules(findings)).toContain("public-secret-env");
    });

    it("allows a non-secret NEXT_PUBLIC_ variable", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/lib/a.ts": "const u = process.env.NEXT_PUBLIC_APP_URL;" }),
        EMPTY_PLAN
      );

      expect(rules(findings)).not.toContain("public-secret-env");
    });

    it("flags generated code referencing the platform's provider key", () => {
      const findings = runStaticChecks(
        scaffolded({ "src/lib/ai.ts": "const k = process.env.NVIDIA_API_KEY;" }),
        EMPTY_PLAN
      );

      expect(rules(findings)).toContain("platform-key-reference");
    });
  });

  describe("plan coverage", () => {
    const plan: AppPlan = {
      ...EMPTY_PLAN,
      pages: [
        { name: "Home", path: "/", description: "" },
        { name: "About", path: "/about", description: "" },
      ],
      dataModel: [
        { table: "todos", description: "", columns: [{ name: "id", type: "uuid" }] },
      ],
    };

    it("maps the root page to src/app/page.tsx", () => {
      const findings = runStaticChecks(scaffolded(), plan);

      expect(
        findings.filter((f) => f.rule === "missing-page").map((f) => f.message)
      ).toEqual([
        'planned page "About" (/about) has no file at src/app/about/page.tsx',
      ]);
    });

    it("accepts a plan whose pages all exist", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/app/about/page.tsx": "export default function P() { return null; }",
        }),
        { ...plan, dataModel: [] }
      );

      expect(rules(findings)).not.toContain("missing-page");
    });

    it("flags a missing schema when the plan defines tables", () => {
      const findings = runStaticChecks(scaffolded(), plan);

      expect(rules(findings)).toContain("missing-schema");
    });

    it("does not ask for a schema when the plan has no tables", () => {
      const findings = runStaticChecks(scaffolded(), EMPTY_PLAN);

      expect(rules(findings)).not.toContain("missing-schema");
    });

    it("flags a planned table with no API route", () => {
      const findings = runStaticChecks(scaffolded(), plan);

      expect(
        findings.find((f) => f.rule === "missing-api-route")?.message
      ).toBe('table "todos" has no API route');
    });

    it("flags a planned table absent from an existing schema", () => {
      const findings = runStaticChecks(
        scaffolded({
          "supabase/schema.sql": "create table if not exists public.notes (id uuid);",
        }),
        plan
      );
      const finding = findings.find((f) => f.rule === "missing-schema-table");

      expect(finding?.severity).toBe("warning");
      expect(finding?.message).toBe('planned table "todos" is not in schema.sql');
    });

    it("accepts a planned table present in the schema", () => {
      const findings = runStaticChecks(
        scaffolded({
          "supabase/schema.sql": "CREATE TABLE public.todos (id uuid);",
          "src/app/api/todos/route.ts": "export async function GET() { return null; }",
        }),
        plan
      );

      expect(rules(findings)).not.toContain("missing-schema-table");
      expect(rules(findings)).not.toContain("missing-api-route");
    });

    it("rejects in-memory arrays as a persistent data layer", () => {
      const findings = runStaticChecks(
        scaffolded({
          "src/lib/data.ts": "const todos: unknown[] = [];",
          "supabase/schema.sql":
            "create table public.todos (id uuid); create policy own on public.todos for select using (true);",
          "src/app/api/todos/route.ts": "export async function GET() { return null; }",
        }),
        plan
      );

      expect(rules(findings)).toContain("ephemeral-data-layer");
      expect(checksPass(findings)).toBe(false);
    });

    it("requires RLS policies for generated persistent tables", () => {
      const findings = runStaticChecks(
        scaffolded({
          "supabase/schema.sql":
            "create table public.todos (id uuid); alter table public.todos enable row level security;",
          "src/app/api/todos/route.ts": "export async function GET() { return null; }",
        }),
        plan
      );

      expect(rules(findings)).toContain("missing-rls-policies");
      expect(checksPass(findings)).toBe(false);
    });

    it("rejects a data app preview with no real interaction", () => {
      const findings = runStaticChecks(
        scaffolded({
          "supabase/schema.sql":
            "create table public.todos (id uuid); create policy own on public.todos for select using (true);",
          "src/app/api/todos/route.ts": "export async function GET() { return null; }",
        }),
        plan
      );

      expect(findings.find((finding) => finding.rule === "shallow-preview")?.severity).toBe("error");
      expect(checksPass(findings)).toBe(false);
    });

    it("rejects planned product pages that are only placeholders", () => {
      const findings = runStaticChecks(
        scaffolded({
          "supabase/schema.sql":
            "create table public.todos (id uuid); create policy own on public.todos for select using (true);",
          "src/app/api/todos/route.ts": "export async function GET() { return null; }",
          "src/app/about/page.tsx":
            "export default function Page() { return <h1>About</h1>; }",
        }),
        plan
      );

      expect(rules(findings)).toContain("placeholder-page");
      expect(checksPass(findings)).toBe(false);
    });
  });
});

describe("checksPass", () => {
  const finding = (severity: CheckFinding["severity"]): CheckFinding => ({
    rule: "r",
    severity,
    message: "m",
    fix: "auto",
  });

  it("passes with no findings", () => {
    expect(checksPass([])).toBe(true);
  });

  it("passes with warnings only", () => {
    expect(checksPass([finding("warning"), finding("warning")])).toBe(true);
  });

  it("fails when any finding is an error", () => {
    expect(checksPass([finding("warning"), finding("error")])).toBe(false);
  });
});
