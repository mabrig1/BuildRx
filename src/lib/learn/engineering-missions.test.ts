import { describe, expect, it } from "vitest";
import { getTrainingLab, TRAINING_TRACKS } from "@/lib/learn/labs";
import { getPlaygroundExercise } from "@/lib/learn/playground-exercises";
import {
  ENGINEERING_MISSIONS, ENGINEERING_STAGES, engineeringPrompt, missionById,
  nextEngineeringStep, passedEngineeringSteps, safeEngineeringProgress,
} from "./engineering-missions";

describe("BuildRx interactive engineering missions", () => {
  it("provides four cross-track missions with five unique scored decisions", () => {
    expect(ENGINEERING_MISSIONS).toHaveLength(4);
    expect(new Set(ENGINEERING_MISSIONS.map(m => m.id)).size).toBe(4);
    expect(ENGINEERING_STAGES).toHaveLength(5);
    expect(new Set(ENGINEERING_MISSIONS.map(m => m.trackId)).size).toBe(4);
    for (const mission of ENGINEERING_MISSIONS) {
      expect(TRAINING_TRACKS.some(t => t.id === mission.trackId)).toBe(true);
      expect(getTrainingLab(mission.labId)?.trackId).toBe(mission.trackId);
      expect(getPlaygroundExercise(mission.exerciseId)?.trackId).toBe(mission.trackId);
      expect(mission.decisions).toHaveLength(ENGINEERING_STAGES.length);
      for (const decision of mission.decisions) {
        expect(decision.choices).toHaveLength(3);
        expect(decision.choices[decision.correctIndex].length).toBeGreaterThan(15);
        expect(decision.explanation).not.toBe("");
        expect(decision.retryHint).not.toBe("");
      }
    }
  });
  it("enforces complete, correct-only local progress without accepting fabricated keys", () => {
    const mission = ENGINEERING_MISSIONS[0];
    const answers = mission.decisions.map(q => q.correctIndex);
    const safe = safeEngineeringProgress({ [mission.id]: answers, wrong: [0, 0] });
    expect(safe.wrong).toBeUndefined();
    expect(passedEngineeringSteps(mission, safe)).toBe(5);
    expect(nextEngineeringStep(mission, safe)).toBe(4);
    const oneWrong = safeEngineeringProgress({ [mission.id]: [42, ...answers.slice(1)] });
    expect(passedEngineeringSteps(mission, oneWrong)).toBe(4);
    expect(nextEngineeringStep(mission, oneWrong)).toBe(0);
    expect(safeEngineeringProgress([])).toEqual({});
    expect(safeEngineeringProgress("nope")).toEqual({});
    expect(missionById("not-a-mission")).toBeUndefined();
  });
  it("builds a realistic bounded prompt without leaking results or deploying", () => {
    const text = engineeringPrompt(ENGINEERING_MISSIONS[1], "Extra detail ".repeat(100));
    expect(text).toContain("Requirements:");
    expect(text).toContain("Acceptance tests:");
    expect(text).toContain("explicit human approval");
    expect(text.length).toBeLessThan(3500);
  });
});
