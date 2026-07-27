import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `validModelId` keeps a module-level Set of already-reported variable
 * names so a bad value is logged once per process. Every test that cares
 * about logging therefore needs a fresh module instance.
 */
async function freshModule() {
  vi.resetModules();
  return import("@/lib/ai/nvidia");
}

describe("validModelId", () => {
  it("accepts well-formed vendor/model ids", async () => {
    const { validModelId } = await freshModule();
    for (const id of [
      "z-ai/glm-5.2",
      "poolside/laguna-xs-2.1",
      "stepfun-ai/step-3.7-flash",
      "meta/llama-3.1-8b-instruct",
      "qwen/qwen2.5-coder-32b-instruct",
      "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      "openai/gpt-oss-120b",
    ]) {
      expect(validModelId(id)).toBe(id);
    }
  });

  it("trims surrounding whitespace and newlines", async () => {
    const { validModelId } = await freshModule();
    expect(validModelId("  z-ai/glm-5.2\n")).toBe("z-ai/glm-5.2");
  });

  it("returns undefined for unset or blank values", async () => {
    const { validModelId } = await freshModule();
    expect(validModelId(undefined)).toBeUndefined();
    expect(validModelId("")).toBeUndefined();
    expect(validModelId("   ")).toBeUndefined();
    expect(validModelId("\n\t")).toBeUndefined();
  });

  describe("rejects values that look like credentials", () => {
    it.each([
      ["NVIDIA key prefix", "nvapi-abc123def456ghi789jkl"],
      ["uppercase key prefix", "NVAPI-abc123def456ghi789jkl"],
      ["bearer header", "Bearer sk-abc123"],
      ["over 120 characters", `vendor/${"m".repeat(120)}`],
    ])("%s", async (_label, value) => {
      const { validModelId } = await freshModule();
      expect(validModelId(value)).toBeUndefined();
    });
  });

  describe("rejects malformed model ids", () => {
    it.each([
      ["no slash", "glm-5.2"],
      ["leading slash", "/glm-5.2"],
      ["trailing slash", "z-ai/"],
      ["leading punctuation", "-ai/glm"],
      ["whitespace inside", "z ai/glm"],
      ["a URL", "https://integrate.api.nvidia.com/v1"],
    ])("%s", async (_label, value) => {
      const { validModelId } = await freshModule();
      expect(validModelId(value)).toBeUndefined();
    });
  });

  describe("reporting a rejected variable", () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it("never logs the value — only the variable name", async () => {
      const { validModelId } = await freshModule();
      const secret = "nvapi-supersecretkeymaterial123456";

      validModelId(secret, "NVIDIA_MODEL_KIMI");

      expect(consoleError).toHaveBeenCalledOnce();
      const logged = consoleError.mock.calls[0].join(" ");
      expect(logged).toContain("NVIDIA_MODEL_KIMI");
      expect(logged).not.toContain(secret);
      expect(logged).not.toContain("nvapi-");
    });

    it("logs once per variable, not once per call", async () => {
      const { validModelId } = await freshModule();

      validModelId("bad", "NVIDIA_MODEL_KIMI");
      validModelId("also-bad", "NVIDIA_MODEL_KIMI");
      validModelId("bad", "NVIDIA_MODEL_DEEPSEEK_PRO");

      expect(consoleError).toHaveBeenCalledTimes(2);
    });

    it("stays silent when no variable name is supplied", async () => {
      const { validModelId } = await freshModule();
      validModelId("bad");
      expect(consoleError).not.toHaveBeenCalled();
    });
  });
});

describe("rejectedModelVars", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("is empty when every model variable is unset", async () => {
    const { MODEL_ENV_VARS, rejectedModelVars } = await freshModule();
    for (const name of MODEL_ENV_VARS) delete process.env[name];
    expect(rejectedModelVars()).toEqual([]);
  });

  it("is empty when every model variable is well-formed", async () => {
    const { rejectedModelVars } = await freshModule();
    process.env.NVIDIA_TEXT_MODEL = "z-ai/glm-5.2";
    process.env.NVIDIA_MODEL_KIMI = "openai/gpt-oss-20b";
    expect(rejectedModelVars()).toEqual([]);
  });

  it("names exactly the variables holding malformed values", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { MODEL_ENV_VARS, rejectedModelVars } = await freshModule();
    for (const name of MODEL_ENV_VARS) delete process.env[name];

    process.env.NVIDIA_TEXT_MODEL = "z-ai/glm-5.2";
    process.env.NVIDIA_MODEL_KIMI = "nvapi-akeypastedintothewrongbox123";
    process.env.NVIDIA_CODE_MODEL = "not-a-model-id";

    expect(rejectedModelVars().sort()).toEqual([
      "NVIDIA_CODE_MODEL",
      "NVIDIA_MODEL_KIMI",
    ]);
  });
});

describe("nvidiaBaseUrl", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("falls back to the NIM default", async () => {
    const { nvidiaBaseUrl } = await freshModule();
    delete process.env.NVIDIA_API_BASE_URL;
    delete process.env.NVIDIA_BASE_URL;
    expect(nvidiaBaseUrl()).toBe("https://integrate.api.nvidia.com/v1");
  });

  it("prefers NVIDIA_API_BASE_URL over NVIDIA_BASE_URL", async () => {
    const { nvidiaBaseUrl } = await freshModule();
    process.env.NVIDIA_API_BASE_URL = "https://a.example/v1";
    process.env.NVIDIA_BASE_URL = "https://b.example/v1";
    expect(nvidiaBaseUrl()).toBe("https://a.example/v1");
  });

  it("strips a trailing slash so path joins never double up", async () => {
    const { nvidiaBaseUrl } = await freshModule();
    process.env.NVIDIA_API_BASE_URL = "https://a.example/v1/";
    expect(nvidiaBaseUrl()).toBe("https://a.example/v1");
  });

  it("ignores a whitespace-only override", async () => {
    const { nvidiaBaseUrl } = await freshModule();
    process.env.NVIDIA_API_BASE_URL = "   ";
    delete process.env.NVIDIA_BASE_URL;
    expect(nvidiaBaseUrl()).toBe("https://integrate.api.nvidia.com/v1");
  });
});

describe("listAvailableModels", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it("returns an empty list when no API key is configured", async () => {
    const { listAvailableModels } = await freshModule();
    delete process.env.NVIDIA_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await listAvailableModels()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns sorted ids from the catalog", async () => {
    const { listAvailableModels } = await freshModule();
    process.env.NVIDIA_API_KEY = "nvapi-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "z-ai/glm-5.2" }, { id: "openai/gpt-oss-20b" }],
        }),
      })
    );

    expect(await listAvailableModels()).toEqual([
      "openai/gpt-oss-20b",
      "z-ai/glm-5.2",
    ]);
  });

  it("drops entries without a string id", async () => {
    const { listAvailableModels } = await freshModule();
    process.env.NVIDIA_API_KEY = "nvapi-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "z-ai/glm-5.2" }, { id: 42 }, {}, null],
        }),
      })
    );

    expect(await listAvailableModels()).toEqual(["z-ai/glm-5.2"]);
  });

  /**
   * The catalog is an optimisation, never a dependency: any failure must
   * degrade to "no catalog" so model resolution falls back to its static
   * answer instead of throwing mid-build.
   */
  describe("degrades to an empty list rather than throwing", () => {
    beforeEach(() => {
      process.env.NVIDIA_API_KEY = "nvapi-test";
    });

    it("on a non-OK response", async () => {
      const { listAvailableModels } = await freshModule();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 })
      );
      expect(await listAvailableModels()).toEqual([]);
    });

    it("on a network error", async () => {
      const { listAvailableModels } = await freshModule();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
      expect(await listAvailableModels()).toEqual([]);
    });

    it("on an unexpected payload shape", async () => {
      const { listAvailableModels } = await freshModule();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
      );
      expect(await listAvailableModels()).toEqual([]);
    });
  });
});

// ------------------------------------------------------------------
// Streaming: reasoning models emit `reasoning_content` before (or
// instead of) `content`. Dropping it is what silently turned generated
// apps into built-in scaffolds.
// ------------------------------------------------------------------

/** A Response whose body streams the given SSE lines. */
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

describe("streamChatCompletion", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.NVIDIA_API_KEY = "nvapi-test";
  });

  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("streams content deltas and reports them as the text", async () => {
    const { streamChatCompletion } = await freshModule();
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
    const done = await completion;
    expect(done.text).toBe("Hello world");
    expect(done.reasoning).toBe("");
  });

  it("collects reasoning_content without streaming it to the caller", async () => {
    // The user asked for an answer, not a transcript of the thinking.
    const { streamChatCompletion } = await freshModule();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          '{"choices":[{"delta":{"reasoning_content":"Let me think. "}}]}',
          '{"choices":[{"delta":{"reasoning_content":"Maybe X. "}}]}',
          '{"choices":[{"delta":{"content":"The answer is X."}}]}',
        ])
      )
    );

    const { stream, completion } = await streamChatCompletion([
      { role: "user", content: "hi" },
    ]);

    expect(await drain(stream)).toBe("The answer is X.");
    const done = await completion;
    expect(done.text).toBe("The answer is X.");
    expect(done.reasoning).toBe("Let me think. Maybe X. ");
  });

  /**
   * The exact failure that made every agent fall back to a scaffold: a
   * reasoning model that spends its whole budget thinking emits no
   * `content` at all. Before this was captured, the call looked
   * indistinguishable from a dead endpoint.
   */
  it("keeps the reasoning when the model never emits any content", async () => {
    const { streamChatCompletion } = await freshModule();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          '{"choices":[{"delta":{"reasoning_content":"===FILE: a.ts===\\nx\\n===END==="}}]}',
        ])
      )
    );

    const { stream, completion } = await streamChatCompletion([
      { role: "user", content: "hi" },
    ]);

    expect(await drain(stream)).toBe("");
    const done = await completion;
    expect(done.text).toBe("");
    expect(done.reasoning).toContain("===FILE: a.ts===");
  });

  it("ignores malformed keep-alive lines", async () => {
    const { streamChatCompletion } = await freshModule();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          "not json",
          '{"choices":[{"delta":{"content":"ok"}}]}',
        ])
      )
    );

    const { stream, completion } = await streamChatCompletion([
      { role: "user", content: "hi" },
    ]);

    expect(await drain(stream)).toBe("ok");
    expect((await completion).text).toBe("ok");
  });

  it("reports token usage from the final chunk", async () => {
    const { streamChatCompletion } = await freshModule();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          '{"choices":[{"delta":{"content":"ok"}}]}',
          '{"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3}}',
        ])
      )
    );

    const { stream, completion } = await streamChatCompletion([
      { role: "user", content: "hi" },
    ]);
    await drain(stream);

    expect((await completion).usage).toEqual({
      promptTokens: 12,
      completionTokens: 3,
    });
  });
});
