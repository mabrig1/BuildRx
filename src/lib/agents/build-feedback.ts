import { z } from "zod";

export const feedbackInputSchema = z.object({
  projectId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().min(8).max(800),
  runId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
}).strict();

export type BuildFeedbackInput = z.infer<typeof feedbackInputSchema>;

/** Fail closed on common credentials: feedback must not become a secret store. */
const CREDENTIAL_PATTERNS = [
  /\b(?:sk-|nvapi-|ghp_|gho_|github_pat_)[A-Za-z0-9_-]{12,}/i,
  /\b(?:bearer\s+)[A-Za-z0-9_.-]{16,}/i,
  /\b(?:api[_ -]?key|password|secret[_ -]?key)\s*[:=]\s*\S{10,}/i,
  /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{15,}/,
];

export function containsCredential(note: string): boolean {
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(note));
}

/** Explicit opt-in: a human chooses to add feedback to the next build prompt. */
export function appendApprovedFeedback(prompt: string, note: string): string {
  const clean = note.trim();
  if (!clean || containsCredential(clean)) return prompt;
  return [
    prompt.trim(),
    "",
    "USER-APPROVED FEEDBACK FOR THIS REBUILD:",
    clean.slice(0, 800),
    "",
    "Retain every previously working user workflow and fix the reported issue.",
  ].join("\n");
}
