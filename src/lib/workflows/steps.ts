/**
 * Executes one workflow step. Each step type is a thin wrapper around
 * an already-built capability from an earlier phase (a raw AI
 * completion, an agent turn, a Content Studio piece, a Knowledge Base
 * question) or an outbound webhook — nothing here duplicates that
 * logic, it just adapts inputs/outputs to fit a chain.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getProvider } from "@/lib/ai/providers/registry";
import type { AiProviderId } from "@/lib/ai/providers/types";
import { loadAgentRuntimeConfig } from "@/lib/ai-agents/context";
import { runAgent } from "@/lib/ai-agents/runtime";
import { generateContentPiece } from "@/lib/content/ai";
import type { ContentInputs, ContentType } from "@/lib/content/prompts";
import { answerFromKnowledgeBase } from "@/lib/rag/chat";
import type { Database, Json, WorkflowStepType } from "@/types/database";

export interface StepExecutionContext {
  supabase: SupabaseClient<Database>;
  ownerId: string;
}

export interface StepOutput {
  text: string;
  [key: string]: Json | undefined;
}

export interface StepUsage {
  provider: AiProviderId;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface StepExecutionResult {
  output: StepOutput;
  usage?: StepUsage;
}

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^169\.254\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

/** Blocks the obvious loopback/private-network targets. Not a complete SSRF defense (no DNS resolution check), but a reasonable guard for a user-configured outbound webhook. */
export function isSafeWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith(".local")) return false;
  return !PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

async function executeAiGenerate(
  config: { system?: string; prompt: string; provider: AiProviderId; model?: string }
): Promise<StepExecutionResult> {
  const provider = getProvider(config.provider);
  if (!provider.isConfigured()) {
    throw new Error(`${provider.label} isn't configured on this deployment.`);
  }
  const result = await provider.createCompletion([{ role: "user", content: config.prompt }], {
    model: config.model,
    system: config.system,
    maxTokens: 1500,
    temperature: 0.7,
  });
  return {
    output: { text: result.text },
    usage: {
      provider: config.provider,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    },
  };
}

async function executeAgentRun(
  config: { agentId: string; message: string },
  ctx: StepExecutionContext
): Promise<StepExecutionResult> {
  const agentConfig = await loadAgentRuntimeConfig(ctx.supabase, config.agentId, ctx.ownerId);
  if (!agentConfig) {
    throw new Error("Agent not found or not accessible.");
  }

  const result = await runAgent({
    provider: getProvider(agentConfig.provider),
    model: agentConfig.model || undefined,
    systemPrompt: agentConfig.systemPrompt,
    toolIds: agentConfig.tools,
    history: [],
    userMessage: config.message,
    context: { agentId: config.agentId, userId: ctx.ownerId },
    saveMemory: async (context, content) => {
      await ctx.supabase
        .from("agent_memories")
        .insert({ agent_id: context.agentId, user_id: context.userId, content });
    },
  });

  return {
    output: { text: result.text },
    usage: {
      provider: agentConfig.provider,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    },
  };
}

async function executeContentGenerate(
  config: { contentType: ContentType; inputs: ContentInputs; provider: AiProviderId; model?: string },
  ctx: StepExecutionContext
): Promise<StepExecutionResult> {
  const provider = getProvider(config.provider);
  if (!provider.isConfigured()) {
    throw new Error(`${provider.label} isn't configured on this deployment.`);
  }

  const generated = await generateContentPiece({
    providerId: config.provider,
    model: config.model,
    type: config.contentType,
    inputs: config.inputs,
  });

  const insert = await ctx.supabase
    .from("content_pieces")
    .insert({
      owner_id: ctx.ownerId,
      type: config.contentType,
      title: generated.title,
      inputs: config.inputs as unknown as Json,
      content: generated.content,
      status: "ready",
      provider: config.provider,
      model: generated.model,
    })
    .select("id")
    .single();

  return {
    output: {
      text: generated.content,
      title: generated.title,
      contentId: insert.data?.id ?? null,
    },
    usage: { provider: config.provider, model: generated.model, promptTokens: 0, completionTokens: 0 },
  };
}

async function executeKbChat(
  config: { knowledgeBaseId: string; question: string; provider: AiProviderId; model?: string },
  ctx: StepExecutionContext
): Promise<StepExecutionResult> {
  const result = await answerFromKnowledgeBase({
    supabase: ctx.supabase,
    ownerId: ctx.ownerId,
    knowledgeBaseId: config.knowledgeBaseId,
    question: config.question,
    providerId: config.provider,
    model: config.model,
  });

  return {
    output: {
      text: result.answer,
      citations: result.citations as unknown as Json,
    },
    usage: result.model
      ? { provider: config.provider, model: result.model, promptTokens: 0, completionTokens: 0 }
      : undefined,
  };
}

async function executeWebhook(
  config: { url: string; payload?: string }
): Promise<StepExecutionResult> {
  if (!isSafeWebhookUrl(config.url)) {
    throw new Error("That webhook URL isn't allowed (must be a public http/https host).");
  }

  const body = config.payload ?? "";
  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: body }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(
      `Webhook request failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${responseText.slice(0, 300)}`);
  }

  return { output: { text: responseText.slice(0, 4000), status: response.status } };
}

export async function executeStep(
  type: WorkflowStepType,
  config: Record<string, unknown>,
  ctx: StepExecutionContext
): Promise<StepExecutionResult> {
  switch (type) {
    case "ai_generate":
      return executeAiGenerate(config as Parameters<typeof executeAiGenerate>[0]);
    case "agent_run":
      return executeAgentRun(config as Parameters<typeof executeAgentRun>[0], ctx);
    case "content_generate":
      return executeContentGenerate(config as Parameters<typeof executeContentGenerate>[0], ctx);
    case "kb_chat":
      return executeKbChat(config as Parameters<typeof executeKbChat>[0], ctx);
    case "webhook":
      return executeWebhook(config as Parameters<typeof executeWebhook>[0]);
  }
}
