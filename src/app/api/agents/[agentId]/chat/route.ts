import { NextResponse } from "next/server";

import { getProvider } from "@/lib/ai/providers/registry";
import type { AiMessage } from "@/lib/ai/providers/types";
import { recordAiUsage } from "@/lib/ai/usage";
import { requireAgentUser } from "@/lib/ai-agents/access";
import { loadAgentRuntimeConfig } from "@/lib/ai-agents/context";
import { runAgent } from "@/lib/ai-agents/runtime";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { agentChatSchema } from "@/lib/validations/agents";
import type { Json } from "@/types/database";

export const maxDuration = 120;

type RouteParams = { params: Promise<{ agentId: string }> };

const HISTORY_LIMIT = 30;

function requestsPerMinute() {
  const configured = Number(process.env.NVIDIA_RATE_LIMIT_RPM);
  return Number.isFinite(configured) && configured > 0 ? configured : 20;
}

/**
 * POST /api/agents/[agentId]/chat — run one turn of a conversation with
 * an agent: loads its system prompt + knowledge + memory, resolves any
 * tool calls (see runtime.ts), and persists the full exchange (user
 * turn, any tool steps, final answer) so the next turn sees it all.
 *
 * Body: { message, conversationId? } — omit conversationId to start a
 * new conversation.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAgentUser();
  if (!auth.ok) return auth.response;
  const { agentId } = await params;

  const limit = rateLimit(`agent-chat:${auth.userId}`, {
    limit: requestsPerMinute(),
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const { checkAiRequestLimit } = await import("@/lib/billing/limits");
  const quotaError = await checkAiRequestLimit(auth.userId);
  if (quotaError) {
    return NextResponse.json({ error: quotaError }, { status: 402 });
  }

  const body = await request.json().catch(() => null);
  const parsed = agentChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { message, conversationId: requestedConversationId } = parsed.data;

  const agentConfig = await loadAgentRuntimeConfig(auth.supabase, agentId, auth.userId);
  if (!agentConfig) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Resolve (or create) the conversation.
  let conversationId = requestedConversationId;
  if (conversationId) {
    const existing = await auth.supabase
      .from("agent_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("agent_id", agentId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!existing.data) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
  } else {
    const created = await auth.supabase
      .from("agent_conversations")
      .insert({ agent_id: agentId, user_id: auth.userId, title: message.slice(0, 80) })
      .select("id")
      .single();
    if (created.error || !created.data) {
      return NextResponse.json(
        { error: created.error?.message ?? "Failed to start conversation" },
        { status: 500 }
      );
    }
    conversationId = created.data.id;
  }

  // Load prior turns for this conversation.
  const historyRows = await auth.supabase
    .from("agent_messages")
    .select("role, content, tool_calls, tool_name, tool_call_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);
  const history: AiMessage[] = (historyRows.data ?? []).map((row) => ({
    role: row.role,
    content: row.content,
    toolCalls: Array.isArray(row.tool_calls)
      ? (row.tool_calls as unknown as AiMessage["toolCalls"])
      : undefined,
    toolCallId: row.tool_call_id ?? undefined,
    name: row.tool_name ?? undefined,
  }));

  const startedAt = Date.now();

  try {
    const result = await runAgent({
      provider: getProvider(agentConfig.provider),
      model: agentConfig.model || undefined,
      systemPrompt: agentConfig.systemPrompt,
      toolIds: agentConfig.tools,
      history,
      userMessage: message,
      context: { agentId, userId: auth.userId },
      saveMemory: async (context, content) => {
        await auth.supabase.from("agent_memories").insert({
          agent_id: context.agentId,
          user_id: context.userId,
          content,
        });
      },
    });

    // Persist the full turn: user message, each tool step, final answer.
    const rows: {
      conversation_id: string;
      role: "user" | "assistant" | "tool";
      content: string;
      tool_calls?: Json;
      tool_name?: string | null;
      tool_call_id?: string | null;
    }[] = [{ conversation_id: conversationId, role: "user", content: message }];

    for (const step of result.steps) {
      rows.push({
        conversation_id: conversationId,
        role: "assistant",
        content: "",
        tool_calls: [
          { id: step.id, name: step.name, arguments: step.arguments },
        ] as unknown as Json,
      });
      rows.push({
        conversation_id: conversationId,
        role: "tool",
        content: step.result,
        tool_name: step.name,
        tool_call_id: step.id,
      });
    }
    rows.push({ conversation_id: conversationId, role: "assistant", content: result.text });

    await auth.supabase.from("agent_messages").insert(rows);
    await auth.supabase
      .from("agent_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    await recordAiUsage({
      userId: auth.userId,
      provider: agentConfig.provider,
      model: result.model,
      status: "completed",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      durationMs: Date.now() - startedAt,
      action: "ai_generation",
    });

    return NextResponse.json(
      {
        conversationId,
        text: result.text,
        steps: result.steps,
        model: result.model,
      },
      { headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    await recordAiUsage({
      userId: auth.userId,
      provider: agentConfig.provider,
      model: agentConfig.model || "unknown",
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
      action: "ai_generation",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The agent couldn't respond. Please try again.",
      },
      { status: 502 }
    );
  }
}
