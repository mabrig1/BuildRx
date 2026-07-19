import { describe, expect, it, vi } from "vitest";

import { createToolRegistry, evaluateArithmetic } from "@/lib/ai-agents/tools";

describe("evaluateArithmetic", () => {
  it("evaluates basic operators with correct precedence", () => {
    expect(evaluateArithmetic("2 + 3 * 4")).toBe(14);
    expect(evaluateArithmetic("(2 + 3) * 4")).toBe(20);
    expect(evaluateArithmetic("10 / 4")).toBe(2.5);
  });

  it("handles unary minus and decimals", () => {
    expect(evaluateArithmetic("-5 + 2.5")).toBe(-2.5);
  });

  it("throws on division by zero", () => {
    expect(() => evaluateArithmetic("1 / 0")).toThrow(/division by zero/);
  });

  it("throws on unsupported characters (rejects code injection attempts)", () => {
    expect(() => evaluateArithmetic("process.exit()")).toThrow();
    expect(() => evaluateArithmetic("1; alert(1)")).toThrow();
  });

  it("throws on malformed expressions", () => {
    expect(() => evaluateArithmetic("(1 + 2")).toThrow(/closing parenthesis/);
    expect(() => evaluateArithmetic("")).toThrow(/empty expression/);
    expect(() => evaluateArithmetic("1 +")).toThrow();
  });
});

describe("built-in tool registry", () => {
  it("registers exactly the three built-in tools", () => {
    const registry = createToolRegistry(vi.fn());
    expect(Object.keys(registry).sort()).toEqual([
      "calculator",
      "get_current_time",
      "remember_fact",
    ]);
  });

  it("calculator tool returns the computed result as a string", async () => {
    const registry = createToolRegistry(vi.fn());
    const result = await registry.calculator.execute(
      { expression: "6 * 7" },
      { agentId: "a", userId: "u" }
    );
    expect(result).toBe("42");
  });

  it("calculator tool reports errors without throwing", async () => {
    const registry = createToolRegistry(vi.fn());
    const result = await registry.calculator.execute(
      { expression: "1 / 0" },
      { agentId: "a", userId: "u" }
    );
    expect(result).toMatch(/error/i);
  });

  it("get_current_time tool returns a non-empty string", async () => {
    const registry = createToolRegistry(vi.fn());
    const result = await registry.get_current_time.execute(
      {},
      { agentId: "a", userId: "u" }
    );
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("remember_fact tool calls saveMemory with the context and fact", async () => {
    const saveMemory = vi.fn().mockResolvedValue(undefined);
    const registry = createToolRegistry(saveMemory);
    const context = { agentId: "agent-1", userId: "user-1" };

    const result = await registry.remember_fact.execute(
      { fact: "The user prefers dark mode." },
      context
    );

    expect(saveMemory).toHaveBeenCalledWith(context, "The user prefers dark mode.");
    expect(result).toContain("dark mode");
  });

  it("remember_fact tool no-ops on an empty fact", async () => {
    const saveMemory = vi.fn();
    const registry = createToolRegistry(saveMemory);
    const result = await registry.remember_fact.execute(
      { fact: "   " },
      { agentId: "a", userId: "u" }
    );
    expect(saveMemory).not.toHaveBeenCalled();
    expect(result).toMatch(/nothing to remember/i);
  });
});
