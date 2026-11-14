import { describe, expect, it } from "vitest";
import { TRAINING_TRACKS } from "./labs";
import { TRAINING_STARTER_KITS, starterKitForTrack } from "./starter-kits";

describe("safe educational starter kits", () => {
  it("provides reviewed study files for each of the four engineering tracks", () => {
    expect(TRAINING_STARTER_KITS).toHaveLength(4);
    for (const track of TRAINING_TRACKS) {
      const kit = starterKitForTrack(track.id);
      expect(kit).toBeDefined();
      expect(kit?.files.length).toBeGreaterThanOrEqual(1);
      expect(kit?.setup.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("never supplies executable deployment workflows, credentials or unsafe paths", () => {
    for (const kit of TRAINING_STARTER_KITS) {
      for (const file of kit.files) {
        expect(file.path).toMatch(/^(docs\/|src\/|app\/|openapi\.yaml)/);
        expect(file.path).not.toMatch(/\.\.|^\/|\.env|\.github\/workflows/);
        expect(file.content).not.toMatch(/(?:github_pat_|ghp_[A-Za-z0-9]{12,}|mongodb\+srv:\/\/[^\s]+:[^\s]+@)/);
        expect(file.content.length).toBeLessThan(10_000);
      }
    }
  });

  it("does not conflate Expo with BuildRx's web hosting", () => {
    const mobile = starterKitForTrack("mobile-app");
    expect(mobile?.description).toMatch(/No native binary/);
    expect(mobile?.files[0]?.content).toContain("memory only");
  });
});
