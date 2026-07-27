import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const streamChatCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/nvidia", () => ({
  isNvidiaConfigured: () => true,
  nvidiaGlmModel: () => "vendor/primary",
  nvidiaChatModel: () => "vendor/fast",
  nvidiaLlamaModel: () => "vendor/lite",
  streamChatCompletion,
}));

import { completeText } from "@/lib/ai/provider";

/** A successful streamed answer from `model`. */
function answers(text: string, model: string) {
  const encoder = new TextEncoder();
  return {
    model,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    completion: Promise.resolve({
      text,
      reasoning: "",
      usage: { promptTokens: 0, completionTokens: 0 },
      model,
    }),
  };
}

const timeout = () =>
  Promise.reject(new Error("The operation was aborted due to timeout"));

const MESSAGES = [{ role: "user" as const, content: "hi" }];

/** Awaits a call expected to reject and hands back the error. */
async function failure(promise: Promise<unknown>): Promise<Error> {
  let caught: unknown;
  let resolved = false;
  try {
    await promise;
    resolved = true;
  } catch (error) {
    caught = error;
  }
  if (resolved) throw new Error("expected the call to fail, but it resolved");
  return caught as Error;
}

beforeEach(() => {
  streamChatCompletion.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("completeText fallback chain", () => {
  it("returns the first model's answer when it succeeds", async () => {
    streamChatCompletion.mockImplementation(() =>
      Promise.resolve(answers("primary answer", "vendor/primary"))
    );

    const result = await completeText(MESSAGES, { timeoutMs: 90_000 });

    expect(result.text).toBe("primary answer");
    expect(result.provider).toBe("nvidia-primary");
    expect(streamChatCompletion).toHaveBeenCalledOnce();
  });

  /**
   * The chain used to break out on any timeout, on the theory that a slow
   * endpoint is slow for every model on it. A single build disproved
   * that — qwen2.5-coder answered while gpt-oss-20b timed out, same
   * endpoint, same minute — and the early exit meant the working model
   * behind it was never asked.
   */
  it("keeps going after a timeout instead of giving up", async () => {
    streamChatCompletion
      .mockImplementationOnce(timeout)
      .mockImplementationOnce(() =>
        Promise.resolve(answers("fallback answer", "vendor/fast"))
      );

    const result = await completeText(MESSAGES, { timeoutMs: 90_000 });

    expect(result.text).toBe("fallback answer");
    expect(result.provider).toBe("nvidia-fast");
    expect(streamChatCompletion).toHaveBeenCalledTimes(2);
  });

  it("reaches the third tier when the first two time out", async () => {
    streamChatCompletion
      .mockImplementationOnce(timeout)
      .mockImplementationOnce(timeout)
      .mockImplementationOnce(() =>
        Promise.resolve(answers("lite answer", "vendor/lite"))
      );

    const result = await completeText(MESSAGES, { timeoutMs: 120_000 });

    expect(result.text).toBe("lite answer");
    expect(streamChatCompletion).toHaveBeenCalledTimes(3);
  });

  it("gives the first attempt a share, not the whole budget", async () => {
    // A model that never answers must not be able to consume the step and
    // leave every later tier unreachable.
    streamChatCompletion.mockImplementation(timeout);

    await expect(
      completeText(MESSAGES, { timeoutMs: 120_000 })
    ).rejects.toThrow();

    const budgets = streamChatCompletion.mock.calls.map(
      (call) => call[1].timeoutMs
    );
    expect(budgets[0]).toBeLessThan(120_000);
    expect(streamChatCompletion.mock.calls.length).toBeGreaterThan(1);
  });
});

describe("the error a failed chain reports", () => {
  it("names only the models actually called, each with its own error", async () => {
    streamChatCompletion
      .mockImplementationOnce(() => Promise.reject(new Error("404 not found")))
      .mockImplementationOnce(() => Promise.reject(new Error("429 slow down")))
      .mockImplementationOnce(() => Promise.reject(new Error("boom")));

    const error = await failure(completeText(MESSAGES, { timeoutMs: 120_000 }));

    expect(error.message).toContain("Tried 3");
    expect(error.message).toContain("vendor/primary");
    expect(error.message).toContain("404 not found");
    expect(error.message).toContain("429 slow down");
  });

  /**
   * The old message listed the *planned* attempts, so a first tier that
   * consumed the budget still produced "Tried: …, nvidia-lite
   * (llama-3.2-1b)" — inviting the conclusion that even a 1B model could
   * not answer when it had never been asked.
   */
  it("does not claim a model was tried when it never ran", async () => {
    streamChatCompletion.mockImplementationOnce(timeout);

    // Only enough budget for the first attempt; the rest are skipped for
    // having less than MIN_ATTEMPT_MS left.
    const error = await failure(completeText(MESSAGES, { timeoutMs: 10_000 }));

    expect(streamChatCompletion).toHaveBeenCalledOnce();
    expect(error.message).toContain("Tried 1");
    expect(error.message).not.toContain("vendor/lite");
  });

  it("says so plainly when no model could be called at all", async () => {
    const error = await failure(completeText(MESSAGES, { timeoutMs: -1 }));

    expect(error.message).toMatch(/No model could be called/);
    expect(streamChatCompletion).not.toHaveBeenCalled();
  });
});
