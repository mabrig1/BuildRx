import { describe, expect, it } from "vitest";
import {
  TRAINING_LABS, TRAINING_TRACKS, getTrainingLab, labsForTrack,
} from "./labs";

describe("BuildRx hands-on engineering curriculum", () => {
  it("has four distinct modern software tracks and 20 ordered labs", () => {
    expect(TRAINING_TRACKS.map(t => t.id)).toEqual([
      "software-engineering", "systems-engineering", "fullstack-web", "mobile-app",
    ]);
    expect(TRAINING_LABS).toHaveLength(20);
    expect(new Set(TRAINING_LABS.map(l => l.id)).size).toBe(20);
    for (const t of TRAINING_TRACKS) {
      const labs = labsForTrack(t.id);
      expect(labs).toHaveLength(5);
      expect(labs.map(l => l.sequence)).toEqual([1,2,3,4,5]);
      expect(t.capstone.length).toBeGreaterThan(20);
    }
  });

  it("keeps tasks, acceptance checks and evidence explicit and actionable", () => {
    for (const lab of TRAINING_LABS) {
      expect(lab.title.length).toBeGreaterThan(10);
      expect(lab.tasks.length).toBeGreaterThanOrEqual(5);
      expect(lab.acceptance.length).toBeGreaterThanOrEqual(3);
      expect(lab.deliverables.length).toBeGreaterThanOrEqual(2);
      expect(lab.caution.length).toBeGreaterThan(20);
      expect(lab.references.every(r => r.url.startsWith("https://"))).toBe(true);
    }
    expect(getTrainingLab("bad-id")).toBeUndefined();
  });

  it("does not misrepresent mobile or Cloudflare as already hosted", () => {
    const mobile = labsForTrack("mobile-app");
    expect(mobile.some(l => l.caution.includes("does not currently produce"))).toBe(true);
    const web = getTrainingLab("web05");
    expect(web?.caution).toMatch(/NOT proof of live Workers deployment/);
    const systems = labsForTrack("systems-engineering");
    expect(systems.some(l => l.title.includes("atomic"))).toBe(true);
  });
});
