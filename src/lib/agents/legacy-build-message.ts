/**
 * Legacy BuildRx builds stored raw provider diagnostics in assistant chat content.
 * Only treat recognizable multi-stage build transcripts as internal reports;
 * do not change the user's normal chat messages or erase stored audit history.
 */
export function customerVisibleAssistantMessage(content: string): string {
  const agentStages = content.match(/\b(?:Planner|FounderOps|Architect|UI|Database|Coding|Debugging|Security|QA\/?Test|Repair|Deployment) Agent\b/gi) ?? [];
  const hasInternalDetails = /OpenRouter|OPENROUTER_MODEL|NVIDIA_API_KEY|AI providers failed|provider credit balance|max.tokens|requested up to \d+ tokens|\bWhy:\s/i.test(content);
  // Never redact ordinary explanatory messages just because one agent is mentioned.
  if (agentStages.length < 2 || !hasInternalDetails) return content;

  const failed = /Verification failed|failed verification|coding used a fallback|not certified|essential generation.*fallback|\b(?:❌|x)\s*Verification/i.test(content);
  const heading = failed ? "Previous build needs attention" : "Previous build report";
  const state = failed
    ? "This build did not pass all required checks. Its preview may contain starter or demonstration components rather than a fully functioning application."
    : "This earlier build includes internal service diagnostics. Review the available preview and verify the app before publishing.";

  return [
    `⚠️ **${heading}**`,
    state,
    "Internal AI-provider logs are no longer displayed in the customer workspace.",
    "Use **Retry build** for unfinished features once AI generation is available, or contact BuildRx support.",
  ].join("\n\n");
}
