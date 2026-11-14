import { describe, expect, it } from "vitest";

import {
  buildFounderOpsFiles,
  fallbackFounderOps,
  applyFounderOpsRefinement,
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


describe("FounderOps compact model refinement", () => {
  it("validates a small response without requiring tools or eleven schema fields", () => {
    const baseline = fallbackFounderOps(plan, "Create an agentic app");
    const improved = applyFounderOpsRefinement(JSON.stringify({
      smallestValuableOutcome: "A founder can verify the output and retrieve the saved preview",
      acceptanceCriteria: ["The project reopens with the same saved preview"],
      riskGates: ["Confirm the release checksum before deployment"],
      productionEvidence: ["Record the successful sign-in and reload check"],
    }), baseline);
    expect(improved.smallestValuableOutcome).toContain("saved preview");
    expect(improved.acceptanceCriteria).toContain("The project reopens with the same saved preview");
    expect(improved.infrastructure).toEqual(baseline.infrastructure);
    expect(improved.humanApprovals).toEqual(baseline.humanApprovals);
    expect(improved.dataClassification).toEqual(baseline.dataClassification);
    expect(improved.costControls).toEqual(baseline.costControls);
  });

  it("ignores attempts to override approvals, credential handling, and provider boundaries", () => {
    const baseline = fallbackFounderOps(plan, "Build an app");
    const spec = applyFounderOpsRefinement(JSON.stringify({
      smallestValuableOutcome: "A secure application is verified in its actual browser",
      infrastructure: [],
      humanApprovals: [],
      dataClassification: [],
    }), baseline);
    expect(spec.infrastructure).toEqual(baseline.infrastructure);
    expect(spec.humanApprovals).toEqual(baseline.humanApprovals);
    expect(spec.dataClassification).toEqual(baseline.dataClassification);
  });

  it("rejects empty or invalid model output", () => {
    const baseline = fallbackFounderOps(plan, "Build an app");
    expect(() => applyFounderOpsRefinement("not JSON", baseline)).toThrow("FOUNDEROPS_INVALID_JSON");
    expect(() => applyFounderOpsRefinement("{}", baseline)).toThrow("FOUNDEROPS_SCHEMA_INVALID");
    expect(() => applyFounderOpsRefinement('{"acceptanceCriteria":[123]}', baseline)).toThrow("FOUNDEROPS_SCHEMA_INVALID");
  });

  it("retains all baseline risk gates and bounds additional model evidence", () => {
    const baseline = fallbackFounderOps(plan, "Build an app");
    const spec = applyFounderOpsRefinement(JSON.stringify({
      riskGates: ["Check that ticket status cannot be changed by strangers"],
      productionEvidence: ["Verify that one ticket update survives a reload"],
    }), baseline);
    for(const gate of baseline.riskGates) expect(spec.riskGates).toContain(gate);
    for(const item of baseline.productionEvidence) expect(spec.productionEvidence).toContain(item);
    expect(spec.riskGates.length).toBeLessThanOrEqual(12);
  });
});
