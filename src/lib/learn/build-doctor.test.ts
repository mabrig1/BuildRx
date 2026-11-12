import { describe, expect, it } from "vitest";
import { BUILD_DOCTOR_MAX_CHARS, diagnoseBuildLog } from "./build-doctor";

describe("privacy-aware deterministic Build Doctor", () => {
  it("identifies the first TypeScript source blocker rather than guessing hosting", () => {
    const result = diagnoseBuildLog([
      "Setup complete",
      "src/app/page.tsx(12,4): error TS2322: Type number is not assignable to string",
      "Process completed with exit code 2",
    ].join("\n"));
    expect(result.area).toBe("TypeScript");
    expect(result.confidence).toBe("evidence in pasted log");
    expect(result.firstRelevantLine).toContain("TS2322");
    expect(result.nextSteps.some(step => step.includes("typecheck"))).toBe(true);
    expect(result.limitation).toMatch(/has not inspected your repository/);
  });

  it("diagnoses common dependency, test, preview, and Cloudflare failure classes", () => {
    expect(diagnoseBuildLog("npm ci can only install packages when lockfile exists").area).toBe("Dependencies");
    expect(diagnoseBuildLog("Module not found: Can't resolve 'react-router'").area).toBe("Dependencies");
    expect(diagnoseBuildLog("AssertionError: expected true to be false").area).toBe("Tests");
    expect(diagnoseBuildLog("Cannot access 'isSupabaseConfigured' before initialization").area).toBe("Tests");
    expect(diagnoseBuildLog("wrangler.jsonc missing: Workers Builds failed").area).toBe("Cloudflare");
    expect(diagnoseBuildLog("Hello world").area).toBe("Preview");
    expect(diagnoseBuildLog("preview 404 not found").area).toBe("Preview");
    expect(diagnoseBuildLog("Failed to compile").area).toBe("Build");
  });

  it("redacts credentials from the displayed evidence", () => {
    const testCases = [
      "Error: missing env MONGODB_URI mongodb+srv://user:pass@cluster.example.com/database",
      "Error: failed Bearer thisisaverylongtoken",
      "Error: failed password=supersecret123",
      "Error: failed github_pat_abcdef1234567890",
    ];
    for (const raw of testCases) {
      const result = diagnoseBuildLog(raw);
      expect(result.firstRelevantLine).not.toContain("pass@cluster");
      expect(result.firstRelevantLine).not.toContain("supersecret123");
      expect(result.firstRelevantLine).not.toContain("abcdef1234567890");
      expect(result.firstRelevantLine).not.toContain("thisisaverylongtoken");
    }
  });

  it("does not invent a diagnosis when there is no matching evidence", () => {
    for (const raw of ["", "The build log was not attached", "All good"]) {
      const result = diagnoseBuildLog(raw);
      expect(result.area).toBe("Unknown");
      expect(result.confidence).toBe("possible only");
      expect(result.nextSteps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("bounds very long log lines and skips terminal color codes", () => {
    const raw = "a".repeat(BUILD_DOCTOR_MAX_CHARS + 3000) + "\nError: missing variable";
    const result = diagnoseBuildLog(raw);
    expect(result.area).toBe("Unknown");
    const colored = diagnoseBuildLog("\x1b[31merror TS2307: Cannot find module\x1b[0m");
    expect(colored.area).toBe("TypeScript");
    expect(colored.firstRelevantLine).not.toContain("\x1b");
  });
});
