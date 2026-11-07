import { MAX_AI_PROMPT_CHARACTERS } from "./limits";

export function isRepairCommand(prompt: string): boolean {
  return /^(?:repair|retry|try again|fix it|rebuild)[.!]?$/i.test(prompt.trim());
}

export function isBuildBrief(prompt: string): boolean {
  const length = prompt.trim().length;
  return length >= 10 && length <= MAX_AI_PROMPT_CHARACTERS && !isRepairCommand(prompt);
}
