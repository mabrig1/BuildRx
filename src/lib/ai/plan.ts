/**
 * Build-planning service — turns a feature request into a structured
 * multi-file plan via the NVIDIA Inference API's long-context model
 * (Qwen3 Next 80B by default), before any code is generated. Mirrors
 * the "plan, then generate" step competing app builders use for
 * larger/ambiguous requests.
 */

import { z } from "zod";

import { createChatCompletion, nvidiaPlanModel } from "@/lib/ai/nvidia";
import type { NvidiaMessage } from "@/lib/ai/nvidia";

const planSchema = z.object({
  summary: z.string(),
  files: z
    .array(
      z.object({
        path: z.string(),
        description: z.string(),
      })
    )
    .default([]),
});

export type ProjectPlan = z.infer<typeof planSchema>;

const PLAN_SYSTEM_PROMPT = [
  "You are a senior software architect planning changes to a Next.js + Supabase web app.",
  "Given the request below, respond with ONLY minified JSON (no markdown fences, no commentary) matching this exact shape:",
  '{"summary": string, "files": [{"path": string, "description": string}]}',
  "List only the files that need to be created or changed, most important first. Keep each description to one sentence.",
].join(" ");

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = /\{[\s\S]*\}/.exec(trimmed);
    if (!match) throw new Error("No JSON object found in the plan response.");
    return JSON.parse(match[0]);
  }
}

export async function generateProjectPlan({
  prompt,
  context,
  model,
}: {
  prompt: string;
  context?: string;
  model?: string;
}) {
  const messages: NvidiaMessage[] = [
    { role: "system", content: PLAN_SYSTEM_PROMPT },
    {
      role: "user",
      content: context
        ? `Existing project context:\n\n${context}\n\n---\n\n${prompt}`
        : prompt,
    },
  ];

  const result = await createChatCompletion(messages, {
    model: model ?? nvidiaPlanModel(),
    maxTokens: 2048,
    temperature: 0.3,
  });

  let plan: ProjectPlan;
  try {
    plan = planSchema.parse(extractJson(result.text));
  } catch {
    // The model didn't return clean JSON — fall back to the raw text as
    // the summary rather than failing the request outright.
    plan = { summary: result.text.trim(), files: [] };
  }

  return { plan, model: result.model, usage: result.usage };
}
