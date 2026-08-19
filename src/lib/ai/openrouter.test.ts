import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isOpenRouterConfigured,
  OpenRouterApiError,
  openrouterBaseUrl,
  openrouterModel,
  openrouterStrongModel,
  streamChatCompletion,
} from "@/lib/ai/openrouter";

const savedEnv = { ...process.env };

const OPENROUTER_VARS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_MODEL",
  "OPENROUTER_MODEL_STRONG",
  "OPENROUTER_APP_NAME",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
];

beforeEach(() => {
  for (const name of OPENROUTER_VARS) delete process.env[name];
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A Response whose body streams the given SSE payloads. */
function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
  };
}

/** Awaits a call expected to reject and hands back the error. */
async function rejection(promise: Promise<unknown>): Promise<Error> {
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

async function drain(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe("configuration", () => {
  it("is unconfigured without a key", () => {
    expect(isOpenRouterConfigured()).toBe(false);
  });

  it("ignores a whitespace-only key", () => {
    process.env.OPENROUTER_API_KEY = "   ";
    expect(isOpenRouterConfigured()).toBe(false);
  });

  it("is configured with a key", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    expect(isOpenRouterConfigured()).toBe(true);
  });

  it("defaults the endpoint and strips a trailing slash", () => {
    expect(openrouterBaseUrl()).toBe("https://openrouter.ai/api/v1");
    process.env.OPENROUTER_BASE_URL = "https://proxy.example/v1/";
    expect(openrouterBaseUrl()).toBe("https://proxy.example/v1");
  });

  it("has a cheap default and a stronger one, both overridable", () => {
    expect(openrouterModel()).toBe("openai/gpt-4o-mini");
    expect(openrouterStrongModel()).toBe("openai/gpt-4o");

    process.env.OPENROUTER_MODEL = "vendor/cheap";
    process.env.OPENROUTER_MODEL_STRONG = "vendor/strong";
    expect(openrouterModel()).toBe("vendor/cheap");
    expect(openrouterStrongModel()).toBe("vendor/strong");
  });
});

describe("streamChatCompletion", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
  });

  it("refuses to call without a key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamChatCompletion([{ role: "user", content: "hi" }])
    ).rejects.toThrow(/OPENROUTER_API_KEY is not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the key as a bearer token and never in the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse(['{"choices":[{"delta":{"content":"ok"}}]}'])
      );
    vi.stubGlobal("fetch", fetchMock);

    await streamChatCompletion([{ role: "user", content: "hi" }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-or-test");
    expect(init.body).not.toContain("sk-or-test");
  });

  it("sends attribution headers, and no referer when no public URL is known", async () => {
    // A fresh Response per call: a stream can only be read once.
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        sseResponse(['{"choices":[{"delta":{"content":"ok"}}]}'])
      );
    vi.stubGlobal("fetch", fetchMock);

    await streamChatCompletion([{ role: "user", content: "hi" }]);
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      "HTTP-Referer"
    );

    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    await streamChatCompletion([{ role: "user", content: "hi" }]);
    const headers = fetchMock.mock.calls[1][1].headers;
    expect(headers["HTTP-Referer"]).toBe("https://app.example");
    expect(headers["X-Title"]).toBe("BuildRx");
  });

  it("streams content deltas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          '{"choices":[{"delta":{"content":"Hello "}}]}',
          '{"choices":[{"delta":{"content":"world"}}]}',
        ])
      )
    );

    const { stream, completion } = await streamChatCompletion([
      { role: "user", content: "hi" },
    ]);

    expect(await drain(stream)).toBe("Hello world");
    expect((await completion).text).toBe("Hello world");
  });

  it("captures OpenRouter's `reasoning` field without streaming it", async () => {
    // NVIDIA calls it reasoning_content, OpenRouter calls it reasoning.
    // Losing either is what made a whole generation look like silence.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          '{"choices":[{"delta":{"reasoning":"thinking hard"}}]}',
          '{"choices":[{"delta":{"content":"the answer"}}]}',
        ])
      )
    );

    const { stream, completion } = await streamChatCompletion([
      { role: "user", content: "hi" },
    ]);

    expect(await drain(stream)).toBe("the answer");
    const done = await completion;
    expect(done.text).toBe("the answer");
    expect(done.reasoning).toBe("thinking hard");
  });

  describe("error mapping", () => {
    it.each([
      [401, /authentication failed/i, false],
      [402, /credit balance is exhausted/i, false],
      [404, /model not found/i, false],
      [429, /rate limit/i, true],
      [503, /temporarily unavailable/i, true],
    ])("maps HTTP %i", async (status, pattern, retryable) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status,
          statusText: "error",
          json: async () => ({ error: { message: "upstream detail" } }),
        })
      );

      const error = await rejection(
        streamChatCompletion([{ role: "user", content: "hi" }])
      );

      expect(error).toBeInstanceOf(OpenRouterApiError);
      expect(error.message).toMatch(pattern);
      expect((error as OpenRouterApiError).retryable).toBe(retryable);
    });

    it("never echoes the API key in an error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: async () => ({ error: { message: "bad key sk-or-test" } }),
        })
      );

      const error = await rejection(
        streamChatCompletion([{ role: "user", content: "hi" }])
      );

      expect(error.message).not.toContain("sk-or-test");
    });
  });
});
