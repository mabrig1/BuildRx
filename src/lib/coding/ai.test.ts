import { describe, expect, it } from "vitest";

import { parseExplanationAndCode, suggestTestFilePath } from "@/lib/coding/ai";

describe("parseExplanationAndCode", () => {
  it("splits a well-formed structured response", () => {
    const raw = [
      "## Explanation",
      "The loop had an off-by-one error.",
      "## Code",
      "```ts",
      "for (let i = 0; i < arr.length; i++) {}",
      "```",
    ].join("\n");

    const result = parseExplanationAndCode(raw);
    expect(result.explanation).toBe("The loop had an off-by-one error.");
    expect(result.code).toBe("for (let i = 0; i < arr.length; i++) {}");
  });

  it("is case-insensitive on the section markers", () => {
    const raw = "## explanation\nFixed it.\n## code\n```\nconst x = 1;\n```";
    const result = parseExplanationAndCode(raw);
    expect(result.explanation).toBe("Fixed it.");
    expect(result.code).toBe("const x = 1;");
  });

  it("handles a code fence with no language tag", () => {
    const raw = "## Explanation\nDone.\n## Code\n```\nplain text\n```";
    expect(parseExplanationAndCode(raw).code).toBe("plain text");
  });

  it("returns null code and the full text as explanation when there's no code block", () => {
    const raw = "This code has no bugs — nothing to change.";
    const result = parseExplanationAndCode(raw);
    expect(result.code).toBeNull();
    expect(result.explanation).toBe(raw);
  });

  it("returns null code when a ## Code marker exists but has no fenced block", () => {
    const raw = "## Explanation\nNo changes needed.\n## Code\n(unchanged)";
    const result = parseExplanationAndCode(raw);
    expect(result.code).toBeNull();
    expect(result.explanation).toBe("No changes needed.");
  });

  it("preserves multi-line code exactly", () => {
    const raw = "## Explanation\nAdded a null check.\n## Code\n```ts\nfunction f(x) {\n  if (!x) return;\n  return x.y;\n}\n```";
    const result = parseExplanationAndCode(raw);
    expect(result.code).toBe("function f(x) {\n  if (!x) return;\n  return x.y;\n}");
  });
});

describe("suggestTestFilePath", () => {
  it("inserts .test before common extensions", () => {
    expect(suggestTestFilePath("src/lib/utils.ts")).toBe("src/lib/utils.test.ts");
    expect(suggestTestFilePath("src/components/Button.tsx")).toBe(
      "src/components/Button.test.tsx"
    );
    expect(suggestTestFilePath("src/foo.js")).toBe("src/foo.test.js");
    expect(suggestTestFilePath("src/foo.jsx")).toBe("src/foo.test.jsx");
  });

  it("falls back to appending .test.ts for unrecognized extensions", () => {
    expect(suggestTestFilePath("README.md")).toBe("README.md.test.ts");
    expect(suggestTestFilePath("noext")).toBe("noext.test.ts");
  });
});
