import { describe, expect, it } from "vitest";
import { IMPLEMENTATION_TRACKS, RELEASE_GATES, SDLC_ROLES, renderSdlcBlueprint } from "@/lib/agents/sdlc-blueprint";
import type { AppPlan } from "@/lib/agents/types";

const plan: AppPlan = {
  appName: "Sample Bookings",
  summary: "An app with real reservation persistence.",
  pages: [{ name: "Bookings", path: "/", description: "Manage bookings" }],
  components: [],
  dataModel: [],
  features: ["Create booking"],
  workflows: [{
    name: "Make a booking",
    actor: "Signed-in user",
    steps: ["Select service", "Confirm", "Save"],
    outcome: "Booking survives a reload",
  }],
  acceptanceCriteria: ["Users can save bookings"],
};

describe("Video-inspired SDLC contract", () => {
  it("assigns existing orchestration responsibilities to named roles", () => {
    expect(SDLC_ROLES.some((role) => role.name === "Security engineer")).toBe(true);
    expect(SDLC_ROLES.some((role) => role.name === "Product manager")).toBe(true);
    expect(IMPLEMENTATION_TRACKS.map((track) => track.id)).toEqual([
      "backend-api",
      "data-pipeline",
      "dashboard-ui",
    ]);
    expect(RELEASE_GATES.some((gate) => gate.includes("explicit owner action"))).toBe(true);
  });
  it("generates correct owner-reviewed evidence without pretending to run cloud tools", () => {
    const text = renderSdlcBlueprint(plan);
    expect(text).toContain("Make a booking");
    expect(text).toContain("sequentially");
    expect(text).toContain("BigQuery is **not configured**");
    expect(text).toContain("A preview saved by the BuildRx deployment agent");
    expect(text).toContain("Users can save bookings");
    expect(text).not.toContain("Cloud Run deployed successfully");
  });
  it("uses bounded content even if model output is oversized", () => {
    const result = renderSdlcBlueprint({ ...plan, summary: "x".repeat(5000) });
    expect(result).not.toContain("x".repeat(400));
  });
});
