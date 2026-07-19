/**
 * Built-in tools available to custom agents (Settings -> AI Models's
 * sibling feature, the Agent Builder). Each tool is fully self-contained
 * — no external API keys required — so tool calling works out of the
 * box on any deployment that has at least one tool-capable provider
 * configured (OpenAI, Anthropic, DeepSeek, or Grok; see
 * providers/*.ts `supportsTools`).
 */

import type { AiToolDefinition } from "@/lib/ai/providers/types";

export interface ToolContext {
  agentId: string;
  userId: string;
}

export interface ToolDefinition extends AiToolDefinition {
  execute(args: Record<string, unknown>, context: ToolContext): Promise<string>;
}

function getCurrentTimeTool(): ToolDefinition {
  return {
    name: "get_current_time",
    description:
      "Returns the current date and time. Use this whenever the user asks what time or date it is, or asks you to reason about how long until/since something.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            'IANA timezone name, e.g. "America/New_York". Defaults to UTC.',
        },
      },
    },
    async execute(args) {
      const timezone = typeof args.timezone === "string" ? args.timezone : "UTC";
      try {
        const formatted = new Intl.DateTimeFormat("en-US", {
          dateStyle: "full",
          timeStyle: "long",
          timeZone: timezone,
        }).format(new Date());
        return formatted;
      } catch {
        return `${new Date().toISOString()} (UTC — "${timezone}" isn't a recognized timezone)`;
      }
    },
  };
}

function calculatorTool(): ToolDefinition {
  return {
    name: "calculator",
    description:
      "Evaluates a basic arithmetic expression (+, -, *, /, parentheses, decimals). Use this for any math instead of computing it yourself.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: 'e.g. "(4 + 5) * 12 / 3"',
        },
      },
      required: ["expression"],
    },
    async execute(args) {
      const expression = String(args.expression ?? "");
      try {
        return String(evaluateArithmetic(expression));
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "invalid expression"}`;
      }
    },
  };
}

function rememberFactTool(
  saveMemory: (context: ToolContext, content: string) => Promise<void>
): ToolDefinition {
  return {
    name: "remember_fact",
    description:
      "Saves a short fact about the user or conversation for future sessions with this agent (e.g. their name, a preference, an ongoing project). Call this whenever the user shares something worth remembering long-term.",
    parameters: {
      type: "object",
      properties: {
        fact: {
          type: "string",
          description: "A single, concise fact to remember, in plain language.",
        },
      },
      required: ["fact"],
    },
    async execute(args, context) {
      const fact = String(args.fact ?? "").trim();
      if (!fact) return "Nothing to remember — the fact was empty.";
      await saveMemory(context, fact.slice(0, 500));
      return `Got it, I'll remember: ${fact}`;
    },
  };
}

/**
 * Builds the tool registry. `saveMemory` is injected rather than
 * imported directly so this module has no hard dependency on Supabase
 * (keeps it easy to unit test — see tools.test.ts).
 */
export function createToolRegistry(
  saveMemory: (context: ToolContext, content: string) => Promise<void>
): Record<string, ToolDefinition> {
  const tools = [getCurrentTimeTool(), calculatorTool(), rememberFactTool(saveMemory)];
  return Object.fromEntries(tools.map((tool) => [tool.name, tool]));
}

export const AVAILABLE_TOOL_IDS = ["get_current_time", "calculator", "remember_fact"] as const;
export type ToolId = (typeof AVAILABLE_TOOL_IDS)[number];

export const TOOL_DESCRIPTIONS: Record<ToolId, string> = {
  get_current_time: "Look up the current date/time.",
  calculator: "Evaluate arithmetic expressions.",
  remember_fact: "Save a fact about the user across sessions.",
};

/**
 * A small, dependency-free arithmetic evaluator (+ - * / parentheses,
 * unary minus, decimals) — deliberately not `eval`/`Function`, since
 * the input ultimately comes from model output and must never be able
 * to execute arbitrary code.
 */
export function evaluateArithmetic(input: string): number {
  const tokens = tokenize(input);
  let position = 0;

  function peek() {
    return tokens[position];
  }
  function next() {
    return tokens[position++];
  }

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseUnary();
      if (op === "/" && rhs === 0) throw new Error("division by zero");
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseUnary(): number {
    if (peek() === "-") {
      next();
      return -parseUnary();
    }
    if (peek() === "+") {
      next();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = next();
    if (token === undefined) throw new Error("unexpected end of expression");
    if (token === "(") {
      const value = parseExpression();
      if (next() !== ")") throw new Error("missing closing parenthesis");
      return value;
    }
    const value = Number(token);
    if (Number.isNaN(value)) throw new Error(`unexpected token "${token}"`);
    return value;
  }

  if (tokens.length === 0) throw new Error("empty expression");
  const result = parseExpression();
  if (position < tokens.length) {
    throw new Error(`unexpected token "${tokens[position]}"`);
  }
  return result;
}

function tokenize(input: string): string[] {
  const cleaned = input.trim();
  if (!/^[0-9+\-*/().\s]*$/.test(cleaned)) {
    throw new Error("expression contains unsupported characters");
  }
  return cleaned.match(/\d+\.?\d*|\.\d+|[+\-*/()]/g) ?? [];
}
