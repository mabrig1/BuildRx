import { describe, expect, it } from "vitest";
import { PLAYGROUND_EXERCISES, getPlaygroundExercise } from "./playground-exercises";

describe("curated coding exercises", () => {
  it("has unique reviewed tasks across four engineering tracks", () => {
    expect(PLAYGROUND_EXERCISES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(PLAYGROUND_EXERCISES.map(exercise => exercise.id)).size).toBe(PLAYGROUND_EXERCISES.length);
    expect(new Set(PLAYGROUND_EXERCISES.map(exercise => exercise.trackId))).toEqual(
      new Set(["software-engineering", "systems-engineering", "fullstack-web", "mobile-app"]),
    );
  });
  it("bounds test cases, requires meaningful starter and hints", () => {
    for (const exercise of PLAYGROUND_EXERCISES) {
      expect(exercise.start.length).toBeGreaterThan(20);
      expect(exercise.hints.length).toBeGreaterThanOrEqual(2);
      if (exercise.kind === "javascript") {
        expect(exercise.functionName).toMatch(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/);
        expect(exercise.tests?.length).toBeGreaterThanOrEqual(4);
        expect(exercise.tests?.length).toBeLessThanOrEqual(8);
      } else {
        expect(exercise.checks?.length).toBeGreaterThanOrEqual(3);
        expect(exercise.checks?.every(check => Boolean(check.label && check.pattern))).toBe(true);
      }
    }
    expect(getPlaygroundExercise("no-such-exercise")).toBeUndefined();
  });
});
