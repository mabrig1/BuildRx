import { describe, expect, it } from "vitest";

import { TRAINING_TRACKS } from "./labs";
import { buildStudioExport } from "./studio-export-kit";
import { newStudioWorkspace, setStudioFile } from "./studio-workspace";
import {
  trainingVerificationFiles,
  VERIFICATION_GUIDE_PATH,
  VERIFICATION_SCRIPT_PATH,
  VERIFICATION_WORKFLOW_PATH,
} from "./studio-verification";

describe("read-only training verification pack", () => {
  it("generates a complete read-only workflow with no deployment privileges", () => {
    for (const track of ["fullstack-web", "software-engineering"] as const) {
      const files = trainingVerificationFiles(track);
      const workflow = files[VERIFICATION_WORKFLOW_PATH];
      const verifier = files[VERIFICATION_SCRIPT_PATH];
      const guide = files[VERIFICATION_GUIDE_PATH];

      expect(workflow).toContain("permissions:\n  contents: read");
      expect(workflow).toContain("pull_request:");
      expect(workflow).toContain("workflow_dispatch:");
      expect(workflow).toContain("timeout-minutes: 12");
      expect(workflow).toContain("persist-credentials: false");
      expect(workflow).toContain("npm install --ignore-scripts --no-audit --no-fund");
      expect(workflow).toContain("npm run typecheck");
      expect(workflow).not.toMatch(/^\\s*pull_request_target:/m);
      expect(workflow).not.toMatch(/^\\s*(?:deploy|push):/m);\n      expect(workflow).not.toContain("secrets.");
      expect(workflow).not.toContain("id-token: write");

      expect(verifier).toContain("existsSync");
      expect(verifier).toContain("MISSING REQUIRED FILE");
      expect(verifier).not.toContain("eval(");
      expect(guide).toContain("NOT a deployed app");
      expect(guide).toContain("GitHub Actions");
      expect(guide).toContain("npm run typecheck");
      expect(guide).toContain("BuildRx has not run it");
      if (track === "fullstack-web") {
        expect(workflow).toContain("npm run build");
        expect(verifier).toContain("src/app/page.tsx");
      } else {
        expect(workflow).toContain("npm test");
        expect(verifier).toContain("src/lib/issues.test.ts");
      }
    }
  });

  it("adds verification files only for web and TypeScript training exports", () => {
    for (const track of TRAINING_TRACKS) {
      const exportResult = buildStudioExport(newStudioWorkspace(track.id));
      if (!exportResult.ok) throw new Error(exportResult.reason);
      const shouldHaveWorkflow = track.id === "fullstack-web" || track.id === "software-engineering";
      expect(exportResult.files[VERIFICATION_WORKFLOW_PATH] !== undefined).toBe(shouldHaveWorkflow);
      expect(exportResult.files[VERIFICATION_SCRIPT_PATH] !== undefined).toBe(shouldHaveWorkflow);
      expect(exportResult.files[VERIFICATION_GUIDE_PATH] !== undefined).toBe(shouldHaveWorkflow);
    }
  });

  it("never overwrites a student-authored document of the same name", () => {
    const web = newStudioWorkspace("fullstack-web");
    const edited = setStudioFile(web, VERIFICATION_GUIDE_PATH, "student's own guide");
    if (!edited.ok) throw new Error(edited.reason);
    const result = buildStudioExport(edited.workspace);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("will not overwrite");
  });

  it("keeps Expo and systems exports separate from CI execution claims", () => {
    expect(trainingVerificationFiles("mobile-app")).toEqual({});
    expect(trainingVerificationFiles("systems-engineering")).toEqual({});
  });
});
