import { describe, expect, it } from "vitest";
import ts from "typescript";

import { TRAINING_TRACKS } from "./labs";
import { buildStudioExport } from "./studio-export-kit";
import { newStudioWorkspace, setStudioFile } from "./studio-workspace";

function exportFor(track: (typeof TRAINING_TRACKS)[number]["id"]) {
  return buildStudioExport(newStudioWorkspace(track));
}

describe("BuildRx stack-specific training ZIP preparation", () => {
  it("generates non-mutating, reviewed manifests for a local Next.js App Router starter", () => {
    const input = newStudioWorkspace("fullstack-web");
    const before = JSON.stringify(input);
    const result = buildStudioExport(input);
    if (!result.ok) throw new Error(result.reason);

    expect(result.kind).toBe("web-app-starter");
    expect(JSON.stringify(input)).toBe(before);
    expect(result.files["src/app/page.tsx"]).toBe(input.files["src/app/page.tsx"]);
    expect(result.files["src/app/layout.tsx"]).toContain("<html lang=\"en\">");
    expect(result.files["src/app/globals.css"]).toContain("box-sizing");
    expect(result.files[".gitignore"]).toContain(".env.*");
    expect(result.files["README-TRAINING.md"]).toContain("no real booking persistence");

    const pkg = JSON.parse(result.files["package.json"]);
    const config = JSON.parse(result.files["tsconfig.json"]);
    expect(pkg.private).toBe(true);
    expect(pkg.license).toBe("UNLICENSED");
    expect(pkg.scripts.dev).toBe("next dev");
    expect(pkg.scripts.build).toBe("next build");
    expect(pkg.dependencies.next).toBe("15.5.20");
    expect(pkg.dependencies.react).toBe("19.1.0");
    expect(pkg.dependencies["react-dom"]).toBe("19.1.0");
    expect(pkg).not.toHaveProperty("postinstall");
    expect(config.compilerOptions.moduleResolution).toBe("bundler");
    expect(config.include).toContain(".next/types/**/*.ts");
    expect(result.files).not.toHaveProperty("node_modules");
    expect(result.files).not.toHaveProperty("package-lock.json");
  });

  it("has syntactically parsable Next.js source and root layout", () => {
    const result = exportFor("fullstack-web");
    if (!result.ok) throw Error(result.reason);
    const sourceFiles = Object.entries(result.files).filter(([path]) => /\.tsx?$/.test(path));
    for (const [path, source] of sourceFiles) {
      const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
      expect(parsed.parseDiagnostics, path).toHaveLength(0);
    }
  });

  it("generates a unit-testing package with real npm scripts and reviewed Vitest tests", () => {
    const result = exportFor("software-engineering");
    if (!result.ok) throw Error(result.reason);
    expect(result.kind).toBe("typescript-test-starter");
    const pkg = JSON.parse(result.files["package.json"]);
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
    expect(pkg.devDependencies.vitest).toMatch(/^\^4/);
    expect(result.files["src/lib/issues.test.ts"]).toContain("describe(");
    expect(result.steps.some(step => step.includes("npm test"))).toBe(true);
  });

  it("keeps mobile overlays and architecture artifacts honestly non-executable", () => {
    const mobile = exportFor("mobile-app");
    const system = exportFor("systems-engineering");
    if (!mobile.ok || !system.ok) throw Error("Missing track packaging");
    expect(mobile.kind).toBe("expo-overlay");
    expect(mobile.files["app/index.tsx"]).toContain("react-native");
    expect(mobile.files).not.toHaveProperty("package.json");
    expect(mobile.caution).toContain("not a standalone Expo app");
    expect(system.kind).toBe("systems-design");
    expect(system.files["openapi.yaml"]).toContain("openapi:");
    expect(system.files).not.toHaveProperty("package.json");
    expect(system.caution).toContain("not a running application");
  });

  it("rejects project secret strings and prevents override of generated files", () => {
    const starter = newStudioWorkspace("fullstack-web");
    const withSecret = setStudioFile(starter, "src/not-a-public-token.ts", 'const key = "github_pat_thisisunsafe123456";');
    if (!withSecret.ok) throw Error(withSecret.reason);
    expect(buildStudioExport(withSecret.workspace).ok).toBe(false);

    for (const reserved of ["package.json", "tsconfig.json", "src/app/layout.tsx", "src/app/globals.css"]) {
      const patched = setStudioFile(starter, reserved, "overriding generated config");
      if (!patched.ok) throw Error(patched.reason);
      const exported = buildStudioExport(patched.workspace);
      expect(exported.ok, reserved).toBe(false);
      if (!exported.ok) expect(exported.reason).toMatch(/will not overwrite/);
    }
  });

  it("requires the expected app or test entrypoint rather than silently exporting a fake runnable package", () => {
    const web = newStudioWorkspace("fullstack-web");
    delete web.files["src/app/page.tsx"];
    expect(buildStudioExport(web).ok).toBe(false);

    const tsStudio = newStudioWorkspace("software-engineering");
    delete tsStudio.files["src/lib/issues.test.ts"];
    expect(buildStudioExport(tsStudio).ok).toBe(false);
  });

  it("provides an explicit, transparent next-action guide for every track", () => {
    for (const track of TRAINING_TRACKS) {
      const result = exportFor(track.id);
      if (!result.ok) throw Error(result.reason);
      const readme = result.files["README-TRAINING.md"];
      expect(readme).toMatch(/NOT installed dependencies/);
      expect(readme).toMatch(/no.*deploy/i);
      expect(readme).toContain("never treat a generated package".replace("never", "Never"));
      expect(readme).toContain("## Exact next steps");
      expect(result.steps.length).toBeGreaterThanOrEqual(4);
      expect(Object.keys(result.files).length).toBeGreaterThanOrEqual(4);
    }
  });
});
