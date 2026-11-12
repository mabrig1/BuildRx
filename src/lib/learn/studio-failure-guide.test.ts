import { describe, expect, it } from "vitest";

import {
  containsStudioLogSecret,
  diagnoseStudioLog,
  MAX_DIAGNOSTIC_LOG,
} from "./studio-failure-guide";

describe("privacy-first beginner build diagnostics", () => {
  const examples = [
    ["npm-arborist-edgesout", "npm error Cannot read properties of null (reading 'edgesOut')"],
    ["npm-peer-conflict", "npm ERR! ERESOLVE unable to resolve dependency tree"],
    ["missing-package-json", "npm error ENOENT: no such file or directory, open '/tmp/app/package.json'"],
    ["missing-module", "src/app/page.tsx: Module not found: Can't resolve './Card'"],
    ["typescript-error", "src/route.ts(12,3): error TS2339: Property 'id' does not exist"],
    ["next-missing-build", "Could not find a production build in the '.next' directory"],
    ["cloudflare-build", "wrangler deploy failed: nodejs_compat is not configured"],
    ["preview-not-found", "Preview renders — preview returned HTTP 404"],
    ["placeholder", "Hello world"],
  ] as const;

  it.each(examples)("recognizes %s without claiming a real remote diagnosis", (code, sample) => {
    const result = diagnoseStudioLog(sample);
    expect(result.code).toBe(code);
    expect(result.recognized).toBe(true);
    expect(result.sensitive).toBe(false);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.likelyCause.length).toBeGreaterThan(20);
    expect(JSON.stringify(result)).not.toContain(sample);
  });

  it("uses an honest fallback instead of inventing a cause", () => {
    const result = diagnoseStudioLog("A workflow failed; check the details online.");
    expect(result.code).toBe("unknown");
    expect(result.recognized).toBe(false);
    expect(result.steps.some(step => step.includes("first failed step"))).toBe(true);
    expect(diagnoseStudioLog(" ").code).toBe("empty");
  });

  it("detects secrets and returns no copied log data", () => {
    const samples = [
      "mongodb+srv://user:pass@example.mongodb.net/db",
      "Authorization: Bearer VERYSECRETTOKEN123456",
      "github_pat_SECRETTOKEN1234567890",
      "password=secretvalue123456",
      "-----BEGIN PRIVATE KEY-----",
    ];
    for (const input of samples) {
      expect(containsStudioLogSecret(input)).toBe(true);
      const result = diagnoseStudioLog(input + "\nerror TS2307");
      expect(result.code).toBe("sensitive");
      expect(result.sensitive).toBe(true);
      expect(result.recognized).toBe(false);
      expect(JSON.stringify(result)).not.toContain(input);
    }
    expect(containsStudioLogSecret("error TS2307")).toBe(false);
  });

  it("bounds very long logs and treats excerpts as text only", () => {
    const prefix = "x".repeat(MAX_DIAGNOSTIC_LOG + 10);
    expect(diagnoseStudioLog(prefix + "\nerror TS2339").code).toBe("unknown");
    const attack = "<script>alert('break the app')</script>";
    const outcome = diagnoseStudioLog(attack);
    expect(outcome.code).toBe("unknown");
    expect(JSON.stringify(outcome)).not.toContain("<script>");
  });
});
