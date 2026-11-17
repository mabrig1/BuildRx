import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const streamed = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/openrouter", () => ({
  isOpenRouterConfigured: () => true,
  openrouterStrongModel: () => "paid/large",
  openrouterModel: () => "paid/cheap",
  streamChatCompletion: streamed,
}));
vi.mock("@/lib/ai/nvidia", () => ({
  isNvidiaConfigured: () => false,
  nvidiaGlmModel: () => "vendor/primary",
  nvidiaChatModel: () => "vendor/fast",
  nvidiaLlamaModel: () => "vendor/lite",
  streamChatCompletion: vi.fn(),
}));

import { completeText, availableProviders } from "./provider";

const messages = [{ role: "user" as const, content: "Generate my delivery app" }];
const reply = (model: string) => ({
  model,
  stream: new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode("Generated app files")); controller.close(); },
  }),
  completion: Promise.resolve({
    text: "Generated app files", reasoning: "",
    usage: { promptTokens: 10, completionTokens: 12 }, model,
  }),
});

beforeEach(() => {
  streamed.mockReset();
  vi.stubEnv("OPENROUTER_FREE_FALLBACK", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("BuildRx OpenRouter credit failover", () => {
  it("includes an explicitly free model route behind the paid tiers", () => {
    expect(availableProviders()).toEqual([
      "openrouter-primary", "openrouter-fast", "openrouter-free",
    ]);
  });
  it("skips a redundant paid request after HTTP 402 and uses the no-charge router", async () => {
    streamed.mockImplementation(async (_m: unknown, opts: { model: string }) => {
      if (opts.model === "paid/large") throw new Error("OpenRouter 402: insufficient available credit or a key/in-flight spending limit.");
      if (opts.model === "paid/cheap") throw new Error("Duplicate paid attempt should be skipped");
      return reply(opts.model);
    });
    const answer = await completeText(messages, { maxTokens: 4000, timeoutMs: 120_000 });
    expect(answer.provider).toBe("openrouter-free");
    expect(answer.model).toBe("openrouter/free");
    expect(streamed.mock.calls.map(call => call[1].model)).toEqual(["paid/large", "openrouter/free"]);
  });
  it("tries the second paid model when the first is only rate-limited", async () => {
    streamed.mockImplementationOnce(async () => { throw new Error("OpenRouter rate limit 429"); });
    streamed.mockImplementationOnce(async (_m: unknown, opts: { model: string }) => reply(opts.model));
    const answer = await completeText(messages, { maxTokens: 1200, timeoutMs: 120_000 });
    expect(answer.provider).toBe("openrouter-fast");
    expect(streamed.mock.calls.map(call => call[1].model)).toEqual(["paid/large", "paid/cheap"]);
  });
  it("allows operators to opt out of unspecified free-model routing", async () => {
    vi.stubEnv("OPENROUTER_FREE_FALLBACK", "false");
    streamed.mockRejectedValue(new Error("OpenRouter 402: insufficient available credit"));
    await expect(completeText(messages, { timeoutMs: 120_000 })).rejects.toThrow("Tried 1");
    expect(streamed).toHaveBeenCalledTimes(1);
  });
  it("does not claim a model generated code when free model is also unavailable", async () => {
    streamed.mockRejectedValue(new Error("OpenRouter 402: insufficient available credit"));
    await expect(completeText(messages, { timeoutMs: 120_000 })).rejects.toThrow(/All AI providers failed/);
    expect(streamed.mock.calls.map(call => call[1].model)).toEqual(["paid/large", "openrouter/free"]);
  });
});
