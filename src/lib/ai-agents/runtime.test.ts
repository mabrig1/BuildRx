import { describe, expect, it, vi } from "vitest";

import type { AiCompletion, AiMessage, AiProvider } from "@/lib/ai/providers/types";
import { runAgent } from "@/lib/ai-agents/runtime";

function makeProvider(
  respond: (messages: AiMessage[], call: number) => AiCompletion,
  supportsTools = true
): AiProvider {
  let call = 0;
  return {
    id: "openai",
    label: "Test Provider",
    isConfigured: () => true,
    supportsTools,
    models: () => [{ id: "test-model", label: "Test Model" }],
    defaultModel: () => "test-model",
    createCompletion: vi.fn(async (messages) => respond(messages, call++)),
    streamCompletion: vi.fn(),
  };
}

const noopSaveMemory = vi.fn().mockResolvedValue(undefined);

describe("runAgent", () => {
  it("returns the model's text immediately when no tools are called", async () => {
    const provider = makeProvider(() => ({
      text: "Hello there!",
      model: "test-model",
      usage: { promptTokens: 10, completionTokens: 5 },
    }));

    const result = await runAgent({
      provider,
      systemPrompt: "You are helpful.",
      toolIds: [],
      history: [],
      userMessage: "Hi",
      context: { agentId: "a", userId: "u" },
      saveMemory: noopSaveMemory,
    });

    expect(result.text).toBe("Hello there!");
    expect(result.steps).toEqual([]);
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
    expect(provider.createCompletion).toHaveBeenCalledTimes(1);
  });

  it("resolves a single tool call then returns the final answer", async () => {
    const provider = makeProvider((_messages, call) => {
      if (call === 0) {
        return {
          text: "",
          model: "test-model",
          usage: { promptTokens: 20, completionTokens: 5 },
          toolCalls: [{ id: "call_1", name: "calculator", arguments: { expression: "2+2" } }],
        };
      }
      return {
        text: "2 + 2 is 4.",
        model: "test-model",
        usage: { promptTokens: 30, completionTokens: 8 },
      };
    });

    const result = await runAgent({
      provider,
      systemPrompt: "You are helpful.",
      toolIds: ["calculator"],
      history: [],
      userMessage: "What is 2+2?",
      context: { agentId: "a", userId: "u" },
      saveMemory: noopSaveMemory,
    });

    expect(result.text).toBe("2 + 2 is 4.");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ name: "calculator", result: "4" });
    // Usage accumulates across both calls in the loop.
    expect(result.usage).toEqual({ promptTokens: 50, completionTokens: 13 });
    expect(provider.createCompletion).toHaveBeenCalledTimes(2);
  });

  it("reports an error result for a tool the agent doesn't have enabled", async () => {
    const provider = makeProvider((_messages, call) => {
      if (call === 0) {
        return {
          text: "",
          model: "test-model",
          usage: { promptTokens: 0, completionTokens: 0 },
          toolCalls: [{ id: "call_1", name: "calculator", arguments: { expression: "1+1" } }],
        };
      }
      return { text: "done", model: "test-model", usage: { promptTokens: 0, completionTokens: 0 } };
    });

    const result = await runAgent({
      provider,
      systemPrompt: "You are helpful.",
      toolIds: [], // calculator not enabled
      history: [],
      userMessage: "2+2?",
      context: { agentId: "a", userId: "u" },
      saveMemory: noopSaveMemory,
    });

    expect(result.steps[0].result).toMatch(/isn't enabled/);
  });

  it("never sends tools to a provider that doesn't support them", async () => {
    const provider = makeProvider(() => ({
      text: "ok",
      model: "test-model",
      usage: { promptTokens: 0, completionTokens: 0 },
    }), /* supportsTools */ false);

    await runAgent({
      provider,
      systemPrompt: "sys",
      toolIds: ["calculator", "get_current_time"],
      history: [],
      userMessage: "hi",
      context: { agentId: "a", userId: "u" },
      saveMemory: noopSaveMemory,
    });

    const options = (provider.createCompletion as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(options.tools).toBeUndefined();
  });

  it("stops after the iteration cap instead of looping forever", async () => {
    const provider = makeProvider(() => ({
      text: "",
      model: "test-model",
      usage: { promptTokens: 1, completionTokens: 1 },
      toolCalls: [{ id: "call_x", name: "get_current_time", arguments: {} }],
    }));

    const result = await runAgent({
      provider,
      systemPrompt: "sys",
      toolIds: ["get_current_time"],
      history: [],
      userMessage: "loop forever",
      context: { agentId: "a", userId: "u" },
      saveMemory: noopSaveMemory,
    });

    // MAX_TOOL_ITERATIONS = 4, one tool call recorded per iteration.
    expect(provider.createCompletion).toHaveBeenCalledTimes(4);
    expect(result.steps).toHaveLength(4);
    expect(result.text).toMatch(/couldn't reach a final answer/);
  });

  it("calls remember_fact's saveMemory with the run's context", async () => {
    const provider = makeProvider((_messages, call) => {
      if (call === 0) {
        return {
          text: "",
          model: "test-model",
          usage: { promptTokens: 0, completionTokens: 0 },
          toolCalls: [{ id: "call_1", name: "remember_fact", arguments: { fact: "likes cats" } }],
        };
      }
      return { text: "noted", model: "test-model", usage: { promptTokens: 0, completionTokens: 0 } };
    });
    const saveMemory = vi.fn().mockResolvedValue(undefined);

    await runAgent({
      provider,
      systemPrompt: "sys",
      toolIds: ["remember_fact"],
      history: [],
      userMessage: "I like cats",
      context: { agentId: "agent-9", userId: "user-9" },
      saveMemory,
    });

    expect(saveMemory).toHaveBeenCalledWith(
      { agentId: "agent-9", userId: "user-9" },
      "likes cats"
    );
  });
});
