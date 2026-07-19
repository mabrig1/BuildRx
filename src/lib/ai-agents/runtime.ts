/**
 * Agent runtime — resolves a user turn against a configured provider,
 * running the tool-call loop (call model -> execute any requested tools
 * -> call model again with the results) until the model returns a plain
 * text answer or a safety cap is hit.
 *
 * Deliberately non-streaming: reliably parsing partial tool-call JSON
 * out of a token stream is a materially harder problem than this phase
 * needs, and a full tool trace is arguably more useful to show the user
 * than a live-typed answer would be anyway. The final answer still
 * arrives in one response with a `steps` trace of everything the agent
 * did along the way.
 */

import type { AiMessage, AiProvider, AiUsage } from "@/lib/ai/providers/types";
import { createToolRegistry, type ToolContext } from "@/lib/ai-agents/tools";

const MAX_TOOL_ITERATIONS = 4;

export interface AgentStep {
  type: "tool_call";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: string;
}

export interface AgentRunResult {
  text: string;
  steps: AgentStep[];
  usage: AiUsage;
  model: string;
}

export async function runAgent({
  provider,
  model,
  systemPrompt,
  toolIds,
  history,
  userMessage,
  context,
  saveMemory,
}: {
  /** Resolved provider adapter — callers get it from the registry (`getProvider`). */
  provider: AiProvider;
  model?: string;
  systemPrompt: string;
  toolIds: string[];
  history: AiMessage[];
  userMessage: string;
  context: ToolContext;
  saveMemory: (context: ToolContext, content: string) => Promise<void>;
}): Promise<AgentRunResult> {
  const registry = createToolRegistry(saveMemory);
  const enabledTools = toolIds
    .map((id) => registry[id])
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));
  // Only tools the agent owner actually enabled are callable — even if
  // the model requests one outside that set (hallucinated or a stale
  // tool list from earlier in a long conversation), it must not run.
  const enabledByName = new Map(enabledTools.map((tool) => [tool.name, tool]));

  const messages: AiMessage[] = [...history, { role: "user", content: userMessage }];
  const steps: AgentStep[] = [];
  const usage: AiUsage = { promptTokens: 0, completionTokens: 0 };
  let resolvedModel = model ?? provider.defaultModel();

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const result = await provider.createCompletion(messages, {
      model,
      system: systemPrompt,
      maxTokens: 2048,
      tools:
        provider.supportsTools && enabledTools.length > 0
          ? enabledTools.map(({ name, description, parameters }) => ({
              name,
              description,
              parameters,
            }))
          : undefined,
    });

    usage.promptTokens += result.usage.promptTokens;
    usage.completionTokens += result.usage.completionTokens;
    resolvedModel = result.model;

    if (!result.toolCalls || result.toolCalls.length === 0) {
      return { text: result.text, steps, usage, model: resolvedModel };
    }

    messages.push({ role: "assistant", content: result.text, toolCalls: result.toolCalls });

    for (const call of result.toolCalls) {
      const tool = enabledByName.get(call.name);
      const output = tool
        ? await tool.execute(call.arguments, context).catch(
            (error) => `Error running ${call.name}: ${error instanceof Error ? error.message : "unknown error"}`
          )
        : `Error: tool "${call.name}" isn't enabled for this agent.`;

      steps.push({ type: "tool_call", id: call.id, name: call.name, arguments: call.arguments, result: output });
      messages.push({ role: "tool", content: output, toolCallId: call.id, name: call.name });
    }
  }

  return {
    text: "I made several tool calls but couldn't reach a final answer — here's what I found along the way.",
    steps,
    usage,
    model: resolvedModel,
  };
}
