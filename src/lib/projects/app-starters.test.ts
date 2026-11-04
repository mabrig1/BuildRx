import { describe, expect, it } from "vitest";
import { APP_STARTERS } from "@/lib/projects/app-starters";
import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";
import { createProjectSchema } from "@/lib/validations/project";

describe("credential-free project starters", () => {
  it("offers 24 diverse, searchable app briefs", () => {
    expect(APP_STARTERS).toHaveLength(24);
    expect(new Set(APP_STARTERS.map((s) => s.id)).size).toBe(24);
    expect(new Set(APP_STARTERS.map((s) => s.category)).size).toBeGreaterThan(7);
    expect(APP_STARTERS.some(s => s.id === "inventory")).toBe(true);
    expect(APP_STARTERS.some(s => s.id === "printing")).toBe(true);
    expect(APP_STARTERS.some(s => s.id === "grants")).toBe(true);
    expect(APP_STARTERS.some(s => s.id === "church")).toBe(true);
  });

  it.each(APP_STARTERS.map((starter) => [starter.id, starter] as const))(
    "%s pre-fills an accepted project with a substantive editable spec",
    (_id, starter) => {
      const form = createProjectSchema.safeParse({
        name: starter.name,
        description: starter.description,
        prompt: starter.prompt,
      });
      expect(form.success).toBe(true);
      expect(starter.prompt.length).toBeGreaterThan(500);
      expect(starter.prompt.length).toBeLessThanOrEqual(MAX_AI_PROMPT_CHARACTERS);
      expect(starter.prompt).toMatch(/WORKFLOW:/);
      expect(starter.prompt).toMatch(/ACCEPTANCE:/);
      expect(starter.prompt).toMatch(/Row-Level Security/);
      expect(starter.prompt).toMatch(/never put service-role keys in browser code/i);
      expect(starter.prompt).not.toMatch(/sk-proj-|ghp_[A-Za-z0-9]{20}|sb_secret_/);
    }
  );

  it("does not imply real payments or external actions are already working", () => {
    expect(APP_STARTERS.every(s => /never simulate a successful payment/i.test(s.prompt))).toBe(true);
  });
});
