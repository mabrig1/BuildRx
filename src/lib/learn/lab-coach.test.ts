import { describe, expect, it } from "vitest";
import { labCoachMessages, validateLabCoachRequest } from "./lab-coach";

describe("project-based AI mentor validation", () => {
  it("permits allowlisted tracks and strict bounded inputs", () => {
    const allowed = validateLabCoachRequest({
      labId: "mob01", level: "first-time", mode: "lesson",
    });
    expect(allowed.ok).toBe(true);
    expect(validateLabCoachRequest({ labId: "invalid" }).ok).toBe(false);
    expect(validateLabCoachRequest({ labId: "web01", arbitraryField: "untrusted" }).ok).toBe(false);
    expect(validateLabCoachRequest({ labId: "web01", goal: "a".repeat(161) }).ok).toBe(false);
  });
  it("refuses connection strings and token-like learner goals", () => {
    expect(validateLabCoachRequest({ labId: "web03", goal: "mongodb+srv://u:p@host" }).ok).toBe(false);
    expect(validateLabCoachRequest({ labId: "mob03", goal: "github_pat_secretvalue" }).ok).toBe(false);
  });
  it("uses trusted lab tasks and explicitly avoids fabricated evidence", () => {
    const chosen = validateLabCoachRequest({ labId: "mob01", mode: "five-day-plan" });
    if (!chosen.ok) throw Error("expected valid lab");
    const messages = labCoachMessages(chosen.lab, chosen.request);
    expect(messages[0].content).toMatch(/BuildRx does not currently compile/);
    expect(messages[0].content).toMatch(/Never fabricate passed tests/);
    expect(messages[1].content).toContain("Expo");
    expect(messages[1].content).toContain("five-day-plan");
  });
});
