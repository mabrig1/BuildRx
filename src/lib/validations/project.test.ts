import { describe, expect, it } from "vitest";

import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";
import { createProjectSchema } from "@/lib/validations/project";

describe("createProjectSchema", () => {
  it("allows a project to start without an initial prompt", () => {
    const result = createProjectSchema.safeParse({
      name: "ClientFlow",
      description: "",
      prompt: "",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a detailed product specification", () => {
    const result = createProjectSchema.safeParse({
      name: "ClientFlow",
      description: "A multi-tenant SaaS",
      prompt: "A".repeat(MAX_AI_PROMPT_CHARACTERS),
    });

    expect(result.success).toBe(true);
  });

  it("rejects a specification above the shared prompt limit", () => {
    const result = createProjectSchema.safeParse({
      name: "ClientFlow",
      description: "",
      prompt: "A".repeat(MAX_AI_PROMPT_CHARACTERS + 1),
    });

    expect(result.success).toBe(false);
  });
});
