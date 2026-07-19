/**
 * AI coding operations: explain, debug, refactor, generate tests,
 * generate docs. Generic over any code snippet — not tied to a
 * project's file system (the editor UI is what wires "current file
 * content" in and "write result back" out). Reuses the Phase 1
 * multi-provider registry, same as documents/ai.ts and agents.
 */

import { getProvider } from "@/lib/ai/providers/registry";
import type { AiProviderId } from "@/lib/ai/providers/types";

const MAX_CODE_CHARS = 16_000;

function truncate(code: string): string {
  return code.length > MAX_CODE_CHARS
    ? `${code.slice(0, MAX_CODE_CHARS)}\n\n// ...truncated for length`
    : code;
}

/**
 * Debug/refactor/docs all need the model to return an explanation AND
 * a full code block together. Rather than a second model round trip
 * or JSON mode (which not every provider supports identically), both
 * are requested in one structured text response with clear markers,
 * parsed here. Pulled out as a pure function so parsing is unit-testable
 * without a live model call.
 */
export function parseExplanationAndCode(raw: string): {
  explanation: string;
  code: string | null;
} {
  const marker = /##\s*code/i.exec(raw);
  const explanationPart = marker ? raw.slice(0, marker.index) : raw;
  const explanation = explanationPart.replace(/##\s*explanation/i, "").trim();

  const codeSearchArea = marker ? raw.slice(marker.index) : raw;
  const codeBlock = /```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/.exec(codeSearchArea);

  return {
    explanation: explanation || raw.trim(),
    code: codeBlock ? codeBlock[1].replace(/\n$/, "") : null,
  };
}

const STRUCTURED_FORMAT_INSTRUCTIONS = [
  "Respond in exactly this format, with nothing before or after it:",
  "## Explanation",
  "<a few clear sentences>",
  "## Code",
  "<a single fenced code block with the complete, corrected/updated file — not a diff or a snippet>",
].join("\n");

async function runCodePrompt({
  providerId,
  model,
  system,
  prompt,
  maxTokens,
}: {
  providerId: AiProviderId;
  model?: string;
  system: string;
  prompt: string;
  maxTokens: number;
}): Promise<{ text: string; model: string }> {
  const provider = getProvider(providerId);
  if (!provider.isConfigured()) {
    throw new Error(`${provider.label} isn't configured on this deployment.`);
  }
  const result = await provider.createCompletion([{ role: "user", content: prompt }], {
    model,
    system,
    maxTokens,
    temperature: 0.2,
  });
  return { text: result.text.trim(), model: result.model };
}

export async function explainCode({
  providerId,
  model,
  code,
  language,
}: {
  providerId: AiProviderId;
  model?: string;
  code: string;
  language?: string;
}) {
  return runCodePrompt({
    providerId,
    model,
    system:
      "You are an expert software engineer explaining code clearly and concisely, for a developer who can read code but is unfamiliar with this specific file.",
    prompt:
      `Explain what this ${language ?? ""} code does: its purpose, key logic, and anything ` +
      `non-obvious (edge cases, side effects, gotchas). Plain prose, no code block needed:\n\n${truncate(code)}`,
    maxTokens: 1000,
  });
}

export async function debugCode({
  providerId,
  model,
  code,
  language,
  errorMessage,
}: {
  providerId: AiProviderId;
  model?: string;
  code: string;
  language?: string;
  errorMessage?: string;
}) {
  const { text } = await runCodePrompt({
    providerId,
    model,
    system:
      "You are an expert debugger. Find real bugs — don't invent problems in correct code. If the code has no bugs, say so in the explanation and return the code unchanged.",
    prompt:
      `Find and fix the bug(s) in this ${language ?? ""} code.` +
      (errorMessage ? ` The error/symptom observed: ${errorMessage}` : "") +
      `\n\n${STRUCTURED_FORMAT_INSTRUCTIONS}\n\nCode:\n${truncate(code)}`,
    maxTokens: 3000,
  });
  return parseExplanationAndCode(text);
}

export async function refactorCode({
  providerId,
  model,
  code,
  language,
  instruction,
}: {
  providerId: AiProviderId;
  model?: string;
  code: string;
  language?: string;
  instruction: string;
}) {
  const { text } = await runCodePrompt({
    providerId,
    model,
    system:
      "You are an expert software engineer refactoring code. Preserve behavior unless the instruction explicitly asks to change it.",
    prompt:
      `Refactor this ${language ?? ""} code as instructed: "${instruction}".\n\n` +
      `${STRUCTURED_FORMAT_INSTRUCTIONS}\n\nCode:\n${truncate(code)}`,
    maxTokens: 3000,
  });
  return parseExplanationAndCode(text);
}

export async function generateDocs({
  providerId,
  model,
  code,
  language,
}: {
  providerId: AiProviderId;
  model?: string;
  code: string;
  language?: string;
}) {
  const { text } = await runCodePrompt({
    providerId,
    model,
    system:
      "You add clear, accurate documentation comments (JSDoc/docstrings as appropriate for the language) to code. Don't change behavior or logic — only add/improve comments and doc headers.",
    prompt:
      `Add documentation comments to this ${language ?? ""} code (function/class doc comments, ` +
      `plus brief inline comments only where the logic is non-obvious).\n\n` +
      `${STRUCTURED_FORMAT_INSTRUCTIONS}\n\nCode:\n${truncate(code)}`,
    maxTokens: 3000,
  });
  return parseExplanationAndCode(text);
}

/** Derives a conventional test file path next to the source file. */
export function suggestTestFilePath(filePath: string): string {
  const match = /^(.*?)(\.(?:tsx|ts|jsx|js))$/.exec(filePath);
  if (!match) return `${filePath}.test.ts`;
  const [, base, ext] = match;
  return `${base}.test${ext}`;
}

export async function generateTests({
  providerId,
  model,
  code,
  language,
  filePath,
}: {
  providerId: AiProviderId;
  model?: string;
  code: string;
  language?: string;
  filePath?: string;
}) {
  const { text, model: resolvedModel } = await runCodePrompt({
    providerId,
    model,
    system:
      "You write focused, high-value unit tests (Vitest/Jest-style conventions for JS/TS unless the language clearly calls for something else) covering the main behavior and important edge cases — not exhaustive trivial tests.",
    prompt:
      `Write unit tests for this ${language ?? ""} code${filePath ? ` (file: ${filePath})` : ""}.\n\n` +
      `Respond with ONLY a single fenced code block containing the complete test file — no explanation.\n\nCode:\n${truncate(code)}`,
    maxTokens: 3000,
  });

  const codeBlock = /```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/.exec(text);
  return {
    testCode: codeBlock ? codeBlock[1].replace(/\n$/, "") : text,
    suggestedFileName: filePath ? suggestTestFilePath(filePath) : undefined,
    model: resolvedModel,
  };
}
