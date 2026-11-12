import { describe, expect, it } from "vitest";
import { checksForLab } from "./lab-mastery";
import {
  containsLikelyPrivateValue, emptyLabMasteryRecord,
  readLabMasteryProgress, recordKnowledgeAttempt, passedKnowledgeCheck,
  LAB_EVIDENCE_NOTE_LIMIT, LAB_REFLECTION_LIMIT,
} from "./lab-mastery-progress";

describe("non-certified browser-local lab progress", () => {
  it("safely filters malformed, unknown and oversized saved records", () => {
    expect(readLabMasteryProgress(null)).toEqual({});
    expect(readLabMasteryProgress([])).toEqual({});
    const progress = readLabMasteryProgress({
      unknown: { attempts: 9000 },
      web03: { attempts: 999999, bestCorrect: 99999,
        reflection: "x".repeat(1000), evidenceNote: "e".repeat(800) },
    });
    expect(progress).not.toHaveProperty("unknown");
    expect(progress.web03.attempts).toBe(10000);
    expect(progress.web03.bestCorrect).toBe(2);
    expect(progress.web03.reflection).toHaveLength(LAB_REFLECTION_LIMIT);
    expect(progress.web03.evidenceNote).toHaveLength(LAB_EVIDENCE_NOTE_LIMIT);
  });

  it("records attempts only after all locally answered, retains the best score", () => {
    const questions = checksForLab("se03");
    let record = emptyLabMasteryRecord();
    record = recordKnowledgeAttempt("se03", record, { [questions[0].id]: questions[0].correctIndex });
    expect(record.attempts).toBe(0);
    const wrong = Object.fromEntries(questions.map(q => [q.id, (q.correctIndex+1)%4]));
    record = recordKnowledgeAttempt("se03", record, wrong);
    expect(record).toMatchObject({ attempts: 1, bestCorrect: 0 });
    const right = Object.fromEntries(questions.map(q => [q.id, q.correctIndex]));
    record = recordKnowledgeAttempt("se03", record, right);
    expect(record).toMatchObject({ attempts: 2, bestCorrect: 2 });
    expect(passedKnowledgeCheck("se03", record)).toBe(true);
    record = recordKnowledgeAttempt("se03", record, wrong);
    expect(record).toMatchObject({ attempts: 3, bestCorrect: 2 });
    expect(passedKnowledgeCheck("unknown", record)).toBe(false);
  });

  it("checks recognizable credentials but does not claim that regex guarantees secret protection", () => {
    expect(containsLikelyPrivateValue("github_pat_abcd1234567890")).toBe(true);
    expect(containsLikelyPrivateValue("mongodb+srv://name:pass@host.local")).toBe(true);
    expect(containsLikelyPrivateValue("password=secret")).toBe(true);
    expect(containsLikelyPrivateValue("I wrote 4 tests and then verified a failing case")).toBe(false);
  });
});
