import { getTrainingLab } from "@/lib/learn/labs";
import { checksForLab, gradeLabKnowledge } from "@/lib/learn/lab-mastery";

export const LAB_MASTERY_STORAGE_KEY = "buildrx-lab-mastery-v1";
export const LAB_REFLECTION_LIMIT = 500;
export const LAB_EVIDENCE_NOTE_LIMIT = 350;
export interface LabMasteryRecord {
  attempts: number;
  bestCorrect: number;
  reflection: string;
  evidenceNote: string;
}
export type LabMasteryProgress = Record<string, LabMasteryRecord>;

export function emptyLabMasteryRecord(): LabMasteryRecord {
  return { attempts: 0, bestCorrect: 0, reflection: "", evidenceNote: "" };
}

/** Storage is local and untrusted; do not treat it as certified assessment evidence. */
export function readLabMasteryProgress(raw: unknown): LabMasteryProgress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const output: LabMasteryProgress = {};
  for (const [labId, value] of Object.entries(raw)) {
    if (!getTrainingLab(labId) || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const item = value as Record<string, unknown>;
    const attempts = Number.isInteger(item.attempts) && typeof item.attempts === "number"
      ? Math.min(Math.max(item.attempts, 0), 10000) : 0;
    const total = checksForLab(labId).length;
    const bestCorrect = Number.isInteger(item.bestCorrect) && typeof item.bestCorrect === "number"
      ? Math.min(Math.max(item.bestCorrect, 0), total) : 0;
    output[labId] = {
      attempts, bestCorrect,
      reflection: typeof item.reflection === "string" ? item.reflection.slice(0, LAB_REFLECTION_LIMIT) : "",
      evidenceNote: typeof item.evidenceNote === "string" ? item.evidenceNote.slice(0, LAB_EVIDENCE_NOTE_LIMIT) : "",
    };
  }
  return output;
}

/** Heuristic only; do not add sensitive information to training notes at all. */
export function containsLikelyPrivateValue(input: string): boolean {
  return /(?:github_pat_|ghp_[a-z0-9]{12,}|mongodb(?:\+srv)?:\/\/|\bBearer\s+[a-z\d_-]{12,}|(?:sk-|nvapi-)[a-z\d_-]{12,}|-----BEGIN\s+(?:RSA|OPENSSH|EC)?\s*PRIVATE KEY-----|\b(?:api[_-]?key|password|client_secret)\s*[:=]\s*[^\s]+)/i.test(input);
}

export function recordKnowledgeAttempt(
  labId: string,
  previous: LabMasteryRecord,
  answers: Readonly<Record<string, number>>,
): LabMasteryRecord {
  const grade = gradeLabKnowledge(labId, answers);
  if (grade.total === 0 || grade.answered !== grade.total) return previous;
  return {
    ...previous,
    attempts: Math.min(previous.attempts + 1, 10000),
    bestCorrect: Math.max(previous.bestCorrect, grade.correct),
  };
}
export function passedKnowledgeCheck(labId: string, record?: LabMasteryRecord): boolean {
  const total = checksForLab(labId).length;
  return !!record && total > 0 && record.bestCorrect === total;
}
