import { describe, expect, it } from "vitest";
import { TRAINING_LABS, TRAINING_TRACKS } from "./labs";
import {
  LAB_KNOWLEDGE_CHECKS, checksForLab, gradeLabKnowledge,
  nextLabForTrack, prerequisitesForLab,
} from "./lab-mastery";

describe("reviewed learner knowledge checks and guided progression", () => {
  it("has exactly two unique, reviewable questions per curated laboratory", () => {
    expect(LAB_KNOWLEDGE_CHECKS).toHaveLength(40);
    expect(new Set(LAB_KNOWLEDGE_CHECKS.map(q => q.id)).size).toBe(40);
    for (const lab of TRAINING_LABS) {
      const questions = checksForLab(lab.id);
      expect(questions).toHaveLength(2);
      for (const q of questions) {
        expect(q.prompt.length).toBeGreaterThan(18);
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
        expect(q.explanation.length).toBeGreaterThan(18);
      }
    }
  });

  it("evaluates correct, wrong and incomplete answers without issuing certification", () => {
    const q = checksForLab("web03");
    const full = Object.fromEntries(q.map(question => [question.id, question.correctIndex]));
    const result = gradeLabKnowledge("web03", full);
    expect(result).toMatchObject({ answered: 2, total: 2, correct: 2, passed: true });
    const partial = gradeLabKnowledge("web03", { [q[0].id]: q[0].correctIndex });
    expect(partial).toMatchObject({ answered: 1, passed: false });
    expect(gradeLabKnowledge("web03", { [q[0].id]: 99, [q[1].id]: -5 })).toMatchObject({
      answered: 0, correct: 0, passed: false,
    });
    const wrong = gradeLabKnowledge("web03", { [q[0].id]: (q[0].correctIndex+1)%4, [q[1].id]: q[1].correctIndex });
    expect(wrong).toMatchObject({ answered: 2, correct: 1, passed: false });
    expect(gradeLabKnowledge("unknown-lab", {}).passed).toBe(false);
  });

  it("offers a sensible per-track sequence but never prevents open practice", () => {
    for (const track of TRAINING_TRACKS) {
      const labs = TRAINING_LABS.filter(lab => lab.trackId === track.id);
      expect(prerequisitesForLab(labs[0].id)).toEqual([]);
      for (let i = 1; i < labs.length; i++) {
        expect(prerequisitesForLab(labs[i].id)).toEqual([labs[i-1].id]);
      }
      expect(nextLabForTrack(track.id, new Set())).toBe(labs[0].id);
      expect(nextLabForTrack(track.id, new Set([labs[0].id]))).toBe(labs[1].id);
      expect(nextLabForTrack(track.id, new Set(labs.map(lab => lab.id)))).toBeNull();
    }
    expect(prerequisitesForLab("not-real")).toEqual([]);
  });
});
