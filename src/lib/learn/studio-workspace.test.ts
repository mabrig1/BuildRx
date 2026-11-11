import { describe, expect, it } from "vitest";
import {
  containsStudioSecret, inspectStudioWorkspace, isStudioTrack,
  newStudioWorkspace, parseStudioWorkspace, removeStudioFile, setStudioFile,
  STUDIO_MAX_FILE_CHARS, STUDIO_MAX_FILES, STUDIO_MAX_TOTAL_CHARS,
  validStudioPath,
} from "./studio-workspace";
import { TRAINING_TRACKS } from "./labs";

describe("client-only multi-file training studio", () => {
  it("creates safe reviewed source files in each training stack", () => {
    for (const track of TRAINING_TRACKS) {
      const workspace = newStudioWorkspace(track.id);
      expect(workspace.version).toBe(1);
      expect(workspace.trackId).toBe(track.id);
      expect(Object.keys(workspace.files).length).toBeGreaterThan(0);
      expect(Object.keys(workspace.files).every(validStudioPath)).toBe(true);
      expect(parseStudioWorkspace(workspace, track.id).ok).toBe(true);
    }
    expect(isStudioTrack("invalid")).toBe(false);
  });

  it("accepts benign relative paths and rejects secrets or dangerous file names", () => {
    expect(validStudioPath("src/app/about/page.tsx")).toBe(true);
    expect(validStudioPath("src/lib/issues.test.ts")).toBe(true);
    expect(validStudioPath("openapi.yaml")).toBe(true);
    for (const path of [
      "../src/app/page.tsx", "/root/file.ts", "src/../secret.ts",
      ".env", "src/.env.local", "src/.git/config.json",
      "node_modules/package.json", "src\\file.ts", "src//file.ts",
      "src/test.js%2f.env", "src/test.exe", "README",
    ]) expect(validStudioPath(path)).toBe(false);
  });

  it("stays within file and total limits and leaves original input unchanged", () => {
    const base = newStudioWorkspace("software-engineering");
    const original = JSON.stringify(base);
    const created = setStudioFile(base, "src/lib/new-util.ts", "export const x = 1;");
    if (!created.ok) throw Error("expected new file");
    expect(created.workspace.files["src/lib/new-util.ts"]).toContain("x");
    expect(JSON.stringify(base)).toBe(original);
    const deleted = removeStudioFile(created.workspace, "src/lib/new-util.ts");
    expect(deleted.files["src/lib/new-util.ts"]).toBeUndefined();

    expect(setStudioFile(base, "src/util.ts", "a".repeat(STUDIO_MAX_FILE_CHARS + 1)).ok).toBe(false);
    let expanded = base;
    while (Object.keys(expanded.files).length < STUDIO_MAX_FILES) {
      const n = Object.keys(expanded.files).length;
      const result = setStudioFile(expanded, "src/lib/added" + n + ".ts", "a");
      if (!result.ok) throw Error("expected room to add");
      expanded = result.workspace;
    }
    expect(setStudioFile(expanded, "src/lib/overflow.ts", "a").ok).toBe(false);

    const giant: Record<string, string> = {};
    for (let i = 0; i < 9; i++) giant["src/a" + i + ".ts"] = "a".repeat(15000);
    expect(parseStudioWorkspace({ version: 1, trackId: "software-engineering", files: giant }).ok).toBe(false);
    expect(STUDIO_MAX_TOTAL_CHARS).toBeLessThan(9 * 15000);
  });

  it("denies invalid/mismatched backup structures and embedded credentials", () => {
    const base = newStudioWorkspace("mobile-app");
    expect(parseStudioWorkspace(base, "fullstack-web").ok).toBe(false);
    expect(parseStudioWorkspace({ ...base, version: 999 }).ok).toBe(false);
    expect(parseStudioWorkspace({ ...base, files: [] }).ok).toBe(false);
    expect(parseStudioWorkspace({ ...base, files: { "/etc/passwd": "data" } }).ok).toBe(false);
    expect(parseStudioWorkspace({ ...base, files: { "src/x.ts": "sk-supersecret123456789" } }).ok).toBe(false);
    expect(containsStudioSecret("github_pat_1234567890")).toBe(true);
    expect(containsStudioSecret("MONGODB_URI")).toBe(false);
  });

  it("uses diagnostic language that does not certify or deploy the project", () => {
    const web = inspectStudioWorkspace(newStudioWorkspace("fullstack-web"));
    expect(web.some(check => check.label === "Real backend and access control" && check.status === "action")).toBe(true);
    expect(web.some(check => check.label === "Real build and runtime verification" && check.status === "action")).toBe(true);
    const mobile = inspectStudioWorkspace(newStudioWorkspace("mobile-app"));
    expect(mobile.some(check => check.label === "Real device and offline tests" && check.status === "action")).toBe(true);
    const systems = inspectStudioWorkspace(newStudioWorkspace("systems-engineering"));
    expect(systems.some(check => check.label === "Unresolved architecture tasks" && check.status === "action")).toBe(true);
  });
});
