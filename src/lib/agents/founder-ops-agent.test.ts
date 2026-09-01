import { describe, expect, it } from "vitest";

import {
  buildFounderOpsFiles,
  fallbackFounderOps,
} from "@/lib/agents/founder-ops-agent";
import type { AppPlan } from "@/lib/agents/types";

const plan: AppPlan = {
  appName: "BuildPilot",
  summary: "An agentic application builder",
  userRoles: [{ name: "Founder", permissions: ["create projects"] }],
  workflows: [
    {
      name: "Build an app",
      actor: "Founder",
      steps: ["Describe app", "Review plan", "Generate", "Approve preview"],
      outcome: "A founder receives a verified preview of the requested app.",
    },
  ],
  pages: [{ name: "Builder", path: "/", description: "Build workspace" }],
  components: [],
  dataModel: [
    {
      table: "projects",
      description: "Projects",
      columns: [{ name: "owner_id", type: "uuid" }],
    },
  ],
  features: ["Agent workflow", "File generation"],
  acceptanceCriteria: [
    "A founder can describe an app.",
    "The app produces a preview.",
    "The preview survives a reload.",
  ],
};

describe("FounderOps Agent deterministic contract", () => {
  it("assigns distinct responsibilities to all four requested providers", () => {
    const spec = fallbackFounderOps(
      plan,
      "Use Vercel, Supabase, MongoDB, and Cloudflare for an agentic builder with file uploads"
    );
    const roles = Object.fromEntries(
      spec.infrastructure.map((item) => [item.provider, item])
    );

    expect(roles.vercel.responsibility).toContain("Next.js");
    expect(roles.supabase.responsibility).toContain("authentication");
    expect(roles.mongodb.responsibility).toContain("build-job state");
    expect(roles.cloudflare.responsibility).toContain("R2");
    expect(Object.values(roles).every((item) => item.required)).toBe(true);
  });

  it("defers providers that do not yet have a distinct responsibility", () => {
    const simplePlan: AppPlan = {
      ...plan,
      summary: "An authenticated notes app",
      workflows: [],
      features: ["Create notes", "Edit notes"],
    };
    const spec = fallbackFounderOps(
      simplePlan,
      "Build a simple authenticated notes app"
    );
    const roles = Object.fromEntries(
      spec.infrastructure.map((item) => [item.provider, item])
    );

    expect(roles.vercel.required).toBe(true);
    expect(roles.supabase.required).toBe(true);
    expect(roles.mongodb.required).toBe(false);
    expect(roles.cloudflare.required).toBe(false);
  });

  it("emits the complete production evidence pack without secret values", () => {
    const spec = fallbackFounderOps(plan, "Build an agentic app builder with uploads");
    const files = buildFounderOpsFiles(spec, plan);

    expect(files.map((file) => file.path)).toEqual([
      "docs/PRODUCT-BRIEF.md",
      "docs/ARCHITECTURE-DECISION.md",
      "docs/RELEASE-CHECKLIST.md",
      "docs/OPERATIONS-RUNBOOK.md",
    ]);
    expect(files.map((file) => file.content).join("\n")).not.toMatch(
      /(?:nvapi-|sk-)[A-Za-z0-9_-]{20,}/
    );
  });
});
