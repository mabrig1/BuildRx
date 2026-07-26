import { NextResponse } from "next/server";

import { nvidiaChatModel } from "@/lib/ai/nvidia";
import { APP_BUILDER_SYSTEM_PROMPT, ANTHROPIC_CHAT_MODEL } from "@/lib/ai/prompts";
import {
  isAnyProviderConfigured,
  streamText,
  type ProviderMessage,
} from "@/lib/ai/provider";
import { recordAiUsage } from "@/lib/ai/usage";
import { withTimeout } from "@/lib/health/retry";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { chatMessageSchema } from "@/lib/validations/chat";

/**
 * Bounds every Supabase round trip made before the AI stream starts.
 * Those calls previously had no timeout at all: a single hung one (auth,
 * a query, an insert) burned the whole 300s function budget with no
 * diagnosable error, even though the AI-streaming section further down
 * already had its own deadline — this closes the gap.
 */
const DB_STEP_TIMEOUT_MS = 20_000;

export const maxDuration = 300;

/** Demo response streamed when no NVIDIA_API_KEY is configured. */
const MOCK_RESPONSE = `I'd love to help you build that! Here's how I'd approach it:

1. **Layout** — a clean page shell with a header and content area
2. **Data model** — we'll define the core entities and wire them to Supabase
3. **Components** — reusable UI pieces styled with Tailwind

Here's a starting point:

\`\`\`tsx
export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-semibold">Your app starts here</h1>
    </main>
  );
}
\`\`\`

*(This is a demo response — add your free \`NVIDIA_API_KEY\` from https://build.nvidia.com to .env.local for real AI generation.)*

What should we build first?`;

function mockStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  for (let i = 0; i < MOCK_RESPONSE.length; i += 12) {
    chunks.push(MOCK_RESPONSE.slice(i, i + 12));
  }
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
      await new Promise((resolve) => setTimeout(resolve, 15));
    },
  });
}

/** Temporary deployment check — confirms the route is live. */
export async function GET() {
  return Response.json({
    status: "API is working",
    message: "Chat endpoint is alive",
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { projectId, content } = parsed.data;

  // Demo mode: no Supabase → no persistence. Stream a real response
  // through the NVIDIA provider chain, otherwise the canned demo reply.
  if (!isSupabaseConfigured()) {
    if (isAnyProviderConfigured()) {
      try {
        const { stream, model, provider } = await streamText(
          [
            { role: "system", content: APP_BUILDER_SYSTEM_PROMPT },
            { role: "user", content },
          ],
          {
            maxTokens: 4096,
            // Chat wants low latency over depth — start on NVIDIA's fast
            // model rather than the heavier reasoning default.
            nvidiaModel: nvidiaChatModel(),
            anthropicModel: ANTHROPIC_CHAT_MODEL,
            timeoutMs: 270_000,
          }
        );
        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Model": model,
            "X-Provider": provider,
          },
        });
      } catch {
        // fall through to the demo response
      }
    }
    return new Response(mockStream(), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Persistence requires a real project id.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const supabase = await createClient();
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
  try {
    const auth = await withTimeout(
      () => supabase.auth.getUser(),
      DB_STEP_TIMEOUT_MS,
      "auth.getUser"
    );
    user = auth.data.user;
  } catch {
    return NextResponse.json(
      { error: "Authentication is taking too long to respond. Please try again." },
      { status: 504 }
    );
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checkAiRequestLimit } = await import("@/lib/billing/limits");
  let limitError: string | null;
  try {
    limitError = await withTimeout(
      () => checkAiRequestLimit(user!.id),
      DB_STEP_TIMEOUT_MS,
      "checkAiRequestLimit"
    );
  } catch {
    return NextResponse.json(
      { error: "Usage check is taking too long to respond. Please try again." },
      { status: 504 }
    );
  }
  if (limitError) {
    return NextResponse.json({ error: limitError }, { status: 402 });
  }

  // RLS also enforces this, but a explicit check gives a clean 404.
  let project: { id: string } | null;
  try {
    const result = await withTimeout(
      () => supabase.from("projects").select("id").eq("id", projectId).single(),
      DB_STEP_TIMEOUT_MS,
      "project lookup"
    );
    project = result.data;
  } catch {
    return NextResponse.json(
      { error: "The database is taking too long to respond. Please try again." },
      { status: 504 }
    );
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Persist the user's message.
  let insertError: { message: string } | null;
  try {
    const result = await withTimeout(
      () =>
        supabase.from("chat_messages").insert({
          project_id: projectId,
          user_id: user!.id,
          role: "user",
          content,
        }),
      DB_STEP_TIMEOUT_MS,
      "chat message insert"
    );
    insertError = result.error;
  } catch {
    return NextResponse.json(
      { error: "The database is taking too long to respond. Please try again." },
      { status: 504 }
    );
  }
  if (insertError) {
    const { classifyThrown } = await import("@/lib/health/error-response");
    const { logError } = await import("@/lib/health/logger");
    const diagnosed = classifyThrown(insertError, "database");
    await logError("chat", diagnosed.message, {
      code: diagnosed.code,
      subsystem: diagnosed.subsystem,
      context: { projectId, cause: diagnosed.cause },
    });
    return NextResponse.json(
      {
        error: diagnosed.message,
        code: diagnosed.code,
        subsystem: diagnosed.subsystem,
        cause: diagnosed.cause,
        suggestedFix: diagnosed.suggestedFix,
      },
      { status: 500 }
    );
  }

  // Load conversation history (including the message just inserted).
  let history: Array<{ role: string; content: string }> | null;
  try {
    const result = await withTimeout(
      () =>
        supabase
          .from("chat_messages")
          .select("role, content")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true })
          .limit(50),
      DB_STEP_TIMEOUT_MS,
      "chat history load"
    );
    history = result.data;
  } catch {
    return NextResponse.json(
      { error: "The database is taking too long to respond. Please try again." },
      { status: 504 }
    );
  }

  const messages: ProviderMessage[] = [
    { role: "system", content: APP_BUILDER_SYSTEM_PROMPT },
    ...(history ?? [])
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  ];

  async function persistAssistantMessage(
    text: string,
    generation: {
      promptTokens: number;
      completionTokens: number;
      durationMs: number;
      status: "completed" | "failed";
      error?: string;
      model?: string;
    }
  ) {
    const supabase = await createClient();
    const { data: message } = await supabase
      .from("chat_messages")
      .insert({
        project_id: projectId,
        role: "assistant",
        content: text,
      })
      .select("id")
      .single();

    await recordAiUsage({
      userId: user!.id,
      projectId,
      messageId: message?.id ?? null,
      model: generation.model ?? nvidiaChatModel(),
      status: generation.status,
      promptTokens: generation.promptTokens,
      completionTokens: generation.completionTokens,
      durationMs: generation.durationMs,
      error: generation.error,
      action: "ai_message",
    });
  }

  // No provider configured at all → mock stream, but still persist both sides.
  if (!isAnyProviderConfigured()) {
    const upstream = mockStream();
    const [toClient, toPersist] = upstream.tee();
    void (async () => {
      const text = await new Response(toPersist).text();
      await persistAssistantMessage(text, {
        promptTokens: 0,
        completionTokens: 0,
        durationMs: 0,
        status: "completed",
      });
    })();
    return new Response(toClient, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const startedAt = Date.now();

  // Vercel hard-kills this function at maxDuration (300s) with no
  // chance to respond, which is exactly what left users staring at an
  // infinite spinner. This bounds both the time spent trying models in
  // the NVIDIA fallback chain and, once one is selected, its own
  // generation time.
  const DEADLINE_MS = 270_000;

  try {
    const { stream, model, provider, completion } = await withTimeout(
      () =>
        streamText(messages, {
          // Chat replies should be conversational, not a full app dump
          // (see APP_BUILDER_SYSTEM_PROMPT: "keep responses concise").
          maxTokens: 8192,
          nvidiaModel: nvidiaChatModel(),
          anthropicModel: ANTHROPIC_CHAT_MODEL,
          timeoutMs: DEADLINE_MS,
        }),
      DEADLINE_MS,
      "AI provider selection"
    );

    void completion
      .then((result) =>
        persistAssistantMessage(result.text, {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          durationMs: Date.now() - startedAt,
          status: "completed",
          model: result.model,
        })
      )
      .catch(async (error) => {
        const { classifyThrown } = await import("@/lib/health/error-response");
        const { logError } = await import("@/lib/health/logger");
        const diagnosed = classifyThrown(error, "ai");
        await logError("chat", diagnosed.message, {
          code: diagnosed.code,
          subsystem: diagnosed.subsystem,
          context: { projectId, cause: diagnosed.cause },
        });
        await persistAssistantMessage(
          error instanceof Error ? error.message : "The AI request failed.",
          {
            promptTokens: 0,
            completionTokens: 0,
            durationMs: Date.now() - startedAt,
            status: "failed",
            error: diagnosed.cause,
          }
        );
      });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Model": model,
        "X-Provider": provider,
      },
    });
  } catch (error) {
    // Every configured provider failed before any response could start.
    const { classifyThrown } = await import("@/lib/health/error-response");
    const { logError } = await import("@/lib/health/logger");
    const diagnosed = classifyThrown(error, "ai");
    await logError("chat", diagnosed.message, {
      code: diagnosed.code,
      subsystem: diagnosed.subsystem,
      context: { projectId, cause: diagnosed.cause },
    });
    const message = `${diagnosed.message} ${diagnosed.suggestedFix ?? ""}`.trim();
    await persistAssistantMessage(message, {
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startedAt,
      status: "failed",
      error: diagnosed.cause,
    });
    return NextResponse.json(
      {
        error: diagnosed.message,
        code: diagnosed.code,
        subsystem: diagnosed.subsystem,
        cause: diagnosed.cause,
        suggestedFix: diagnosed.suggestedFix,
      },
      { status: 500 }
    );
  }
}
