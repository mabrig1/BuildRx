import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The catalog cache is module-level, so each test needs its own copy. */
async function freshModule() {
  vi.resetModules();
  return import("@/lib/ai/models");
}

/** Stubs the NVIDIA catalog with exactly these ids. */
function catalog(ids: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: ids.map((id) => ({ id })) }),
    })
  );
}

const MODEL_VARS = [
  "NVIDIA_MODEL_DEEPSEEK_PRO",
  "NVIDIA_MODEL_DEEPSEEK_FLASH",
  "NVIDIA_MODEL_MISTRAL_LARGE",
  "NVIDIA_MODEL_MISTRAL_MEDIUM",
  "NVIDIA_MODEL_KIMI",
];

const savedEnv = { ...process.env };

beforeEach(() => {
  process.env.NVIDIA_API_KEY = "nvapi-test";
  for (const name of MODEL_VARS) delete process.env[name];
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Everything the ladders can name, so nothing is filtered by the catalog. */
const FULL_CATALOG = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3-next-80b-a3b-instruct",
  "qwen/qwen2.5-coder-32b-instruct",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "mistralai/ministral-14b-instruct-2512",
  "meta/llama-3.1-8b-instruct",
  "stepfun-ai/step-3.7-flash",
  "poolside/laguna-xs-2.1",
  "z-ai/glm-5.2",
  "deepseek-ai/deepseek-r1",
];

describe("resolveModelForRole", () => {
  it("picks the strongest available candidate when the budget is generous", async () => {
    const { resolveModelForRole } = await freshModule();
    catalog(FULL_CATALOG);

    await expect(resolveModelForRole("deep-reasoning", 120_000)).resolves.toBe(
      "openai/gpt-oss-20b"
    );
  });

  it("skips candidates the key cannot call", async () => {
    const { resolveModelForRole } = await freshModule();
    catalog(["mistralai/ministral-14b-instruct-2512", "z-ai/glm-5.2"]);

    await expect(resolveModelForRole("deep-reasoning", 120_000)).resolves.toBe(
      "mistralai/ministral-14b-instruct-2512"
    );
  });

  /**
   * The planner had 39s, asked a 120B model, and got "no response within
   * 39s" — then the chain broke on the timeout before any smaller model
   * was tried, and the whole build fell back to a template.
   */
  describe("with a short step budget", () => {
    it("prefers a model that starts fast over one that reasons well", async () => {
      const { resolveModelForRole } = await freshModule();
      catalog(FULL_CATALOG);

      await expect(resolveModelForRole("deep-reasoning", 39_000)).resolves.toBe(
        "openai/gpt-oss-20b"
      );
    });

    it("never returns a very large model for a tight slice", async () => {
      const { resolveModelForRole } = await freshModule();
      catalog(FULL_CATALOG);
      const huge = ["openai/gpt-oss-120b", "qwen/qwen3-next-80b-a3b-instruct"];

      for (const role of [
        "deep-reasoning",
        "primary-coding",
        "codegen",
        "diagnostics",
        "light",
      ] as const) {
        expect(huge).not.toContain(await resolveModelForRole(role, 20_000));
      }
    });

    it("still falls back to the capability ladder when no fast model is available", async () => {
      const { resolveModelForRole } = await freshModule();
      catalog(["qwen/qwen3-next-80b-a3b-instruct"]);

      await expect(resolveModelForRole("deep-reasoning", 20_000)).resolves.toBe(
        "qwen/qwen3-next-80b-a3b-instruct"
      );
    });
  });

  it("treats an omitted budget as generous", async () => {
    const { resolveModelForRole } = await freshModule();
    catalog(FULL_CATALOG);

    await expect(resolveModelForRole("primary-coding")).resolves.toBe(
      "qwen/qwen2.5-coder-32b-instruct"
    );
  });

  it("lets an explicit env override win at any budget", async () => {
    const { resolveModelForRole } = await freshModule();
    catalog(FULL_CATALOG);
    process.env.NVIDIA_MODEL_DEEPSEEK_PRO = "vendor/my-pinned-model";

    await expect(resolveModelForRole("deep-reasoning", 5_000)).resolves.toBe(
      "vendor/my-pinned-model"
    );
  });

  it("falls back to the built-in default when the catalog is unreachable", async () => {
    const { resolveModelForRole } = await freshModule();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(resolveModelForRole("deep-reasoning", 39_000)).resolves.toBe(
      "z-ai/glm-5.2"
    );
  });

  it("fetches the catalog once for many concurrent roles", async () => {
    const { resolvedModelPlan } = await freshModule();
    catalog(FULL_CATALOG);

    await resolvedModelPlan();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});

describe("MODEL_CANDIDATES ordering", () => {
  it("never leads a role with a model that did not answer in production", async () => {
    // Evidence from a real build: 120B and 80B returned nothing within
    // the step budget; 32B and below answered. Leading with one of the
    // former breaks the fallback chain on its timeout.
    const { MODEL_CANDIDATES } = await freshModule();
    const didNotAnswer = [
      "openai/gpt-oss-120b",
      "qwen/qwen3-next-80b-a3b-instruct",
    ];

    for (const [role, ladder] of Object.entries(MODEL_CANDIDATES)) {
      expect(didNotAnswer, `${role} leads with a non-responding model`).not.toContain(
        ladder[0]
      );
    }
  });

  it("keeps the large models available as later rungs", async () => {
    // Deployments on a paid tier can serve them; they just must not lead.
    const { MODEL_CANDIDATES } = await freshModule();

    expect(MODEL_CANDIDATES["deep-reasoning"]).toContain("openai/gpt-oss-120b");
  });
});
