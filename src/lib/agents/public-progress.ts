import type { AgentEvent, AgentName } from "@/lib/agents/types";

/**
 * Allowlisted progress events for ordinary customers. Never forward provider
 * error bodies, model settings, usage limits or secret-bearing diagnostics.
 */
export const CUSTOMER_BUILD_STAGES: Record<AgentName, string> = {
  planner: "Understanding your app idea",
  founder_ops: "Preparing the app blueprint",
  architect: "Organizing the app structure",
  ui: "Designing your screens",
  database: "Preparing your data",
  coding: "Creating app features",
  debug: "Checking the app",
  security: "Checking safety",
  qa: "Testing the result",
  repair: "Improving the result",
  deployment: "Saving your preview",
};

function customerFallbackMessage(code: string): string {
  switch (code) {
    case "AI_NOT_CONFIGURED":
      return "AI generation is currently unavailable. This build is using starter components rather than fully generated features.";
    case "AI_NO_CREDIT":
    case "AI_PROVIDER_BILLING":
      return "AI generation capacity is limited. Some features may use starter components.";
    default:
      return "This step could not fully generate its features. BuildRx used available fallback components.";
  }
}

export function toCustomerBuildEvent(event: AgentEvent): AgentEvent {
  switch (event.type) {
    case "agent_start":
      return { type: "agent_start", agent: event.agent, message: `${CUSTOMER_BUILD_STAGES[event.agent]}…` };
    case "agent_log":
      return { type: "agent_log", agent: event.agent, message: "Working on this step…" };
    case "agent_complete":
      return { type: "agent_complete", agent: event.agent, message: "Step completed." };
    case "agent_degraded":
      return {
        type: "agent_degraded",
        ...(event.agent ? { agent: event.agent } : {}),
        code: event.code,
        cause: "",
        message: customerFallbackMessage(event.code),
        suggestedFix: event.retryable
          ? "Review the available preview and retry the unfinished features."
          : "Review the available preview. Contact BuildRx support if full generation remains unavailable.",
        retryable: event.retryable,
      };
    case "error":
      return {
        type: "error",
        ...(event.agent ? { agent: event.agent } : {}),
        code: event.code,
        message: event.agent
          ? "This step needs attention. BuildRx will finish its checks before marking the app ready."
          : "BuildRx could not finish this build. Your project is not yet verified.",
        suggestedFix: "Retry the build or contact BuildRx support if the problem continues.",
      };
    case "verification":
      return {
        type: "verification",
        agent: event.agent,
        items: event.items.map(({ label, status }) => ({
          label,
          status,
          ...(status !== "pass" ? { detail: "Needs review before release." } : {}),
        })),
      };
    default:
      return event;
  }
}
