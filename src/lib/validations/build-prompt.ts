import { MAX_AI_PROMPT_CHARACTERS } from "./limits";

export function isRepairCommand(prompt: string): boolean {
  const text = prompt.trim();
  return /^(?:repair|retry|try again|fix it|rebuild)[.!]?$/i.test(text) ||
    /^(?:please\s+)?(?:fix|repair|debug|troubleshoot)\s+(?:(?:this|the|my|existing|current)\s+)?(?:app|application|project|build|preview|error|bug|issue)\b/i.test(text);
}

export function isBuildBrief(prompt: string): boolean {
  const length = prompt.trim().length;
  return length >= 10 && length <= MAX_AI_PROMPT_CHARACTERS && !isRepairCommand(prompt);
}
