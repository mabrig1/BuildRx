import { describe, expect, it } from "vitest";

import { renderConfigTemplates, renderTemplate, stringifyTriggerInput } from "@/lib/workflows/template";

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    expect(renderTemplate("Hello {{step1.text}}!", { "step1.text": "world" })).toBe("Hello world!");
  });

  it("substitutes multiple placeholders", () => {
    const result = renderTemplate("{{a}} and {{b}}", { a: "1", b: "2" });
    expect(result).toBe("1 and 2");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(renderTemplate("Hi {{unknown}}", {})).toBe("Hi {{unknown}}");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("{{ step1.text }}", { "step1.text": "x" })).toBe("x");
  });

  it("returns the input unchanged when there are no placeholders", () => {
    expect(renderTemplate("plain text", { a: "1" })).toBe("plain text");
  });
});

describe("renderConfigTemplates", () => {
  it("renders string values", () => {
    expect(renderConfigTemplates("Hi {{name}}", { name: "Ada" })).toBe("Hi Ada");
  });

  it("recurses into nested objects and arrays", () => {
    const config = {
      prompt: "Topic: {{trigger.text}}",
      inputs: { topic: "{{trigger.text}}", tags: ["{{trigger.text}}", "static"] },
      count: 3,
      enabled: true,
    };
    const result = renderConfigTemplates(config, { "trigger.text": "AI" });
    expect(result).toEqual({
      prompt: "Topic: AI",
      inputs: { topic: "AI", tags: ["AI", "static"] },
      count: 3,
      enabled: true,
    });
  });

  it("leaves non-string primitives and null untouched", () => {
    expect(renderConfigTemplates(42, {})).toBe(42);
    expect(renderConfigTemplates(null, {})).toBe(null);
    expect(renderConfigTemplates(undefined, {})).toBe(undefined);
  });
});

describe("stringifyTriggerInput", () => {
  it("returns a string input as-is", () => {
    expect(stringifyTriggerInput("hello")).toBe("hello");
  });

  it("JSON-stringifies objects and arrays", () => {
    expect(stringifyTriggerInput({ a: 1 })).toBe('{"a":1}');
    expect(stringifyTriggerInput([1, 2])).toBe("[1,2]");
  });

  it("returns an empty string for null/undefined", () => {
    expect(stringifyTriggerInput(null)).toBe("");
    expect(stringifyTriggerInput(undefined)).toBe("");
  });
});
