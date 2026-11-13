import { describe, it, expect } from "vitest";
import { COURSE_PRICE_NGN, COURSE_SLUG, courseModules } from "@/lib/course/buildrx-tech-plus";
import { TRAINING_LABS } from "@/lib/learn/labs";
import { academyLabTracks, academyTrackForModule, academyLabUrl, academyStudioUrl, masterclassPhases, masterclassTopicCount, academyCourseSources, academyAppExamples } from "./academy-bundle";
describe("BuildRx Academy integration", () => {
  it("preserves pricing and enrollment identity", () => {
    expect(COURSE_PRICE_NGN).toBe(100_000);
    expect(COURSE_SLUG).toBe("mabrig-tech-plus-buildrx");
    expect(courseModules).toHaveLength(8);
  });
  it("links each premium course module to an authentic studio/lab track", () => {
    for (const m of courseModules) {
      const track = academyTrackForModule(m.id);
      expect(academyLabTracks.some(t => t.id === track)).toBe(true);
      expect(academyLabUrl(m.id)).toBe("/learn/labs?track=" + track);
      expect(academyStudioUrl(m.id)).toBe("/learn/studio?track=" + track);
    }
  });
  it("counts source-authored 20 labs and 64 curriculum topics", () => {
    expect(academyLabTracks.reduce((sum, t) => sum + t.labCount, 0)).toBe(TRAINING_LABS.length);
    expect(TRAINING_LABS.length).toBe(20);
    expect(masterclassPhases).toHaveLength(10);
    expect(masterclassTopicCount).toBe(64);
  });
  it("links only explicit MABRIG repositories", () => {
    for (const p of [...academyCourseSources, ...academyAppExamples]) {
      expect(p.repo).toMatch(/^https:\/\/github\.com\/mabrig1\/[A-Za-z0-9._-]+$/);
    }
  });
});
