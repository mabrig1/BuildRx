import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canCallModel,
  degradedEvent,
  diagnoseModelFailure,
  emptyOutputFailure,
  extractJson,
  fallbackReason,
  isSafeFilePath,
  outOfTimeNote,
  parseFileBlocks,
  remainingBudgetMs,
  stepBudgetMs,
} from "@/lib/agents/llm";

// ------------------------------------------------------------------
// isSafeFilePath — the only guard between model-authored paths and both
// the project_files table and the export archive.
// ------------------------------------------------------------------

describe("isSafeFilePath", () => {
  describe("rejects unsafe paths", () => {
    it.each([
      ["empty", ""],
      ["absolute", "/etc/passwd"],
      ["absolute app path", "/src/app/page.tsx"],
      ["parent traversal", "../secrets.env"],
      ["nested traversal", "src/../../etc/passwd"],
      ["traversal mid-path", "src/app/../../../root/.ssh/id_rsa"],
      ["backslash separator", "src\\app\\page.tsx"],
      ["windows traversal", "..\\..\\windows\\system32"],
      ["NUL byte", "src/app/page.tsx\0.png"],
      ["over 200 chars", `src/${"a".repeat(200)}.ts`],
    ])("%s", (_label, input) => {
      expect(isSafeFilePath(input)).toBe(false);
    });
  });

  describe("allows the paths the pipeline actually writes", () => {
    it.each([
      ["nested source file", "src/app/page.tsx"],
      ["preview entrypoint", "preview/index.html"],
      ["root manifest", "package.json"],
      ["dotfile", ".env.example"],
      ["deeply nested", "src/components/ui/forms/date-picker.tsx"],
      ["dots in filename", "vitest.config.ts"],
      ["exactly 200 chars", `src/${"a".repeat(193)}.ts`],
    ])("%s", (_label, input) => {
      expect(isSafeFilePath(input)).toBe(true);
    });
  });

  /**
   * Documented gaps. Neither is exploitable today — writes go to a
   * `path` column and a JSZip entry, not to a host filesystem — but both
   * would become traversal the moment generated files are written to
   * disk, so pin the current answer rather than leave it undiscovered.
   */
  describe("known gaps in the current guard", () => {
    it("does not reject a Windows drive prefix", () => {
      expect(isSafeFilePath("C:/Windows/System32/config")).toBe(true);
    });

    it("does not reject percent-encoded traversal", () => {
      expect(isSafeFilePath("%2e%2e/%2e%2e/etc/passwd")).toBe(true);
    });
  });

  it("rejects a legitimate filename containing two dots", () => {
    // `..` is matched anywhere, not just as a path segment. Acceptable
    // over-rejection — asserted so the trade-off stays deliberate.
    expect(isSafeFilePath("src/data/v1..2/schema.json")).toBe(false);
  });
});

// ------------------------------------------------------------------
// parseFileBlocks — the ===FILE:/===END=== wire format
// ------------------------------------------------------------------

describe("parseFileBlocks", () => {
  it("parses a single block", () => {
    const text = `===FILE: src/app/page.tsx===
export default function Page() {
  return <main>hi</main>;
}
===END===`;
    expect(parseFileBlocks(text)).toEqual([
      {
        path: "src/app/page.tsx",
        content: "export default function Page() {\n  return <main>hi</main>;\n}",
      },
    ]);
  });

  it("parses consecutive blocks", () => {
    const text = `===FILE: a.ts===
const a = 1;
===END===
===FILE: b.ts===
const b = 2;
===END===`;
    expect(parseFileBlocks(text).map((f) => f.path)).toEqual(["a.ts", "b.ts"]);
  });

  it("ignores prose surrounding the blocks", () => {
    const text = `Here is the file you asked for:

===FILE: a.ts===
const a = 1;
===END===

Let me know if you need changes.`;
    const files = parseFileBlocks(text);
    expect(files).toHaveLength(1);
    expect(files[0].content).toBe("const a = 1;");
  });

  it("handles CRLF line endings", () => {
    const text = "===FILE: a.ts===\r\nconst a = 1;\r\n===END===";
    expect(parseFileBlocks(text)).toEqual([
      { path: "a.ts", content: "const a = 1;" },
    ]);
  });

  it("trims whitespace around the path", () => {
    const text = "===FILE:   src/app/page.tsx  ===\nx\n===END===";
    expect(parseFileBlocks(text)[0].path).toBe("src/app/page.tsx");
  });

  it("preserves blank lines inside content", () => {
    const text = "===FILE: a.ts===\nconst a = 1;\n\nconst b = 2;\n===END===";
    expect(parseFileBlocks(text)[0].content).toBe(
      "const a = 1;\n\nconst b = 2;"
    );
  });

  it("silently drops blocks whose path fails the safety guard", () => {
    const text = `===FILE: ../../etc/passwd===
root:x:0:0
===END===
===FILE: src/app/page.tsx===
ok
===END===`;
    expect(parseFileBlocks(text).map((f) => f.path)).toEqual([
      "src/app/page.tsx",
    ]);
  });

  it("returns nothing for an unterminated block", () => {
    const text = "===FILE: a.ts===\nconst a = 1;";
    expect(parseFileBlocks(text)).toEqual([]);
  });

  it("returns nothing when there are no blocks", () => {
    expect(parseFileBlocks("I could not complete that request.")).toEqual([]);
  });
});

// ------------------------------------------------------------------
// extractJson — hand-rolled recovery over untrusted model output
// ------------------------------------------------------------------

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"name":"app"}')).toEqual({ name: "app" });
  });

  it("parses a fenced json block", () => {
    const text = '```json\n{"name":"app"}\n```';
    expect(extractJson(text)).toEqual({ name: "app" });
  });

  it("parses an unlabelled fenced block", () => {
    expect(extractJson('```\n{"name":"app"}\n```')).toEqual({ name: "app" });
  });

  it("ignores prose on both sides", () => {
    const text = 'Sure! Here is the plan:\n{"name":"app"}\nHope that helps.';
    expect(extractJson(text)).toEqual({ name: "app" });
  });

  it("strips a <think> block containing draft JSON", () => {
    const text = `<think>
Maybe I should return {"name":"draft"} — no, the user wants the real one.
</think>
{"name":"final"}`;
    expect(extractJson(text)).toEqual({ name: "final" });
  });

  it.each(["think", "thinking", "reasoning"])(
    "strips a <%s> block",
    (tag) => {
      const text = `<${tag}>{"name":"draft"}</${tag}>{"name":"final"}`;
      expect(extractJson(text)).toEqual({ name: "final" });
    }
  );

  it("keeps braces that appear inside string values", () => {
    const text = '{"template":"function () { return 1; }","ok":true}';
    expect(extractJson(text)).toEqual({
      template: "function () { return 1; }",
      ok: true,
    });
  });

  it("handles escaped quotes inside string values", () => {
    const text = '{"quote":"she said \\"hi\\"","ok":true}';
    expect(extractJson(text)).toEqual({ quote: 'she said "hi"', ok: true });
  });

  it("handles a trailing escaped backslash before the closing quote", () => {
    const text = '{"path":"C:\\\\tmp\\\\","ok":true}';
    expect(extractJson(text)).toEqual({ path: "C:\\tmp\\", ok: true });
  });

  it("parses nested objects and arrays", () => {
    const text = '{"a":{"b":[1,2,{"c":3}]},"d":"}"}';
    expect(extractJson(text)).toEqual({ a: { b: [1, 2, { c: 3 }] }, d: "}" });
  });

  describe("truncation repair", () => {
    it("recovers an object cut off mid-array", () => {
      const text = '{"pages":["home","about","cont';
      expect(extractJson(text)).toEqual({ pages: ["home", "about"] });
    });

    it("recovers an object cut off after a complete element", () => {
      const text = '{"pages":["home","about"],"tables":[{"name":"users"}';
      expect(extractJson(text)).toEqual({
        pages: ["home", "about"],
        tables: [{ name: "users" }],
      });
    });

    it("recovers an object cut off mid-string value", () => {
      const text = '{"name":"app","description":"a really long des';
      expect(extractJson(text)).toEqual({ name: "app" });
    });

    it("recovers from a truncated fenced block with no closing fence", () => {
      const text = '```json\n{"pages":["home","about","cont';
      expect(extractJson(text)).toEqual({ pages: ["home", "about"] });
    });
  });

  describe("unrecoverable input", () => {
    it("throws when there is no JSON object at all", () => {
      expect(() => extractJson("I could not complete that request.")).toThrow(
        /No JSON object found/
      );
    });

    it("throws when nothing complete can be salvaged", () => {
      expect(() => extractJson('{"name":"ap')).toThrow(
        /not valid JSON and could not be repaired/
      );
    });

    it("throws on a JSON array at the top level", () => {
      // The contract is "first JSON *object*" — arrays are not supported.
      expect(() => extractJson("[1,2,3]")).toThrow(/No JSON object found/);
    });
  });
});

// ------------------------------------------------------------------
// Budget arithmetic — decides whether a step calls a model at all
// ------------------------------------------------------------------

describe("budget arithmetic", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("remainingBudgetMs", () => {
    it("returns the ceiling when no deadline is set", () => {
      expect(remainingBudgetMs(undefined)).toBe(90_000);
    });

    it("returns the time left when it sits between floor and ceiling", () => {
      expect(remainingBudgetMs(NOW + 45_000)).toBe(45_000);
    });

    it("clamps to the ceiling when the deadline is far away", () => {
      expect(remainingBudgetMs(NOW + 500_000)).toBe(90_000);
    });

    it("clamps to the floor when the deadline is close", () => {
      expect(remainingBudgetMs(NOW + 1_000)).toBe(10_000);
    });

    it("clamps to the floor when the deadline has already passed", () => {
      expect(remainingBudgetMs(NOW - 30_000)).toBe(10_000);
    });

    it("honours caller-supplied floor and ceiling", () => {
      expect(remainingBudgetMs(NOW + 45_000, 1_000, 20_000)).toBe(20_000);
      expect(remainingBudgetMs(NOW + 500, 5_000, 20_000)).toBe(5_000);
    });
  });

  describe("stepBudgetMs", () => {
    it("returns the default when neither deadline is set", () => {
      expect(stepBudgetMs({})).toBe(90_000);
    });

    it("prefers the per-step deadline over the pipeline deadline", () => {
      expect(
        stepBudgetMs({ stepDeadlineAt: NOW + 20_000, deadlineAt: NOW + 80_000 })
      ).toBe(20_000);
    });

    it("falls back to the pipeline deadline", () => {
      expect(stepBudgetMs({ deadlineAt: NOW + 30_000 })).toBe(30_000);
    });

    it("caps at the default even for a distant deadline", () => {
      expect(stepBudgetMs({ deadlineAt: NOW + 500_000 })).toBe(90_000);
    });

    it("reports zero — not a floor — once the deadline has passed", () => {
      // No floor here on purpose: an honest zero is what lets canCallModel
      // skip a call that would certainly be aborted.
      expect(stepBudgetMs({ deadlineAt: NOW - 5_000 })).toBe(0);
    });
  });

  describe("canCallModel / outOfTimeNote", () => {
    it("skips the call when the step's slice is spent", () => {
      // No provider configured in tests, so both report the demo-mode
      // answer: no call, and no "degraded build" note to explain it.
      expect(canCallModel({ stepDeadlineAt: NOW - 1 })).toBe(false);
      expect(outOfTimeNote({ stepDeadlineAt: NOW - 1 })).toBe("");
    });

    it("skips the call when nothing is configured, even with time left", () => {
      expect(canCallModel({ stepDeadlineAt: NOW + 90_000 })).toBe(false);
    });
  });
});

// ------------------------------------------------------------------
// fallbackReason — ordered classification, shown in the build log
// ------------------------------------------------------------------

describe("fallbackReason", () => {
  it.each([
    ["ran out of time", "the model ran out of time"],
    ["Request timed out", "the model ran out of time"],
    ["The operation was aborted", "the model ran out of time"],
    ["429 Too Many Requests", "the model was rate-limited"],
    ["rate limit exceeded", "the model was rate-limited"],
    ["404 model not found", "the configured model is unavailable"],
    ["401 authentication failed", "the provider rejected the API key"],
    ["Invalid api key", "the provider rejected the API key"],
    ["something inexplicable", "the model call failed"],
  ])("classifies %j", (message, expected) => {
    expect(fallbackReason(new Error(message))).toBe(expected);
  });

  it("accepts non-Error values", () => {
    expect(fallbackReason("429 slow down")).toBe("the model was rate-limited");
    expect(fallbackReason(null)).toBe("the model call failed");
  });

  it("resolves timeout before rate-limit when a message matches both", () => {
    // Precedence is line order in the function; assert it so a reordering
    // of the checks is a visible behaviour change, not a silent one.
    expect(fallbackReason(new Error("429 rate limited, then timed out"))).toBe(
      "the model ran out of time"
    );
  });
});

// ------------------------------------------------------------------
// diagnoseModelFailure — what the user is actually told when a step
// degrades. The provider's own error must survive to the build log.
// ------------------------------------------------------------------

describe("diagnoseModelFailure", () => {
  it.each([
    ["No AI provider is configured.", "AI_NOT_CONFIGURED", false],
    ["Request timed out", "AI_TIMEOUT", true],
    ["z-ai/glm-5.2 returned nothing within 54s.", "AI_TIMEOUT", true],
    ["429 Too Many Requests", "AI_RATE_LIMITED", true],
    ["404 model not found", "AI_MODEL_UNAVAILABLE", false],
    ["401 authentication failed", "AI_KEY_REJECTED", false],
    ["402 credit balance is exhausted", "AI_NO_CREDIT", false],
    ["something nobody predicted", "AI_CALL_FAILED", true],
  ])("classifies %j as %s", (message, code, retryable) => {
    const failure = diagnoseModelFailure(new Error(message));

    expect(failure.code).toBe(code);
    expect(failure.retryable).toBe(retryable);
    expect(failure.suggestedFix.length).toBeGreaterThan(0);
  });

  /**
   * The whole point of this function: the provider chain builds a precise
   * error, and it used to be collapsed into a six-word phrase with the
   * detail discarded. If `cause` ever stops carrying it verbatim, the
   * build log goes back to being useless.
   */
  it("preserves the provider's own error verbatim as the cause", () => {
    const real =
      "All AI providers failed. Tried: nvidia (z-ai/glm-5.2), nvidia (openai/gpt-oss-20b). Last error: 401 Unauthorized";

    const failure = diagnoseModelFailure(new Error(real));

    expect(failure.cause).toBe(real);
    expect(failure.cause).toContain("z-ai/glm-5.2");
    expect(failure.cause).toContain("401 Unauthorized");
  });

  it("always offers a next action, whatever the error", () => {
    for (const error of [
      new Error("boom"),
      "a bare string",
      null,
      undefined,
      { weird: true },
    ]) {
      const failure = diagnoseModelFailure(error);
      expect(failure.suggestedFix).toBeTruthy();
      expect(failure.summary).toBeTruthy();
      expect(failure.code).toBeTruthy();
    }
  });

  it("describes a missing key without echoing any key material", () => {
    const failure = diagnoseModelFailure(
      new Error("No AI provider is configured — set NVIDIA_API_KEY.")
    );

    expect(failure.code).toBe("AI_NOT_CONFIGURED");
    expect(failure.suggestedFix).toMatch(/NVIDIA_API_KEY/);
    expect(failure.retryable).toBe(false);
  });

  it("keeps summary in step with fallbackReason", () => {
    const error = new Error("429 slow down");
    expect(diagnoseModelFailure(error).summary).toBe(fallbackReason(error));
  });
});

describe("emptyOutputFailure", () => {
  it("is distinct from a failed call — the model answered", () => {
    const failure = emptyOutputFailure("no ===FILE:=== blocks in the response");

    expect(failure.code).toBe("AI_EMPTY_OUTPUT");
    expect(failure.retryable).toBe(true);
    expect(failure.cause).toBe("no ===FILE:=== blocks in the response");
  });
});

describe("degradedEvent", () => {
  const failure = {
    summary: "the model ran out of time",
    code: "AI_TIMEOUT",
    cause: "timed out after 54s",
    suggestedFix: "Re-run the build.",
    retryable: true,
  };

  it("carries the diagnosis onto the wire", () => {
    expect(degradedEvent("ui", "Pages are scaffolded.", failure)).toEqual({
      type: "agent_degraded",
      agent: "ui",
      message: "Pages are scaffolded.",
      code: "AI_TIMEOUT",
      cause: "timed out after 54s",
      suggestedFix: "Re-run the build.",
      retryable: true,
    });
  });

  it("omits the agent for a whole-build condition", () => {
    const event = degradedEvent(undefined, "Nothing configured.", failure);

    expect(event).not.toHaveProperty("agent");
  });

  it("does not leak the internal summary field onto the event", () => {
    // `summary` is for the inline note; the event carries `message`.
    expect(degradedEvent("ui", "m", failure)).not.toHaveProperty("summary");
  });
});
